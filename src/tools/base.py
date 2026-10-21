from abc import ABC, abstractmethod
from pydantic import BaseModel


class BaseTool(ABC):
    name: str
    description: str
    args_schema: type[BaseModel]

    def spec(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parametrs": self.args_schema.model_json_schema()
        }

    @abstractmethod
    async def async_execute(sefl,args:BaseModel) -> dict: ...


class ToolRegistry:
    def __init__(self, tools: list[BaseTool]):
        self._tools = {t.name: t for t in tools}

    def specs(self) -> list[dict]:
        return [t.spec() for t in self._tools.values()]

    async def call(self, name: str, raw_args: dict | None) -> dict:
        tool = self._tools.get(name)
        if tool is None:
            return {"error": f"Неизвестный инструмент: {name}"}
        try:
            args = tool.args_schema(**(raw_args or {}))    # валидация аргументов
            return await tool.async_execute(args)
        except Exception as e:
            return {"error": str(e)}  