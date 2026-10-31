from datetime import datetime
from zoneinfo import ZoneInfo


MOSCOW_TZ = ZoneInfo("Europe/Moscow")


def now_moscow() -> datetime:
    """Возвращает текущее timezone-aware время в часовом поясе Москвы."""
    return datetime.now(MOSCOW_TZ)


def as_moscow(value: datetime) -> datetime:
    """Считает naive-время московским, а aware-время переводит в Москву."""
    if value.tzinfo is None:
        return value.replace(tzinfo=MOSCOW_TZ)
    return value.astimezone(MOSCOW_TZ)
