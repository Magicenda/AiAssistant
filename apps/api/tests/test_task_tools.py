import asyncio
from datetime import datetime

from core.time import MOSCOW_TZ
from db.models import Task, Type
from schemas.tool import DeleteTaskArgs, UpdateTaskArgs
from tools.task_tools import TaskToolkit


class FakeTaskRepository:
    def __init__(self, task: Task | None):
        self.task = task
        self.deleted_task = None
        self.updated_values = None

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


def make_task() -> Task:
    return Task(
        id=7,
        user_id=42,
        description="Старая задача",
        deadline=datetime(2026, 10, 31, 12, 0, tzinfo=MOSCOW_TZ),
        type=Type.TASK,
    )


def test_task_toolkit_exposes_update_and_delete_tools():
    names = {tool.name for tool in TaskToolkit(FakeTaskRepository(None), 42).tools()}

    assert {"update_task", "delete_task"} <= names


def test_update_task_tool_updates_users_task():
    repository = FakeTaskRepository(make_task())
    toolkit = TaskToolkit(repository, user_id=42)

    result = asyncio.run(
        toolkit.update_task(UpdateTaskArgs(task_id=7, description="Новая задача"))
    )

    assert result["description"] == "Новая задача"
    assert repository.updated_values == ("Новая задача", None)


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
