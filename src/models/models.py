from datetime import datetime, timezone

from sqlalchemy import ForeingKey, String
from sqlalchemy import Enum

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.orm import DeclarativeBase

class BaseModel(DeclarativeBase):
    pass

class Type(str, Enum):
    TASK = "Task"
    MEETING = "Meeting"

class Meeting(BaseModel):
    __tablename__ = "meetings"

    id: Mapped[int] = mapped_column(primary_key=True)  
    description: Mapped[str] = mapped_column(String(255))
    dateTime: Mapped[datetime] = mapped_column(datetime)
    dateTime_created: Mapped[datetime] = mapped_column(datetime.now(timezone.utc))

    def __repr__(self):
        return f"Meeting(id={self.id!r}, dateTime={self.dateTime!r}, description='{self.description!r}', dateTime_created={self.dateTime_created!r})"

class Task(BaseModel):
    __tablename__ = "Task" 
    id: Mapped[int] = mapped_column(primary_key=True)  
    description: Mapped[str] = mapped_column(String(255))
    deadline: Mapped[datetime] = mapped_column(server_default=datetime.now(timezone.utc))
    dateTime_created: Mapped[datetime] = mapped_column(server_default=datetime.now(timezone.utc))

    status: Mapped[Type] = mapped_column(
        Enum(
            Type,
            name="type",
            values_callable=lambda obj: [e.value for e in obj],
            length=20
        ),

        default=Type.TASK,
        server_default=Type.TASK.value,
        nullable=False,
    )

    def __repr__(self):
        return f"Task(id={self.id!r}, deadline={self.deadline!r}, description='{self.description!r}', dateTime_created={self.dateTime_created!r})"