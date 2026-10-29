from db.repository.meeting_repository import MeetingRepository
from schemas.tool import CreateMeetingArgs
from tools.base import Toolkit, tool


class MeetingToolkit(Toolkit):
    def __init__(self, repository: MeetingRepository, user_id: int):
        self.repository = repository
        self.user_id = user_id

    @tool(
        "create_meeting",
        "Создаёт встречу в календаре. Вызывай, когда пользователь просит назначить, "
        "записать или запланировать встречу. Дата и время обязательны.",
        CreateMeetingArgs,
    )
    async def create_meeting(self, args: CreateMeetingArgs) -> dict:
        meeting = await self.repository.create_meeting(self.user_id, args.description, args.appointment)
        return {
            "id": meeting.id,
            "description": meeting.description,
            "appointment": meeting.appointment.isoformat(),
        }
