
from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict
from deps import ChatServiceDep
from db.models import MessageRole
from datetime import datetime


router = APIRouter(prefix="/chat", tags=["chat"])

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

@router.post("/create_chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest, service: ChatServiceDep) -> ChatResponse:
    chat = await service.create_chat(request.name_chat)
    return ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages)

@router.get("/get_chat/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, service: ChatServiceDep) -> ChatResponse:
    chat = await service.get_chat_by_id(chat_id)
    return ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages)

@router.get("/get_all_chats", response_model=list[ChatResponse])
async def get_all_chats(service: ChatServiceDep) -> list[ChatResponse]:
    chats = await service.get_all_chats()
    return [ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages) for chat in chats]

@router.post("/add_message/{chat_id}", response_model=ChatResponse)
async def add_message(chat_id: int, role: MessageRole, content: str, service: ChatServiceDep) -> ChatResponse:
    chat = await service.add_message(chat_id, role.value, content)
    return ChatResponse(chat_id=chat.id, name_chat=chat.name, messages=chat.messages)

@router.delete("/delete_chat/{chat_id}")
async def delete_chat(chat_id: int, service: ChatServiceDep) -> bool:
    return await service.delete_chat(chat_id)
