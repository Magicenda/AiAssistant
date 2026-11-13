from core.time import as_moscow
from db.models import Meeting
from schemas.planner import MeetingCreate
from schemas.tool import (
    CreateMeetingArgs,
    DeleteAllMeetingsArgs,
    DeleteMeetingArgs,
    ListMeetingsArgs,
)
from services.profile_service import ProfileService
from tools.base import Toolkit, tool


def _meeting_to_dict(meeting: Meeting) -> dict:
    return {
        "id": meeting.id,
        "description": meeting.description,
        "appointment": as_moscow(meeting.appointment).isoformat(),
    }


class MeetingToolkit(Toolkit):
    def __init__(self, profile: ProfileService):
        self.profile = profile

    @tool(
        "create_meeting",
        "Создаёт встречу в календаре. Вызывай, когда пользователь просит назначить, "
        "записать или запланировать встречу. Дата и время обязательны.",
        CreateMeetingArgs,
    )
    async def create_meeting(self, args: CreateMeetingArgs) -> dict:
        meeting = await self.profile.create_meeting(
            MeetingCreate(description=args.description, appointment=args.appointment)
        )
        return _meeting_to_dict(meeting)

    @tool(
        "list_meetings",
        "Возвращает список встреч пользователя. Вызывай, когда пользователь спрашивает, "
        "какие у него встречи, просит показать расписание или найти встречу. "
        "Для поиска только будущих встреч передай only_upcoming=true.",
        ListMeetingsArgs,
    )
    async def list_meetings(self, args: ListMeetingsArgs) -> dict:
        meetings = await self.profile.get_meetings(args.limit, args.only_upcoming)
        return {
            "count": len(meetings),
            "meetings": [_meeting_to_dict(meeting) for meeting in meetings],
        }

    @tool(
        "delete_meeting",
        "Удаляет встречу пользователя. Вызывай, когда пользователь явно просит удалить "
        "встречу. Если id неизвестен, сначала вызови list_meetings.",
        DeleteMeetingArgs,
    )
    async def delete_meeting(self, args: DeleteMeetingArgs) -> dict:
        meeting = await self.profile.find_meeting(args.meeting_id)
        if meeting is None:
            return {"error": f"Встреча с id {args.meeting_id} не найдена"}

        deleted_meeting = _meeting_to_dict(meeting)
        await self.profile.delete_meeting(args.meeting_id)
        return {"deleted": True, "meeting": deleted_meeting}

    @tool(
        "delete_all_meetings",
        "Удаляет все встречи пользователя одним вызовом. Вызывай только когда пользователь "
        "явно просит удалить все встречи.",
        DeleteAllMeetingsArgs,
    )
    async def delete_all_meetings(self, args: DeleteAllMeetingsArgs) -> dict:
        deleted = await self.profile.delete_all_meetings()
        return {"deleted": deleted}
