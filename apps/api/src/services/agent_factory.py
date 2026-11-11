from sqlalchemy.ext.asyncio import AsyncSession

from db.repository.calendar_connection_repository import CalendarConnectionRepository
from db.repository.chat_repository import ChatRepository
from db.repository.meeting_repository import MeetingRepository
from db.repository.task_repository import TaskRepository
from services.agent_service import AgentService
from services.chat_service import ChatService
from services.llm_client import LLMClient
from services.profile_service import ProfileService
from tools.base import ToolRegistry
from tools.meeting_tools import MeetingToolkit
from tools.task_tools import TaskToolkit


def build_agent_service(llm: LLMClient, session: AsyncSession, user_id: int) -> AgentService:
    """Собирает агента вне запроса FastAPI (например, в фоновом воркере) на переданной сессии."""
    profile = ProfileService(
        TaskRepository(session),
        MeetingRepository(session),
        user_id,
        CalendarConnectionRepository(session),
    )
    tools = ToolRegistry([
        TaskToolkit(TaskRepository(session), user_id, profile),
        MeetingToolkit(profile),
    ])
    return AgentService(llm=llm, chat=ChatService(ChatRepository(session), user_id), tools=tools)
