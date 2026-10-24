from db.models import Task, Type
from db.repository.task_repository import TaskRepository
from schemas.tool import CreateReminderArgs, CreateTaskArgs, ListTasksArgs
from tools.base import Toolkit, tool


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "kind": task.type.value,
        "description": task.description,
        "deadline": task.deadline.isoformat() if task.deadline else None,
    }


class TaskToolkit(Toolkit):
    def __init__(self, repository: TaskRepository):
        self.repository = repository

    @tool(
        "create_task",
        "Создаёт задачу (дело, которое нужно сделать). Вызывай, когда пользователь просит "
        "записать или запомнить задачу. Для напоминания в конкретное время используй create_reminder.",
        CreateTaskArgs,
    )
    async def create_task(self, args: CreateTaskArgs) -> dict:
        task = await self.repository.create_task(args.description, args.deadline, Type.TASK)
        return _task_to_dict(task)

    @tool(
        "create_reminder",
        "Создаёт напоминание на конкретное время. Вызывай, когда пользователь просит "
        "напомнить о чём-то. Время обязательно.",
        CreateReminderArgs,
    )
    async def create_reminder(self, args: CreateReminderArgs) -> dict:
        task = await self.repository.create_task(args.description, args.remind_at, Type.NOTIFY)
        return _task_to_dict(task)

    @tool(
        "list_tasks",
        "Возвращает список задач и напоминаний пользователя. Вызывай, когда пользователь "
        "спрашивает, какие у него задачи, напоминания или дела.",
        ListTasksArgs,
    )
    async def list_tasks(self, args: ListTasksArgs) -> dict:
        kind = Type(args.kind) if args.kind else None
        tasks = await self.repository.list_tasks(args.limit, kind, args.only_upcoming)
        return {"count": len(tasks), "tasks": [_task_to_dict(t) for t in tasks]}
