"""Минимальный async-клиент Яндекс Календаря по CalDAV."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from xml.etree import ElementTree as ET

import httpx

CALDAV_BASE = "https://caldav.yandex.ru"
DEFAULT_EVENT_DURATION = timedelta(hours=1)

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


def escape_ics_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def format_ics_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_event_ics(
    *,
    uid: str,
    summary: str,
    start: datetime,
    duration: timedelta = DEFAULT_EVENT_DURATION,
) -> str:
    end = start + duration
    stamp = format_ics_datetime(datetime.now(timezone.utc))
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AiAssistant//EN",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{format_ics_datetime(start)}",
            f"DTEND:{format_ics_datetime(end)}",
            f"SUMMARY:{escape_ics_text(summary)}",
            "END:VEVENT",
            "END:VCALENDAR",
            "",
        ]
    )


class YandexCalendarError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


class YandexCalendarClient:
    def __init__(
        self,
        login: str,
        app_password: str,
        *,
        calendar_path: str | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self.login = login.strip()
        self.app_password = app_password
        self.calendar_path = calendar_path or default_calendar_path(self.login)
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> YandexCalendarClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _auth(self) -> httpx.BasicAuth:
        return httpx.BasicAuth(self.login, self.app_password)

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("YandexCalendarClient используется без открытого клиента")
        return self._client

    async def verify(self) -> None:
        """Проверяет логин/пароль через PROPFIND к календарю по умолчанию."""
        url = f"{CALDAV_BASE}{self.calendar_path.rstrip('/')}/"
        response = await self._http().request(
            "PROPFIND",
            url,
            content=_PROPFIND_BODY,
            headers={
                "Content-Type": "application/xml; charset=utf-8",
                "Depth": "0",
            },
            auth=self._auth(),
        )
        if response.status_code not in (207, 200):
            detail = response.text[:200] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось подключиться к Яндекс Календарю ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
        # Ответ должен быть XML multi-status; пустой/HTML — тоже ошибка.
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
        response = await self._http().put(
            url,
            content=body.encode("utf-8"),
            headers={"Content-Type": "text/calendar; charset=utf-8"},
            auth=self._auth(),
        )
        if response.status_code not in (200, 201, 204):
            detail = response.text[:300] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось сохранить событие в Яндекс Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )

    async def delete_event(self, uid: str) -> None:
        url = event_url(self.login, uid, self.calendar_path)
        response = await self._http().delete(url, auth=self._auth())
        # 404 — уже удалено на стороне Яндекса, для нас это успех.
        if response.status_code not in (200, 204, 404):
            detail = response.text[:300] if response.text else ""
            raise YandexCalendarError(
                f"Не удалось удалить событие в Яндекс Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
