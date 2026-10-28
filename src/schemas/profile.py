from datetime import datetime

from pydantic import BaseModel, ConfigDict

from db.models import Type


class TaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    type: Type
    description: str
    deadline: datetime | None
    created_at: datetime


class MeetingOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    appointment: datetime
    created_at: datetime
