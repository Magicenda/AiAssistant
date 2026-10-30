from uuid import UUID
from pydantic import BaseModel, Field
from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, StreamingResponse

from schemas import (
    AssistantVoiceJobResult,
    JobStatus,
    SpeechStreamResponse,
    VoiceJobCreatedResponse,
)
from deps import ChatServiceDep, CurrentUserIdDep, SpeechInputDep, TTSServiceDep, VoiceOrchestratorDep
from services.speech_stream import STREAM_TTL_SECONDS, SpeechStreamRegistry

router = APIRouter(prefix="/voice", tags=["Text to Voice Pipeline"])
speech_streams = SpeechStreamRegistry()


class TextToVoiceRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Готовый текст от LLM для озвучки")


@router.post("/generate", response_model=VoiceJobCreatedResponse, status_code=202)
async def generate_voice_from_text(
    payload: TextToVoiceRequest,
    background_tasks: BackgroundTasks,
    voice_orchestrator: VoiceOrchestratorDep,
    user_id: CurrentUserIdDep,
):
    job_id = voice_orchestrator.create_job(user_id, payload.text)

    background_tasks.add_task(
        voice_orchestrator.run_tts_worker,
        job_id,
        payload.text
    )

    return VoiceJobCreatedResponse(job_id=job_id, status=JobStatus.PENDING)


@router.post("/stream", response_model=SpeechStreamResponse)
async def create_speech_stream(
    payload: TextToVoiceRequest,
    user_id: CurrentUserIdDep,
):
    """Создаёт короткоживущую ссылку на потоковую озвучку текста."""
    stream_id = speech_streams.create(user_id, payload.text)
    return SpeechStreamResponse(
        stream_url=f"/api/voice/stream/{stream_id}",
        expires_in=STREAM_TTL_SECONDS,
    )


@router.get("/stream/{stream_id}")
async def stream_speech_audio(stream_id: str, tts: TTSServiceDep):
    """Отдаёт mp3 по мере синтеза: браузер начинает говорить без ожидания конца."""
    item = speech_streams.get(stream_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Озвучка не найдена или устарела")
    return StreamingResponse(
        tts.stream_speech(item.text),
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-store"},
    )


@router.post("/ask", response_model=VoiceJobCreatedResponse, status_code=202)
async def ask_by_voice(
    payload: SpeechInputDep,
    background_tasks: BackgroundTasks,
    chat_service: ChatServiceDep,
    voice_orchestrator: VoiceOrchestratorDep,
    user_id: CurrentUserIdDep,
):
    audio_bytes = await payload.read_audio()
    model_settings = payload.read_model_settings()
    await chat_service.get_history(payload.chat_id, limit=1)    # 404, если чата нет

    job_id = voice_orchestrator.create_job(user_id)
    background_tasks.add_task(
        voice_orchestrator.run_pipeline,
        job_id,
        audio_bytes,
        payload.chat_id,
        user_id,
        model_settings,
        payload.speak,
        payload.timezone,
    )

    return VoiceJobCreatedResponse(job_id=job_id, status=JobStatus.PENDING)


@router.get("/jobs/{job_id}", response_model=AssistantVoiceJobResult)
async def get_voice_generation_status(
    job_id: UUID, voice_orchestrator: VoiceOrchestratorDep, user_id: CurrentUserIdDep
):
    job = voice_orchestrator.get_job_status(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    return job


@router.get("/jobs/{job_id}/audio")
async def download_audio_binary(
    job_id: UUID, voice_orchestrator: VoiceOrchestratorDep, user_id: CurrentUserIdDep
):
    job = voice_orchestrator.get_job_status(job_id, user_id)
    if not job:
        raise HTTPException(status_code=404, detail="Задача не найдена")
    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail=f"Аудио еще не готово. Статус: {job.status}")

    file_path = voice_orchestrator.get_output_audio_path(job_id)
    if not file_path:
        raise HTTPException(status_code=404, detail="Файл озвучки не найден")

    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=f"response_{job_id}.mp3",
    )