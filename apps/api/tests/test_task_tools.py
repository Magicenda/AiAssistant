import asyncio
from datetime import datetime

from core.time import MOSCOW_TZ
from db.models import Task, Type
from schemas.tool import (
    CreateTaskArgs,
    CreateTasksArgs,
    DeleteAllTasksArgs,
    DeleteTaskArgs,
    ListRemindersArgs,
    UpdateReminderArgs,
    UpdateTaskArgs,
)
from tools.task_tools import TaskToolkit


class FakeTaskRepository:
    def __init__(self, task: Task | None):
        self.task = task
        self.deleted_task = None
        self.deleted_all_values = None
        self.updated_values = None
        self.list_values = None
        self.created_values = []
        self._next_id = 100

    async def create_task(self, user_id, description, deadline, kind=Type.TASK):
        self._next_id += 1
        task = Task(
            id=self._next_id,
            user_id=user_id,
            description=description,
            deadline=deadline,
            type=kind,
        )
        self.created_values.append((user_id, description, deadline, kind))
        return task

    async def get_task(self, user_id: int, task_id: int) -> Task | None:
        if self.task is not None and self.task.user_id == user_id and self.task.id == task_id:
            return self.task
        return None

    async def update_task(self, task, description, deadline):
        self.updated_values = (description, deadline)
        if description is not None:
            task.description = description
        if deadline is not None:
            task.deadline = deadline
        return task

    async def delete_task(self, task: Task) -> None:
        self.deleted_task = task

    async def delete_all_tasks(self, user_id, kind):
        self.deleted_all_values = (user_id, kind)
        return 3

    async def list_tasks(self, user_id, limit, kind, only_upcoming):
        self.list_values = (user_id, limit, kind, only_upcoming)
        if self.task is not None and self.task.user_id == user_id and self.task.type == kind:
            return [self.task]
        return []


def make_task() -> Task:
    return Task(
        id=7,
        user_id=42,
        description="Старая задача",
        deadline=datetime(2026, 10, 31, 12, 0, tzinfo=MOSCOW_TZ),
        type=Type.TASK,
    )


def make_reminder() -> Task:
    return Task(
        id=8,
        user_id=42,
        description="Старое напоминание",
        deadline=datetime(2026, 11, 1, 12, 0, tzinfo=MOSCOW_TZ),
        type=Type.NOTIFY,
    )


def test_task_toolkit_exposes_update_and_delete_tools():
    names = {tool.name for tool in TaskToolkit(FakeTaskRepository(None), 42).tools()}

    assert {
        "list_reminders",
        "update_task",
        "update_reminder",
        "delete_task",
        "delete_all_tasks",
    } <= names


def test_list_reminders_tool_returns_only_users_reminders():
    repository = FakeTaskRepository(make_reminder())
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(
        toolkit.list_reminders(ListRemindersArgs(limit=10, only_upcoming=True))
    )

    assert result == {
        "count": 1,
        "reminders": [
            {
                "id": 8,
                "kind": "notify",
                "description": "Старое напоминание",
                "deadline": "2026-11-01T12:00:00+03:00",
            }
        ],
    }
    assert repository.list_values == (42, 10, Type.NOTIFY, True)


def test_update_task_tool_updates_users_task():
    repository = FakeTaskRepository(make_task())
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(
        toolkit.update_task(UpdateTaskArgs(task_id=7, description="Новая задача"))
    )

    assert result["description"] == "Новая задача"
    assert repository.updated_values == ("Новая задача", None)


def test_update_reminder_tool_changes_text_and_time():
    repository = FakeTaskRepository(make_reminder())
    toolkit = TaskToolkit(repository, user_id=42)
    new_time = datetime(2026, 11, 2, 18, 30, tzinfo=MOSCOW_TZ)

    result = asyncio.run(
        toolkit.update_reminder(
            UpdateReminderArgs(
                reminder_id=8,
                description="Новое напоминание",
                remind_at=new_time,
            )
        )
    )

    assert result == {
        "id": 8,
        "kind": "notify",
        "description": "Новое напоминание",
        "deadline": "2026-11-02T18:30:00+03:00",
    }
    assert repository.updated_values == ("Новое напоминание", new_time)


def test_update_reminder_tool_rejects_a_task():
    repository = FakeTaskRepository(make_task())
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(
        toolkit.update_reminder(UpdateReminderArgs(reminder_id=7, description="Новый текст"))
    )

    assert result == {"error": "Напоминание с id 7 не найдено"}
    assert repository.updated_values is None


def test_update_task_tool_rejects_a_reminder():
    repository = FakeTaskRepository(make_reminder())
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(
        toolkit.update_task(UpdateTaskArgs(task_id=8, description="Новый текст"))
    )

    assert result == {
        "error": "Запись с id 8 является напоминанием; используй update_reminder"
    }
    assert repository.updated_values is None


def test_delete_task_tool_deletes_users_task():
    task = make_task()
    repository = FakeTaskRepository(task)
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_task(DeleteTaskArgs(task_id=7)))

    assert result == {
        "deleted": True,
        "task": {
            "id": 7,
            "kind": "task",
            "description": "Старая задача",
            "deadline": "2026-10-31T12:00:00+03:00",
        },
    }
    assert repository.deleted_task is task


def test_delete_task_tool_does_not_delete_another_users_task():
    repository = FakeTaskRepository(make_task())
    toolkit = TaskToolkit(repository, user_id=99)

    result = asyncio.run(toolkit.delete_task(DeleteTaskArgs(task_id=7)))

    assert result == {"error": "Задача с id 7 не найдена"}
    assert repository.deleted_task is None

def test_delete_all_tasks_tool_deletes_all_kinds_by_default():
    repository = FakeTaskRepository(None)
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_all_tasks(DeleteAllTasksArgs()))

    assert result == {"deleted": 3, "kind": "all"}
    assert repository.deleted_all_values == (42, None)


def test_delete_all_tasks_tool_can_limit_to_reminders():
    repository = FakeTaskRepository(None)
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_all_tasks(DeleteAllTasksArgs(kind="notify")))

    assert result == {"deleted": 3, "kind": "notify"}
    assert repository.deleted_all_values == (42, Type.NOTIFY)

def test_create_tasks_tool_creates_all_tasks_in_one_call():
    repository = FakeTaskRepository(None)
    toolkit = TaskToolkit(repository, user_id=42)
    first = datetime(2026, 11, 12, 18, 0, tzinfo=MOSCOW_TZ)
    second = datetime(2026, 11, 13, 15, 0, tzinfo=MOSCOW_TZ)

    result = asyncio.run(
        toolkit.create_tasks(
            CreateTasksArgs(
                tasks=[
                    CreateTaskArgs(description="Первая", deadline=first),
                    CreateTaskArgs(description="Вторая", deadline=second),
                ]
            )
        )
    )

    assert result == {
        "count": 2,
        "tasks": [
            {
                "id": 101,
                "kind": "task",
                "description": "Первая",
                "deadline": "2026-11-12T18:00:00+03:00",
            },
            {
                "id": 102,
                "kind": "task",
                "description": "Вторая",
                "deadline": "2026-11-13T15:00:00+03:00",
            },
        ],
    }
    assert [values[3] for values in repository.created_values] == [Type.TASK, Type.TASK]
