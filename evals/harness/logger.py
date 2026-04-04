from __future__ import annotations

import json
import sys
import threading
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .timeutil import format_timestamp


_SENSITIVE_KEY_RE = ("KEY", "SECRET", "TOKEN", "PASSWORD")


def _redact_value(key: str, value: Any) -> Any:
    if any(token in key.upper() for token in _SENSITIVE_KEY_RE):
        return "[REDACTED]"
    return value


def _sanitize_mapping(mapping: dict[str, Any] | None) -> dict[str, Any] | None:
    if mapping is None:
        return None
    return {key: _redact_value(key, value) for key, value in mapping.items()}


@dataclass
class HarnessLogger:
    run_id: str
    log_file: Path | None = None
    timestamp_timezone_name: str | None = None
    _lock: threading.Lock = field(default_factory=threading.Lock, init=False, repr=False)
    _file_handle: Any = field(default=None, init=False, repr=False)
    _file_disabled: bool = field(default=False, init=False, repr=False)

    def _ensure_file(self) -> Any:
        if self.log_file is None:
            return None
        if self._file_handle is None and not self._file_disabled:
            self.log_file.parent.mkdir(parents=True, exist_ok=True)
            self._file_handle = self.log_file.open("a", encoding="utf-8")
        return self._file_handle

    def _write(self, line: str) -> None:
        with self._lock:
            sys.stderr.write(line + "\n")
            sys.stderr.flush()
            handle = self._ensure_file()
            if handle is None:
                return
            try:
                handle.write(line + "\n")
                handle.flush()
            except OSError:
                self._file_disabled = True

    def log(self, level: str, event: str, message: str | None = None, **fields: Any) -> None:
        payload = {
            "ts": format_timestamp(self.timestamp_timezone_name),
            "run_id": self.run_id,
            "level": level,
            "event": event,
        }
        if message is not None:
            payload["message"] = message
        for key, value in fields.items():
            if value is not None:
                payload[key] = value
        self._write(json.dumps(payload, ensure_ascii=False))

    def spawn(self, command: list[str], work_dir: str, env_overrides: dict[str, Any]) -> None:
        self.log("info", "SPAWN", command=command, work_dir=work_dir, env_overrides=_sanitize_mapping(env_overrides))

    def env_summary(self, **fields: Any) -> None:
        self.log("info", "ENV_SUMMARY", **fields)

    def state(self, value: str) -> None:
        self.log("info", "STATE", state=value)

    def warning(self, event: str, **fields: Any) -> None:
        self.log("warn", event, **fields)

    def timeout(self, wall_clock_s: float) -> None:
        self.log("warn", "TIMEOUT", wall_clock_s=wall_clock_s)

    def kill(self, signal_name: str, pgid: int) -> None:
        self.log("warn", "KILL", signal=signal_name, pgid=pgid)

    def score(self, **fields: Any) -> None:
        self.log("info", "SCORE", **fields)

    def violation(self, **fields: Any) -> None:
        self.log("info", "VIOLATION", **fields)

    def error(self, error: BaseException) -> None:
        self.log("error", "ERROR", message=str(error), traceback="".join(traceback.format_exception(error)))

    def result(self, status: str, answer: str | None, truth: str, turns: int | None, time_s: float) -> None:
        answer_text = answer if answer is not None else "none"
        turns_text = "null" if turns is None else str(turns)
        line = f"RESULT: {status} | answer={answer_text} | truth={truth} | turns={turns_text} | time={time_s:.1f}s"
        self._write(line)

    def close(self) -> None:
        if self._file_handle is not None:
            try:
                self._file_handle.close()
            finally:
                self._file_handle = None


def get_logger(run_id: str, log_file: Path | None = None, timestamp_timezone_name: str | None = None) -> HarnessLogger:
    return HarnessLogger(run_id=run_id, log_file=log_file, timestamp_timezone_name=timestamp_timezone_name)
