from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from schemas.enums import JobStatus


class VoiceJobCreatedResponse(BaseModel):
    job_id: UUID
    status: JobStatus


class AssistantVoiceJobResult(BaseModel):
    job_id: UUID
    status: JobStatus
    error: Optional[str] = Field(default=None, description="текст ошибки")
    transcript: Optional[str] = Field(default=None, description="распознанная речь пользователя")
    agent_reply_text: Optional[str] = Field(default=None, description="текстовый ответ от агента")
    audio_binary_url: Optional[str] = Field(default=None, description="ссылка на готовое аудио")
