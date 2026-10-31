import asyncio
from uuid import uuid4

import httpx

from core.config import settings
from core.exceptions import GIGACHAT_TIMEOUT_MESSAGE
from schemas import AssistantVoiceJobResult, JobStatus
from services.llm_client import GigaChatClient
from services.orchestrator import VoiceGenerationOrchestrator, _JobEntry


def test_gigachat_client_uses_configured_timeout_and_retries():
    client = GigaChatClient()

    assert client._client._settings.timeout == settings.llm_timeout
    assert client._client._settings.max_retries == settings.gigachat_max_retries

    asyncio.run(client.aclose())


def test_voice_pipeline_reports_gigachat_read_timeout():
    entry = _JobEntry(
        user_id=42,
        result=AssistantVoiceJobResult(job_id=uuid4(), status=JobStatus.THINKING),
    )

    VoiceGenerationOrchestrator._fail(entry, httpx.ReadTimeout("GigaChat timed out"))

    assert entry.result.status == JobStatus.FAILED
    assert entry.result.error == GIGACHAT_TIMEOUT_MESSAGE
