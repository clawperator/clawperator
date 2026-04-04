from __future__ import annotations

import os

from evals.harness.agents.base import AgentConfig
from evals.harness.agents.claude import ClaudeAgent
from evals.harness.agents.codex import CodexAgent
from evals.harness.agents.gemini import GeminiAgent
from evals.harness.agents.kimi import KimiAgent


def test_agent_build_commands_start_with_expected_binary():
    claude = ClaudeAgent(AgentConfig(type_id="claude", model="claude-sonnet-4-6", knowledge_mode="public-surface"))
    gemini = GeminiAgent(AgentConfig(type_id="gemini", model="gemini-2.5-pro", knowledge_mode="public-surface"))
    codex = CodexAgent(AgentConfig(type_id="codex", model="gpt-5.1-codex-mini", knowledge_mode="public-surface"))
    kimi = KimiAgent(AgentConfig(type_id="kimi", model="kimi-code/kimi-for-coding", knowledge_mode="public-surface"))

    assert claude.build_command("prompt", "/tmp/work")[0] == "claude"
    assert gemini.build_command("prompt", "/tmp/work")[0] == "gemini"
    assert codex.build_command("prompt", "/tmp/work")[0] == "codex"
    assert kimi.build_command("prompt", "/tmp/work")[0] == "kimi"


def test_agent_count_turns_from_empirical_json_lines():
    claude = ClaudeAgent(AgentConfig(type_id="claude", model="claude-sonnet-4-6", knowledge_mode="public-surface"))
    gemini = GeminiAgent(AgentConfig(type_id="gemini", model="gemini-2.5-pro", knowledge_mode="public-surface"))
    codex = CodexAgent(AgentConfig(type_id="codex", model="gpt-5.1-codex-mini", knowledge_mode="public-surface"))
    kimi = KimiAgent(AgentConfig(type_id="kimi", model="kimi-code/kimi-for-coding", knowledge_mode="public-surface"))

    claude_line = (
        '{"type":"assistant","message":{"model":"claude-sonnet-4-6","type":"message","role":"assistant",'
        '"content":[{"type":"text","text":"Hello! How can I help you today?"}]}}'
    )
    gemini_line = '{"type":"message","role":"assistant","content":"Hello.","delta":true}'
    codex_line = '{"type":"turn.completed","usage":{"input_tokens":1,"output_tokens":1}}'
    kimi_line = '{"role":"assistant","content":[{"type":"text","text":"Hello!"}]}'

    assert claude.count_turn(claude_line) is True
    assert gemini.count_turn(gemini_line) is True
    assert codex.count_turn(codex_line) is True
    assert kimi.count_turn(kimi_line) is True


def test_agent_build_env_forwards_required_keys(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "anthropic")
    monkeypatch.setenv("GOOGLE_API_KEY", "google")
    monkeypatch.setenv("GEMINI_API_KEY", "gemini")
    monkeypatch.setenv("OPENAI_API_KEY", "openai")

    base_env = {"PATH": os.environ["PATH"], "HOME": os.environ["HOME"]}
    claude = ClaudeAgent(AgentConfig(type_id="claude", model="claude-sonnet-4-6", knowledge_mode="public-surface"))
    gemini = GeminiAgent(AgentConfig(type_id="gemini", model="gemini-2.5-pro", knowledge_mode="public-surface"))
    codex = CodexAgent(AgentConfig(type_id="codex", model="gpt-5.1-codex-mini", knowledge_mode="public-surface"))
    kimi = KimiAgent(AgentConfig(type_id="kimi", model="kimi-code/kimi-for-coding", knowledge_mode="public-surface"))

    assert claude.build_env(base_env) == {"ANTHROPIC_API_KEY": "anthropic"}
    assert gemini.build_env(base_env) == {"GOOGLE_API_KEY": "google", "GEMINI_API_KEY": "gemini"}
    assert codex.build_env(base_env) == {"OPENAI_API_KEY": "openai"}
    assert kimi.build_env(base_env) == {}
