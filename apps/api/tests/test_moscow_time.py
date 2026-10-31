from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from core.time import MOSCOW_TZ, as_moscow
from schemas.tool import CreateMeetingArgs, CreateReminderArgs, tool_timezone


def test_naive_tool_time_is_treated_as_moscow_time():
    token = tool_timezone.set(ZoneInfo("Europe/Moscow"))
    try:
        args = CreateReminderArgs(description="Позвонить", remind_at="2026-10-30T15:00:00")
    finally:
        tool_timezone.reset(token)

    assert args.remind_at == datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)


def test_aware_tool_time_is_normalized_to_utc():
    args = CreateMeetingArgs(
        description="Встреча",
        appointment="2026-10-30T12:00:00Z",
    )

    assert args.appointment == datetime(2026, 10, 30, 12, 0, tzinfo=timezone.utc)


def test_repository_normalizer_treats_naive_time_as_moscow():
    value = as_moscow(datetime(2026, 10, 30, 9, 30))

    assert value == datetime(2026, 10, 30, 9, 30, tzinfo=MOSCOW_TZ)
    assert value.astimezone(timezone.utc).hour == 6
