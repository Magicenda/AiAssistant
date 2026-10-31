from typing import Annotated

from fastapi import APIRouter, Query

from deps import ProfileServiceDep
from schemas.profile import MeetingOut, TaskOut


router = APIRouter(prefix="/profile", tags=["profile"])

LimitQuery = Annotated[int, Query(ge=1, le=100, description="Сколько записей вернуть")]
UpcomingQuery = Annotated[bool, Query(description="Только записи со сроком в будущем")]


@router.get("/tasks", response_model=list[TaskOut])
async def get_my_tasks(
    service: ProfileServiceDep, limit: LimitQuery = 50, only_upcoming: UpcomingQuery = False
) -> list[TaskOut]:
    return await service.get_tasks(limit, only_upcoming)


@router.get("/reminders", response_model=list[TaskOut])
async def get_my_reminders(
    service: ProfileServiceDep, limit: LimitQuery = 50, only_upcoming: UpcomingQuery = False
) -> list[TaskOut]:
    return await service.get_reminders(limit, only_upcoming)


@router.post("/reminders/claim-due", response_model=list[TaskOut])
async def claim_due_reminders(
    service: ProfileServiceDep, limit: LimitQuery = 20
) -> list[TaskOut]:
    """Возвращает один раз напоминания, до срока которых осталось не более 30 минут."""
    return await service.claim_due_reminders(limit)


@router.get("/meetings", response_model=list[MeetingOut])
async def get_my_meetings(
    service: ProfileServiceDep, limit: LimitQuery = 50, only_upcoming: UpcomingQuery = False
) -> list[MeetingOut]:
    return await service.get_meetings(limit, only_upcoming)
