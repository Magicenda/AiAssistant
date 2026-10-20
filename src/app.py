from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.db.session import engine
from src.db.models import BaseModel
from src.routes import voice


@asynccontextmanager
async def lifespan(app: FastAPI):
    # При запуске сервера автоматически создаем таблицы Task и Meeting, если их еще нет
    async with engine.begin() as conn:
        await conn.run_sync(BaseModel.metadata.create_all)
    yield
    # При выключении сервера корректно закрываем соединения с БД
    await engine.dispose()


app = FastAPI(
    title="AI Voice Assistant Service",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(voice.router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok"}