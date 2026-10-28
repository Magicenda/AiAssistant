from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from deps import AudioServiceDep, SpeechInputDep


router = APIRouter(prefix="/audio", tags=["audio"])

class TranscriptionResponse(BaseModel):
    text: str

@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    service: AudioServiceDep,
    payload: SpeechInputDep,
) -> TranscriptionResponse:
    audio_bytes = await payload.read_audio()

    transcription = await service.recognize_from_bytes(audio_bytes)
    if not transcription.status:
        raise HTTPException(
            status_code=422,
            detail="Речь не распознана",
        )
    return TranscriptionResponse(text=transcription.text)
