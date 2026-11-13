"""OAuth Яндекс ID для доступа к Календарю (CalDAV)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import jwt

from core.config import settings

AUTHORIZE_URL = "https://oauth.yandex.ru/authorize"
TOKEN_URL = "https://oauth.yandex.ru/token"
INFO_URL = "https://login.yandex.ru/info"
STATE_TTL_MINUTES = 10


class YandexOAuthError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def create_yandex_http_client(timeout: float = 30.0) -> httpx.AsyncClient:
    """Клиент к API Яндекса.

    На части сетей IPv6 до oauth/login.yandex.ru обрывается на TLS,
    поэтому исходящие соединения идут с IPv4 (`local_address=0.0.0.0`).
    """
    transport = httpx.AsyncHTTPTransport(local_address="0.0.0.0")
    return httpx.AsyncClient(timeout=timeout, transport=transport)


def oauth_configured() -> bool:
    return bool(settings.yandex_oauth_client_id and settings.yandex_oauth_client_secret)


def create_oauth_state(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "uid": user_id,
        "purpose": "yandex_calendar",
        "iat": now,
        "exp": now + timedelta(minutes=STATE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def parse_oauth_state(state: str) -> int:
    try:
        payload = jwt.decode(
            state,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "uid", "purpose"]},
        )
    except jwt.InvalidTokenError as exc:
        raise YandexOAuthError("Недействительный или истёкший state OAuth") from exc
    if payload.get("purpose") != "yandex_calendar":
        raise YandexOAuthError("Недействительный state OAuth")
    try:
        return int(payload["uid"])
    except (TypeError, ValueError) as exc:
        raise YandexOAuthError("Недействительный state OAuth") from exc


def build_authorize_url(state: str) -> str:
    query = urlencode(
        {
            "response_type": "code",
            "client_id": settings.yandex_oauth_client_id,
            "redirect_uri": settings.yandex_oauth_redirect_uri,
            "scope": settings.yandex_oauth_scopes,
            "force_confirm": "yes",
            "state": state,
        }
    )
    return f"{AUTHORIZE_URL}?{query}"


async def exchange_code(code: str, *, client: httpx.AsyncClient | None = None) -> dict[str, Any]:
    http = client or create_yandex_http_client()
    owns = client is None
    try:
        try:
            response = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": settings.yandex_oauth_client_id,
                    "client_secret": settings.yandex_oauth_client_secret,
                    "redirect_uri": settings.yandex_oauth_redirect_uri,
                },
            )
        except httpx.RequestError as exc:
            raise YandexOAuthError(
                f"Не удалось связаться с Яндекс OAuth при обмене code: {exc or type(exc).__name__}"
            ) from exc
    finally:
        if owns:
            await http.aclose()
    if response.status_code != 200:
        detail = response.text[:300] if response.text else ""
        raise YandexOAuthError(
            f"Не удалось обменять code на токен ({response.status_code}): {detail}",
            status_code=response.status_code,
        )
    data = response.json()
    if "access_token" not in data:
        raise YandexOAuthError("Ответ Яндекса без access_token")
    return data


async def refresh_access_token(
    refresh_token: str, *, client: httpx.AsyncClient | None = None
) -> dict[str, Any]:
    http = client or create_yandex_http_client()
    owns = client is None
    try:
        try:
            response = await http.post(
                TOKEN_URL,
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "client_id": settings.yandex_oauth_client_id,
                    "client_secret": settings.yandex_oauth_client_secret,
                },
            )
        except httpx.RequestError as exc:
            raise YandexOAuthError(
                f"Не удалось связаться с Яндекс OAuth при refresh: {exc or type(exc).__name__}"
            ) from exc
    finally:
        if owns:
            await http.aclose()
    if response.status_code != 200:
        detail = response.text[:300] if response.text else ""
        raise YandexOAuthError(
            f"Не удалось обновить OAuth-токен ({response.status_code}): {detail}",
            status_code=response.status_code,
        )
    data = response.json()
    if "access_token" not in data:
        raise YandexOAuthError("Ответ Яндекса без access_token при refresh")
    return data


async def fetch_user_login(access_token: str, *, client: httpx.AsyncClient | None = None) -> str:
    http = client or create_yandex_http_client()
    owns = client is None
    try:
        try:
            response = await http.get(
                INFO_URL,
                params={"format": "json"},
                headers={"Authorization": f"OAuth {access_token}"},
            )
        except httpx.RequestError as exc:
            raise YandexOAuthError(
                f"Не удалось связаться с Яндекс ID: {exc or type(exc).__name__}"
            ) from exc
    finally:
        if owns:
            await http.aclose()
    if response.status_code != 200:
        detail = response.text[:200] if response.text else ""
        raise YandexOAuthError(
            f"Не удалось получить профиль Яндекса ({response.status_code}): {detail}",
            status_code=response.status_code,
        )
    data = response.json()
    login = data.get("default_email") or data.get("login")
    if not login:
        raise YandexOAuthError("В профиле Яндекса нет email/login")
    if "@" not in str(login):
        login = f"{login}@yandex.ru"
    return str(login)


def token_expires_at_from_payload(data: dict[str, Any]) -> datetime | None:
    expires_in = data.get("expires_in")
    if expires_in is None:
        return None
    try:
        seconds = int(expires_in)
    except (TypeError, ValueError):
        return None
    return datetime.now(timezone.utc) + timedelta(seconds=max(seconds - 60, 0))
