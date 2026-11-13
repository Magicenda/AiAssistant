from datetime import datetime, timezone

from fastapi import HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

from core.config import settings
from core.crypto import decrypt_secret, encrypt_secret
from db.models import CalendarConnection
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from schemas.calendar import (
    AppleCalendarConnectRequest,
    AppleCalendarStatus,
    YandexAuthorizeResponse,
    YandexCalendarStatus,
)
from services.apple_calendar_client import AppleCalendarClient, AppleCalendarError
from services.yandex_calendar_client import (
    YandexCalendarClient,
    YandexCalendarError,
    default_calendar_path,
)
from services.yandex_oauth import (
    YandexOAuthError,
    build_authorize_url,
    create_oauth_state,
    exchange_code,
    fetch_user_login,
    oauth_configured,
    parse_oauth_state,
    refresh_access_token,
    token_expires_at_from_payload,
)


class CalendarService:
    def __init__(self, connections: CalendarConnectionRepository, user_id: int | None = None):
        self.connections = connections
        self.user_id = user_id

    def _require_user(self) -> int:
        if self.user_id is None:
            raise HTTPException(status_code=401, detail="Требуется авторизация")
        return self.user_id

    async def yandex_authorize(self) -> YandexAuthorizeResponse:
        if not oauth_configured():
            raise HTTPException(
                status_code=503,
                detail="Яндекс OAuth не настроен: задайте YANDEX_OAUTH_CLIENT_ID и YANDEX_OAUTH_CLIENT_SECRET",
            )
        state = create_oauth_state(self._require_user())
        return YandexAuthorizeResponse(authorize_url=build_authorize_url(state))

    async def yandex_callback(self, code: str | None, state: str | None):
        if not code or not state:
            raise HTTPException(status_code=400, detail="В callback нет code или state")
        try:
            user_id = parse_oauth_state(state)
            token_payload = await exchange_code(code)
            access_token = token_payload["access_token"]
            login = await fetch_user_login(access_token)
            path = default_calendar_path(login)
            async with YandexCalendarClient(login, access_token=access_token, calendar_path=path) as client:
                await client.verify()
        except YandexOAuthError as exc:
            status = 400 if "state" in str(exc).lower() else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc
        except YandexCalendarError as exc:
            status = 401 if exc.status_code in (401, 403) else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc

        refresh = token_payload.get("refresh_token")
        await self.connections.upsert_yandex(
            user_id,
            login=login,
            access_token_encrypted=encrypt_secret(access_token),
            refresh_token_encrypted=encrypt_secret(refresh) if refresh else None,
            token_expires_at=token_expires_at_from_payload(token_payload),
            calendar_path=path,
        )

        if settings.yandex_oauth_success_redirect:
            return RedirectResponse(url=settings.yandex_oauth_success_redirect, status_code=302)
        return HTMLResponse(
            "<!doctype html><html><body style='font-family:sans-serif;padding:2rem'>"
            "<h1>Яндекс Календарь подключён</h1>"
            "<p>Можно закрыть это окно и вернуться в приложение.</p>"
            "<script>window.close && window.close()</script>"
            "</body></html>"
        )

    async def yandex_status(self) -> YandexCalendarStatus:
        connection = await self.connections.get_for_user(self._require_user(), "yandex")
        if connection is None:
            return YandexCalendarStatus(connected=False)
        return YandexCalendarStatus(
            connected=True,
            login=connection.login,
            connected_at=connection.connected_at,
        )

    async def disconnect_yandex(self) -> None:
        deleted = await self.connections.delete_for_user(self._require_user(), "yandex")
        if not deleted:
            raise HTTPException(status_code=404, detail="Яндекс Календарь не подключён")

    async def apple_connect(self, request: AppleCalendarConnectRequest) -> AppleCalendarStatus:
        user_id = self._require_user()
        try:
            async with AppleCalendarClient(
                request.apple_id, app_password=request.app_password
            ) as client:
                path = await client.verify()
        except AppleCalendarError as exc:
            status = 401 if exc.status_code in (401, 403) else 502
            raise HTTPException(status_code=status, detail=str(exc)) from exc

        connection = await self.connections.upsert_apple(
            user_id,
            login=request.apple_id,
            app_password_encrypted=encrypt_secret(request.app_password),
            calendar_path=path,
        )
        return AppleCalendarStatus(
            connected=True,
            login=connection.login,
            connected_at=connection.connected_at,
        )

    async def apple_status(self) -> AppleCalendarStatus:
        connection = await self.connections.get_for_user(self._require_user(), "apple")
        if connection is None:
            return AppleCalendarStatus(connected=False)
        return AppleCalendarStatus(
            connected=True,
            login=connection.login,
            connected_at=connection.connected_at,
        )

    async def disconnect_apple(self) -> None:
        deleted = await self.connections.delete_for_user(self._require_user(), "apple")
        if not deleted:
            raise HTTPException(status_code=404, detail="Apple Календарь не подключён")

    async def resolve_access_token(self, connection: CalendarConnection) -> str:
        """Возвращает действующий access_token, при необходимости обновляя его."""
        access = decrypt_secret(connection.access_token_encrypted)
        expires_at = connection.token_expires_at
        if expires_at is not None and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        still_valid = expires_at is None or expires_at > datetime.now(timezone.utc)
        if still_valid:
            return access
        if not connection.refresh_token_encrypted:
            raise YandexOAuthError("OAuth-токен истёк, переподключите Яндекс Календарь")
        refresh = decrypt_secret(connection.refresh_token_encrypted)
        payload = await refresh_access_token(refresh)
        new_access = payload["access_token"]
        new_refresh = payload.get("refresh_token")
        await self.connections.update_tokens(
            connection,
            access_token_encrypted=encrypt_secret(new_access),
            refresh_token_encrypted=encrypt_secret(new_refresh) if new_refresh else None,
            token_expires_at=token_expires_at_from_payload(payload),
        )
        return new_access
