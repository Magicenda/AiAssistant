import uuid
from typing import Dict
from uuid import UUID

from schemas import JobStatus, AssistantVoiceJobResult
from services.tts_services import TTSService, FileStorageService

class VoiceGenerationOrchestrator:
    def __init__(self, storage: FileStorageService, tts_service: TTSService):
        self.storage = storage
        self.tts_service = tts_service
        self._job: Dict[UUID, AssistantVoiceJobResult] = {}
        self._output_files: Dict[UUID, str] = {}

    def create_job(self, text_to_convert: str) -> UUID:
        job_id = uuid.uuid4()
        self._job[job_id] = AssistantVoiceJobResult(
            job_id=job_id,
            status=JobStatus.PENDING,
            agent_reply=text_to_convert
        )
        return job_id

    def get_job_status(self, job_id: UUID) -> AssistantVoiceJobResult | None:
        return self._job.get(job_id)

    def get_output_audio_path(self, job_id: UUID) -> str | None:
        file_id = self._output_files.get(job_id)
        if not file_id:
            return None
        return self.storage.get_file_path(file_id)

    async def run_tts_worker(self, job_id: UUID, text: str) -> None:
        print(f"Запуск TTS воркера для job_id: {job_id}")
        job = self._job[job_id]
        job.status = JobStatus.PROCESSING

        try:
            audio_bytes = await self.tts_service.synthesize_speech(text)
            file_id = await self.storage.save_outgoing_audio(job_id, audio_bytes)
            self._output_files[job_id] = file_id

            job.audio_binary_url = f"/api/voice/jobs/{job_id}/audio"
            job.status = JobStatus.COMPLETED
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error = str(e)

