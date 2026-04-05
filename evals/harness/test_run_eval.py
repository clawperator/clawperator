from __future__ import annotations

import json
from types import SimpleNamespace
from pathlib import Path

from evals.harness import environment
from evals import run_eval


class _StubAgent:
    def __init__(self) -> None:
        self.config = SimpleNamespace(extra_flags=[])

    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        return ["stub-agent", work_dir]


def test_write_preflight_failure_run_uses_full_repo_paths(monkeypatch, tmp_path):
    args = SimpleNamespace(
        eval_id="android-version",
        agent="claude",
        model="claude-sonnet-4-6",
        label=None,
        runs_dir=str(tmp_path / "runs"),
        mode="full-repo",
        runtime="published",
        timeout_s=300,
        max_turns=40,
    )
    spec = {"prompts": {"full-repo": "prompt-full-repo.md"}}
    monkeypatch.setenv("CLAWPERATOR_OPERATOR_PACKAGE", "   ")
    run_dir = run_eval._write_preflight_failure_run(
        args=args,
        spec=spec,
        agent=_StubAgent(),
        failure_reason="published_binary_not_found",
        runtime_inputs=None,
    )

    result = json.loads((run_dir / "result.json").read_text(encoding="utf-8"))
    config = json.loads((run_dir / "config.json").read_text(encoding="utf-8"))

    assert result["environment"]["operator_package"] == environment.RELEASE_OPERATOR_PACKAGE
    assert result["environment"]["cwd"] == str(run_eval.ROOT)
    assert result["environment"]["runs_dir"] == str(tmp_path / "runs")
    assert result["environment"]["clawperator_npm_version"] is None
    assert config["invocation"]["work_dir"] == str(run_eval.ROOT)
    assert config["environment"]["cwd"] == str(run_eval.ROOT)
    assert config["environment"]["runs_dir"] == str(tmp_path / "runs")
    assert config["environment"]["operator_package"] == environment.RELEASE_OPERATOR_PACKAGE


def test_load_replay_runtime_prefers_recorded_context():
    config = {
        "runtime_target": "local-dev",
        "environment": {
            "clawperator_cmd": ["clawperator"],
            "runtime_clawperator_cmd": ["node", "/repo/apps/node/dist/cli/index.js"],
            "operator_package": "com.clawperator.operator.dev",
        },
    }

    clawperator_cmd, operator_package, runtime_target = run_eval._load_replay_runtime(config)

    assert clawperator_cmd == ["node", "/repo/apps/node/dist/cli/index.js"]
    assert operator_package == "com.clawperator.operator.dev"
    assert runtime_target == "local-dev"


def test_load_replay_runtime_published_can_use_display_command():
    config = {
        "runtime_target": "published",
        "environment": {
            "clawperator_cmd": ["/opt/homebrew/bin/clawperator"],
            "operator_package": "com.clawperator.operator",
        },
    }

    clawperator_cmd, operator_package, runtime_target = run_eval._load_replay_runtime(config)

    assert clawperator_cmd == ["/opt/homebrew/bin/clawperator"]
    assert operator_package == "com.clawperator.operator"
    assert runtime_target == "published"
