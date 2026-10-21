from pydantic import BaseModel, Field
from datetime import datetime

class CreateTaskArgs(BaseModel):
    description: str = Field(description="Что нужно сделать")
    deadline: datetime | None = Field(default=None, description="Срок выполнения, ISO 8601")
