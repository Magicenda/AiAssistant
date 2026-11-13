"""Общие хелперы для CalDAV: ICS-события без привязки к провайдеру."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

DEFAULT_EVENT_DURATION = timedelta(hours=1)


def escape_ics_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
        .replace("\r", "")
    )


def format_ics_datetime(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def build_event_ics(
    *,
    uid: str,
    summary: str,
    start: datetime,
    duration: timedelta = DEFAULT_EVENT_DURATION,
) -> str:
    end = start + duration
    stamp = format_ics_datetime(datetime.now(timezone.utc))
    return "\r\n".join(
        [
            "BEGIN:VCALENDAR",
            "VERSION:2.0",
            "PRODID:-//AiAssistant//EN",
            "CALSCALE:GREGORIAN",
            "BEGIN:VEVENT",
            f"UID:{uid}",
            f"DTSTAMP:{stamp}",
            f"DTSTART:{format_ics_datetime(start)}",
            f"DTEND:{format_ics_datetime(end)}",
            f"SUMMARY:{escape_ics_text(summary)}",
            "END:VEVENT",
            "END:VCALENDAR",
            "",
        ]
    )
