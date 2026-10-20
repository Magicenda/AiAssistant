import os
import uuid
import asyncio
import aiofiles
from fastapi import UploadFile, HTTPException, status

from src.schemas import AudioFileMetadata

STORAGE_DIR = "storage/audio"

os.makedirs(STORAGE_DIR, exist_ok=True)

class FileStorageService:
    async def save_outgoing_audio(self,job_id:uuid.UUID,audio_bytes:bytes) -> str:
        file_id = f"out_{job_id}.mp3"
        file_path = os.path.join(STORAGE_DIR, file_id)
        async with aiofiles.open(file_path,"wb") as f:
            await f.write(audio_bytes)
        return file_id

    def get_file_path(self, file_id: str) -> str:
        safe_name = os.path.basename(file_id)
        path = os.path.join(STORAGE_DIR, safe_name)
        if not os.path.exists(path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
        return path

class TTSService:

    async def synthesize_speech(self, text: str) -> bytes:
        await asyncio.sleep(1.0)

        return b"ID3...fake_mp3_binary_stream_from_tts..."