# описание схемы данных для запроса модели
from pydantic import BaseModel

from schemas.model_settings import ModelSettings


class QueryRequest(BaseModel):
    chat_id: int
    query: str
    # Необязательно: без настроек используется GigaChat из env.
    model_settings: ModelSettings | None = None
