from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field, model_validator

from core.time import as_moscow


MoscowDatetime = Annotated[datetime, AfterValidator(as_moscow)]


class CreateTaskArgs(BaseModel):
    description: str = Field(description="Что нужно сделать")
    deadline: MoscowDatetime = Field(
        description=(
            "Обязательный срок выполнения в формате ISO 8601, например "
            "2026-10-24T18:00:00. Если дата или время неизвестны, сначала уточни их у пользователя "
            "и не вызывай create_task"
        ),
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
        description="Номер задачи. Если пользователь его не назвал, сначала вызови list_tasks с kind=task и найди id",
    )
    description: str | None = Field(
        default=None,
        description="Новый текст задачи. Не указывай, если текст менять не нужно",
    )
    deadline: MoscowDatetime | None = Field(
        default=None,
        description="Новый срок в формате ISO 8601, например 2026-10-24T18:00:00. Не указывай, если срок менять не нужно",
    )
    @model_validator(mode="after")
    def _require_change(self):
        if self.description is None and self.deadline is None:
            raise ValueError("Укажи хотя бы одно поле для изменения: description или deadline")
        return self


class UpdateReminderArgs(BaseModel):
    reminder_id: int = Field(
        ge=1,
        description=(
            "Номер напоминания. Если пользователь его не назвал, сначала вызови list_tasks "
            "с kind=notify и найди id"
        ),
    )
    description: str | None = Field(
        default=None,
        description="Новый текст напоминания. Не указывай, если текст менять не нужно",
    )
    remind_at: MoscowDatetime | None = Field(
        default=None,
        description=(
            "Новое время напоминания в формате ISO 8601, например 2026-11-01T15:00:00. "
            "Не указывай, если время менять не нужно"
        ),
    )

    @model_validator(mode="after")
    def _require_change(self):
        if self.description is None and self.remind_at is None:
            raise ValueError("Укажи хотя бы одно поле для изменения: description или remind_at")
        return self


class DeleteTaskArgs(BaseModel):
    task_id: int = Field(
        ge=1,
        description="Номер задачи или напоминания. Если пользователь его не назвал, сначала вызови list_tasks и найди id",
    )

