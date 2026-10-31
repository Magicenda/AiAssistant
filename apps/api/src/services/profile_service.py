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
