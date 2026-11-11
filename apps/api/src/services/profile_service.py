import logging
import uuid

from fastapi import HTTPException

from core.crypto import decrypt_secret
from schemas.planner import TaskCreate, TaskPatch, MeetingCreate, MeetingPatch

from db.models import Meeting, Task, Type
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from services.yandex_calendar_client import YandexCalendarClient, YandexCalendarError

logger = logging.getLogger(__name__)


class ProfileService:
    def __init__(
        self,
        tasks: TaskRepository,
        meetings: MeetingRepository,
        user_id: int,
        calendar_connections: CalendarConnectionRepository | None = None,
    ):
        self.tasks = tasks
        self.meetings = meetings
        self.user_id = user_id
        self.calendar_connections = calendar_connections

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
        meeting = await self.meetings.create_meeting(
            self.user_id, request.description, request.appointment
        )
        await self._sync_meeting_upsert(meeting)
        return meeting

    async def find_meeting(self, meeting_id: int) -> Meeting | None:
        return await self.meetings.get_meeting(self.user_id, meeting_id)

    async def get_meeting(self, meeting_id: int) -> Meeting:
        meeting = await self.find_meeting(meeting_id)
        if meeting is None:
            raise HTTPException(status_code=404, detail="Встреча не найдена")
        return meeting

    async def update_meeting(self, meeting_id: int, request: MeetingPatch) -> Meeting:
        meeting = await self.get_meeting(meeting_id)
        meeting = await self.meetings.update_meeting(
            meeting, **request.model_dump(exclude_unset=True)
        )
        await self._sync_meeting_upsert(meeting)
        return meeting

    async def delete_meeting(self, meeting_id: int) -> None:
        meeting = await self.get_meeting(meeting_id)
        yandex_uid = meeting.yandex_uid
        await self.meetings.delete_meeting(meeting)
        if yandex_uid:
            await self._sync_meeting_delete(yandex_uid)

    async def delete_all_meetings(self) -> int:
        meetings = await self.meetings.list_all_meetings(self.user_id)
        yandex_uids = [meeting.yandex_uid for meeting in meetings if meeting.yandex_uid]
        deleted = await self.meetings.delete_all_meetings(self.user_id)
        for yandex_uid in yandex_uids:
            await self._sync_meeting_delete(yandex_uid)
        return deleted

    async def _get_yandex_connection(self):
        if self.calendar_connections is None:
            return None
        return await self.calendar_connections.get_for_user(self.user_id)

    async def _sync_meeting_upsert(self, meeting: Meeting) -> None:
        connection = await self._get_yandex_connection()
        if connection is None:
            return

        uid = meeting.yandex_uid or str(uuid.uuid4())
        try:
            password = decrypt_secret(connection.app_password_encrypted)
            async with YandexCalendarClient(
                connection.login,
                password,
                calendar_path=connection.calendar_path,
            ) as client:
                await client.upsert_event(
                    uid=uid,
                    summary=meeting.description,
                    start=meeting.appointment,
                )
        except (YandexCalendarError, ValueError) as exc:
            logger.warning(
                "Не удалось синхронизировать встречу %s с Яндекс Календарём: %s",
                meeting.id,
                exc,
            )
            return
        if meeting.yandex_uid != uid:
            await self.meetings.update_meeting(meeting, yandex_uid=uid)

    async def _sync_meeting_delete(self, yandex_uid: str) -> None:
        connection = await self._get_yandex_connection()
        if connection is None:
            return

        try:
            password = decrypt_secret(connection.app_password_encrypted)
            async with YandexCalendarClient(
                connection.login,
                password,
                calendar_path=connection.calendar_path,
            ) as client:
                await client.delete_event(yandex_uid)
        except (YandexCalendarError, ValueError) as exc:
            logger.warning(
                "Не удалось удалить событие %s в Яндекс Календаре: %s",
                yandex_uid,
                exc,
            )
