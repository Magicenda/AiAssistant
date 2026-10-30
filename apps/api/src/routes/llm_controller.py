import asyncio
import json
from contextlib import suppress

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from starlette.background import BackgroundTasks

from deps import AgentServiceDep, CurrentUserIdDep, VoiceOrchestratorDep
from schemas.enums import JobStatus
from schemas.llm_request import QueryRequest
from schemas.llm_responce import QueryResponse
from schemas.voice import VoiceJobCreatedResponse


router = APIRouter(prefix="/llm", tags=["llm"])

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "X-Accel-Buffering": "no",
    "Connection": "keep-alive",
}


def _reply_to(request: QueryRequest) -> str | None:
    if not request.reply_to:
        return None
    return json.dumps(request.reply_to.model_dump(), ensure_ascii=False)


@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    answer = await service.generate_response(
        request.chat_id,
        request.query,
        request.model_settings,
        reply_to=_reply_to(request),
        regenerate=request.regenerate,
        user_timezone=request.timezone,
    )
    return QueryResponse(answer=answer)


@router.post("/query/stream")
async def query_stream(request: QueryRequest, service: AgentServiceDep) -> StreamingResponse:
    """Отдаёт ответ ассистента через SSE по мере генерации."""
    queue: asyncio.Queue[str | Exception | None] = asyncio.Queue()

    async def produce() -> None:
        try:
            await service.generate_response(
                request.chat_id,
                request.query,
                request.model_settings,
                reply_to=_reply_to(request),
                regenerate=request.regenerate,
                user_timezone=request.timezone,
                on_delta=queue.put,
            )
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            await queue.put(exc)
        else:
            await queue.put(None)

    task = asyncio.create_task(produce())

    async def events():
        try:
            while True:
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=15)
                except TimeoutError:
                    # Комментарий-SSE не даёт прокси закрыть соединение во время долгого вызова модели.
                    yield ": ping\n\n"
                    continue
                if item is None:
                    yield "data: [DONE]\n\n"
                    return
                if isinstance(item, Exception):
                    payload = json.dumps({"message": str(item)}, ensure_ascii=False)
                    yield f"event: error\ndata: {payload}\n\n"
                    return
                payload = json.dumps({"text": item}, ensure_ascii=False)
                yield f"data: {payload}\n\n"
        finally:
            if not task.done():
                task.cancel()
                with suppress(asyncio.CancelledError):
                    await task

    return StreamingResponse(events(), media_type="text/event-stream", headers=SSE_HEADERS)


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
