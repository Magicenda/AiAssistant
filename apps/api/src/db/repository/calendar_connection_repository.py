from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.time import now_moscow
from db.models import CalendarConnection


class CalendarConnectionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_for_user(self, user_id: int, provider: str = "yandex") -> CalendarConnection | None:
        result = await self.session.execute(
            select(CalendarConnection).where(
                CalendarConnection.user_id == user_id,
                CalendarConnection.provider == provider,
            )
        )
        return result.scalars().first()

    async def upsert_yandex(
        self,
        user_id: int,
        *,
        login: str,
        app_password_encrypted: str,
        calendar_path: str,
    ) -> CalendarConnection:
        existing = await self.get_for_user(user_id, "yandex")
        if existing is None:
            existing = CalendarConnection(
                user_id=user_id,
                provider="yandex",
                login=login,
                app_password_encrypted=app_password_encrypted,
                calendar_path=calendar_path,
                connected_at=now_moscow(),
            )
            self.session.add(existing)
        else:
            existing.login = login
            existing.app_password_encrypted = app_password_encrypted
            existing.calendar_path = calendar_path
            existing.connected_at = now_moscow()
        await self.session.flush()
        return existing

    async def delete_for_user(self, user_id: int, provider: str = "yandex") -> bool:
        existing = await self.get_for_user(user_id, provider)
        if existing is None:
            return False
        await self.session.delete(existing)
        await self.session.flush()
        return True
