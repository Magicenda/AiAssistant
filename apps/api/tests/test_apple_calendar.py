import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.crypto import decrypt_secret, encrypt_secret
from core.time import now_moscow
from datetime import timedelta
from db.models import BaseModel, Type, User
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from schemas.calendar import AppleCalendarConnectRequest
from schemas.planner import MeetingCreate, TaskCreate
from services.apple_calendar_client import (
    AppleCalendarClient,
    AppleCalendarError,
    _href_to_path,
)
from services.caldav_ics import build_event_ics, escape_ics_text
from services.calendar_service import CalendarService
from services.profile_service import ProfileService


def test_shared_ics_helpers():
    start = datetime(2026, 12, 1, 9, 0, tzinfo=timezone.utc)
    body = build_event_ics(uid="evt-1", summary="Встреча; тест", start=start)
    assert "UID:evt-1" in body
    assert "SUMMARY:Встреча\\; тест" in body
    assert escape_ics_text("a;b") == "a\\;b"


def test_href_to_path():
    assert _href_to_path("/123/principal/") == "/123/principal/"
    assert _href_to_path("https://caldav.icloud.com/abc/calendars/") == "/abc/calendars/"


def test_apple_client_verify_and_upsert():
    async def scenario():
        calls: list[str] = []

        def handler(request: httpx.Request) -> httpx.Response:
            calls.append(f"{request.method} {request.url.path}")
            auth = request.headers.get("Authorization", "")
            assert auth.startswith("Basic ")
            if request.method == "PROPFIND" and request.url.path == "/":
                return httpx.Response(
                    207,
                    text=(
                        '<?xml version="1.0"?>'
                        '<d:multistatus xmlns:d="DAV:">'
                        "<d:response><d:propstat><d:prop>"
                        "<d:current-user-principal><d:href>/123/principal/</d:href>"
                        "</d:current-user-principal>"
                        "</d:prop></d:propstat></d:response>"
                        "</d:multistatus>"
                    ),
                    request=request,
                )
            if request.method == "PROPFIND" and request.url.path == "/123/principal/":
                return httpx.Response(
                    207,
                    text=(
                        '<?xml version="1.0"?>'
                        '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
                        "<d:response><d:propstat><d:prop>"
                        "<c:calendar-home-set><d:href>/123/calendars/</d:href>"
                        "</c:calendar-home-set>"
                        "</d:prop></d:propstat></d:response>"
                        "</d:multistatus>"
                    ),
                    request=request,
                )
            if request.method == "PROPFIND" and request.url.path == "/123/calendars/":
                return httpx.Response(
                    207,
                    text=(
                        '<?xml version="1.0"?>'
                        '<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">'
                        "<d:response>"
                        "<d:href>/123/calendars/</d:href>"
                        "<d:propstat><d:prop>"
                        '<d:resourcetype><d:collection/></d:resourcetype>'
                        "</d:prop></d:propstat>"
                        "</d:response>"
                        "<d:response>"
                        "<d:href>/123/calendars/home/</d:href>"
                        "<d:propstat><d:prop>"
                        "<d:displayname>Home</d:displayname>"
                        '<d:resourcetype><d:collection/><c:calendar/></d:resourcetype>'
                        '<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set>'
                        "</d:prop></d:propstat>"
                        "</d:response>"
                        "</d:multistatus>"
                    ),
                    request=request,
                )
            if request.method == "PROPFIND" and request.url.path == "/123/calendars/home/":
                return httpx.Response(
                    207,
                    text=(
                        '<?xml version="1.0"?>'
                        '<d:multistatus xmlns:d="DAV:">'
                        "<d:response><d:propstat><d:prop>"
                        "<d:displayname>Home</d:displayname>"
                        "</d:prop></d:propstat></d:response>"
                        "</d:multistatus>"
                    ),
                    request=request,
                )
            if request.method == "PUT":
                assert request.url.path.endswith("/uid-apple.ics")
                return httpx.Response(201, request=request)
            if request.method == "DELETE":
                return httpx.Response(204, request=request)
            return httpx.Response(500, text=f"unexpected {request.method} {request.url}", request=request)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as http:
            client = AppleCalendarClient(
                "user@icloud.com",
                app_password="abcd-efgh-ijkl-mnop",
                client=http,
            )
            path = await client.verify()
            assert path == "/123/calendars/home/"
            await client.upsert_event(
                uid="uid-apple",
                summary="Стендап",
                start=datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc),
            )
            await client.delete_event("uid-apple")
        assert any(c.startswith("PROPFIND /") for c in calls)
        assert any(c.startswith("PUT ") for c in calls)

    asyncio.run(scenario())


def test_apple_client_rejects_bad_password():
    async def scenario():
        transport = httpx.MockTransport(lambda request: httpx.Response(401, text="denied"))
        async with httpx.AsyncClient(transport=transport) as http:
            client = AppleCalendarClient("user@icloud.com", app_password="bad", client=http)
            with pytest.raises(AppleCalendarError) as exc:
                await client.verify()
            assert exc.value.status_code == 401

    asyncio.run(scenario())


