from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import Field, BaseModel, ConfigDict

from .enums import RecordType

class RecordCreateBase(BaseModel):
    description: str = Field(..., max_length=255, description="Описание задачи и встречи")
    deadline: datetime = Field(..., description="Дедлайн задачи и встречи")

class TaskCreate(RecordCreateBase):
    status: RecordType = RecordType.TASK

class MeetingCreate(RecordCreateBase):
    pass