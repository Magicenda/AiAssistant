import time
import os
import uuid
import asyncio
import aiofiles
from fastapi import UploadFile, HTTPException, status

import edge_tts

from schemas import AudioFileMetadata

STORAGE_DIR = "storage/audio"

CHUNK_SIZE = 64 * 1024  # 64KB
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB



class FileStorageService:
    def __init__(self):
        os.makedirs(STORAGE_DIR, exist_ok=True)

    async def save_incoming_audio(self, upload_file: UploadFile) -> AudioFileMetadata:
        ext = os.path.splitext(upload_file.filename or "voice.webm")[1] or ".webm"
        file_id = f"in_{uuid.uuid4()}{ext}"
        file_path = os.path.join(STORAGE_DIR, file_id)
        total_size = 0

        try:
            async with aiofiles.open(file_path, "wb") as out_file:
                while chunk := await upload_file.read(CHUNK_SIZE):
                    total_size += len(chunk)
                    if total_size > MAX_FILE_SIZE:
                        raise HTTPException(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Превышен максимальный размер файла (25 МБ)"
                        )
                    await out_file.write(chunk)

            return AudioFileMetadata(
                file_id=file_id,
                original_filename=upload_file.filename or "voice.webm",
                content_type=upload_file.content_type or "audio/webm",
                size_bytes=total_size
            )
        except Exception as e:
            if os.path.exists(file_path):
                os.remove(file_path)
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=400, detail=f"Ошибка сохранения файла: {e}")
        finally:
            await upload_file.close()

    async def save_outgoing_audio(self, job_id: uuid.UUID, audio_bytes: bytes) -> str:
        file_id = f"out_{job_id}.mp3"
        file_path = os.path.join(STORAGE_DIR, file_id)
        async with aiofiles.open(file_path, "wb") as out_file:
            await out_file.write(audio_bytes)
        return file_id

    def get_file_path(self, file_id: str) -> str:
        safe_name = os.path.basename(file_id)
        path = os.path.join(STORAGE_DIR, safe_name)
        if not os.path.exists(path):
            raise HTTPException(status_code=404, detail="Аудиофайл не найден")
        return path

    def delete_file(self, file_id: str) -> None:
        try:
            os.remove(os.path.join(STORAGE_DIR, os.path.basename(file_id)))
        except FileNotFoundError:
            pass


class TTSService:
    def __init__(self, voice: str = "ru-RU-SvetlanaNeural", rate: str = "+0%"):
        self.voice = voice
        self.rate = rate

    async def synthesize_speech(self, text_to_speech: str) -> bytes:
        if not text_to_speech or not text_to_speech.strip():
            raise ValueError("Text to speech cannot be empty")
        
        communicate = edge_tts.Communicate(text=text_to_speech, voice=self.voice, rate=self.rate)

        audio_buffer = bytearray()
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_buffer.extend(chunk["data"])
        if not audio_buffer:
            raise RuntimeError("Failed to generate audio from text")
        return bytes(audio_buffer)