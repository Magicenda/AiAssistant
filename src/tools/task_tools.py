from tools.base import BaseTool
from schemas.tool import CreateTaskArgs

class CreateTTaskTool(BaseTool):
    name = "create_task"
    description = "Создает задачу пользователю. Вызывать когда пользователь просить создать, запомнить задачу"
    args_schema = CreateTaskArgs

    # Добаить репозиторий для выполнения
    def __init__(self, repository):
        super().__init__()

    # Заполнить инструменты
    async def async_execute(sefl, args):
        return await super().async_execute(args)