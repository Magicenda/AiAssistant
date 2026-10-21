from sqlalchemy import Integer, DateTime, ForeignKey,  Enum as SqlEnum, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm import relationship
from datetime import datetime
from datetime import timezone
from enum import Enum as PyEnum

class Base(DeclarativeBase):
    pass
class Type(str, PyEnum):
    NOTIFY = "notify"
    TASK = "task"

class MessageRole(str, PyEnum):                
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"
    TOOL = "tool"

class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    description: Mapped[str] = mapped_column(nullable=False)
    type: Mapped[Type] = mapped_column(
        SqlEnum(
            Type,
            name="type",
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
            length=20,
        ),
        default=Type.TASK,
        server_default=Type.TASK.value,
        nullable=False
    ) 
    created_at: Mapped[datetime] = mapped_column(
            DateTime(timezone=True),
            default=lambda: datetime.now(timezone.utc),
            server_default=func.now(),
        )
    deadline: Mapped[datetime | None] = mapped_column( 
        DateTime(timezone=True)
    )


class Chat(Base):
    __tablename__ = "chats"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="chat",
        order_by="Message.created_at", 
        cascade="all, delete-orphan", 
        passive_deletes=True
        )

class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    role: Mapped[MessageRole] = mapped_column(
        SqlEnum(
            MessageRole,
            name="role",
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
            length=20,
        ),
        nullable=False
    )
    chat_id: Mapped[int] = mapped_column(                       # ← этой колонки не хватало
        ForeignKey("chats.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )

    chat: Mapped[Chat] = relationship(back_populates="messages")

class Meeting(Base):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    description: Mapped[str] = mapped_column(nullable=False)
    created_at: Mapped[datetime] =mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
    )
    deadline: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
