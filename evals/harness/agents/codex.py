from __future__ import annotations

import json
import os

from .base import AgentConfig, BaseAgent


class CodexAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        return [
            "codex",
            "exec",
            "--dangerously-bypass-approvals-and-sandbox",
            "--json",
            "-m",
            self.config.model,
            "-C",
            work_dir,
            prompt,
        ]

    def build_env(self, base_env: dict) -> dict:
        env: dict[str, str] = {}
        value = os.environ.get("OPENAI_API_KEY")
        if value is not None:
            env["OPENAI_API_KEY"] = value
        return env

    def supports_streaming(self) -> bool:
        return True

    def normalize_line(self, raw: str) -> str:
        line = raw.rstrip("\n")
        if not line:
            return raw
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return raw
        if not isinstance(payload, dict):
            return raw
        if payload.get("type") != "item.completed":
            return raw
        item = payload.get("item")
        if not isinstance(item, dict):
            return raw
        if item.get("type") != "agent_message":
            return raw
        text = item.get("text")
        if isinstance(text, str):
            return text + ("\n" if raw.endswith("\n") else "")
        return raw

    def count_turn(self, line: str) -> bool:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return False
        if not isinstance(payload, dict):
            return False
        return payload.get("type") in {"turn.completed", "turn.failed"}
