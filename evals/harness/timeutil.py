from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo


def format_timestamp(timezone_name: str | None = None) -> str:
    if timezone_name:
        try:
            tz = ZoneInfo(timezone_name)
        except Exception:
            tz = None
    else:
        tz = None
    if tz is None:
        return datetime.now().astimezone().isoformat(timespec="seconds")
    return datetime.now(tz).isoformat(timespec="seconds")
