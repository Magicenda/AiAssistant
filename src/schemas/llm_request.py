# описание схемы данных для запроса модели
from pydantic import BaseModel


class QueryRequest(BaseModel):
    session_id: int
    query: str

