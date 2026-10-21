from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from deps import AgentServiceDep, ChatServiceDep
from schemas.llm_request import QueryRequest
from schemas.llm_responce import QueryResponse
from db.models import MessageRole
from datetime import datetime


router = APIRouter(prefix="/llm", tags=["llm"])

class ChatRequest(BaseModel):
    name_chat: str  
class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  

    id: int
    role: MessageRole
    content: str
    created_at: datetime

class ChatResponse(BaseModel):
    chat_id: int
    name_chat: str
    messages: list[MessageOut]  

@router.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest, service: AgentServiceDep) -> QueryResponse:
    answer = await service.generate_response(request.session_id, request.query)
    return QueryResponse(answer=answer)

@router.post("/create_chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest, service: ChatServiceDep) -> ChatResponse:
    chat = await service.create_chat(request.name_chat)
    return ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages)

# Возвращает чат по его ID, включая все сообщения
@router.get("/get_chat/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, service: ChatServiceDep) -> ChatResponse:
    # Сделать метод в сервисе history, который будет возвращать чат по его ID, включая все сообщения
    messages = await service.repository.get_chat_by_id(chat_id)
    if not messages:
        return ChatResponse(chat_id=chat_id, name_chat="", message=[])
    chat_name = messages[0].chat.name if messages else ""
    return ChatResponse(chat_id=chat_id, name_chat=chat_name, message=messages)

@router.get("/get_all_chats", response_model=list[ChatResponse])
async def get_all_chats(service: ChatServiceDep) -> list[ChatResponse]:
    chats = await service.get_all_chats()
    return [ChatResponse(chat_id=chat.id, name_chat=chat.name, message=chat.messages) for chat in chats]

@router.post("/add_message/{chat_id}", response_model=ChatResponse)
async def add_message(chat_id: int, role: MessageRole, content: str, service: ChatServiceDep) -> ChatResponse:
    chat = await service.add_message(chat_id, role.value, content)
    return ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages)