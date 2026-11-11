from core.time import as_moscow
from schemas.planner import MeetingCreate
from schemas.tool import CreateMeetingArgs
from services.profile_service import ProfileService
from tools.base import Toolkit, tool


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
        return {
            "id": meeting.id,
            "description": meeting.description,
            "appointment": as_moscow(meeting.appointment).isoformat(),
        }
