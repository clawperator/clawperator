from __future__ import annotations

import json
from types import SimpleNamespace
from pathlib import Path

import pytest

from evals.harness import environment
from evals.harness import runner
from evals import run_eval


class _StubAgent:
    def __init__(self) -> None:
        self.config = SimpleNamespace(type_id="claude", model="claude-sonnet-4-6", extra_flags=[])

    def build_command(self, prompt: str, work_dir: str) -> list[str]:
        return ["stub-agent", work_dir]


def _make_stub_environment():
    return SimpleNamespace(
        device_serial="device-123",
        clawperator_cmd=["clawperator"],
        clawperator_version="0.5.3",
        clawperator_npm_version="0.5.3",
        ground_truth_android_version="15",
        operator_package="com.clawperator.operator.dev",
    )


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
    assert "skill_prompt_file" not in config["spec"]


def test_build_config_omits_redundant_skill_prompt_file(tmp_path):
    config = runner._build_config(
        run_id="run-1",
        eval_id="android-version",
        agent=_StubAgent(),
        knowledge_mode="full-repo",
        runtime_target="local-dev",
        prompt_path=tmp_path / "prompt-skill.md",
        prompt_sha256="abc123",
        work_dir=tmp_path,
        runs_dir=tmp_path / "runs",
        env=_make_stub_environment(),
        command=["stub-agent", str(tmp_path)],
        env_overrides={},
        label=None,
        timeout_s=300,
        max_turns=40,
        agent_binary_version="1.0.0",
        display_clawperator_cmd=["clawperator"],
        display_work_dir=str(tmp_path),
        display_cwd=str(tmp_path),
        display_runs_dir=str(tmp_path / "runs"),
        skill_prompt_path=tmp_path / "prompt-skill.md",
    )

    assert "skill_prompt_file" not in config["spec"]


def test_build_config_records_distinct_skill_prompt_file(tmp_path):
    config = runner._build_config(
        run_id="run-1",
        eval_id="android-version",
        agent=_StubAgent(),
        knowledge_mode="full-repo",
        runtime_target="local-dev",
        prompt_path=tmp_path / "prompt-full-repo.md",
        prompt_sha256="abc123",
        work_dir=tmp_path,
        runs_dir=tmp_path / "runs",
        env=_make_stub_environment(),
        command=["stub-agent", str(tmp_path)],
        env_overrides={},
        label=None,
        timeout_s=300,
        max_turns=40,
        agent_binary_version="1.0.0",
        display_clawperator_cmd=["clawperator"],
        display_work_dir=str(tmp_path),
        display_cwd=str(tmp_path),
        display_runs_dir=str(tmp_path / "runs"),
        skill_prompt_path=tmp_path / "prompt-skill.md",
    )

    assert config["spec"]["skill_prompt_file"] == "prompt-skill.md"


def test_write_preflight_failure_run_redacts_public_surface_runtime_command(monkeypatch, tmp_path):
    args = SimpleNamespace(
        eval_id="android-version",
        agent="claude",
        model="claude-sonnet-4-6",
        label=None,
        runs_dir=str(tmp_path / "runs"),
        mode="public-surface",
        runtime="local-dev",
        timeout_s=300,
        max_turns=40,
    )
    spec = {"prompts": {"public-surface": "prompt-public.md"}}
    monkeypatch.setenv("CLAWPERATOR_OPERATOR_PACKAGE", "   ")

    run_dir = run_eval._write_preflight_failure_run(
        args=args,
        spec=spec,
        agent=_StubAgent(),
        failure_reason="doctor_preflight_failed",
        runtime_inputs=None,
    )

    result = json.loads((run_dir / "result.json").read_text(encoding="utf-8"))
    config = json.loads((run_dir / "config.json").read_text(encoding="utf-8"))

    assert result["environment"]["clawperator_cmd"] == ["clawperator"]
    assert result["environment"]["runtime_clawperator_cmd"] == ["node", str(run_eval.REPO_ROOT / "apps/node/dist/cli/index.js")]
    assert result["environment"]["cwd"] == "<redacted>"
    assert result["environment"]["runs_dir"] == "<redacted>"
    assert config["environment"]["clawperator_cmd"] == ["clawperator"]
    assert config["environment"]["runtime_clawperator_cmd"] == ["node", str(run_eval.REPO_ROOT / "apps/node/dist/cli/index.js")]
    assert config["environment"]["cwd"] == "<redacted>"
    assert config["environment"]["runs_dir"] == "<redacted>"


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


