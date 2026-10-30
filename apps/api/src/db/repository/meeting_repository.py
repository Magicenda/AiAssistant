from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import as_moscow, now_moscow
from db.models import Meeting


class MeetingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_meeting(self, user_id: int, description: str, appointment: datetime) -> Meeting:
        meeting = Meeting(
            user_id=user_id,
            description=description,
            appointment=as_moscow(appointment),
            created_at=now_moscow(),
        )
        self.session.add(meeting)
        await self.session.flush()
        return meeting

    async def list_meetings(
        self, user_id: int, limit: int, only_upcoming: bool = False
    ) -> list[Meeting]:
        query = (
            select(Meeting)
            .where(Meeting.user_id == user_id)
            .order_by(Meeting.appointment.asc(), Meeting.id.asc())
            .limit(limit)
        )
        if only_upcoming:
            query = query.where(Meeting.appointment >= now_moscow())
        result = await self.session.execute(query)
        return list(result.scalars().all())
