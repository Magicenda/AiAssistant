from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from gigachat import GigaChat

from src.routes.llm_controller import router as llm_router
from db.models import Base
from src.routes.chat_controller import router as chat_router
from db.session import engine

from src.db.models import BaseModel
from src.routes import voice

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    app.state.llm = GigaChat()    
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

app.include_router(voice.router)

app.include_router(llm_router)
app.include_router(chat_router)


@app.get("/")
async def root():
    return {"message": "Welcome to the AI Voice Assistant Service"}
