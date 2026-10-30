from core.config import settings
from core.time import now_moscow
from db.models import Message, MessageRole
from schemas.model_settings import ModelSettings
from services.chat_service import ChatService
from services.llm_client import LLMClient, build_llm_client
from tools.base import ToolRegistry

SYSTEM_PROMPT = (
    "Ты полезный ассистент. Отвечай кратко и по-русски. "
    "Для работы с задачами, напоминаниями и встречами используй инструменты. "
    "Если для вызова не хватает даты или времени, уточни их у пользователя. "
    "Текущая дата и время (Europe/Moscow, UTC+03:00): {now}. "
    "Если пользователь не указал другой часовой пояс, считай названное им время московским."
)


def to_llm_message(m: Message) -> dict:
    return {"role": m.role.value, "content": [{"text": m.content}]}


class AgentService:
    def __init__(
        self,
        llm: LLMClient,
        chat: ChatService,
        tools: ToolRegistry,
        temperature: float = 0.1,
    ):
        self.llm = llm
        self.chat = chat
        self.tools = tools
        self.temperature = temperature

    async def generate_response(
        self,
        chat_id: int,
        user_input: str,
        model_settings: ModelSettings | None = None,
        reply_to: str | None = None,
        regenerate: bool = False,
    ) -> str:
        # Перегенерация заменяет последний ответ, а не копит дубли в истории.
        if regenerate:
            await self.chat.delete_last_assistant_message(chat_id)

        history = await self.chat.get_history(chat_id, limit=settings.history_limit)
        system = SYSTEM_PROMPT.format(now=now_moscow().isoformat(timespec="minutes"))

        messages = [
            {"role": "system", "content": [{"text": system}]},
            *map(to_llm_message, history),
        ]
        # При перегенерации вопрос уже есть в истории — второй раз его не добавляем.
        if not regenerate or not history or history[-1].role != MessageRole.USER:
            messages.append({"role": "user", "content": [{"text": user_input}]})

        # Для локальной модели клиент строит только этот запрос; GigaChat общий.
        llm = self.llm
        if model_settings is not None and model_settings.provider == "local":
            llm = build_llm_client(model_settings)
        temperature = model_settings.temperature if model_settings else self.temperature

        try:
            answer = await self._run_agent_loop(messages, llm, temperature)
        finally:
            if llm is not self.llm:
                await llm.aclose()

        if not regenerate:
            await self.chat.add_message(chat_id, "user", user_input, reply_to)
        await self.chat.add_message(chat_id, "assistant", answer)
        return answer

    async def _run_agent_loop(self, messages: list[dict], llm: LLMClient, temperature: float) -> str:
        print(self.tools.specs())
        for _ in range(settings.agent_max_steps):
            response = await llm.create({
                "messages": messages,
                "model_options": {"temperature": temperature},
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



