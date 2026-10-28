import asyncio
import logging
import time
import uuid
from dataclasses import dataclass, field
from uuid import UUID

from gigachat import GigaChat
from sqlalchemy.ext.asyncio import async_sessionmaker

from schemas import JobStatus, AssistantVoiceJobResult
from services.agent_factory import build_agent_service
from services.transcribation_service import AudioService
from services.tts_services import TTSService, FileStorageService

logger = logging.getLogger(__name__)

JOB_TTL_SECONDS = 15 * 60          # сколько живёт завершённая задача вместе с аудиофайлом
PIPELINE_TIMEOUT_SECONDS = 180     # предел на весь цикл: распознавание + агент + озвучка


class PipelineError(Exception):
    """Ошибка, текст которой безопасно показать клиенту."""


@dataclass
class _JobEntry:
    result: AssistantVoiceJobResult
    created_at: float = field(default_factory=time.monotonic)
    file_id: str | None = None


class VoiceGenerationOrchestrator:
    def __init__(
        self,
        storage: FileStorageService,
        tts_service: TTSService,
        audio_service: AudioService,
        llm: GigaChat,
        session_factory: async_sessionmaker,
    ):
        self.storage = storage
        self.tts_service = tts_service
        self.audio_service = audio_service
        self.llm = llm
        self.session_factory = session_factory
        self._jobs: dict[UUID, _JobEntry] = {}

    def create_job(self, text_to_convert: str | None = None) -> UUID:
        job_id = uuid.uuid4()
        self._jobs[job_id] = _JobEntry(
            AssistantVoiceJobResult(
                job_id=job_id,
                status=JobStatus.PENDING,
                agent_reply_text=text_to_convert,
            )
        )
        return job_id

    def get_job_status(self, job_id: UUID) -> AssistantVoiceJobResult | None:
        entry = self._jobs.get(job_id)
        if entry is None:
            return None
        if self._is_expired(entry):
            self._remove(job_id)
            return None
        return entry.result

    def get_output_audio_path(self, job_id: UUID) -> str | None:
        entry = self._jobs.get(job_id)
        if entry is None or not entry.file_id:
            return None
        return self.storage.get_file_path(entry.file_id)

    def cleanup_expired(self) -> None:
        for job_id in [j for j, e in self._jobs.items() if self._is_expired(e)]:
            self._remove(job_id)

    def _is_expired(self, entry: _JobEntry) -> bool:
        # только завершённые: задачу в работе удалять нельзя, воркер ещё пишет в неё
        finished = entry.result.status in (JobStatus.COMPLETED, JobStatus.FAILED)
        return finished and time.monotonic() - entry.created_at > JOB_TTL_SECONDS

    def _remove(self, job_id: UUID) -> None:
        entry = self._jobs.pop(job_id, None)
        if entry and entry.file_id:
            self.storage.delete_file(entry.file_id)

    async def run_tts_worker(self, job_id: UUID, text: str) -> None:
        """Озвучка готового текста (эндпоинты /voice/generate и /llm/query_and_voice)."""
        entry = self._jobs[job_id]
        try:
            await asyncio.wait_for(self._speak(job_id, entry, text), PIPELINE_TIMEOUT_SECONDS)
        except Exception as e:
            self._fail(entry, e)

    async def run_pipeline(self, job_id: UUID, audio_bytes: bytes, chat_id: int) -> None:
        """Полный цикл: речь пользователя -> текст -> ответ агента -> аудио ответа."""
        entry = self._jobs[job_id]
        try:
            await asyncio.wait_for(
                self._run_stages(job_id, entry, audio_bytes, chat_id), PIPELINE_TIMEOUT_SECONDS
            )
        except Exception as e:
            self._fail(entry, e)

    async def _run_stages(
        self, job_id: UUID, entry: _JobEntry, audio_bytes: bytes, chat_id: int
    ) -> None:
        job = entry.result

        job.status = JobStatus.TRANSCRIBING
        transcription = await self.audio_service.recognize_from_bytes(audio_bytes)
        if not transcription.status:
            raise PipelineError("Речь не распознана")
        job.transcript = transcription.text

        job.status = JobStatus.THINKING
        # воркер живёт дольше запроса, поэтому сессия БД у него своя
        async with self.session_factory() as session:
            agent = build_agent_service(self.llm, session)
            job.agent_reply_text = await agent.generate_response(chat_id, transcription.text)
            await session.commit()

        await self._speak(job_id, entry, job.agent_reply_text)

    async def _speak(self, job_id: UUID, entry: _JobEntry, text: str) -> None:
        job = entry.result
        job.status = JobStatus.SPEAKING
        audio_bytes = await self.tts_service.synthesize_speech(text)
        entry.file_id = await self.storage.save_outgoing_audio(job_id, audio_bytes)

        job.audio_binary_url = f"/api/voice/jobs/{job_id}/audio"
        job.status = JobStatus.COMPLETED

    @staticmethod
    def _fail(entry: _JobEntry, exc: Exception) -> None:
        if isinstance(exc, PipelineError):
            message = str(exc)
        elif isinstance(exc, TimeoutError):
            message = "Превышено время обработки"
        else:
            logger.exception("Ошибка обработки голосового запроса", exc_info=exc)
            message = "Не удалось обработать запрос"
        entry.result.status = JobStatus.FAILED
        entry.result.error = message
