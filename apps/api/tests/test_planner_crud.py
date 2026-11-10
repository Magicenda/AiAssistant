import asyncio
from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from core.time import as_moscow, now_moscow
from db.models import BaseModel, Type, User
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from schemas.planner import MeetingCreate, MeetingPatch, TaskCreate, TaskPatch
from services.profile_service import ProfileService


@pytest.mark.parametrize("kind", [Type.TASK, Type.NOTIFY, None])
def test_crud_and_user_isolation(kind):
    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add_all([
                User(id=1, username="owner", hashed_password="hash"),
                User(id=2, username="other", hashed_password="hash"),
            ])
            await session.flush()
            tasks, meetings = TaskRepository(session), MeetingRepository(session)
            owner = ProfileService(tasks, meetings, 1)
            other = ProfileService(tasks, meetings, 2)
            when = now_moscow() + timedelta(days=1)
            if kind is None:
                item = await owner.create_meeting(MeetingCreate(description="Исходное", appointment=when))
                fetch = lambda service: service.get_meeting(item.id)
                update = lambda patch: owner.update_meeting(item.id, MeetingPatch(**patch))
                remove = lambda: owner.delete_meeting(item.id)
                date_field = "appointment"
            else:
                item = await owner.create_task(TaskCreate(description="Исходное", deadline=when), kind)
                fetch = lambda service: service.get_task(item.id, kind)
                update = lambda patch: owner.update_task(item.id, kind, TaskPatch(**patch))
                remove = lambda: owner.delete_task(item.id, kind)
                date_field = "deadline"
                wrong_kind = Type.NOTIFY if kind == Type.TASK else Type.TASK
                with pytest.raises(HTTPException) as exc:
                    await owner.get_task(item.id, wrong_kind)
                assert exc.value.status_code == 404
            await session.commit()
            assert (await fetch(owner)).description == "Исходное"
            with pytest.raises(HTTPException) as exc:
                await fetch(other)
            assert exc.value.status_code == 404
            await update({"description": "Новое"})
            assert item.description == "Новое"
            assert as_moscow(getattr(item, date_field)) == when
            if kind == Type.NOTIFY:
                item.notified_at = now_moscow()
            moved = when + timedelta(hours=2)
            await update({date_field: moved})
            assert item.description == "Новое"
            assert getattr(item, date_field) == moved
            if kind == Type.NOTIFY:
                assert item.notified_at is None
            await remove()
            await session.commit()
            with pytest.raises(HTTPException) as exc:
                await fetch(owner)
            assert exc.value.status_code == 404
        await engine.dispose()

    asyncio.run(scenario())


@pytest.mark.parametrize("schema, date_field", [(TaskPatch, "deadline"), (MeetingPatch, "appointment")])
def test_patch_validation(schema, date_field):
    for payload in [{}, {"description": None}, {date_field: None},
                    {"description": "   "}, {"description": "a" * 256},
                    {"user_id": 2}, {date_field: "invalid"}]:
        with pytest.raises(ValidationError):
            schema.model_validate(payload)
    assert schema(description=" Новое ").model_dump(exclude_unset=True) == {"description": "Новое"}


def test_http_crud_contract():
    # Load the profile router without initializing speech/LLM dependencies.
    import importlib.util
    import sys
    import types
    from pathlib import Path
    from typing import Annotated
    from unittest.mock import patch

    import httpx
    from fastapi import Depends, FastAPI

    async def scenario():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with engine.begin() as conn:
            await conn.run_sync(BaseModel.metadata.create_all)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            session.add(User(id=1, username="http-user", hashed_password="hash"))
            await session.flush()
            service = ProfileService(TaskRepository(session), MeetingRepository(session), 1)

            def get_service():
                return service

            deps = types.ModuleType("deps")
            deps.ProfileServiceDep = Annotated[ProfileService, Depends(get_service)]
            path = Path(__file__).parents[1] / "src/routes/profile_controller.py"
            spec = importlib.util.spec_from_file_location("planner_router_test", path)
            module = importlib.util.module_from_spec(spec)
            with patch.dict(sys.modules, {"deps": deps}):
                spec.loader.exec_module(module)
            app = FastAPI()
            app.include_router(module.router, prefix="/api")
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
                for resource, date_field in [("tasks", "deadline"), ("reminders", "deadline"), ("meetings", "appointment")]:
                    base = f"/api/profile/{resource}"
                    response = await client.post(base, json={"description": "Создать", date_field: "2026-12-01T12:00:00+03:00"})
                    assert response.status_code == 201, response.text
                    item = response.json()
                    url = f"{base}/{item['id']}"
                    assert (await client.get(url)).status_code == 200
                    assert len((await client.get(base)).json()) == 1
                    response = await client.patch(url, json={"description": "Изменить"})
                    assert response.status_code == 200
                    assert as_moscow(datetime.fromisoformat(response.json()[date_field])) == as_moscow(datetime.fromisoformat(item[date_field]))
                    response = await client.patch(url, json={date_field: "2026-12-02T12:00:00+03:00"})
                    assert response.status_code == 200
                    assert response.json()["description"] == "Изменить"
                    for payload in [{}, {"description": None}, {"user_id": 2}]:
                        assert (await client.patch(url, json=payload)).status_code == 422
                    response = await client.delete(url)
                    assert response.status_code == 204
                    assert response.content == b""
                    assert (await client.get(url)).status_code == 404
                    assert (await client.patch(url, json={"description": "Нет"})).status_code == 404
                    assert (await client.delete(url)).status_code == 404
        await engine.dispose()

    asyncio.run(scenario())
