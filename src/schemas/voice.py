from pydantic import BaseModel
from uuid import UUID
from schemas.enums import JobStatus


class VoiceJobCreatedResponse(BaseModel):
    job_id: UUID
    status: JobStatus
