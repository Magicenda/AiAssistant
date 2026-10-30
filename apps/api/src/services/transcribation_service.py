import asyncio
import io
from dataclasses import dataclass

from faster_whisper import WhisperModel


@dataclass
class TranscribationResult:
    status: bool # true - успешно, false - проввал
    text: str


class AudioService:
    def __init__(
        self,
        language: str = "RU",
        model_size: str = "base",
        compute_type: str = "int8",
    ):
        self.language = language.lower()
        # int8 на CPU заметно быстрее float32; для коротких голосовых реплик точности хватает.
        self.model = WhisperModel(model_size, device="cpu", compute_type=compute_type, cpu_threads=0)

    def _transcribe(self, audio_bytes: bytes) -> str:
        segments, _info = self.model.transcribe(
            io.BytesIO(audio_bytes),
            language=self.language,
            beam_size=5,
            vad_filter=True,
            condition_on_previous_text=False,
        )
        return "".join(segment.text for segment in segments).strip()

    async def recognize_from_bytes(self, audio_bytes: bytes) -> TranscribationResult:
        # распознавание синхронное и тяжёлое: в отдельном потоке, чтобы не блокировать event loop
        text = await asyncio.to_thread(self._transcribe, audio_bytes)
        return TranscribationResult(status=bool(text), text=text)

    async def change_language(self, new_language: str):
        if len(new_language) == 2:
            self.language = new_language.lower()
