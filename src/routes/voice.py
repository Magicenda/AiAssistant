from uuid import UUID
from pydantic import BaseModel, Field
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from schemas import AssistantVoiceJobResult, JobStatus
from services.orchestrator import voice_orchestrator

router = APIRouter(prefix="/api/voice", tags=["Text to Voice Pipeline"])


class TextToVoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Готовый текст от LLM для озвучки")


class VoiceJobCreatedResponse(BaseModel):
    job_id: UUID
    status: JobStatus


@router.post("/generate", response_model=VoiceJobCreatedResponse, status_code=202)
async def generate_voice_from_text(
    payload: TextToVoiceRequest,
    background_tasks: BackgroundTasks
):
    job_id = voice_orchestrator.create_job(payload.text)

    background_tasks.add_task(
        voice_orchestrator.run_tts_worker,
        job_id,
        payload.text
    )

    return VoiceJobCreatedResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/jobs/{job_id}", response_model=AssistantVoiceJobResult)
async def get_voice_generation_status(job_id: UUID):
    job = voice_orchestrator.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return job


@router.get("/jobs/{job_id}/audio")
async def download_audio_binary(job_id: UUID):
    job = voice_orchestrator.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Аудио еще не готово. Статус: {job.status}")

    file_path = voice_orchestrator.get_output_audio_path(job_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Файл озвучки не найден")

    # Отдаем бинарник фронту, а после отправки фоном чистим файлы старше 15 минут
    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=f"response_{job_id}.mp3",
        background=BackgroundTask(voice_orchestrator.storage.cleanup_old_files, 900)
    )