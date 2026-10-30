from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import as_moscow, now_moscow
from db.models import Task, Type


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_task(
        self, user_id: int, description: str, deadline: datetime | None, kind: Type = Type.TASK
    ) -> Task:
        task = Task(
            user_id=user_id,
            created_at=now_moscow(),
            description=description,
            deadline=as_moscow(deadline) if deadline is not None else None,
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
        clear_deadline: bool = False,
    ) -> Task:
        if description is not None:
            task.description = description
        if clear_deadline:
            task.deadline = None
        elif deadline is not None:
            task.deadline = as_moscow(deadline)
        await self.session.flush()
        return task

    async def delete_task(self, task: Task) -> None:
        await self.session.delete(task)
        await self.session.flush()

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
