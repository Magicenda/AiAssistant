# описание схемы данных для ответа модели
from pydantic import BaseModel

class QueryResponse(BaseModel):
    answer: str