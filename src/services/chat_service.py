from db.repository.chat_repository import ChatRepository
from db.models import Chat, Message

class ChatService:
    def __init__(self, repository: ChatRepository):
        self.repository = repository

    async def create_chat(self, name_chat: str) -> Chat:
        return await self.repository.create_chat(name_chat)

    async def get_chat_by_id(self, chat_id: int) -> list[Message]:
        return await self.repository.get_chat_by_id(chat_id)\

    async def get_all_chats(self) -> list[Chat]:
        return await self.repository.get_all_chats()

    async def add_message(self, chat_id: int, role: str, content: str) -> Chat:
        chat = await self.repository.get_chat_by_id(chat_id)
        if not chat:
            raise ValueError(f"Chat with id {chat_id} not found")
        return await self.repository.add_message_for_chat(chat, role, content)