from fastapi import APIRouter
import json

from deps import AgentServiceDep
from schemas.llm_request import QueryRequest
from schemas.voice import VoiceJobCreatedResponse
from schemas.llm_responce import QueryResponse
from deps import VoiceOrchestratorDep, AgentServiceDep, CurrentUserIdDep
from starlette.background import BackgroundTasks
from schemas.enums import JobStatus


router = APIRouter(prefix="/llm", tags=["llm"])
 


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    reply_to = request.reply_to.model_dump() if request.reply_to else None
    answer = await service.generate_response(
        request.chat_id,
        request.query,
        request.model_settings,
        reply_to=json.dumps(reply_to, ensure_ascii=False) if reply_to else None,
        regenerate=request.regenerate,
        user_timezone=request.timezone,
    )
    return QueryResponse(answer=answer)

@router.post("/query_and_voice", response_model=VoiceJobCreatedResponse, status_code=202)
async def query_and_voice(
    request: QueryRequest,
    agent: AgentServiceDep,
    orchestrator: VoiceOrchestratorDep,
    background_tasks: BackgroundTasks,
    user_id: CurrentUserIdDep,
):
    answer = await agent.generate_response(
        request.chat_id,
        request.query,
        request.model_settings,
        user_timezone=request.timezone,
    )
    job_id = orchestrator.create_job(user_id, answer)
    background_tasks.add_task(orchestrator.run_tts_worker, job_id, answer)
    return VoiceJobCreatedResponse(job_id=job_id, status=JobStatus.PENDING)
