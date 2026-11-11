import logging
import uuid
from datetime import datetime

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
        task = await self.tasks.create_task(
            self.user_id, request.description, request.deadline, kind
        )
        if kind == Type.NOTIFY:
            await self._sync_reminder_upsert(task)
        return task

    async def get_task(self, task_id: int, kind: Type) -> Task:
        task = await self.tasks.get_task(self.user_id, task_id)
        if task is None or task.type != kind:
            raise HTTPException(status_code=404, detail="Запись не найдена")
        return task

    async def update_task(self, task_id: int, kind: Type, request: TaskPatch) -> Task:
        task = await self.get_task(task_id, kind)
        task = await self.tasks.update_task(task, **request.model_dump(exclude_unset=True))
        if kind == Type.NOTIFY:
            await self._sync_reminder_upsert(task)
        return task

    async def delete_task(self, task_id: int, kind: Type) -> None:
        task = await self.get_task(task_id, kind)
        yandex_uid = task.yandex_uid if task.type == Type.NOTIFY else None
        await self.tasks.delete_task(task)
        if yandex_uid:
            await self._sync_event_delete(yandex_uid)

    async def sync_reminder(self, reminder: Task) -> bool:
        """Добавляет или обновляет напоминание в Яндекс.Календаре."""
        return await self._sync_reminder_upsert(reminder)

    async def delete_reminder_event(self, yandex_uid: str) -> None:
        """Удаляет событие напоминания из Яндекс.Календаря."""
        await self._sync_event_delete(yandex_uid)

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
            await self._sync_event_delete(yandex_uid)

    async def delete_all_meetings(self) -> int:
        meetings = await self.meetings.list_all_meetings(self.user_id)
        yandex_uids = [meeting.yandex_uid for meeting in meetings if meeting.yandex_uid]
        deleted = await self.meetings.delete_all_meetings(self.user_id)
        for yandex_uid in yandex_uids:
            await self._sync_event_delete(yandex_uid)
        return deleted

    async def sync_unsynced_items(self) -> tuple[int, int, int]:
        """Выгружает встречи и напоминания, созданные до подключения календаря."""
        connection = await self._get_yandex_connection()
        if connection is None:
            raise HTTPException(status_code=409, detail="Яндекс.Календарь не подключён")

        synced_meetings = 0
        failed = 0
        for meeting in await self.meetings.list_unsynced_meetings(self.user_id):
            if await self._sync_meeting_upsert(meeting, connection):
                synced_meetings += 1
            else:
                failed += 1

        synced_reminders = 0
        for reminder in await self.tasks.list_unsynced_reminders(self.user_id):
            if await self._sync_reminder_upsert(reminder, connection):
                synced_reminders += 1
            else:
                failed += 1

        return synced_meetings, synced_reminders, failed

    async def _get_yandex_connection(self):
        if self.calendar_connections is None:
            return None
        return await self.calendar_connections.get_for_user(self.user_id)

    async def _upsert_event(
        self,
        *,
        uid: str | None,
        summary: str,
        start: datetime,
        connection=None,
    ) -> str | None:
        if connection is None:
            connection = await self._get_yandex_connection()
        if connection is None:
            return None

        uid = uid or str(uuid.uuid4())
        try:
            password = decrypt_secret(connection.app_password_encrypted)
            async with YandexCalendarClient(
                connection.login,
                password,
                calendar_path=connection.calendar_path,
            ) as client:
                await client.upsert_event(uid=uid, summary=summary, start=start)
        except (YandexCalendarError, ValueError) as exc:
            logger.warning(
                "Не удалось синхронизировать событие %s с Яндекс Календарём: %s",
                uid,
                exc,
            )
            return None
        return uid

    async def _sync_meeting_upsert(self, meeting: Meeting, connection=None) -> bool:
        uid = await self._upsert_event(
            uid=meeting.yandex_uid,
            summary=meeting.description,
            start=meeting.appointment,
            connection=connection,
        )
        if uid is None:
            return False
        if meeting.yandex_uid != uid:
            await self.meetings.update_meeting(meeting, yandex_uid=uid)
        return True

    async def _sync_reminder_upsert(self, reminder: Task, connection=None) -> bool:
        if reminder.type != Type.NOTIFY or reminder.deadline is None:
            return False
        uid = await self._upsert_event(
            uid=reminder.yandex_uid,
            summary=reminder.description,
            start=reminder.deadline,
            connection=connection,
        )
        if uid is None:
            return False
        if reminder.yandex_uid != uid:
            await self.tasks.update_task(reminder, yandex_uid=uid)
        return True

    async def _sync_event_delete(self, yandex_uid: str) -> None:
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
