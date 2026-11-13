from datetime import datetime, timedelta

from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import as_moscow, now_moscow
from db.models import Task, Type


REMINDER_LEAD_TIME = timedelta(minutes=30)


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_task(
        self, user_id: int, description: str, deadline: datetime, kind: Type = Type.TASK
    ) -> Task:
        if deadline is None:
            raise ValueError("Срок задачи обязателен")
        task = Task(
            user_id=user_id,
            created_at=now_moscow(),
            description=description,
            deadline=as_moscow(deadline),
            type=kind,
        )
        self.session.add(task)
        await self.session.flush()     
        return task

    async def get_task(self, user_id: int, task_id: int) -> Task | None:
        result = await self.session.execute(
            select(Task).where(Task.id == task_id, Task.user_id == user_id)
        )
        return result.scalars().first()

    async def update_task(
        self,
        task: Task,
        description: str | None = None,
        deadline: datetime | None = None,
        yandex_uid: str | None = None,
        apple_uid: str | None = None,
    ) -> Task:
        if description is not None:
            task.description = description
        if deadline is not None:
            task.deadline = as_moscow(deadline)
            if task.type == Type.NOTIFY:
                task.notified_at = None
        if yandex_uid is not None:
            task.yandex_uid = yandex_uid
        if apple_uid is not None:
            task.apple_uid = apple_uid
        await self.session.flush()
        return task

    async def list_unsynced_reminders_for_provider(self, user_id: int, provider: str) -> list[Task]:
        """Напоминания без UID выбранного провайдера (yandex | apple)."""
        uid_column = Task.apple_uid if provider == "apple" else Task.yandex_uid
        result = await self.session.execute(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.type == Type.NOTIFY,
                Task.deadline.is_not(None),
                uid_column.is_(None),
            )
            .order_by(Task.deadline.asc(), Task.id.asc())
        )
        return list(result.scalars().all())

    async def list_unsynced_reminders(self, user_id: int) -> list[Task]:
        """Напоминания без yandex_uid (обратная совместимость)."""
        return await self.list_unsynced_reminders_for_provider(user_id, "yandex")

    async def list_reminder_uids(self, user_id: int) -> list[str]:
        """Возвращает yandex_uid напоминаний (обратная совместимость)."""
        pairs = await self.list_reminder_calendar_uids(user_id)
        return [yandex_uid for yandex_uid, _ in pairs if yandex_uid]

    async def list_reminder_calendar_uids(
        self, user_id: int
    ) -> list[tuple[str | None, str | None]]:
        """Возвращает (yandex_uid, apple_uid) напоминаний с хотя бы одним UID."""
        result = await self.session.execute(
            select(Task.yandex_uid, Task.apple_uid).where(
                Task.user_id == user_id,
                Task.type == Type.NOTIFY,
                or_(Task.yandex_uid.is_not(None), Task.apple_uid.is_not(None)),
            )
        )
        return [(yandex_uid, apple_uid) for yandex_uid, apple_uid in result.all()]

    async def delete_task(self, task: Task) -> None:
        await self.session.delete(task)
        await self.session.flush()

    async def delete_all_tasks(self, user_id: int, kind: Type | None = None) -> int:
        """Удаляет все задачи и/или напоминания пользователя и возвращает их число."""
        query = delete(Task).where(Task.user_id == user_id)
        if kind is not None:
            query = query.where(Task.type == kind)
        result = await self.session.execute(query.execution_options(synchronize_session=False))
        await self.session.flush()
        return result.rowcount or 0

    async def claim_due_reminders(self, user_id: int, limit: int = 20) -> list[Task]:
        """Атомарно выдаёт напоминания за 30 минут до срока текущему пользователю."""
        claimed_at = now_moscow()
        notification_threshold = claimed_at + REMINDER_LEAD_TIME
        result = await self.session.execute(
            select(Task)
            .where(
                Task.user_id == user_id,
                Task.type == Type.NOTIFY,
                Task.deadline.is_not(None),
                Task.deadline <= notification_threshold,
                Task.notified_at.is_(None),
            )
            .order_by(Task.deadline.asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
        reminders = list(result.scalars().all())
        for reminder in reminders:
            reminder.notified_at = claimed_at
        await self.session.flush()
        return reminders

    async def list_tasks(
        self, user_id: int, limit: int, kind: Type | None = None, only_upcoming: bool = False
    ) -> list[Task]:
        query = (
            select(Task)
            .where(Task.user_id == user_id)
            .order_by(Task.deadline.asc().nulls_last(), Task.id.desc())
            .limit(limit)
        )
        if kind is not None:
            query = query.where(Task.type == kind)
        if only_upcoming:
            query = query.where(Task.deadline >= now_moscow())
        result = await self.session.execute(query)
        return list(result.scalars().all())
