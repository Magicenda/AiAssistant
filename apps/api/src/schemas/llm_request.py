# описание схемы данных для запроса модели
from pydantic import BaseModel


class QueryRequest(BaseModel):
    chat_id: int
    query: str

