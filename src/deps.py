from typing import Annotated

from fastapi import Depends, Request
from gigachat import GigaChat
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository.chat_repository import ChatRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from db.session import get_session
from services.agent_service import AgentService
from services.chat_service import ChatService
from services.transcribation_service import AudioService
from services.orchestrator import VoiceGenerationOrchestrator
from services.tts_services import FileStorageService, TTSService
from tools.base import ToolRegistry
from tools.meeting_tools import MeetingToolkit
from tools.task_tools import TaskToolkit



def get_llm(request: Request) -> GigaChat:
    return request.app.state.llm


LLMDep = Annotated[GigaChat, Depends(get_llm)]


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_chat_repository(session: SessionDep) -> ChatRepository:
    return ChatRepository(session)


ChatRepositoryDep = Annotated[ChatRepository, Depends(get_chat_repository)]


def get_chat_service(repo: ChatRepositoryDep) -> ChatService:
    return ChatService(repo)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


def get_task_repository(session: SessionDep) -> TaskRepository:
    return TaskRepository(session)

def get_audio_service() -> AudioService:
    return Depends(audio_service_instance)

audio_service_instance = AudioService(language="ru", model_size="base")

TaskRepositoryDep = Annotated[TaskRepository, Depends(get_task_repository)]


def get_meeting_repository(session: SessionDep) -> MeetingRepository:
    return MeetingRepository(session)


MeetingRepositoryDep = Annotated[MeetingRepository, Depends(get_meeting_repository)]


def get_tool_registry(
    task_repo: TaskRepositoryDep, meeting_repo: MeetingRepositoryDep
) -> ToolRegistry:
    return ToolRegistry([
        TaskToolkit(task_repo),
        MeetingToolkit(meeting_repo),
    ])


ToolRegistryDep = Annotated[ToolRegistry, Depends(get_tool_registry)]


def get_agent_service(llm: LLMDep, chat: ChatServiceDep, tools: ToolRegistryDep) -> AgentService:
    return AgentService(llm=llm, chat=chat, tools=tools)


AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]


def get_file_storage(request: Request) -> FileStorageService:
    return request.app.state.file_storage


FileStorageDep = Annotated[FileStorageService, Depends(get_file_storage)]


def get_tts_service(request: Request) -> TTSService:
    return request.app.state.tts


TTSServiceDep = Annotated[TTSService, Depends(get_tts_service)]


def get_voice_orchestrator(request: Request) -> VoiceGenerationOrchestrator:
    return request.app.state.voice


VoiceOrchestratorDep = Annotated[VoiceGenerationOrchestrator, Depends(get_voice_orchestrator)]


def get_audio_service(request: Request) -> AudioService:
    return request.app.state.audio


AudioServiceDep = Annotated[AudioService, Depends(get_audio_service)]
