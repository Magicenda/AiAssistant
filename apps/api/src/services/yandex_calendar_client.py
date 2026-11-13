"""Минимальный async-клиент Яндекс Календаря по CalDAV (OAuth)."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any
from xml.etree import ElementTree as ET

import httpx

from services.caldav_ics import DEFAULT_EVENT_DURATION, build_event_ics
from services.yandex_oauth import create_yandex_http_client

# Реэкспорт для тестов и старых импортов.
from services.caldav_ics import escape_ics_text, format_ics_datetime  # noqa: F401

CALDAV_BASE = "https://caldav.yandex.ru"

_PROPFIND_BODY = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:">'
    "<d:prop><d:displayname/></d:prop>"
    "</d:propfind>"
)


def default_calendar_path(login: str) -> str:
    return f"/calendars/{login}/events-default/"


def event_url(login: str, uid: str, calendar_path: str | None = None) -> str:
    path = (calendar_path or default_calendar_path(login)).rstrip("/")
    return f"{CALDAV_BASE}{path}/{uid}.ics"


class YandexCalendarError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class YandexCalendarClient:
    def __init__(
        self,
        login: str,
        *,
        access_token: str,
        calendar_path: str | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self.login = login.strip()
        self.access_token = access_token
        self.calendar_path = calendar_path or default_calendar_path(self.login)
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> YandexCalendarClient:
        if self._client is None:
            self._client = create_yandex_http_client()
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _auth_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Authorization": f"OAuth {self.access_token}"}
        if extra:
            headers.update(extra)
        return headers

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("YandexCalendarClient используется без открытого клиента")
        return self._client

    async def verify(self) -> None:
        """Проверяет OAuth-токен через PROPFIND к календарю по умолчанию."""
        url = f"{CALDAV_BASE}{self.calendar_path.rstrip('/')}/"
        try:
            response = await self._http().request(
                "PROPFIND",
                url,
                content=_PROPFIND_BODY,
                headers=self._auth_headers(
                    {
                        "Content-Type": "application/xml; charset=utf-8",
                        "Depth": "0",
                    }
                ),
            )
        except httpx.RequestError as exc:
            raise YandexCalendarError(
                f"Не удалось связаться с Яндекс Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code not in (207, 200):
            detail = response.text[:200] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось подключиться к Яндекс Календарю ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
        try:
            ET.fromstring(response.text)
        except ET.ParseError as exc:
            raise YandexCalendarError("Некорректный ответ CalDAV при проверке подключения") from exc

    async def upsert_event(
        self,
        *,
        uid: str,
        summary: str,
        start: datetime,
        duration: timedelta = DEFAULT_EVENT_DURATION,
    ) -> None:
        body = build_event_ics(uid=uid, summary=summary, start=start, duration=duration)
        url = event_url(self.login, uid, self.calendar_path)
        try:
            response = await self._http().put(
                url,
                content=body.encode("utf-8"),
                headers=self._auth_headers({"Content-Type": "text/calendar; charset=utf-8"}),
            )
        except httpx.RequestError as exc:
            raise YandexCalendarError(
                f"Не удалось связаться с Яндекс Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code not in (200, 201, 204):
            detail = response.text[:300] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось сохранить событие в Яндекс Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )

    async def delete_event(self, uid: str) -> None:
        url = event_url(self.login, uid, self.calendar_path)
        try:
            response = await self._http().delete(url, headers=self._auth_headers())
        except httpx.RequestError as exc:
            raise YandexCalendarError(
                f"Не удалось связаться с Яндекс Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code not in (200, 204, 404):
            detail = response.text[:300] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось удалить событие в Яндекс Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
