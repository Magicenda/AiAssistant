import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.crypto import decrypt_secret, encrypt_secret
from core.time import now_moscow
from db.models import BaseModel, CalendarConnection, User
from db.repository.calendar_connection_repository import CalendarConnectionRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from schemas.planner import MeetingCreate, MeetingPatch
from services.calendar_service import CalendarService
from services.profile_service import ProfileService
from services.yandex_calendar_client import (
    YandexCalendarClient,
    YandexCalendarError,
    build_event_ics,
    escape_ics_text,
    event_url,
    format_ics_datetime,
)
from services.yandex_oauth import create_oauth_state, parse_oauth_state


def test_ics_helpers():
    start = datetime(2026, 12, 1, 9, 0, tzinfo=timezone.utc)
    body = build_event_ics(uid="evt-1", summary="Встреча; тест, раз\nдва", start=start)
    assert "UID:evt-1" in body
    assert "DTSTART:20261201T090000Z" in body
    assert "DTEND:20261201T100000Z" in body
    assert "SUMMARY:Встреча\\; тест\\, раз\\nдва" in body
    assert escape_ics_text("a;b,c") == "a\\;b\\,c"
    assert format_ics_datetime(start) == "20261201T090000Z"
    assert event_url("user@yandex.ru", "evt-1").endswith(
        "/calendars/user@yandex.ru/events-default/evt-1.ics"
    )


def test_encrypt_roundtrip():
    token = encrypt_secret("oauth-access-token")
    assert token != "oauth-access-token"
    assert decrypt_secret(token) == "oauth-access-token"


def test_oauth_state_roundtrip():
    state = create_oauth_state(42)
    assert parse_oauth_state(state) == 42


def test_client_sends_oauth_header():
    async def scenario():
        seen = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["authorization"] = request.headers.get("Authorization")
            if request.method == "PUT":
                return httpx.Response(201, request=request)
            return httpx.Response(204, request=request)

        transport = httpx.MockTransport(handler)
        async with httpx.AsyncClient(transport=transport) as http:
            client = YandexCalendarClient(
                "user@yandex.ru",
                access_token="y0_test_token",
                client=http,
            )
            await client.upsert_event(
                uid="uid-1",
                summary="Стендап",
                start=datetime(2026, 12, 1, 10, 0, tzinfo=timezone.utc),
            )
            await client.delete_event("uid-1")
        assert seen["authorization"] == "OAuth y0_test_token"

    asyncio.run(scenario())


def test_client_verify_rejects_unauthorized():
    async def scenario():
        transport = httpx.MockTransport(lambda request: httpx.Response(401, text="denied"))
        async with httpx.AsyncClient(transport=transport) as http:
            client = YandexCalendarClient(
                "user@yandex.ru", access_token="bad", client=http
            )
            with pytest.raises(YandexCalendarError) as exc:
                await client.verify()
            assert exc.value.status_code == 401

    asyncio.run(scenario())


def test_profile_sync_puts_and_deletes():
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
            service = ProfileService(
                TaskRepository(session),
                MeetingRepository(session),
                1,
                calendars,
            )
            when = now_moscow() + timedelta(days=1)
            put_mock = AsyncMock()
            delete_mock = AsyncMock()

            class FakeClient:
                def __init__(self, *args, **kwargs):
                    assert kwargs.get("access_token") == "y0_token"

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                upsert_event = put_mock
                delete_event = delete_mock

            with patch("services.profile_service.YandexCalendarClient", FakeClient):
                meeting = await service.create_meeting(
                    MeetingCreate(description="Созвон", appointment=when)
                )
                assert meeting.yandex_uid
                put_mock.assert_awaited()
                assert put_mock.await_args.kwargs["summary"] == "Созвон"
                await service.update_meeting(meeting.id, MeetingPatch(description="Созвон 2"))
                assert put_mock.await_count == 2
                uid = meeting.yandex_uid
                await service.delete_meeting(meeting.id)
                delete_mock.assert_awaited_once_with(uid)
        await engine.dispose()

    asyncio.run(scenario())


def test_profile_create_without_connection_skips_sync():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="owner", hashed_password="hash"))
            await session.flush()
            service = ProfileService(
                TaskRepository(session),
                MeetingRepository(session),
                1,
                CalendarConnectionRepository(session),
            )
            when = now_moscow() + timedelta(days=1)
            meeting = await service.create_meeting(
                MeetingCreate(description="Локально", appointment=when)
            )
            assert meeting.yandex_uid is None
        await engine.dispose()

    asyncio.run(scenario())


def test_calendar_oauth_callback_and_status():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="owner", hashed_password="hash"))
            await session.flush()
            service = CalendarService(CalendarConnectionRepository(session), user_id=None)
            state = create_oauth_state(1)

            class FakeCalClient:
                def __init__(self, *args, **kwargs):
                    pass

                async def __aenter__(self):
                    return self

                async def __aexit__(self, *args):
                    return None

                async def verify(self):
                    return None

            with (
                patch(
                    "services.calendar_service.exchange_code",
                    AsyncMock(
                        return_value={
                            "access_token": "y0_access",
                            "refresh_token": "y0_refresh",
                            "expires_in": 3600,
                        }
                    ),
                ),
                patch(
                    "services.calendar_service.fetch_user_login",
                    AsyncMock(return_value="user@yandex.ru"),
                ),
                patch("services.calendar_service.YandexCalendarClient", FakeCalClient),
                patch("services.calendar_service.settings") as fake_settings,
            ):
                fake_settings.yandex_oauth_success_redirect = ""
                response = await service.yandex_callback("auth-code", state)
                assert response.status_code == 200

            authed = CalendarService(CalendarConnectionRepository(session), user_id=1)
            status = await authed.yandex_status()
            assert status.connected is True
            assert status.login == "user@yandex.ru"
            conn_row = await CalendarConnectionRepository(session).get_for_user(1)
            assert conn_row is not None
            assert decrypt_secret(conn_row.access_token_encrypted) == "y0_access"
            assert decrypt_secret(conn_row.refresh_token_encrypted) == "y0_refresh"
            await authed.disconnect_yandex()
            assert (await authed.yandex_status()).connected is False
        await engine.dispose()

    asyncio.run(scenario())


def test_authorize_requires_oauth_config():
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            service = CalendarService(CalendarConnectionRepository(session), user_id=1)
            with patch("services.calendar_service.oauth_configured", return_value=False):
                from fastapi import HTTPException

                with pytest.raises(HTTPException) as exc:
                    await service.yandex_authorize()
                assert exc.value.status_code == 503
        await engine.dispose()

    asyncio.run(scenario())
