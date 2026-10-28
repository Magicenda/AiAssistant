from db.models import Task, Type
from db.repository.task_repository import TaskRepository
from schemas.tool import CreateReminderArgs, CreateTaskArgs, ListTasksArgs, UpdateTaskArgs
from tools.base import Toolkit, tool


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "kind": task.type.value,
        "description": task.description,
        "deadline": task.deadline.isoformat() if task.deadline else None,
    }


class TaskToolkit(Toolkit):
    def __init__(self, repository: TaskRepository, user_id: int):
        self.repository = repository
        self.user_id = user_id

    @tool(
        "create_task",
        "Создаёт задачу (дело, которое нужно сделать). Вызывай, когда пользователь просит "
        "записать или запомнить задачу. Для напоминания в конкретное время используй create_reminder.",
        CreateTaskArgs,
    )
    async def create_task(self, args: CreateTaskArgs) -> dict:
        task = await self.repository.create_task(self.user_id, args.description, args.deadline, Type.TASK)
        return _task_to_dict(task)

    @tool(
        "create_reminder",
        "Создаёт напоминание на конкретное время. Вызывай, когда пользователь просит "
        "напомнить о чём-то. Время обязательно.",
        CreateReminderArgs,
    )
    async def create_reminder(self, args: CreateReminderArgs) -> dict:
        task = await self.repository.create_task(self.user_id, args.description, args.remind_at, Type.NOTIFY)
        return _task_to_dict(task)

    @tool(
        "list_tasks",
        "Возвращает список задач и напоминаний пользователя. Вызывай, когда пользователь "
        "спрашивает, какие у него задачи, напоминания или дела.",
        ListTasksArgs,
    )
    async def list_tasks(self, args: ListTasksArgs) -> dict:
        kind = Type(args.kind) if args.kind else None
        tasks = await self.repository.list_tasks(self.user_id, args.limit, kind, args.only_upcoming)
        return {"count": len(tasks), "tasks": [_task_to_dict(t) for t in tasks]}

    @tool(
        "update_task",
        "Изменяет существующую задачу или напоминание: текст и/или срок. Вызывай, когда "
        "пользователь просит изменить, перенести или переименовать запись. Если id неизвестен, "
        "сначала вызови list_tasks.",
        UpdateTaskArgs,
    )
    async def update_task(self, args: UpdateTaskArgs) -> dict:
        task = await self.repository.get_task(self.user_id, args.task_id)
        if task is None:
            return {"error": f"Задача с id {args.task_id} не найдена"}
        task = await self.repository.update_task(
            task, args.description, args.deadline, args.clear_deadline
        )
        return _task_to_dict(task)
