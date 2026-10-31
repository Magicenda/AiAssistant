from core.time import as_moscow
from db.models import Task, Type
from db.repository.task_repository import TaskRepository
from schemas.tool import (
    CreateReminderArgs,
    CreateTaskArgs,
    DeleteTaskArgs,
    ListRemindersArgs,
    ListTasksArgs,
    UpdateReminderArgs,
    UpdateTaskArgs,
)
from tools.base import Toolkit, tool


def _task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "kind": task.type.value,
        "description": task.description,
        "deadline": as_moscow(task.deadline).isoformat() if task.deadline else None,
    }


class TaskToolkit(Toolkit):
    def __init__(self, repository: TaskRepository, user_id: int):
        self.repository = repository
        self.user_id = user_id

    @tool(
        "create_task",
        "Создаёт задачу (дело, которое нужно сделать). Вызывай, когда пользователь просит "
        "записать или запомнить задачу. Deadline обязателен всегда. Если дата или время не названы, "
        "сначала уточни их и пока не вызывай инструмент. Задачу без срока создавать нельзя. "
        "Для напоминания используй create_reminder.",
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
        "list_reminders",
        "Возвращает напоминания текущего пользователя. Вызывай, когда пользователь спрашивает, "
        "какие у него напоминания, просит показать ближайшие напоминания или когда нужно найти "
        "id напоминания перед изменением. Для поиска только будущих напоминаний передай "
        "only_upcoming=true.",
        ListRemindersArgs,
    )
    async def list_reminders(self, args: ListRemindersArgs) -> dict:
        reminders = await self.repository.list_tasks(
            self.user_id,
            args.limit,
            Type.NOTIFY,
            args.only_upcoming,
        )
        return {
            "count": len(reminders),
            "reminders": [_task_to_dict(reminder) for reminder in reminders],
        }

    @tool(
        "update_task",
        "Изменяет существующую задачу: текст и/или срок. Для изменения напоминания используй "
        "update_reminder. Если id задачи неизвестен, сначала вызови list_tasks с kind=task.",
        UpdateTaskArgs,
    )
    async def update_task(self, args: UpdateTaskArgs) -> dict:
        task = await self.repository.get_task(self.user_id, args.task_id)
        if task is None:
            return {"error": f"Задача с id {args.task_id} не найдена"}
        if task.type != Type.TASK:
            return {"error": f"Запись с id {args.task_id} является напоминанием; используй update_reminder"}
        task = await self.repository.update_task(task, args.description, args.deadline)
        return _task_to_dict(task)

    @tool(
        "update_reminder",
        "Изменяет существующее напоминание: текст и/или время. Вызывай, когда пользователь просит "
        "перенести или переименовать напоминание. Если id неизвестен, сначала вызови "
        "list_reminders. Если новое время названо без даты или дата без времени, уточни недостающую "
        "часть до вызова инструмента.",
        UpdateReminderArgs,
    )
    async def update_reminder(self, args: UpdateReminderArgs) -> dict:
        reminder = await self.repository.get_task(self.user_id, args.reminder_id)
        if reminder is None or reminder.type != Type.NOTIFY:
            return {"error": f"Напоминание с id {args.reminder_id} не найдено"}
        reminder = await self.repository.update_task(
            reminder,
            args.description,
            args.remind_at,
        )
        return _task_to_dict(reminder)

    @tool(
        "delete_task",
        "Удаляет задачу или напоминание пользователя. Вызывай, когда пользователь явно просит "
        "удалить запись. Если id неизвестен, сначала вызови list_tasks.",
        DeleteTaskArgs,
    )
    async def delete_task(self, args: DeleteTaskArgs) -> dict:
        task = await self.repository.get_task(self.user_id, args.task_id)
        if task is None:
            return {"error": f"Задача с id {args.task_id} не найдена"}

        deleted_task = _task_to_dict(task)
        await self.repository.delete_task(task)
        return {"deleted": True, "task": deleted_task}
