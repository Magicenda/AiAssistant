from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Meeting


class MeetingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_meeting(self, description: str, appointment: datetime) -> Meeting:
        meeting = Meeting(description=description, appointment=appointment)
        self.session.add(meeting)
        await self.session.flush()
        return meeting
