from fastapi import HTTPException

from schemas.planner import TaskCreate, TaskPatch, MeetingCreate, MeetingPatch

from db.models import Meeting, Task, Type
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository


class ProfileService:
    def __init__(self, tasks: TaskRepository, meetings: MeetingRepository, user_id: int):
        self.tasks = tasks
        self.meetings = meetings
        self.user_id = user_id

    async def get_tasks(self, limit: int, only_upcoming: bool) -> list[Task]:
        return await self.tasks.list_tasks(self.user_id, limit, Type.TASK, only_upcoming)

    async def get_reminders(self, limit: int, only_upcoming: bool) -> list[Task]:
        return await self.tasks.list_tasks(self.user_id, limit, Type.NOTIFY, only_upcoming)

    async def claim_due_reminders(self, limit: int) -> list[Task]:
        return await self.tasks.claim_due_reminders(self.user_id, limit)

    async def get_meetings(self, limit: int, only_upcoming: bool) -> list[Meeting]:
        return await self.meetings.list_meetings(self.user_id, limit, only_upcoming)

    async def create_task(self, request: TaskCreate, kind: Type) -> Task:
        return await self.tasks.create_task(self.user_id, request.description, request.deadline, kind)

    async def get_task(self, task_id: int, kind: Type) -> Task:
        task = await self.tasks.get_task(self.user_id, task_id)
        if task is None or task.type != kind:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        return task

    async def update_task(self, task_id: int, kind: Type, request: TaskPatch) -> Task:
        task = await self.get_task(task_id, kind)
        return await self.tasks.update_task(task, **request.model_dump(exclude_unset=True))

    async def delete_task(self, task_id: int, kind: Type) -> None:
        task = await self.get_task(task_id, kind)
        await self.tasks.delete_task(task)

    async def create_meeting(self, request: MeetingCreate) -> Meeting:
        return await self.meetings.create_meeting(
            self.user_id, request.description, request.appointment
        )

    async def get_meeting(self, meeting_id: int) -> Meeting:
        meeting = await self.meetings.get_meeting(self.user_id, meeting_id)
        if meeting is None:
            raise HTTPException(status_code=404, detail="Встреча не найдена")
        return meeting

    async def update_meeting(self, meeting_id: int, request: MeetingPatch) -> Meeting:
        meeting = await self.get_meeting(meeting_id)
        return await self.meetings.update_meeting(meeting, **request.model_dump(exclude_unset=True))

    async def delete_meeting(self, meeting_id: int) -> None:
        meeting = await self.get_meeting(meeting_id)
        await self.meetings.delete_meeting(meeting)
