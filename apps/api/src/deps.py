from typing import Annotated

import jwt
from fastapi import Depends, File, Form, HTTPException, Request, UploadFile, status
from fastapi.security import OAuth2PasswordBearer
from gigachat import GigaChat
from sqlalchemy.ext.asyncio import AsyncSession

from core.security import decode_access_token
from db.models import User
from db.repository.chat_repository import ChatRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from db.repository.user_repository import UserRepository
from db.session import get_session
from services.agent_service import AgentService
from services.auth_service import AuthService
from services.chat_service import ChatService
from services.profile_service import ProfileService
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


def get_user_repository(session: SessionDep) -> UserRepository:
    return UserRepository(session)


UserRepositoryDep = Annotated[UserRepository, Depends(get_user_repository)]


def get_auth_service(users: UserRepositoryDep) -> AuthService:
    return AuthService(users)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
TokenDep = Annotated[str, Depends(oauth2_scheme)]


async def get_current_user(token: TokenDep, users: UserRepositoryDep) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить токен",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        user_id = decode_access_token(token)
    except jwt.InvalidTokenError:      # подделка, неверная подпись, истёкший срок
        raise unauthorized
    user = await users.get_by_id(user_id)
    if user is None:                   # токен выдан, но пользователя уже удалили
        raise unauthorized
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_current_user_id(user: CurrentUserDep) -> int:
    return user.id


CurrentUserIdDep = Annotated[int, Depends(get_current_user_id)]


def get_chat_repository(session: SessionDep) -> ChatRepository:
    return ChatRepository(session)


ChatRepositoryDep = Annotated[ChatRepository, Depends(get_chat_repository)]


def get_chat_service(repo: ChatRepositoryDep, user_id: CurrentUserIdDep) -> ChatService:
    return ChatService(repo, user_id)


ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


def get_task_repository(session: SessionDep) -> TaskRepository:
    return TaskRepository(session)


TaskRepositoryDep = Annotated[TaskRepository, Depends(get_task_repository)]


def get_meeting_repository(session: SessionDep) -> MeetingRepository:
    return MeetingRepository(session)


MeetingRepositoryDep = Annotated[MeetingRepository, Depends(get_meeting_repository)]


def get_profile_service(
    task_repo: TaskRepositoryDep, meeting_repo: MeetingRepositoryDep, user_id: CurrentUserIdDep
) -> ProfileService:
    return ProfileService(task_repo, meeting_repo, user_id)


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]


def get_tool_registry(
    task_repo: TaskRepositoryDep, meeting_repo: MeetingRepositoryDep, user_id: CurrentUserIdDep
) -> ToolRegistry:
    return ToolRegistry([
        TaskToolkit(task_repo, user_id),
        MeetingToolkit(meeting_repo, user_id),
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


class UserSpeechInputDTO:
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 МБ

    def __init__(
        self,
        chat_id: int = Form(..., description="Уникальный ID чата"),
        file: UploadFile = File(..., description="Бинарный файл аудиозаписи"),
    ):
        self.chat_id = chat_id
        self.file = file
        self.original_filename = file.filename

        if not file.content_type or not file.content_type.startswith("audio/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Переданный файл не является валидным аудиофайлом.",
            )

    async def read_audio(self) -> bytes:
        audio_bytes = await self.file.read()
        if len(audio_bytes) > self.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Размер аудиофайла превышает лимит в 25 МБ.",
            )
        if not audio_bytes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Передан пустой файл.",
            )
        return audio_bytes


SpeechInputDep = Annotated[UserSpeechInputDTO, Depends()]
