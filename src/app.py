from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from gigachat import GigaChat

from core.exceptions import ChatNotFoundError
from db.models import BaseModel
from db.session import engine

from src.db.models import BaseModel
from routes.voice_controller import router as voice_router 
from routes.chat_controller import router as chat_router
from routes.llm_controller import router as llm_router
from services.orchestrator import VoiceGenerationOrchestrator
from services.tts_services import FileStorageService, TTSService

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    app.state.llm = GigaChat()
    app.state.file_storage = FileStorageService()
    app.state.tts = TTSService()
    app.state.voice = VoiceGenerationOrchestrator(app.state.file_storage, app.state.tts)
    try:
        yield
    finally:
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


@app.exception_handler(ChatNotFoundError)
async def chat_not_found_handler(request: Request, exc: ChatNotFoundError):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


app.include_router(voice_router)
app.include_router(llm_router)
app.include_router(chat_router)


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Voice Assistant Service"}
