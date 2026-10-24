from datetime import datetime, timezone

from gigachat import GigaChat

from core.config import settings
from db.models import Message
from services.chat_service import ChatService
from tools.base import ToolRegistry

SYSTEM_PROMPT = (
    "Ты полезный ассистент. Отвечай кратко и по-русски. "
    "Для работы с задачами, напоминаниями и встречами используй инструменты. "
    "Если для вызова не хватает даты или времени, уточни их у пользователя. "
    "Текущая дата и время (UTC): {now}."
)


def to_llm_message(m: Message) -> dict:
    return {"role": m.role.value, "content": [{"text": m.content}]}


class AgentService:
    def __init__(
        self,
        llm: GigaChat,
        chat: ChatService,
        tools: ToolRegistry,
        temperature: float = 0.1,
    ):
        self.llm = llm
        self.chat = chat
        self.tools = tools
        self.temperature = temperature

    async def generate_response(self, chat_id: int, user_input: str) -> str:
        history = await self.chat.get_history(chat_id, limit=settings.history_limit)
        system = SYSTEM_PROMPT.format(now=datetime.now(timezone.utc).isoformat(timespec="minutes"))

        messages = [
            {"role": "system", "content": [{"text": system}]},
            *map(to_llm_message, history),
            {"role": "user", "content": [{"text": user_input}]},
        ]

        answer = await self._run_agent_loop(messages)

        
        await self.chat.add_message(chat_id, "user", user_input)
        await self.chat.add_message(chat_id, "assistant", answer)
        return answer

    async def _run_agent_loop(self, messages: list[dict]) -> str:
        print(self.tools.specs())
        for _ in range(settings.agent_max_steps):
            response = await self.llm.achat.create({
                "messages": messages,
                "model_options": {"temperature": self.temperature},
                "tools": [{"functions": {"specifications": self.tools.specs()}}],
            })
            msg = response.messages[-1]

            call = self._find_call(msg)
            if call is None:
                return self._text(msg)          # модель ответила текстом: цикл окончен

            result = await self.tools.call(call.name, call.arguments)

            messages.append(msg.model_dump(exclude_none=True, by_alias=True))   # просьба вызвать функцию
            messages.append({                                                   # результат функции
                "role": "tool",
                "content": [{"function_result": {"name": call.name, "result": result}}],
            })

        return "Не удалось выполнить задачу за допустимое число шагов."

    @staticmethod
    def _find_call(msg):
        if msg.function_call:
            return msg.function_call
        for part in msg.content or []:
            if part.function_call:
                return part.function_call
        return None

    @staticmethod
    def _text(msg) -> str:
        return "".join(p.text for p in (msg.content or []) if p.text)
