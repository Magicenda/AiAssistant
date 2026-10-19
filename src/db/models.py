from sqlalchemy import Integer, Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.orm import relationship
from datetime import datetime
from datetime import timezone
import enum


class Base(DeclarativeBase):
    pass

class Type(enum.Enum):
    NOTIFY = "notify"
    TASK = "task"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    description: Mapped[str] = mapped_column(nullable=False)
    type: Mapped[Type] = mapped_column(
        Enum(
            Type,
            name="type",
            native_enum=False,
            values_callable=lambda e: [m.value for m in e],
            length=20,
        ),
        default=Type.TASK,
        server_default=Type.TASK.value,
    ) 
    created_at: Mapped[datetime] = mapped_column(server_default=datetime.now(timezone.utc), nullable=False)
    dedline: Mapped[datetime] = mapped_column(server_default=datetime.now(timezone.utc), nullable=False)