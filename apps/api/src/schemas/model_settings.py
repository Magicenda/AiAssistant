from typing import Literal

from pydantic import BaseModel, Field, model_validator


class ModelSettings(BaseModel):
    """Настройки модели из интерфейса пользователя.

    Если объект не передан, backend использует провайдера из env (по умолчанию
    GigaChat). `local` — это Ollama или LM Studio с OpenAI-совместимым API.
    """

    provider: Literal["gigachat", "local"] = "gigachat"
    base_url: str | None = None
    api_key: str = ""
    model: str | None = None
    temperature: float = Field(default=0.7, ge=0, le=1.5)

    @model_validator(mode="after")
    def _check_local_fields(self) -> "ModelSettings":
        if self.provider == "local" and not (self.base_url and self.model):
            raise ValueError("Для локальной модели нужны base_url и model")
        return self
