from typing import Annotated

from fastapi import APIRouter, Query, Response

from db.models import Type
from deps import ProfileServiceDep
from schemas.planner import MeetingCreate, MeetingPatch, TaskCreate, TaskPatch
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


@router.post("/tasks", response_model=TaskOut, status_code=201)
async def create_task(request: TaskCreate, service: ProfileServiceDep):
    return await service.create_task(request, Type.TASK)


@router.get("/tasks/{task_id}", response_model=TaskOut)
async def get_task(task_id: int, service: ProfileServiceDep):
    return await service.get_task(task_id, Type.TASK)


@router.patch("/tasks/{task_id}", response_model=TaskOut)
async def update_task(task_id: int, request: TaskPatch, service: ProfileServiceDep):
    return await service.update_task(task_id, Type.TASK, request)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(task_id: int, service: ProfileServiceDep):
    await service.delete_task(task_id, Type.TASK)
    return Response(status_code=204)


@router.post("/reminders", response_model=TaskOut, status_code=201)
async def create_reminder(request: TaskCreate, service: ProfileServiceDep):
    return await service.create_task(request, Type.NOTIFY)


@router.get("/reminders/{task_id}", response_model=TaskOut)
async def get_reminder(task_id: int, service: ProfileServiceDep):
    return await service.get_task(task_id, Type.NOTIFY)


@router.patch("/reminders/{task_id}", response_model=TaskOut)
async def update_reminder(task_id: int, request: TaskPatch, service: ProfileServiceDep):
    return await service.update_task(task_id, Type.NOTIFY, request)


@router.delete("/reminders/{task_id}", status_code=204)
async def delete_reminder(task_id: int, service: ProfileServiceDep):
    await service.delete_task(task_id, Type.NOTIFY)
    return Response(status_code=204)


@router.post("/meetings", response_model=MeetingOut, status_code=201)
async def create_meeting(request: MeetingCreate, service: ProfileServiceDep):
    return await service.create_meeting(request)


@router.get("/meetings/{meeting_id}", response_model=MeetingOut)
async def get_meeting(meeting_id: int, service: ProfileServiceDep):
    return await service.get_meeting(meeting_id)


@router.patch("/meetings/{meeting_id}", response_model=MeetingOut)
async def update_meeting(meeting_id: int, request: MeetingPatch, service: ProfileServiceDep):
    return await service.update_meeting(meeting_id, request)


@router.delete("/meetings/{meeting_id}", status_code=204)
async def delete_meeting(meeting_id: int, service: ProfileServiceDep):
    await service.delete_meeting(meeting_id)
    return Response(status_code=204)
