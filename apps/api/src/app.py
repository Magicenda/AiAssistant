import asyncio
import logging
from contextlib import asynccontextmanager, suppress

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from gigachat.exceptions import AuthenticationError as GigaChatAuthenticationError
from sqlalchemy import inspect, text

from core.config import MONOREPO_ROOT, settings
from core.exceptions import (
    GIGACHAT_AUTH_MESSAGE,
    ChatNotFoundError,
    InvalidCredentialsError,
    MessageNotFoundError,
    UserAlreadyExistsError,
)
from db.models import BaseModel
from db.session import SessionLocal, engine

from routes.voice_controller import router as voice_router 
from routes.chat_controller import router as chat_router
from routes.llm_controller import router as llm_router
from routes.transcribation_controller import router as audio_router
from routes.profile_controller import router as profile_router
from routes.auth_controller import router as auth_router
from services.llm_client import build_llm_client
from services.orchestrator import VoiceGenerationOrchestrator
from services.transcribation_service import AudioService
from services.tts_services import FileStorageService, TTSService

load_dotenv(MONOREPO_ROOT / ".env")

logger = logging.getLogger(__name__)


async def _cleanup_loop(orchestrator: VoiceGenerationOrchestrator, interval: int = 60) -> None:
    while True:
        await asyncio.sleep(interval)
        orchestrator.cleanup_expired()


async def _ensure_columns(conn) -> None:
    """Досоздаёт новые колонки: `create_all` не меняет существующие таблицы."""
    chat_columns = await conn.run_sync(
        lambda sync: {column["name"] for column in inspect(sync).get_columns("chats")}
    )
    if "pinned" not in chat_columns:
        await conn.execute(text("ALTER TABLE chats ADD COLUMN pinned BOOLEAN NOT NULL DEFAULT FALSE"))

    message_columns = await conn.run_sync(
        lambda sync: {column["name"] for column in inspect(sync).get_columns("messages")}
    )
    if "reply_to" not in message_columns:
        await conn.execute(text("ALTER TABLE messages ADD COLUMN reply_to TEXT"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
        await _ensure_columns(conn)
    if settings.llm_provider == "gigachat" and not settings.gigachat_credentials:
        logger.warning(
            "GIGACHAT_CREDENTIALS не задан: ответы GigaChat будут отклонены (401). "
            "Укажите ключ в apps/api/.env или выберите локальную модель в настройках."
        )
    app.state.llm = build_llm_client()
    app.state.file_storage = FileStorageService()
    app.state.tts = TTSService()
    app.state.audio = AudioService(language="ru", model_size="small")
    app.state.voice = VoiceGenerationOrchestrator(
        app.state.file_storage, app.state.tts, app.state.audio, app.state.llm, SessionLocal
    )
    cleanup_task = asyncio.create_task(_cleanup_loop(app.state.voice))
    try:
        yield
    finally:
        cleanup_task.cancel()
        with suppress(asyncio.CancelledError):
            await cleanup_task
        await app.state.llm.aclose()
        await engine.dispose()       


app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(UserAlreadyExistsError)
async def user_exists_handler(request: Request, exc: UserAlreadyExistsError):
    return JSONResponse(status_code=409, content={"detail": str(exc)})


@app.exception_handler(InvalidCredentialsError)
async def invalid_credentials_handler(request: Request, exc: InvalidCredentialsError):
    return JSONResponse(
        status_code=401, content={"detail": str(exc)}, headers={"WWW-Authenticate": "Bearer"}
    )


@app.exception_handler(ChatNotFoundError)
async def chat_not_found_handler(request: Request, exc: ChatNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(MessageNotFoundError)
async def message_not_found_handler(request: Request, exc: MessageNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(GigaChatAuthenticationError)
async def gigachat_auth_handler(request: Request, exc: GigaChatAuthenticationError):
    logger.warning("GigaChat отклонил ключ: %s", exc)
    return JSONResponse(status_code=502, content={"detail": GIGACHAT_AUTH_MESSAGE})


app.include_router(auth_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(llm_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(audio_router, prefix="/api")
app.include_router(profile_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Voice Assistant Service"}
