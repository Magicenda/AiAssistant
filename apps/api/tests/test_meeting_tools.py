import asyncio
from datetime import datetime

from core.time import MOSCOW_TZ
from db.models import Meeting
from schemas.tool import DeleteAllMeetingsArgs, DeleteMeetingArgs, ListMeetingsArgs
from tools.meeting_tools import MeetingToolkit


class FakeMeetingRepository:
    def __init__(self, meetings: list[Meeting]):
        self.meetings = meetings
        self.list_values = None
        self.deleted_meeting = None
        self.deleted_all_user_id = None

    async def list_meetings(self, user_id, limit, only_upcoming):
        self.list_values = (user_id, limit, only_upcoming)
        own = [meeting for meeting in self.meetings if meeting.user_id == user_id]
        return own[:limit]

    async def get_meeting(self, user_id, meeting_id):
        for meeting in self.meetings:
            if meeting.user_id == user_id and meeting.id == meeting_id:
                return meeting
        return None

    async def delete_meeting(self, meeting):
        self.deleted_meeting = meeting
        self.meetings.remove(meeting)

    async def delete_all_meetings(self, user_id):
        self.deleted_all_user_id = user_id
        own = [meeting for meeting in self.meetings if meeting.user_id == user_id]
        for meeting in own:
            self.meetings.remove(meeting)
        return len(own)


def make_meeting(meeting_id: int, user_id: int, description: str) -> Meeting:
    return Meeting(
        id=meeting_id,
        user_id=user_id,
        description=description,
        appointment=datetime(2026, 11, 12, 15, 0, tzinfo=MOSCOW_TZ),
    )


def test_meeting_toolkit_exposes_list_and_delete_tools():
    names = {tool.name for tool in MeetingToolkit(FakeMeetingRepository([]), 42).tools()}

    assert {
        "create_meeting",
        "list_meetings",
        "delete_meeting",
        "delete_all_meetings",
    } <= names


def test_list_meetings_returns_only_users_meetings():
    repository = FakeMeetingRepository([
        make_meeting(1, 42, "Планёрка"),
        make_meeting(2, 7, "Чужая встреча"),
    ])
    toolkit = MeetingToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.list_meetings(ListMeetingsArgs(limit=10, only_upcoming=True)))

    assert repository.list_values == (42, 10, True)
    assert result == {
        "count": 1,
        "meetings": [
            {
                "id": 1,
                "description": "Планёрка",
                "appointment": "2026-11-12T15:00:00+03:00",
            }
        ],
    }


def test_delete_meeting_removes_only_users_meeting():
    own = make_meeting(1, 42, "Планёрка")
    repository = FakeMeetingRepository([own, make_meeting(2, 7, "Чужая встреча")])
    toolkit = MeetingToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_meeting(DeleteMeetingArgs(meeting_id=1)))

    assert repository.deleted_meeting is own
    assert result == {
        "deleted": True,
        "meeting": {
            "id": 1,
            "description": "Планёрка",
            "appointment": "2026-11-12T15:00:00+03:00",
        },
    }


def test_delete_meeting_refuses_another_users_meeting():
    repository = FakeMeetingRepository([make_meeting(2, 7, "Чужая встреча")])
    toolkit = MeetingToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_meeting(DeleteMeetingArgs(meeting_id=2)))

    assert repository.deleted_meeting is None
    assert result == {"error": "Встреча с id 2 не найдена"}

def test_delete_all_meetings_removes_only_users_meetings():
    repository = FakeMeetingRepository([
        make_meeting(1, 42, "Планёрка"),
        make_meeting(2, 42, "Созвон"),
        make_meeting(3, 7, "Чужая встреча"),
    ])
    toolkit = MeetingToolkit(repository, user_id=42)

    result = asyncio.run(toolkit.delete_all_meetings(DeleteAllMeetingsArgs()))

    assert result == {"deleted": 2}
    assert repository.deleted_all_user_id == 42
    assert [(meeting.id, meeting.user_id) for meeting in repository.meetings] == [(3, 7)]