def test_replay_cli_rejects_missing_recorded_device_serial(tmp_path):
    runs_dir = tmp_path / "runs"
    run_dir = runs_dir / "android-version-20260404-000000-aaaaaa-claude-claude-sonnet"
    run_dir.mkdir(parents=True)
    (run_dir / "config.json").write_text(
        json.dumps(
            {
                "runtime_target": "published",
                "environment": {
                    "clawperator_cmd": ["/opt/homebrew/bin/clawperator"],
                    "operator_package": "com.clawperator.operator",
                },
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )

    with pytest.raises(SystemExit, match="missing environment.device_serial"):
        run_eval.main(["android-version", "--replay", run_dir.name, "--runs-dir", str(runs_dir)])


def test_extract_answer_candidate_prefers_normalized_stream_output():
    raw_line = (
        '{"role":"assistant","content":[{"type":"text","text":"CLAWPERATOR_EVAL_ANSWER: 15"}]}\n'
    )
    normalized_line = "CLAWPERATOR_EVAL_ANSWER: 15\n"

    answer = runner._extract_answer_candidate(raw_line, normalized_line)

    assert answer == "15"


def test_extract_answer_candidate_handles_gemini_wrapped_marker():
    raw_line = (
        '{"type":"message","role":"assistant","content":"CLAWPERATOR_\\nEVAL_ANSWER: 15","delta":true}\n'
    )
    normalized_line = "CLAWPERATOR_\nEVAL_ANSWER: 15\n"

    answer = runner._extract_answer_candidate(raw_line, normalized_line)

    assert answer == "15"


def test_extract_answer_candidate_handles_kimi_stream_json():
    raw_line = (
        '{"role":"assistant","content":[{"type":"text","text":"CLAWPERATOR_EVAL_ANSWER: 15"}]}\n'
    )
    normalized_line = "CLAWPERATOR_EVAL_ANSWER: 15\n"

    answer = runner._extract_answer_candidate(raw_line, normalized_line)

    assert answer == "15"


def test_extract_answer_candidate_handles_codex_item_completed_json():
    raw_line = (
        '{"type":"item.completed","item":{"type":"agent_message","text":"CLAWPERATOR_EVAL_ANSWER: 15"}}\n'
    )
    normalized_line = "CLAWPERATOR_EVAL_ANSWER: 15\n"

    answer = runner._extract_answer_candidate(raw_line, normalized_line)

    assert answer == "15"


def test_attach_skill_score_records_replay_error_without_raising(monkeypatch, tmp_path):
    run_dir = tmp_path / "run"
    run_dir.mkdir()
    (run_dir / "transcript.txt").write_text(
        "CLAWPERATOR_SKILL_START\n"
        "{"
        '"id":"com.example.android-version",'
        '"applicationId":"com.example",'
        '"intent":"android-version",'
        '"summary":"",'
        '"path":"skills/com.example.android-version",'
        '"skillFile":"skills/com.example.android-version/SKILL.md",'
        '"scripts":["skills/com.example.android-version/scripts/run.js"],'
        '"artifacts":[]'
        "}\n"
        "CLAWPERATOR_SKILL_END\n",
        encoding="utf-8",
    )
    result = {"run_id": "run-1", "outcome": {"status": "pass"}}
    env = SimpleNamespace(
        clawperator_cmd=["node", "/repo/apps/node/dist/cli/index.js"],
        operator_package="com.clawperator.operator.dev",
        device_serial="device-123",
    )

    def fake_run_replay(**kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(runner, "run_replay", fake_run_replay)

    updated = runner._attach_skill_score(
        run_dir=run_dir,
        result=result,
        spec={"skill_generation": {"replay_timeout_s": 60}},
        skill_prompt_name="prompt-skill.md",
        env=env,
    )

    saved = json.loads((run_dir / "result.json").read_text(encoding="utf-8"))
    assert updated["skill_score"]["skill_emitted"] is True
    assert updated["skill_score"]["skill_valid"] is True
    assert updated["skill_score"]["replay_status"] == "error"
    assert updated["skill_score"]["replay_error"] == "boom"
    assert saved["skill_score"]["replay_status"] == "error"
    assert saved["skill_score"]["skill_emitted"] is True
    assert saved["skill_score"]["skill_valid"] is True
