from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, model_validator


Description = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)]


class PlannerInput(BaseModel):
    model_config = ConfigDict(extra="forbid")


class TaskCreate(PlannerInput):
    description: Description
    deadline: datetime


class MeetingCreate(PlannerInput):
    description: Description
    appointment: datetime


class PartialUpdate(PlannerInput):
    @model_validator(mode="after")
    def validate_changes(self):
        if not self.model_fields_set:
            raise ValueError("Укажите хотя бы одно поле для обновления")
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"Поле {name} не может быть null")
        return self


class TaskPatch(PartialUpdate):
    description: Description | None = None
    deadline: datetime | None = None


class MeetingPatch(PartialUpdate):
    description: Description | None = None
    appointment: datetime | None = None
