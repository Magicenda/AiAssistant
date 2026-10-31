import asyncio
import io
from dataclasses import dataclass

from faster_whisper import WhisperModel


@dataclass
class TranscribationResult:
    status: bool  # true — успешно, false — ошибка
    text: str


class AudioService:
    def __init__(
        self,
        language: str = "RU",
        model_size: str = "small",
        compute_type: str = "int8",
        cpu_threads: int = 4,
        beam_size: int = 1,
        max_concurrent: int = 1,
        vad_min_silence_ms: int = 500,
    ):
        self.language = language.lower()
        self.beam_size = beam_size
        self.vad_min_silence_ms = vad_min_silence_ms
        self._semaphore = asyncio.Semaphore(max_concurrent)
        # int8 на CPU заметно быстрее float32; для коротких голосовых реплик точности хватает.
        self.model = WhisperModel(
            model_size,
            device="cpu",
            compute_type=compute_type,
            cpu_threads=cpu_threads,
            num_workers=1,
        )

    def _transcribe(self, audio_bytes: bytes) -> str:
        segments, _info = self.model.transcribe(
            io.BytesIO(audio_bytes),
            language=self.language,
            beam_size=self.beam_size,
            best_of=1,
            vad_filter=True,
            vad_parameters={"min_silence_duration_ms": self.vad_min_silence_ms},
            condition_on_previous_text=False,
            without_timestamps=True,
        )
        return "".join(segment.text for segment in segments).strip()

    async def recognize_from_bytes(self, audio_bytes: bytes) -> TranscribationResult:
        # распознавание синхронное и тяжёлое: в отдельном потоке, чтобы не блокировать event loop
        # Одно распознавание за раз не даёт нескольким запросам одновременно занять всю RAM и CPU.
        async with self._semaphore:
            text = await asyncio.to_thread(self._transcribe, audio_bytes)
        return TranscribationResult(status=bool(text), text=text)

    async def change_language(self, new_language: str):
        if len(new_language) == 2:
            self.language = new_language.lower()
