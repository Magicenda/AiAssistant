from collections.abc import Awaitable, Callable
from datetime import datetime
from typing import Any

from core.config import settings
from db.models import Message, MessageRole
from schemas.model_settings import ModelSettings
from schemas.tool import resolve_timezone, tool_timezone
from services.chat_service import ChatService
from services.llm_client import LLMClient, build_llm_client
from tools.base import ToolRegistry

SYSTEM_PROMPT = (
    "Ты полезный ассистент. Отвечай кратко и по-русски. "
    "Для работы с задачами, напоминаниями и встречами используй инструменты. "
    "СТРОГИЕ ПРАВИЛА СОЗДАНИЯ ЗАДАЧ: "
    "1. Каждая задача без исключений должна иметь дату и время срока в deadline. "
    "2. Если пользователь не указал дату, обязательно спроси: "
    "'На какую дату и время поставить задачу?' Не вызывай инструмент создания задачи. "
    "3. Если пользователь указал дату, но не указал время, обязательно уточни время. "
    "До получения ответа создавать задачу запрещено. "
    "4. Если пользователь просит создать задачу без срока, объясни, что срок обязателен, "
    "и попроси назвать дату и время. Если пользователь отказывается назвать срок, не создавай задачу. "
    "5. Если дата и время известны из текущего сообщения или истории диалога, "
    "обязательно передавай deadline. "
    "6. Для напоминаний и встреч дата и время обязательны. "
    "Создавать их без срока запрещено при любых условиях. "
    "Для переноса или переименования напоминания используй update_reminder; "
    "для получения и поиска напоминаний используй list_reminders; "
    "если новое время указано неполностью, сначала уточни недостающую дату или время. "
    "Текущие дата и время пользователя ({timezone}): {now}. "
    "Все даты и время, которые называет пользователь, трактуй в его часовом поясе. "
    "В инструменты передавай ISO 8601 с часовым смещением, "
    "например 2026-10-24T15:00:00+03:00."
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
        user_timezone: str | None = None,
        on_delta: Callable[[str], Awaitable[None]] | None = None,
    ) -> str:
        if regenerate:
            await self.chat.delete_last_assistant_message(chat_id)

        history = await self.chat.get_history(chat_id, limit=settings.history_limit)
        zone = resolve_timezone(user_timezone)
        now = datetime.now(zone)
        system = SYSTEM_PROMPT.format(
            timezone=zone.key or "UTC",
            now=now.isoformat(timespec="minutes"),
        )

        messages = [
            {"role": "system", "content": [{"text": system}]},
            *map(to_llm_message, history),
        ]
        if not regenerate or not history or history[-1].role != MessageRole.USER:
            messages.append({"role": "user", "content": [{"text": user_input}]})

        llm = self.llm
        if model_settings is not None and model_settings.provider == "local":
            llm = build_llm_client(model_settings)
        temperature = model_settings.temperature if model_settings else self.temperature

        token = tool_timezone.set(zone)
        try:
            answer = await self._run_agent_loop(messages, llm, temperature, on_delta)
        finally:
            tool_timezone.reset(token)
            if llm is not self.llm:
                await llm.aclose()

        if not regenerate:
            await self.chat.add_message(chat_id, "user", user_input, reply_to)
        await self.chat.add_message(chat_id, "assistant", answer)
        return answer

    async def _run_agent_loop(
        self,
        messages: list[dict],
        llm: LLMClient,
        temperature: float,
        on_delta: Callable[[str], Awaitable[None]] | None = None,
    ) -> str:
        payload = {
            "messages": messages,
            "model_options": {"temperature": temperature},
            "tools": [{"functions": {"specifications": self.tools.specs()}}],
        }

        for _ in range(settings.agent_max_steps):
            if on_delta is None:
                response = await llm.create(payload)
                msg = response.messages[-1]
                text = self._text(msg)
                call = self._find_call(msg)
                assistant_message = msg.model_dump(exclude_none=True, by_alias=True)
            else:
                text, call, assistant_message = await self._stream_step(llm, payload, on_delta)

            if call is None:
                return text

            result = await self.tools.call(call.name, call.arguments)
            messages.append(assistant_message)
            messages.append({
                "role": "tool",
                "content": [{"function_result": {"name": call.name, "result": result}}],
            })

        return "Не удалось выполнить задачу за допустимое число шагов."

    @staticmethod
    async def _stream_step(
        llm: LLMClient,
        payload: dict,
        on_delta: Callable[[str], Awaitable[None]],
    ) -> tuple[str, Any, dict]:
        parts: list[str] = []
        call = None
        message: dict[str, Any] | None = None
        async for delta in llm.stream(payload):
            if delta.text:
                parts.append(delta.text)
                await on_delta(delta.text)
            if delta.function_call is not None:
                call = delta.function_call
            if delta.assistant_message is not None:
                message = delta.assistant_message

        text = "".join(parts)
        if message is None:
            message = {"role": "assistant", "content": text}
            if call is not None:
                message["function_call"] = {
                    "name": call.name,
                    "arguments": call.arguments,
                }
        return text, call, message

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
        return "".join(part.text for part in (msg.content or []) if part.text)
