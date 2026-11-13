"""Async-клиент iCloud Calendar по CalDAV (Apple ID + пароль приложения)."""

from __future__ import annotations

import base64
from datetime import datetime, timedelta
from typing import Any
from urllib.parse import urljoin, urlparse
from xml.etree import ElementTree as ET

import httpx

from services.caldav_ics import DEFAULT_EVENT_DURATION, build_event_ics
from services.yandex_oauth import create_yandex_http_client

CALDAV_BASE = "https://caldav.icloud.com"

_DAV = "{DAV:}"
_CAL = "{urn:ietf:params:xml:ns:caldav}"

_PROPFIND_PRINCIPAL = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:">'
    "<d:prop><d:current-user-principal/></d:prop>"
    "</d:propfind>"
)

_PROPFIND_HOME = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
    "<d:prop><c:calendar-home-set/></d:prop>"
    "</d:propfind>"
)

_PROPFIND_CALENDARS = (
    '<?xml version="1.0" encoding="utf-8"?>'
    '<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
    "<d:prop>"
    "<d:displayname/><d:resourcetype/>"
    "<c:supported-calendar-component-set/>"
    "</d:prop>"
    "</d:propfind>"
)


class AppleCalendarError(Exception):
    def __init__(self, message: str, status_code: int | None = None):
        super().__init__(message)
        self.status_code = status_code


def _basic_auth_header(apple_id: str, app_password: str) -> str:
    raw = f"{apple_id}:{app_password}".encode("utf-8")
    return "Basic " + base64.b64encode(raw).decode("ascii")


