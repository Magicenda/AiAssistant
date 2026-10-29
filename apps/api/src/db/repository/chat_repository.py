from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from db.models import Chat, Message, MessageRole


class ChatRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_chat(self, user_id: int, name_chat: str) -> Chat:
        new_chat = Chat(user_id=user_id, name=name_chat, messages=[])
        self.session.add(new_chat)
        await self.session.flush()
        await self.session.refresh(new_chat, attribute_names=["messages"])
        return new_chat

    async def update_chat(
        self, chat: Chat, name_chat: str | None, pinned: bool | None
    ) -> Chat:
        if name_chat is not None:
            chat.name = name_chat
        if pinned is not None:
            chat.pinned = pinned
        await self.session.flush()
        await self.session.refresh(chat, attribute_names=["messages"])
        return chat

    async def add_message_for_chat(
        self, chat: Chat, role: str, content: str, reply_to: str | None = None
    ) -> Chat:
        new_message = Message(role=role, content=content, chat=chat, reply_to=reply_to)
        self.session.add(new_message)
        await self.session.flush()
        await self.session.refresh(chat, attribute_names=["messages"])
        return chat

    async def get_chat_by_id(self, chat_id: int, user_id: int) -> Chat | None:
        result = await self.session.execute(
            select(Chat).where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        return result.scalars().first()

    async def get_chat_with_messages(self, chat_id: int, user_id: int) -> Chat | None:
        result = await self.session.execute(
            select(Chat)
            .options(selectinload(Chat.messages))
            .where(Chat.id == chat_id, Chat.user_id == user_id)
        )
        return result.scalars().first()

    async def get_messages(self, chat_id: int, limit: int) -> list[Message]:
        result = await self.session.execute(
            select(Message)
            .where(Message.chat_id == chat_id)
            .order_by(Message.id.desc())
            .limit(limit)
        )
        return list(reversed(result.scalars().all()))

    async def get_message(self, chat_id: int, message_id: int) -> Message | None:
        result = await self.session.execute(
            select(Message).where(Message.id == message_id, Message.chat_id == chat_id)
        )
        return result.scalars().first()

    async def get_all_chats(self, user_id: int) -> list[Chat]:
        result = await self.session.execute(
            select(Chat)
            .where(Chat.user_id == user_id)
            .options(selectinload(Chat.messages))
            .order_by(Chat.created_at.desc())
        )
        return result.scalars().all()

    async def delete_message(self, chat: Chat, message: Message) -> Chat:
        await self.session.delete(message)
        await self.session.flush()
        await self.session.refresh(chat, attribute_names=["messages"])
        return chat

    async def delete_last_assistant_message(self, chat: Chat) -> None:
        result = await self.session.execute(
            select(Message)
            .where(Message.chat_id == chat.id, Message.role == MessageRole.ASSISTANT)
            .order_by(Message.id.desc())
            .limit(1)
        )
        message = result.scalars().first()
        if message is not None:
            await self.session.delete(message)
            await self.session.flush()

    async def clear_messages(self, chat: Chat) -> Chat:
        await self.session.execute(sql_delete(Message).where(Message.chat_id == chat.id))
        await self.session.flush()
        await self.session.refresh(chat, attribute_names=["messages"])
        return chat

    async def delete_chat(self, chat: Chat) -> bool:
        await self.session.delete(chat)
        await self.session.flush()
        return True
