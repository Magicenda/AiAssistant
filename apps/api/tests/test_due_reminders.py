import asyncio
from datetime import timedelta

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.time import now_moscow
from db.models import BaseModel, Task, Type, User
from db.repository.task_repository import TaskRepository


def test_claim_due_reminders_returns_each_reminder_30_minutes_before_deadline_once():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(BaseModel.metadata.create_all)

        async with session_factory() as session:
            user = User(username="reminder-user", hashed_password="hash")
            session.add(user)
            await session.flush()
            due = Task(
                user_id=user.id,
                description="Купить корм",
                deadline=now_moscow() + timedelta(minutes=20),
                type=Type.NOTIFY,
            )
            future = Task(
                user_id=user.id,
                description="Позвонить завтра",
                deadline=now_moscow() + timedelta(days=1),
                type=Type.NOTIFY,
            )
            session.add_all([due, future])
            await session.commit()

            repository = TaskRepository(session)
            first = await repository.claim_due_reminders(user.id)
            await session.commit()
            second = await repository.claim_due_reminders(user.id)

            assert [reminder.id for reminder in first] == [due.id]
            assert first[0].notified_at is not None
            assert second == []

        await engine.dispose()

    asyncio.run(scenario())


def test_moving_a_reminder_allows_it_to_be_delivered_again():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        session_factory = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(BaseModel.metadata.create_all)

        async with session_factory() as session:
            reminder = Task(
                user_id=1,
                description="Позвонить",
                deadline=now_moscow(),
                notified_at=now_moscow(),
                type=Type.NOTIFY,
            )
            repository = TaskRepository(session)
            await repository.update_task(
                reminder,
                deadline=now_moscow() + timedelta(hours=1),
            )

            assert reminder.notified_at is None

        await engine.dispose()

    asyncio.run(scenario())
