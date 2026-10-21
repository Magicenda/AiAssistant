from typing import Annotated

from fastapi import Depends, Request
from gigachat import GigaChat

from services.agent_service import AgentService
from services.history_store import HistoryStore


def get_llm(request: Request) -> GigaChat:
    return request.app.state.llm

def get_history(request: Request) -> HistoryStore:
    return request.app.state.history

LLMDep = Annotated[GigaChat, Depends(get_llm)]
HistoryDep = Annotated[HistoryStore, Depends(get_history)]


# сервис: собирается на каждый запрос из синглтонов
def get_agent_service(llm: LLMDep, history: HistoryDep) -> AgentService:
    return AgentService(llm=llm, history=history)

AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]