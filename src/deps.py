from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Request
from gigachat import GigaChat
from sqlalchemy.ext.asyncio import AsyncSession

from db.repository.chat_repository import ChatRepository
from db.session import SessionLocal
from services.agent_service import AgentService
from services.chat_service import ChatService
from services.transcribation_service import AudioService



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


def get_agent_service(llm: LLMDep, history: ChatRepositoryDep) -> AgentService:
    return AgentService(llm=llm, history=history)


AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]

def get_audio_service() -> AudioService:
    return Depends(audio_service_instance)

audio_service_instance = AudioService(language="ru", model_size="base")
