from enum import Enum
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, field_validator

from .job import JobStatus, JobCreatedResponse, JobBaseStatusResponse
from .ticket_response import TaskResponse, MeetingResponse
from .enums import AudioFormat, IntentType

import base64



class AudioFileMetadata(BaseModel):
    file_id: str = Field(...,description="Уникальный id файла")
    original_filename: str = Field(..., description="исходное имя полученного файла")
    content_type: AudioFormat = Field(..., description="MIME_type файла")
    size_byte: int = Field(..., gt=0, le=25*1024*1024,description="Максимальный размер файла 25мб")

    @field_validator
    @classmethod
    def clean_mime_type(cls, v: str) -> str:
        if isinstance(v, str):
            return v.split(";")[0].strip().lower()
        return v

class AudioJobCreatedResponse(JobCreatedResponse):
    file_id: str = Field(..., description="ID сохраненного бинарника")

class AssiastantVoiceJobResult(JobBaseStatusResponse):
    file_id: Optional[str] = None

    transcribed_text: Optional[str] = Field(default=None, description="расшифрованный текст")
    agent_reply_text: Optional[str] = Field(default=None, description="текстовый ответ от агента")
    detected_intent: Optional[IntentType] = Field(default= None, description="Какой сценарий сработал")

    audio_binary_url: Optional[str] = Field(default=None)
    reply_audio_mime: AudioFormat = Field(default=AudioFormat.MP3)
    reply_audio_base64: Optional[str] = Field(default=None)

    created_task: Optional[TaskResponse] = None
    created_meeting: Optional[MeetingResponse] = None


