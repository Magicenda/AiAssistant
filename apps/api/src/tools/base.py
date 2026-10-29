from collections.abc import Awaitable, Callable
from dataclasses import dataclass

from pydantic import BaseModel


_ALLOWED_SCHEMA_KEYS = {"type", "description", "enum", "items", "properties", "required"}


def to_gigachat_schema(schema: dict) -> dict:
    """Приводит JSON Schema из Pydantic к виду, который принимает GigaChat.

    GigaChat требует простой `type` у каждого свойства, поэтому `X | None` (anyOf с null)
    сворачивается в X, а служебные ключи (title, default, format, minimum...) отбрасываются.
    Реальную проверку аргументов всё равно делает Pydantic.
    """
    if "anyOf" in schema:
        options = [o for o in schema["anyOf"] if o.get("type") != "null"]
        merged = {**options[0], **{k: v for k, v in schema.items() if k != "anyOf"}} if options else {}
        return to_gigachat_schema(merged)

    result = {}
    for key, value in schema.items():
        if key not in _ALLOWED_SCHEMA_KEYS:
            continue
        if key == "properties":
            value = {name: to_gigachat_schema(prop) for name, prop in value.items()}
        elif key == "items":
            value = to_gigachat_schema(value)
        result[key] = value
    return result


@dataclass
class ToolSpec:
    name: str
    description: str
    args_schema: type[BaseModel]
    handler: Callable[..., Awaitable[dict]]

    def spec(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": to_gigachat_schema(self.args_schema.model_json_schema()),
        }


def tool(name: str, description: str, args_schema: type[BaseModel]):
    """Помечает метод Toolkit как инструмент агента."""
    def decorator(func):
        func._tool_meta = (name, description, args_schema)
        return func
    return decorator


class Toolkit:
    """Группа связанных инструментов, которые делят один репозиторий."""

    def tools(self) -> list[ToolSpec]:
        found = []
        for attr in dir(self):
            if attr.startswith("_"):
                continue
            meta = getattr(getattr(self, attr), "_tool_meta", None)
            if meta:
                name, description, args_schema = meta
                found.append(ToolSpec(name, description, args_schema, getattr(self, attr)))
        return found


class ToolRegistry:
    def __init__(self, toolkits: list[Toolkit]):
        self._tools: dict[str, ToolSpec] = {}
        for kit in toolkits:
            for t in kit.tools():
                if t.name in self._tools:
                    raise ValueError(f"Инструмент {t.name} уже зарегистрирован")
                self._tools[t.name] = t

    def specs(self) -> list[dict]:
        return [t.spec() for t in self._tools.values()]

    async def call(self, name: str, raw_args: dict | None) -> dict:
        tool_ = self._tools.get(name)
        if tool_ is None:
            return {"error": f"Неизвестный инструмент: {name}"}
        try:
            args = tool_.args_schema(**(raw_args or {}))    # валидация аргументов
            return await tool_.handler(args)
        except Exception as e:                              # ошибку увидит модель, запрос не упадёт
            return {"error": str(e)}
