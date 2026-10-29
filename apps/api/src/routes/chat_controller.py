
import json
from datetime import datetime

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict, field_validator
from deps import ChatServiceDep
from db.models import MessageRole


router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    name_chat: str  

class ChatPatch(BaseModel):
    """Частичное обновление чата: имя и/или закрепление."""
    name_chat: str | None = None
    pinned: bool | None = None

class ReplyTo(BaseModel):
    """Снимок цитируемого сообщения, который хранится вместе с ответом."""
    id: str | None = None
    role: MessageRole
    text: str

class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)  

    id: int
    role: MessageRole
    content: str
    created_at: datetime
    reply_to: ReplyTo | None = None

    @field_validator("reply_to", mode="before")
    @classmethod
    def parse_reply_to(cls, value):
        if isinstance(value, str):
            return json.loads(value)
        return value

class ChatResponse(BaseModel):
    chat_id: int
    name_chat: str
    messages: list[MessageOut] 
    pinned: bool = False

def to_response(chat) -> ChatResponse:
    return ChatResponse(
        chat_id=chat.id,
        name_chat=chat.name,
        messages=chat.messages,
        pinned=chat.pinned,
    )

@router.post("/create_chat", response_model=ChatResponse)
async def create_chat(request: ChatRequest, service: ChatServiceDep) -> ChatResponse:
    chat = await service.create_chat(request.name_chat)
    return to_response(chat)

@router.get("/get_chat/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, service: ChatServiceDep) -> ChatResponse:
    chat = await service.get_chat_by_id(chat_id)
    return to_response(chat)

@router.get("/get_all_chats", response_model=list[ChatResponse])
async def get_all_chats(service: ChatServiceDep) -> list[ChatResponse]:
    chats = await service.get_all_chats()
    return [to_response(chat) for chat in chats]

@router.patch("/{chat_id}", response_model=ChatResponse)
async def update_chat(chat_id: int, request: ChatPatch, service: ChatServiceDep) -> ChatResponse:
    chat = await service.update_chat(chat_id, request.name_chat, request.pinned)
    return to_response(chat)

@router.post("/add_message/{chat_id}", response_model=ChatResponse)
async def add_message(chat_id: int, role: MessageRole, content: str, service: ChatServiceDep) -> ChatResponse:
    chat = await service.add_message(chat_id, role.value, content)
    return to_response(chat)

@router.delete("/{chat_id}/message/{message_id}", response_model=ChatResponse)
async def delete_message(chat_id: int, message_id: int, service: ChatServiceDep) -> ChatResponse:
    chat = await service.delete_message(chat_id, message_id)
    return to_response(chat)

@router.delete("/{chat_id}/messages", response_model=ChatResponse)
async def clear_messages(chat_id: int, service: ChatServiceDep) -> ChatResponse:
    chat = await service.clear_messages(chat_id)
    return to_response(chat)

@router.delete("/delete_chat/{chat_id}")
async def delete_chat(chat_id: int, service: ChatServiceDep) -> bool:
    return await service.delete_chat(chat_id)