def _local_name(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _text_of(element: ET.Element | None) -> str | None:
    if element is None or element.text is None:
        return None
    value = element.text.strip()
    return value or None


def _href_to_path(href: str, base: str = CALDAV_BASE) -> str:
    """Нормализует href из PROPFIND в path на caldav.icloud.com."""
    href = href.strip()
    if href.startswith("http://") or href.startswith("https://"):
        parsed = urlparse(href)
        return parsed.path or "/"
    if href.startswith("/"):
        return href
    return urlparse(urljoin(base + "/", href)).path


def _first_href(root: ET.Element, *local_names: str) -> str | None:
    wanted = set(local_names)
    for node in root.iter():
        if _local_name(node.tag) in wanted:
            href = node.find(f"{_DAV}href")
            text = _text_of(href)
            if text:
                return text
            # Иногда текст лежит прямо в элементе.
            direct = _text_of(node)
            if direct and direct.startswith("/"):
                return direct
    return None


def _supports_vevent(response: ET.Element) -> bool:
    for node in response.iter():
        if _local_name(node.tag) == "comp" and node.attrib.get("name", "").upper() == "VEVENT":
            return True
    # Если сервер не отдал supported-calendar-component-set, считаем календарь подходящим.
    has_calendar = False
    for node in response.iter():
        if _local_name(node.tag) == "calendar" and node.tag.startswith("{urn:ietf:params:xml:ns:caldav}"):
            has_calendar = True
            break
    return has_calendar


class AppleCalendarClient:
    def __init__(
        self,
        apple_id: str,
        *,
        app_password: str,
        calendar_path: str | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self.apple_id = apple_id.strip()
        self.app_password = app_password.replace(" ", "").strip()
        self.calendar_path = calendar_path
        self._client = client
        self._owns_client = client is None

    async def __aenter__(self) -> AppleCalendarClient:
        if self._client is None:
            # Тот же IPv4-транспорт, что и для Яндекса: на части сетей IPv6 рвётся.
            self._client = create_yandex_http_client()
        return self

    async def __aexit__(self, *args: Any) -> None:
        if self._owns_client and self._client is not None:
            await self._client.aclose()
            self._client = None

    def _auth_headers(self, extra: dict[str, str] | None = None) -> dict[str, str]:
        headers = {"Authorization": _basic_auth_header(self.apple_id, self.app_password)}
        if extra:
            headers.update(extra)
        return headers

    def _http(self) -> httpx.AsyncClient:
        if self._client is None:
            raise RuntimeError("AppleCalendarClient используется без открытого клиента")
        return self._client

    async def _propfind(self, url: str, body: str, *, depth: str) -> ET.Element:
        try:
            response = await self._http().request(
                "PROPFIND",
                url,
                content=body,
                headers=self._auth_headers(
                    {
                        "Content-Type": "application/xml; charset=utf-8",
                        "Depth": depth,
                    }
                ),
            )
        except httpx.RequestError as exc:
            raise AppleCalendarError(
                f"Не удалось связаться с iCloud Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code in (401, 403):
            raise AppleCalendarError(
                "Неверный Apple ID или код доступа. Создайте пароль приложения в настройках Apple ID.",
                status_code=response.status_code,
            )
        if response.status_code not in (207, 200):
            detail = response.text[:200] if response.text else ""
            raise AppleCalendarError(
                f"Не удалось выполнить запрос к iCloud ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
        try:
            return ET.fromstring(response.text)
        except ET.ParseError as exc:
            raise AppleCalendarError("Некорректный ответ CalDAV от iCloud") from exc

    async def discover_calendar_path(self) -> str:
        """Находит writable calendar path: principal → home-set → первый VEVENT-календарь."""
        root = await self._propfind(f"{CALDAV_BASE}/", _PROPFIND_PRINCIPAL, depth="0")
        principal_href = _first_href(root, "current-user-principal")
        if not principal_href:
            raise AppleCalendarError("iCloud не вернул current-user-principal")
        principal_path = _href_to_path(principal_href)

        home_root = await self._propfind(
            f"{CALDAV_BASE}{principal_path}", _PROPFIND_HOME, depth="0"
        )
        home_href = _first_href(home_root, "calendar-home-set")
        if not home_href:
            raise AppleCalendarError("iCloud не вернул calendar-home-set")
        home_path = _href_to_path(home_href).rstrip("/") + "/"

        calendars_root = await self._propfind(
            f"{CALDAV_BASE}{home_path}", _PROPFIND_CALENDARS, depth="1"
        )
        for response in calendars_root.findall(f"{_DAV}response"):
            href_el = response.find(f"{_DAV}href")
            href = _text_of(href_el)
            if not href:
                continue
            path = _href_to_path(href).rstrip("/") + "/"
            if path.rstrip("/") == home_path.rstrip("/"):
                continue
            if _supports_vevent(response):
                return path

        raise AppleCalendarError(
            "В iCloud не найден календарь для событий. Создайте календарь в приложении Календарь и попробуйте снова."
        )

    async def verify(self) -> str:
        """Проверяет учётные данные и возвращает путь календаря."""
        path = self.calendar_path or await self.discover_calendar_path()
        # Depth 0 PROPFIND к найденному календарю — финальная проверка записи/чтения метаданных.
        await self._propfind(
            f"{CALDAV_BASE}{path.rstrip('/')}/",
            (
                '<?xml version="1.0" encoding="utf-8"?>'
                '<d:propfind xmlns:d="DAV:">'
                "<d:prop><d:displayname/></d:prop>"
                "</d:propfind>"
            ),
            depth="0",
        )
        self.calendar_path = path
        return path

    def _event_url(self, uid: str) -> str:
        if not self.calendar_path:
            raise AppleCalendarError("Не задан calendar_path для Apple Календаря")
        path = self.calendar_path.rstrip("/")
        return f"{CALDAV_BASE}{path}/{uid}.ics"

    async def upsert_event(
        self,
        *,
        uid: str,
        summary: str,
        start: datetime,
        duration: timedelta = DEFAULT_EVENT_DURATION,
    ) -> None:
        body = build_event_ics(uid=uid, summary=summary, start=start, duration=duration)
        try:
            response = await self._http().put(
                self._event_url(uid),
                content=body.encode("utf-8"),
                headers=self._auth_headers({"Content-Type": "text/calendar; charset=utf-8"}),
            )
        except httpx.RequestError as exc:
            raise AppleCalendarError(
                f"Не удалось связаться с iCloud Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code not in (200, 201, 204):
            detail = response.text[:300] if response.text else ""
            raise AppleCalendarError(
                f"Не удалось сохранить событие в Apple Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )

    async def delete_event(self, uid: str) -> None:
        try:
            response = await self._http().delete(
                self._event_url(uid), headers=self._auth_headers()
            )
        except httpx.RequestError as exc:
            raise AppleCalendarError(
                f"Не удалось связаться с iCloud Календарём: {exc or type(exc).__name__}"
            ) from exc
        if response.status_code not in (200, 204, 404):
            detail = response.text[:300] if response.text else ""
            raise AppleCalendarError(
                f"Не удалось удалить событие в Apple Календаре ({response.status_code}): {detail}",
                status_code=response.status_code,
            )
