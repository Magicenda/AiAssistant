from core.exceptions import ChatNotFoundError
from db.repository.chat_repository import ChatRepository
from db.models import Chat, Message

class ChatService:
    def __init__(self, repository: ChatRepository):
        self.repository = repository

    async def create_chat(self, name_chat: str) -> Chat:
        return await self.repository.create_chat(name_chat)

    async def get_chat_by_id(self, chat_id: int) -> Chat:
        chat = await self.repository.get_chat_with_messages(chat_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return chat

    async def get_history(self, chat_id: int, limit: int) -> list[Message]:
        chat = await self.repository.get_chat_by_id(chat_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.get_messages(chat_id, limit)

    async def get_all_chats(self) -> list[Chat]:
        return await self.repository.get_all_chats()

    async def delete_chat(self, chat_id: int) -> bool:
        chat = await self.repository.get_chat_by_id(chat_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.delete_chat(chat)

    async def add_message(self, chat_id: int, role: str, content: str) -> Chat:
        chat = await self.repository.get_chat_by_id(chat_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.add_message_for_chat(chat, role, content)