from services.transcribation_service import AudioService
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, status, Depends
from pydantic import BaseModel, Field, field_validatorl
from deps import get_audio_service

class UserSpeechInputDTO:
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 МБ

    def __init__(
        self,
        chat_id: int = Form(..., description="Уникальный ID чата"),
        file: UploadFile = File(..., description="Бинарный файл аудиозаписи")
    ):
        self.chat_id = chat_id
        self.file = file
        self.original_filename = file.filename
        
        self._validate()

    def _validate(self):
        if not self.file.content_type or not self.file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Переданный файл не является валидным аудиофайлом."
            )


router = APIRouter(prefix="/chat", tags=["audio"])

class TranscriptionResponse(BaseModel):
    text: str

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    service: AudioService = get_audio_service,
    payload: UserSpeechAudioDTO = Depends(),
) -> TranscriptionResponse:
    audio_bytes = await payload.file.read()

    if len(audio_bytes) > payload.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Размер аудиофайла превышает лимит в 25 МБ."
        )
    if len(audio_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Передан пустой файл."
        )

    transcription = await service.recognize_from_bytes(audio_bytes)
    return TranscriptionResponse(text=transcription.text)