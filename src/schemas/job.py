from pydantic import BaseModel, Field
from enum import Enum
from typing import Optional
from uuid import UUID

from .enums import JobStatus



class JobCreatedResponse(BaseModel):
    job_id: UUID
    status: JobStatus

class JobBaseStatusResponse(BaseModel):
    job_id: UUID
    status: JobStatus
    error: Optional[str] = Field(default=None, description="текст ошибки")
