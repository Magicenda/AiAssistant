from db.repository.meeting_repository import MeetingRepository
from schemas.tool import CreateMeetingArgs
from tools.base import Toolkit, tool


class MeetingToolkit(Toolkit):
    def __init__(self, repository: MeetingRepository):
        self.repository = repository

    @tool(
        "create_meeting",
        "Создаёт встречу в календаре. Вызывай, когда пользователь просит назначить, "
        "записать или запланировать встречу. Дата и время обязательны.",
        CreateMeetingArgs,
    )
    async def create_meeting(self, args: CreateMeetingArgs) -> dict:
        meeting = await self.repository.create_meeting(args.description, args.appointment)
        return {
            "id": meeting.id,
            "description": meeting.description,
            "appointment": meeting.appointment.isoformat(),
        }
