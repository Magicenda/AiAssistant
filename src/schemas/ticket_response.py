from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

from .enums import RecordType

class RecordCreateBase(BaseModel):
    description: str = Field(..., max_length=255, description="Описание задачи и встречи")
    deadline: datetime = Field(..., description="Дедлайн задачи и встречи")

#Схемы для ответа фронту
class TaskResponse(BaseModel):
    id: int
    description: str
    deadline: datetime
    created_at: datetime
    status: RecordType

    model_config = ConfigDict(from_attributes=True)

class MeetingResponse(BaseModel):
    id: int
    description: str
    deadline: datetime
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


