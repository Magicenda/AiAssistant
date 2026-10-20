from datetime import datetime, timezone
from enum import Enum as PyEnum

from sqlalchemy import String, DateTime, Enum as SQLEnum, func
from sqlalchemy.orm import Mapped, mapped_column, DeclarativeBase


class BaseModel(DeclarativeBase):
    pass


class Type(str, PyEnum):
    TASK = "Task"
    MEETING = "Meeting"


class Meeting(BaseModel):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(String(255))
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    dateTime_created: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )

    def __repr__(self):
        return (
            f"Meeting(id={self.id!r}, deadline={self.deadline!r}, "
            f"description={self.description!r}, dateTime_created={self.dateTime_created!r})"
        )


class Task(BaseModel):
    __tablename__ = "Task"

    id: Mapped[int] = mapped_column(primary_key=True)
    description: Mapped[str] = mapped_column(String(255))
    deadline: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )
    dateTime_created: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now()
    )

    status: Mapped[Type] = mapped_column(
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
            f"description={self.description!r}, dateTime_created={self.dateTime_created!r})"
        )