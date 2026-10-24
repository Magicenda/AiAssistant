from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Task, Type


class TaskRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_task(
        self, description: str, deadline: datetime | None, kind: Type = Type.TASK
    ) -> Task:
        task = Task(description=description, deadline=deadline, type=kind)
        self.session.add(task)
        await self.session.flush()     
        return task

    async def list_tasks(
        self, limit: int, kind: Type | None = None, only_upcoming: bool = False
    ) -> list[Task]:
        query = (
            select(Task)
            .order_by(Task.deadline.asc().nulls_last(), Task.id.desc())
            .limit(limit)
        )
        if kind is not None:
            query = query.where(Task.type == kind)
        if only_upcoming:
            query = query.where(Task.deadline >= datetime.now(timezone.utc))
        result = await self.session.execute(query)
        return list(result.scalars().all())
