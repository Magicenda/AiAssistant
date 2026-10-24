from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from gigachat import GigaChat
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository.chat_repository import ChatRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from db.session import SessionLocal
from services.agent_service import AgentService
from services.chat_service import ChatService
from tools.base import ToolRegistry
from tools.meeting_tools import MeetingToolkit
from tools.task_tools import TaskToolkit


def get_llm(request: Request) -> GigaChat:
    return request.app.state.llm


LLMDep = Annotated[GigaChat, Depends(get_llm)]


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


SessionDep = Annotated[AsyncSession, Depends(get_session)]


def get_chat_repository(session: SessionDep) -> ChatRepository:
    return ChatRepository(session)


ChatRepositoryDep = Annotated[ChatRepository, Depends(get_chat_repository)]


def get_chat_service(repo: ChatRepositoryDep) -> ChatService:
    return ChatService(repo)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


def get_task_repository(session: SessionDep) -> TaskRepository:
    return TaskRepository(session)


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