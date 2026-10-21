from gigachat import GigaChat
from db.repository.chat_repository import ChatRepository
from db.models import Chat, Message

SYSTEM_PROMPT = "Ты полезный ассистент. Отвечай кратко и по-русски."

# Сделать стандартный ответ
# Оставить только работу с агентом

def to_llm_message(m: Message) -> dict:
    return {"role": m.role.value, "content": [{"text": m.content}]}

class AgentService:
    def __init__(self, llm: GigaChat, repository: ChatRepository, temperature: float = 0.1):
        self.llm = llm
        self.repository = repository
        self.temperature = temperature

    async def generate_response(self, chat_id: str, user_input: str) -> str:

        history = await self.repository.get_chat_by_id(chat_id)

        messages = [
        {"role": "system", "content": [{"text": SYSTEM_PROMPT}]},
        *map(to_llm_message, history),
        {"role": "user", "content": [{"text": user_input}]},
        ]

        # Нужно дальше передать в агентский цикл
        response = await self.llm.achat.create(

        )
        response = await self.llm.achat.create({
            "messages": messages,
            "model_options": {"temperature": self.temperature},
        })
        # answer = response.messages[0].content[0].text

        # self.history.append(session_id, "user", user_input)
        # self.history.append(session_id, "assistant", answer)
        # return answer

    # сделать цикл для агента с рассуждениями 
    async def _run_agent_loop(self):
        pass