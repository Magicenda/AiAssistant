from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from gigachat import GigaChat

from api.llm_controller import router as llm_router
from services.history_store import HistoryStore

load_dotenv()   


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.llm = GigaChat()
    app.state.history = HistoryStore()
    yield
    await app.state.llm.aclose()


app = FastAPI(lifespan=lifespan)
app.include_router(llm_router)


@app.get("/")
async def root():
    return {"status": "ok"}