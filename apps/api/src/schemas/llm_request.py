# Параметры запроса к ассистенту
from typing import Literal

from pydantic import BaseModel, Field

from schemas.model_settings import ModelSettings


class ReplyTo(BaseModel):
    """Цитата, на которую отвечает пользователь."""
    id: str | None = None
    role: Literal["user", "assistant"]
    text: str


class QueryRequest(BaseModel):
    chat_id: int
    query: str
    # Необязательно: без настроек используется GigaChat из env.
    model_settings: ModelSettings | None = None
    # Снимок цитируемого сообщения — сохраняется вместе с вопросом.
    reply_to: ReplyTo | None = None
    # Перегенерировать последний ответ, не добавляя вопрос повторно.
    regenerate: bool = False
    # IANA-часовой пояс браузера пользователя: в нём трактуются названные даты.
    timezone: str | None = Field(
        default=None,
        description="IANA-часовой пояс, например Europe/Moscow",
    )
