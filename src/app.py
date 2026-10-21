from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from gigachat import GigaChat

from api.llm_controller import router as llm_router
from db.models import Base
from db.session import engine

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
app.include_router(llm_router)


@app.get("/")
async def root():
    return {"status": "ok"}