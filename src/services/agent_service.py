from gigachat import GigaChat
from services.history_store import HistoryStore

SYSTEM_PROMPT = "Ты полезный ассистент. Отвечай кратко и по-русски."


class AgentService:
    def __init__(self, llm: GigaChat, history: HistoryStore, temperature: float = 0.1):
        self.llm = llm
        self.history = history
        self.temperature = temperature

    async def generate_response(self, session_id: str, user_input: str) -> str:
        messages = [
            {"role": "system", "content": [{"text": SYSTEM_PROMPT}]},
            *self.history.get(session_id),
            {"role": "user", "content": [{"text": user_input}]},
        ]

        response = await self.llm.achat.create({
            "messages": messages,
            "model_options": {"temperature": self.temperature},
        })
        answer = response.messages[0].content[0].text

        self.history.append(session_id, "user", user_input)
        self.history.append(session_id, "assistant", answer)
        return answer