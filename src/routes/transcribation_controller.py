from services.transcribation_service import AudioService
from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel


router = APIRouter(prefix="/chat", tags=["audio"])

audio_service_instance = AudioService(language="ru", model_size="base")

def get_audio_service() -> AudioService:
    return audio_service_instance

class TranscriptionResponse(BaseModel):
    text: str

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    service: AudioService = Depends(get_audio_service),
    file: UploadFile = File(...)
) -> TranscriptionResponse:
    audio_bytes = await file.read()
    transcription_text = service.recognize_from_bytes(audio_bytes)
    return TranscriptionResponse(text=transcription_text)