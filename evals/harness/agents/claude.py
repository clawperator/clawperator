from __future__ import annotations

import json
import os

from .base import AgentConfig, BaseAgent


class ClaudeAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        cmd = [
            "claude",
            "-p", prompt,
            "--model", self.config.model,
            "--dangerously-skip-permissions",
            "--tools", "Bash",
            "--output-format", "stream-json",
            "--verbose",
        ]
        cmd.extend(self.config.extra_flags)
        return cmd

    def build_env(self, base_env: dict) -> dict:
        env: dict[str, str] = {}
        for key in ["ANTHROPIC_API_KEY"]:
            value = os.environ.get(key)
            if value is not None:
                env[key] = value
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
        if isinstance(payload, dict):
            if payload.get("role") == "assistant":
                content = payload.get("content")
                if isinstance(content, list):
                    chunks: list[str] = []
                    for item in content:
                        if isinstance(item, dict):
                            text = item.get("text")
                            if isinstance(text, str):
                                chunks.append(text)
                    if chunks:
                        return "".join(chunks) + ("\n" if raw.endswith("\n") else "")
                text = payload.get("text")
                if isinstance(text, str):
                    return text + ("\n" if raw.endswith("\n") else "")
            if payload.get("role") == "tool":
                content = payload.get("content")
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
        if payload.get("type") == "assistant":
            return True
        if payload.get("type") != "message":
            return False
        message = payload.get("message")
        if isinstance(message, dict) and message.get("role") == "assistant":
            return True
        return payload.get("role") == "assistant"
