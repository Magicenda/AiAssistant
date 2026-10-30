import time
import uuid
from dataclasses import dataclass

# Озвучка отдаётся браузеру отдельным GET-запросом: <audio> не умеет
# передавать Authorization, поэтому доступ даём по неугадываемому id на 5 минут.
STREAM_TTL_SECONDS = 5 * 60


@dataclass
class SpeechStream:
    user_id: int
    text: str
    created_at: float


class SpeechStreamRegistry:
    """Хранит тексты для потоковой озвучки и чистит просроченные записи."""

    def __init__(self, ttl: int = STREAM_TTL_SECONDS):
        self.ttl = ttl
        self._items: dict[str, SpeechStream] = {}

    def create(self, user_id: int, text: str) -> str:
        self._cleanup()
        stream_id = uuid.uuid4().hex
        self._items[stream_id] = SpeechStream(user_id, text, time.monotonic())
        return stream_id

    def get(self, stream_id: str) -> SpeechStream | None:
        item = self._items.get(stream_id)
        if item is None:
            return None
        if time.monotonic() - item.created_at > self.ttl:
            self._items.pop(stream_id, None)
            return None
        return item

    def _cleanup(self) -> None:
        now = time.monotonic()
        expired = [
            key for key, item in self._items.items() if now - item.created_at > self.ttl
        ]
        for key in expired:
            self._items.pop(key, None)
