from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from deps import AgentServiceDep, ChatServiceDep
from schemas.llm_request import QueryRequest
from schemas.llm_responce import QueryResponse
from db.models import MessageRole
from datetime import datetime


router = APIRouter(prefix="/llm", tags=["llm"])
 

# Переделать логику
@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    answer = await service.generate_response(request.chat_id, request.query)
    return QueryResponse(answer=answer)