def test_apple_connect_status_disconnect():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="owner", hashed_password="hash"))
            await session.flush()
            service = CalendarService(CalendarConnectionRepository(session), user_id=1)

            class FakeApple:
                def __init__(self, *args, **kwargs):
                    pass

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                async def verify(self):
                    return "/123/calendars/home/"

            with patch("services.calendar_service.AppleCalendarClient", FakeApple):
                status = await service.apple_connect(
                    AppleCalendarConnectRequest(
                        apple_id="user@icloud.com",
                        app_password="xxxx-yyyy-zzzz-wwww",
                    )
                )
            assert status.connected is True
            assert status.login == "user@icloud.com"
            row = await CalendarConnectionRepository(session).get_for_user(1, "apple")
            assert row is not None
            assert decrypt_secret(row.access_token_encrypted) == "xxxx-yyyy-zzzz-wwww"
            assert row.calendar_path == "/123/calendars/home/"
            assert (await service.apple_status()).connected is True
            await service.disconnect_apple()
            assert (await service.apple_status()).connected is False
        await engine.dispose()

    asyncio.run(scenario())


def test_dual_write_yandex_and_apple():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="owner", hashed_password="hash"))
            await session.flush()
            calendars = CalendarConnectionRepository(session)
            await calendars.upsert_yandex(
                1,
                login="user@yandex.ru",
                access_token_encrypted=encrypt_secret("y0_token"),
                refresh_token_encrypted=None,
                token_expires_at=None,
                calendar_path="/calendars/user@yandex.ru/events-default/",
            )
            await calendars.upsert_apple(
                1,
                login="user@icloud.com",
                app_password_encrypted=encrypt_secret("app-pass"),
                calendar_path="/123/calendars/home/",
            )
            service = ProfileService(
                TaskRepository(session),
                MeetingRepository(session),
                1,
                calendars,
            )
            when = now_moscow() + timedelta(days=1)
            yandex_put = AsyncMock()
            apple_put = AsyncMock()
            yandex_delete = AsyncMock()
            apple_delete = AsyncMock()

            class FakeYandex:
                def __init__(self, *args, **kwargs):
                    assert kwargs.get("access_token") == "y0_token"

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                upsert_event = yandex_put
                delete_event = yandex_delete

            class FakeApple:
                def __init__(self, *args, **kwargs):
                    assert kwargs.get("app_password") == "app-pass"

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                upsert_event = apple_put
                delete_event = apple_delete

            with (
                patch("services.profile_service.YandexCalendarClient", FakeYandex),
                patch("services.profile_service.AppleCalendarClient", FakeApple),
            ):
                meeting = await service.create_meeting(
                    MeetingCreate(description="Созвон", appointment=when)
                )
                assert meeting.yandex_uid
                assert meeting.apple_uid
                assert meeting.yandex_uid != meeting.apple_uid
                assert yandex_put.await_count == 1
                assert apple_put.await_count == 1

                uid_y = meeting.yandex_uid
                uid_a = meeting.apple_uid
                await service.delete_meeting(meeting.id)
                yandex_delete.assert_awaited_once_with(uid_y)
                apple_delete.assert_awaited_once_with(uid_a)

                reminder = await service.create_task(
                    TaskCreate(description="Напоминание", deadline=when), Type.NOTIFY
                )
                assert reminder.yandex_uid
                assert reminder.apple_uid
                assert yandex_put.await_count == 2
                assert apple_put.await_count == 2
        await engine.dispose()

    asyncio.run(scenario())


def test_apple_sync_only_unsynced_to_apple():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="owner", hashed_password="hash"))
            await session.flush()
            calendars = CalendarConnectionRepository(session)
            await calendars.upsert_apple(
                1,
                login="user@icloud.com",
                app_password_encrypted=encrypt_secret("app-pass"),
                calendar_path="/123/calendars/home/",
            )
            meetings = MeetingRepository(session)
            tasks = TaskRepository(session)
            service = ProfileService(tasks, meetings, 1, calendars)
            when = now_moscow() + timedelta(days=1)
            await meetings.create_meeting(1, "Старая", when)
            await tasks.create_task(1, "Старое напоминание", when, Type.NOTIFY)
            put_mock = AsyncMock()

            class FakeApple:
                def __init__(self, *args, **kwargs):
                    pass

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                upsert_event = put_mock

            with patch("services.profile_service.AppleCalendarClient", FakeApple):
                result = await service.sync_unsynced_items("apple")
            assert result == (1, 1, 0)
            assert put_mock.await_count == 2
            unsynced = await meetings.list_unsynced_meetings_for_provider(1, "apple")
            assert unsynced == []
        await engine.dispose()

    asyncio.run(scenario())
