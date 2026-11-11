from fastapi import HTTPException

from core.crypto import decrypt_secret, encrypt_secret
from db.models import CalendarConnection
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from schemas.calendar import YandexCalendarStatus, YandexConnectRequest
from services.yandex_calendar_client import (
    YandexCalendarClient,
    YandexCalendarError,
    default_calendar_path,
)


class CalendarService:
    def __init__(self, connections: CalendarConnectionRepository, user_id: int):
        self.connections = connections
        self.user_id = user_id

    async def connect_yandex(self, request: YandexConnectRequest) -> YandexCalendarStatus:
        login = request.login.strip()
        password = request.app_password.strip()
        path = default_calendar_path(login)
        try:
            async with YandexCalendarClient(login, password, calendar_path=path) as client:
                await client.verify()
        except YandexCalendarError as exc:
            status = 401 if exc.status_code in (401, 403) else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc

        await self.connections.upsert_yandex(
            self.user_id,
            login=login,
            app_password_encrypted=encrypt_secret(password),
            calendar_path=path,
        )
        return await self.yandex_status()

    async def yandex_status(self) -> YandexCalendarStatus:
        connection = await self.connections.get_for_user(self.user_id)
        if connection is None:
            return YandexCalendarStatus(connected=False)
        return YandexCalendarStatus(
            connected=True,
            login=connection.login,
            connected_at=connection.connected_at,
        )

    async def disconnect_yandex(self) -> None:
        deleted = await self.connections.delete_for_user(self.user_id)
        if not deleted:
            raise HTTPException(status_code=404, detail="Яндекс Календарь не подключён")

    async def get_connection(self) -> CalendarConnection | None:
        return await self.connections.get_for_user(self.user_id)

    def open_client(self, connection: CalendarConnection) -> YandexCalendarClient:
        password = decrypt_secret(connection.app_password_encrypted)
        return YandexCalendarClient(
            connection.login,
            password,
            calendar_path=connection.calendar_path,
        )
