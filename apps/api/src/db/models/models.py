from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import Boolean, String, DateTime, Integer, Enum as SQLEnum, Text, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, DeclarativeBase

from core.time import now_moscow


class BaseModel(DeclarativeBase):
    pass


class Type(str, PyEnum):
    NOTIFY = "notify"
    TASK = "task"

class MessageRole(str, PyEnum):                
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"


class User(BaseModel):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_moscow,
        server_default=func.now()
    )

    def __repr__(self):
        return f"User(id={self.id!r}, username={self.username!r})"


class Meeting(BaseModel):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(255))
    appointment: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_moscow,
        server_default=func.now()
    )

    def __repr__(self):
        return (
            f"Meeting(id={self.id!r}, appointment={self.appointment!r}, "
            f"description={self.description!r}, created_at={self.created_at!r})"
        )


class Task(BaseModel):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    description: Mapped[str] = mapped_column(String(255))
    deadline: Mapped[datetime | None] = mapped_column( 
            DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_moscow,
        server_default=func.now()
    )

    type: Mapped[Type] = mapped_column(
        SQLEnum(
            Type,
            name="type",
            values_callable=lambda obj: [e.value for e in obj],
            length=20
        ),
        default=Type.TASK,
        server_default=Type.TASK.value,
        nullable=False
    )

    def __repr__(self):
        return (
            f"Task(id={self.id!r}, deadline={self.deadline!r}, "
            f"description={self.description!r}, created_at={self.created_at!r})"
        )



class Chat(BaseModel):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(nullable=False)
    pinned: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_moscow,
        server_default=func.now(),
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat",
        order_by="Message.created_at", 
        cascade="all, delete-orphan", 
        passive_deletes=True
        )

class Message(BaseModel):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    role: Mapped[MessageRole] = mapped_column(
        SQLEnum(
            MessageRole,
            name="role",
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
            length=20,
        ),
        nullable=False
    )
    chat_id: Mapped[int] = mapped_column(
        ForeignKey("chats.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(nullable=False)
    # Снимок цитируемого сообщения в JSON: при удалении оригинала цитата остаётся.
    reply_to: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=now_moscow,
        server_default=func.now(),
    )

    chat: Mapped[Chat] = relationship(back_populates="messages")
