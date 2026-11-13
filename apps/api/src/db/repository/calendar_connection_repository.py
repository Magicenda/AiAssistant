from datetime import datetime

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
        access_token_encrypted: str,
        refresh_token_encrypted: str | None,
        token_expires_at: datetime | None,
        calendar_path: str,
    ) -> CalendarConnection:
        existing = await self.get_for_user(user_id, "yandex")
        if existing is None:
            existing = CalendarConnection(
                user_id=user_id,
                provider="yandex",
                login=login,
                access_token_encrypted=access_token_encrypted,
                refresh_token_encrypted=refresh_token_encrypted,
                token_expires_at=token_expires_at,
                calendar_path=calendar_path,
                connected_at=now_moscow(),
            )
            self.session.add(existing)
        else:
            existing.login = login
            existing.access_token_encrypted = access_token_encrypted
            existing.refresh_token_encrypted = refresh_token_encrypted
            existing.token_expires_at = token_expires_at
            existing.calendar_path = calendar_path
            existing.connected_at = now_moscow()
        await self.session.flush()
        return existing

    async def update_tokens(
        self,
        connection: CalendarConnection,
        *,
        access_token_encrypted: str,
        refresh_token_encrypted: str | None,
        token_expires_at: datetime | None,
    ) -> CalendarConnection:
        connection.access_token_encrypted = access_token_encrypted
        if refresh_token_encrypted is not None:
            connection.refresh_token_encrypted = refresh_token_encrypted
        connection.token_expires_at = token_expires_at
        await self.session.flush()
        return connection

    async def delete_for_user(self, user_id: int, provider: str = "yandex") -> bool:
        existing = await self.get_for_user(user_id, provider)
        if existing is None:
            return False
        await self.session.delete(existing)
        await self.session.flush()
        return True
