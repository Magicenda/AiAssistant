from fastapi import APIRouter

from deps import AgentServiceDep
from schemas.llm_request import QueryRequest
from schemas.llm_responce import QueryResponse

router = APIRouter(prefix="/llm", tags=["llm"])


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    answer = await service.generate_response(request.session_id, request.query)
    return QueryResponse(answer=answer)