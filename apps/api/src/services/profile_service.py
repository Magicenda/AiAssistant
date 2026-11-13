import logging
import uuid
from datetime import datetime

from fastapi import HTTPException

from core.crypto import decrypt_secret
from schemas.planner import TaskCreate, TaskPatch, MeetingCreate, MeetingPatch

from db.models import CalendarConnection, Meeting, Task, Type
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from services.apple_calendar_client import AppleCalendarClient, AppleCalendarError
from services.calendar_service import CalendarService
from services.yandex_calendar_client import YandexCalendarClient, YandexCalendarError
from services.yandex_oauth import YandexOAuthError

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
        apple_uid = task.apple_uid if task.type == Type.NOTIFY else None
        await self.tasks.delete_task(task)
        if yandex_uid or apple_uid:
            await self._sync_event_delete(yandex_uid=yandex_uid, apple_uid=apple_uid)

    async def sync_reminder(self, reminder: Task) -> bool:
        """Добавляет или обновляет напоминание во всех подключённых календарях."""
        return await self._sync_reminder_upsert(reminder)

    async def delete_reminder_event(self, yandex_uid: str | None = None, apple_uid: str | None = None) -> None:
        """Удаляет событие напоминания из подключённых календарей."""
        await self._sync_event_delete(yandex_uid=yandex_uid, apple_uid=apple_uid)

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
        apple_uid = meeting.apple_uid
        await self.meetings.delete_meeting(meeting)
        if yandex_uid or apple_uid:
            await self._sync_event_delete(yandex_uid=yandex_uid, apple_uid=apple_uid)

    async def delete_all_meetings(self) -> int:
        meetings = await self.meetings.list_all_meetings(self.user_id)
        pairs = [(m.yandex_uid, m.apple_uid) for m in meetings if m.yandex_uid or m.apple_uid]
        deleted = await self.meetings.delete_all_meetings(self.user_id)
        for yandex_uid, apple_uid in pairs:
            await self._sync_event_delete(yandex_uid=yandex_uid, apple_uid=apple_uid)
        return deleted

    async def sync_unsynced_items(self, provider: str = "yandex") -> tuple[int, int, int]:
        """Выгружает встречи и напоминания без UID указанного провайдера."""
        if provider not in ("yandex", "apple"):
            raise HTTPException(status_code=400, detail="Неизвестный провайдер календаря")

        connection = await self._get_connection(provider)
        if connection is None:
            label = "Яндекс.Календарь" if provider == "yandex" else "Apple Календарь"
            raise HTTPException(status_code=409, detail=f"{label} не подключён")

        synced_meetings = 0
        failed = 0
        for meeting in await self.meetings.list_unsynced_meetings_for_provider(
            self.user_id, provider
        ):
            if await self._sync_meeting_upsert(meeting, connections=[connection]):
                synced_meetings += 1
            else:
                failed += 1

        synced_reminders = 0
        for reminder in await self.tasks.list_unsynced_reminders_for_provider(
            self.user_id, provider
        ):
            if await self._sync_reminder_upsert(reminder, connections=[connection]):
                synced_reminders += 1
            else:
                failed += 1

        return synced_meetings, synced_reminders, failed

    async def _list_connections(self) -> list[CalendarConnection]:
        if self.calendar_connections is None:
            return []
        return await self.calendar_connections.list_for_user(self.user_id)

    async def _get_connection(self, provider: str) -> CalendarConnection | None:
        if self.calendar_connections is None:
            return None
        return await self.calendar_connections.get_for_user(self.user_id, provider)

    async def _get_yandex_connection(self):
        """Обратная совместимость для тестов/старых вызовов."""
        return await self._get_connection("yandex")

    async def _open_yandex_client(self, connection: CalendarConnection):
        calendar = CalendarService(self.calendar_connections, self.user_id)
        access_token = await calendar.resolve_access_token(connection)
        return YandexCalendarClient(
            connection.login,
            access_token=access_token,
            calendar_path=connection.calendar_path,
        )

    def _open_apple_client(self, connection: CalendarConnection) -> AppleCalendarClient:
        app_password = decrypt_secret(connection.access_token_encrypted)
        return AppleCalendarClient(
            connection.login,
            app_password=app_password,
            calendar_path=connection.calendar_path,
        )

    async def _upsert_to_provider(
        self,
        connection: CalendarConnection,
        *,
        uid: str | None,
        summary: str,
        start: datetime,
    ) -> str | None:
        uid = uid or str(uuid.uuid4())
        try:
            if connection.provider == "apple":
                async with self._open_apple_client(connection) as client:
                    await client.upsert_event(uid=uid, summary=summary, start=start)
            else:
                async with await self._open_yandex_client(connection) as client:
                    await client.upsert_event(uid=uid, summary=summary, start=start)
        except (YandexCalendarError, YandexOAuthError, AppleCalendarError, ValueError) as exc:
            label = "Apple" if connection.provider == "apple" else "Яндекс"
            logger.warning(
                "Не удалось синхронизировать событие %s с %s Календарём: %s",
                uid,
                label,
                exc,
            )
            return None
        return uid

    async def _sync_meeting_upsert(
        self,
        meeting: Meeting,
        connection=None,
        connections: list[CalendarConnection] | None = None,
    ) -> bool:
        targets = connections
        if targets is None:
            if connection is not None:
                targets = [connection]
            else:
                targets = await self._list_connections()
        if not targets:
            return False

        any_ok = False
        for conn in targets:
            if conn.provider == "apple":
                uid = await self._upsert_to_provider(
                    conn,
                    uid=meeting.apple_uid,
                    summary=meeting.description,
                    start=meeting.appointment,
                )
                if uid is None:
                    continue
                any_ok = True
                if meeting.apple_uid != uid:
                    await self.meetings.update_meeting(meeting, apple_uid=uid)
            else:
                uid = await self._upsert_to_provider(
                    conn,
                    uid=meeting.yandex_uid,
                    summary=meeting.description,
                    start=meeting.appointment,
                )
                if uid is None:
                    continue
                any_ok = True
                if meeting.yandex_uid != uid:
                    await self.meetings.update_meeting(meeting, yandex_uid=uid)
        return any_ok

    async def _sync_reminder_upsert(
        self,
        reminder: Task,
        connection=None,
        connections: list[CalendarConnection] | None = None,
    ) -> bool:
        if reminder.type != Type.NOTIFY or reminder.deadline is None:
            return False

        targets = connections
        if targets is None:
            if connection is not None:
                targets = [connection]
            else:
                targets = await self._list_connections()
        if not targets:
            return False

        any_ok = False
        for conn in targets:
            if conn.provider == "apple":
                uid = await self._upsert_to_provider(
                    conn,
                    uid=reminder.apple_uid,
                    summary=reminder.description,
                    start=reminder.deadline,
                )
                if uid is None:
                    continue
                any_ok = True
                if reminder.apple_uid != uid:
                    await self.tasks.update_task(reminder, apple_uid=uid)
            else:
                uid = await self._upsert_to_provider(
                    conn,
                    uid=reminder.yandex_uid,
                    summary=reminder.description,
                    start=reminder.deadline,
                )
                if uid is None:
                    continue
                any_ok = True
                if reminder.yandex_uid != uid:
                    await self.tasks.update_task(reminder, yandex_uid=uid)
        return any_ok

    async def _delete_from_provider(
        self, connection: CalendarConnection, uid: str
    ) -> None:
        try:
            if connection.provider == "apple":
                async with self._open_apple_client(connection) as client:
                    await client.delete_event(uid)
            else:
                async with await self._open_yandex_client(connection) as client:
                    await client.delete_event(uid)
        except (YandexCalendarError, YandexOAuthError, AppleCalendarError, ValueError) as exc:
            label = "Apple" if connection.provider == "apple" else "Яндекс"
            logger.warning(
                "Не удалось удалить событие %s в %s Календаре: %s",
                uid,
                label,
                exc,
            )

    async def _sync_event_delete(
        self,
        yandex_uid: str | None = None,
        apple_uid: str | None = None,
    ) -> None:
        if yandex_uid:
            connection = await self._get_connection("yandex")
            if connection is not None:
                await self._delete_from_provider(connection, yandex_uid)
        if apple_uid:
            connection = await self._get_connection("apple")
            if connection is not None:
                await self._delete_from_provider(connection, apple_uid)
