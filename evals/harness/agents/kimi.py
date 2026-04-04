from __future__ import annotations

import json

from .base import AgentConfig, BaseAgent


class KimiAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        return [
            "kimi",
            "--print",
            "--yolo",
            "--output-format",
            "stream-json",
            "--model",
            self.config.model,
            "--work-dir",
            work_dir,
            "-p",
            prompt,
        ]

    def build_env(self, base_env: dict) -> dict:
        return {}

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
        if payload.get("role") not in {"assistant", "tool"}:
            return raw
        content = payload.get("content")
        if isinstance(content, str):
            return content + ("\n" if raw.endswith("\n") else "")
        if isinstance(content, list):
            chunks: list[str] = []
            for item in content:
                if isinstance(item, dict):
                    text = item.get("text")
                    if isinstance(text, str):
                        chunks.append(text)
            if chunks:
                return "".join(chunks) + ("\n" if raw.endswith("\n") else "")
        return raw

    def count_turn(self, line: str) -> bool:
        try:
            payload = json.loads(line)
        except json.JSONDecodeError:
            return False
        if not isinstance(payload, dict):
            return False
        return payload.get("role") == "assistant"
