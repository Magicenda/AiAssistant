from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, model_validator

from core.time import as_moscow


MoscowDatetime = Annotated[datetime, AfterValidator(as_moscow)]


class CreateTaskArgs(BaseModel):
    description: str = Field(description="Что нужно сделать")
    deadline: MoscowDatetime | None = Field(
        default=None,
        description="Срок выполнения в формате ISO 8601, например 2026-10-24T18:00:00. Не указывай, если пользователь не назвал срок",
    )


class CreateReminderArgs(BaseModel):
    description: str = Field(description="О чём напомнить")
    remind_at: MoscowDatetime = Field(
        description="Когда напомнить, формат ISO 8601, например 2026-10-24T09:30:00",
    )


class ListTasksArgs(BaseModel):
    kind: Literal["task", "notify"] | None = Field(
        default=None,
        description="Фильтр: task - только задачи, notify - только напоминания. Без значения вернутся и те и другие",
    )
    only_upcoming: bool = Field(
        default=False,
        description="Только записи со сроком в будущем",
    )
    limit: int = Field(default=20, ge=1, le=50, description="Сколько записей вернуть, не больше 50")


class CreateMeetingArgs(BaseModel):
    description: str = Field(description="Тема или описание встречи")
    appointment: MoscowDatetime = Field(
        description="Дата и время встречи в формате ISO 8601, например 2026-10-25T15:00:00",
    )


class UpdateTaskArgs(BaseModel):
    task_id: int = Field(
        description="Номер задачи или напоминания. Если пользователь его не назвал, сначала вызови list_tasks и найди id",
    )
    description: str | None = Field(
        default=None,
        description="Новый текст задачи. Не указывай, если текст менять не нужно",
    )
    deadline: MoscowDatetime | None = Field(
        default=None,
        description="Новый срок в формате ISO 8601, например 2026-10-24T18:00:00. Не указывай, если срок менять не нужно",
    )
    clear_deadline: bool = Field(
        default=False,
        description="true, если пользователь просит убрать срок у задачи",
    )

    @model_validator(mode="after")
    def _require_change(self):
        if self.description is None and self.deadline is None and not self.clear_deadline:
            raise ValueError("Укажи хотя бы одно поле для изменения: description, deadline или clear_deadline")
        if self.deadline is not None and self.clear_deadline:
            raise ValueError("Нельзя одновременно задать новый срок и убрать срок")
        return self


class DeleteTaskArgs(BaseModel):
    task_id: int = Field(
        ge=1,
        description="Номер задачи или напоминания. Если пользователь его не назвал, сначала вызови list_tasks и найди id",
    )

