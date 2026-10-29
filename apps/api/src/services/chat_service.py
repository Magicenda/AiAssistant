from core.exceptions import ChatNotFoundError, MessageNotFoundError
from db.repository.chat_repository import ChatRepository
from db.models import Chat, Message

class ChatService:
    def __init__(self, repository: ChatRepository, user_id: int):
        self.repository = repository
        self.user_id = user_id

    async def create_chat(self, name_chat: str) -> Chat:
        return await self.repository.create_chat(self.user_id, name_chat)

    async def get_chat_by_id(self, chat_id: int) -> Chat:
        chat = await self.repository.get_chat_with_messages(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return chat

    async def get_history(self, chat_id: int, limit: int) -> list[Message]:
        chat = await self.repository.get_chat_by_id(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.get_messages(chat_id, limit)

    async def get_all_chats(self) -> list[Chat]:
        return await self.repository.get_all_chats(self.user_id)

    async def delete_chat(self, chat_id: int) -> bool:
        chat = await self.repository.get_chat_by_id(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.delete_chat(chat)

    async def update_chat(
        self, chat_id: int, name_chat: str | None = None, pinned: bool | None = None
    ) -> Chat:
        chat = await self.repository.get_chat_with_messages(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.update_chat(chat, name_chat, pinned)

    async def add_message(
        self, chat_id: int, role: str, content: str, reply_to: str | None = None
    ) -> Chat:
        chat = await self.repository.get_chat_by_id(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.add_message_for_chat(chat, role, content, reply_to)

    async def delete_message(self, chat_id: int, message_id: int) -> Chat:
        chat = await self.repository.get_chat_with_messages(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        message = await self.repository.get_message(chat_id, message_id)
        if not message:
            raise MessageNotFoundError(message_id)
        return await self.repository.delete_message(chat, message)

    async def clear_messages(self, chat_id: int) -> Chat:
        chat = await self.repository.get_chat_with_messages(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        return await self.repository.clear_messages(chat)

    async def delete_last_assistant_message(self, chat_id: int) -> None:
        chat = await self.repository.get_chat_by_id(chat_id, self.user_id)
        if not chat:
            raise ChatNotFoundError(chat_id)
        await self.repository.delete_last_assistant_message(chat)
