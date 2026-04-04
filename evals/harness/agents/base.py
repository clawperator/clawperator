from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    type_id: str
    model: str
    knowledge_mode: str
    extra_flags: list[str] = field(default_factory=list)


class BaseAgent(ABC):
    def __init__(self, config: AgentConfig):
        self.config = config

    @abstractmethod
    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        """Return the exact subprocess argv list."""

    @abstractmethod
    def build_env(self, base_env: dict) -> dict:
        """Return env overrides for this agent."""

    @abstractmethod
    def supports_streaming(self) -> bool:
        """Return True if the harness should scan output line-by-line while running."""

    @abstractmethod
    def normalize_line(self, raw: str) -> str:
        """Pre-process a raw output line before transcript writing and answer scanning."""

