from __future__ import annotations

import os

from .base import AgentConfig, BaseAgent


class ClaudeAgent(BaseAgent):
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        cmd = [
            "claude",
            "-p", prompt,
            "--model", self.config.model,
            "--dangerously-skip-permissions",
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
        return raw
