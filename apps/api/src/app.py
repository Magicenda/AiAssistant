import asyncio
from contextlib import asynccontextmanager, suppress

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from core.exceptions import ChatNotFoundError, InvalidCredentialsError, UserAlreadyExistsError
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

load_dotenv()


async def _cleanup_loop(orchestrator: VoiceGenerationOrchestrator, interval: int = 60) -> None:
    while True:
        await asyncio.sleep(interval)
        orchestrator.cleanup_expired()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    app.state.llm = build_llm_client()
    app.state.file_storage = FileStorageService()
    app.state.tts = TTSService()
    app.state.audio = AudioService(language="ru", model_size="base")
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


app.include_router(auth_router, prefix="/api")
app.include_router(voice_router, prefix="/api")
app.include_router(llm_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(audio_router, prefix="/api")
app.include_router(profile_router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Voice Assistant Service"}
