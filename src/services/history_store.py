

class HistoryStore:
    """Пока в памяти. Позже заменишь на репозиторий с БД, сервис менять не придётся."""

    def __init__(self, max_messages: int = 20):
        self._data: dict[str, list[dict]] = {}
        self.max_messages = max_messages

    def get(self, session_id: str) -> list[dict]:
        return list(self._data.get(session_id, []))

    def append(self, session_id: str, role: str, text: str) -> None:
        history = self._data.setdefault(session_id, [])
        history.append({"role": role, "content": [{"text": text}]})
        del history[:-self.max_messages]      # не даём истории расти бесконечно