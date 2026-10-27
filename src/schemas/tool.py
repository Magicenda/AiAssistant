from datetime import datetime, timezone
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, Field


def _ensure_utc(value: datetime) -> datetime:
    # модель может прислать время без часового пояса, а в БД колонки с timezone=True
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


AwareDatetime = Annotated[datetime, AfterValidator(_ensure_utc)]


class CreateTaskArgs(BaseModel):
    description: str = Field(description="Что нужно сделать")
    deadline: AwareDatetime | None = Field(
        default=None,
        description="Срок выполнения в формате ISO 8601, например 2026-10-24T18:00:00. Не указывай, если пользователь не назвал срок",
    )


class CreateReminderArgs(BaseModel):
    description: str = Field(description="О чём напомнить")
    remind_at: AwareDatetime = Field(
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
    appointment: AwareDatetime = Field(
        description="Дата и время встречи в формате ISO 8601, например 2026-10-25T15:00:00",
    )
