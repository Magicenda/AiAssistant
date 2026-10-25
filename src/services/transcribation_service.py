import io
from faster_whisper import WhisperModel

class TranscribationResult:
    status: bool # true - успешно, false - проввал
    text: str


class AudioService:
    def __init__(self, language: str = "RU", model_size: str = "base"):
        self.language = language.lower()
        self.model = WhisperModel(model_size, device="cpu", compute_type="float32")

    async def recognize_from_bytes(self, audio_bytes: bytes) -> TranscribationResult:
        audio_file = io.BytesIO(audio_bytes)
        segments, _info = self.model.transcribe(audio_file, language=self.language)

        text_segments = [segment.text for segment in segments]
        text = "".join(text_segments).strip()

        if not text:
            return TranscribationResult(
                status = False,
                text = ''
            )

        return TranscribationResult(
            status = True,
            text = text 
        )

    async def change_language(self, new_language: str):
        if len(new_language) == 2:
            self.language = new_language.lower()