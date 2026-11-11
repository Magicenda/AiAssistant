from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import as_moscow, now_moscow
from db.models import Meeting


class MeetingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_meeting(
        self,
        user_id: int,
        description: str,
        appointment: datetime,
        yandex_uid: str | None = None,
    ) -> Meeting:
        meeting = Meeting(
            user_id=user_id,
            description=description,
            appointment=as_moscow(appointment),
            yandex_uid=yandex_uid,
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

    async def list_all_meetings(self, user_id: int) -> list[Meeting]:
        """Возвращает все встречи пользователя без ограничения по количеству."""
        result = await self.session.execute(select(Meeting).where(Meeting.user_id == user_id))
        return list(result.scalars().all())

    async def get_meeting(self, user_id: int, meeting_id: int) -> Meeting | None:
        result = await self.session.execute(
            select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == user_id)
        )
        return result.scalars().first()

    async def update_meeting(
        self,
        meeting: Meeting,
        description: str | None = None,
        appointment: datetime | None = None,
        yandex_uid: str | None = None,
    ) -> Meeting:
        if description is not None:
            meeting.description = description
        if appointment is not None:
            meeting.appointment = as_moscow(appointment)
        if yandex_uid is not None:
            meeting.yandex_uid = yandex_uid
        await self.session.flush()
        return meeting

    async def delete_meeting(self, meeting: Meeting) -> None:
        await self.session.delete(meeting)
        await self.session.flush()

    async def delete_all_meetings(self, user_id: int) -> int:
        """Удаляет все встречи пользователя и возвращает их число."""
        result = await self.session.execute(
            delete(Meeting)
            .where(Meeting.user_id == user_id)
            .execution_options(synchronize_session=False)
        )
        await self.session.flush()
        return result.rowcount or 0
