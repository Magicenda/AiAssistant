from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Annotated, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import AfterValidator, BaseModel, Field, model_validator


def resolve_timezone(name: str | None) -> ZoneInfo:
    """Возвращает часовой пояс по IANA-имени; при ошибке — UTC."""
    if not name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


# Модель может вернуть время без смещения. Валидатор аргументов инструмента
# трактует такое время в часовом поясе пользователя, переданном фронтендом.
tool_timezone: ContextVar[ZoneInfo] = ContextVar("tool_timezone", default=ZoneInfo("UTC"))


def _ensure_utc(value: datetime) -> datetime:
    # Модель может прислать время без часового пояса, а в БД колонки с timezone=True.
    if value.tzinfo is None:
        value = value.replace(tzinfo=tool_timezone.get())
    return value.astimezone(timezone.utc)


AwareDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]


class CreateTaskArgs(BaseModel):
    description: str = Field(description="Что нужно сделать")
    deadline: AwareDatetime | None = Field(
        default=None,
        description="Срок выполнения в формате ISO 8601 с часовым смещением, например 2026-10-24T18:00:00+03:00. Не указывай, если пользователь не назвал срок",
    )


class CreateReminderArgs(BaseModel):
    description: str = Field(description="О чём напомнить")
    remind_at: AwareDatetime = Field(
        description="Когда напомнить, ISO 8601 с часовым смещением, например 2026-10-24T09:30:00+03:00",
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
    appointment: AwareDatetime = Field(
        description="Дата и время встречи в ISO 8601 с часовым смещением, например 2026-10-25T15:00:00+03:00",
    )


class UpdateTaskArgs(BaseModel):
    task_id: int = Field(
        description="Номер задачи или напоминания. Если пользователь его не назвал, сначала вызови list_tasks и найди id",
    )
    description: str | None = Field(
        default=None,
        description="Новый текст задачи. Не указывай, если текст менять не нужно",
    )
    deadline: AwareDatetime | None = Field(
        default=None,
        description="Новый срок в ISO 8601 с часовым смещением, например 2026-10-24T18:00:00+03:00. Не указывай, если срок менять не нужно",
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
