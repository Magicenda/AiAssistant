from fastapi import APIRouter
from deps import AgentServiceDep
from schemas.llm_request import QueryRequest
from schemas.voice import VoiceJobCreatedResponse
from schemas.llm_responce import QueryResponse
from deps import VoiceOrchestratorDep, AgentServiceDep
from starlette.background import BackgroundTasks
from schemas.enums import JobStatus


router = APIRouter(prefix="/llm", tags=["llm"])
 


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    answer = await service.generate_response(request.chat_id, request.query)
    return QueryResponse(answer=answer)

@router.post("/query_and_voice", response_model=VoiceJobCreatedResponse, status_code=202)
async def query_and_voice(
    request: QueryRequest,
    agent: AgentServiceDep,
    orchestrator: VoiceOrchestratorDep,
    background_tasks: BackgroundTasks,
):
    answer = await agent.generate_response(request.chat_id, request.query)
    job_id = orchestrator.create_job(answer)
    background_tasks.add_task(orchestrator.run_tts_worker, job_id, answer)
    return VoiceJobCreatedResponse(job_id=job_id, status=JobStatus.PENDING)
