from __future__ import annotations

import json
import subprocess
from pathlib import Path

from evals.harness.replay import run_replay


def _write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def _write_basic_run(tmp_path: Path, transcript: str) -> Path:
    run_dir = tmp_path / "runs" / "android-version-20260405-000000-aaaaaa-claude-claude-sonnet"
    run_dir.mkdir(parents=True)
    _write_json(
        run_dir / "config.json",
        {
            "eval_id": "android-version",
            "environment": {
                "device_serial": "device-123",
                "ground_truth_android_version": "15",
                "operator_package": "com.clawperator.operator.dev",
            },
        },
    )
    _write_json(
        run_dir / "result.json",
        {
            "run_id": run_dir.name,
            "environment": {
                "device_serial": "device-123",
                "ground_truth_android_version": "15",
            },
        },
    )
    (run_dir / "transcript.txt").write_text(transcript, encoding="utf-8")
    return run_dir


def test_run_replay_skips_when_no_skill_emitted(tmp_path):
    run_dir = _write_basic_run(tmp_path, "CLAWPERATOR_EVAL_ANSWER: 15\n")

    skill_score = run_replay(
        run_dir=run_dir,
        clawperator_cmd=["clawperator"],
        operator_package="com.clawperator.operator.dev",
        device_serial="device-123",
        timeout_s=1,
    )

    assert skill_score["skill_emitted"] is False
    assert skill_score["replay_status"] == "skipped"
    assert skill_score["replay_attempted"] is False


def test_run_replay_passes_with_materialized_skill(monkeypatch, tmp_path):
    transcript = (
        "before\n"
        "CLAWPERATOR_SKILL_START\n"
        "{"
        "\"id\":\"com.example.android-version\","
        "\"applicationId\":\"com.example\","
        "\"intent\":\"android-version\","
        "\"summary\":\"Determine Android version\","
        "\"path\":\"skills/com.example.android-version\","
        "\"skillFile\":\"skills/com.example.android-version/SKILL.md\","
        "\"scripts\":[\"skills/com.example.android-version/scripts/run.js\"],"
        "\"artifacts\":[],"
        "\"skillMarkdown\":\"# Generated skill\\n\","
        "\"scriptContents\":{"
        "\"skills/com.example.android-version/scripts/run.js\":\"console.log('CLAWPERATOR_EVAL_ANSWER: 15')\\n\""
        "}"
        "}"
        "\nCLAWPERATOR_SKILL_END\n"
        "after\n"
    )
    run_dir = _write_basic_run(tmp_path, transcript)

    def fake_run(cmd, check, capture_output, text, env, timeout, cwd):
        assert cmd[:3] == ["clawperator", "skills", "run"]
        assert "--json" in cmd
        assert "SECRET_TOKEN" not in env
        assert env["CLAWPERATOR_SKILLS_REGISTRY"].endswith("skills/skills-registry.json")
        payload = {
            "skillId": "com.example.android-version",
            "output": "CLAWPERATOR_EVAL_ANSWER: 15\n",
            "exitCode": 0,
            "durationMs": 12,
        }
        return subprocess.CompletedProcess(cmd, 0, stdout=json.dumps(payload), stderr="")

    monkeypatch.setattr("evals.harness.replay.subprocess.run", fake_run)

    skill_score = run_replay(
        run_dir=run_dir,
        clawperator_cmd=["clawperator"],
        operator_package="com.clawperator.operator.dev",
        device_serial="device-123",
        timeout_s=1,
    )

    assert skill_score["skill_emitted"] is True
    assert skill_score["skill_valid"] is True
    assert skill_score["replay_attempted"] is True
    assert skill_score["replay_status"] == "pass"
    assert skill_score["replay_answer_normalized"] == "15"
    assert skill_score["replay_answer_correct"] is True


def test_run_replay_prefers_post_run_artifact_answer(monkeypatch, tmp_path):
    transcript = (
        "before\n"
        "CLAWPERATOR_SKILL_START\n"
        "{"
        "\"id\":\"com.example.android-version\","
        "\"applicationId\":\"com.example\","
        "\"intent\":\"android-version\","
        "\"summary\":\"Determine Android version\","
        "\"path\":\"skills/com.example.android-version\","
        "\"skillFile\":\"skills/com.example.android-version/SKILL.md\","
        "\"scripts\":[\"skills/com.example.android-version/scripts/run.js\"],"
        "\"artifacts\":[\"skills/com.example.android-version/android-version.txt\"],"
        "\"skillMarkdown\":\"# Generated skill\\n\","
        "\"scriptContents\":{"
        "\"skills/com.example.android-version/scripts/run.js\":\"console.log('CLAWPERATOR_EVAL_ANSWER: 15')\\n\""
        "},"
        "\"artifactContents\":{"
        "\"skills/com.example.android-version/android-version.txt\":\"15\""
        "}"
        "}"
        "\nCLAWPERATOR_SKILL_END\n"
        "after\n"
    )
    run_dir = _write_basic_run(tmp_path, transcript)

    def fake_run(cmd, check, capture_output, text, env, timeout, cwd):
        artifact_path = Path(cwd) / "skills/com.example.android-version/android-version.txt"
        artifact_path.write_text("15", encoding="utf-8")
        payload = {
            "skillId": "com.example.android-version",
            "output": "CLAWPERATOR_EVAL_ANSWER: 5\n",
            "exitCode": 0,
            "durationMs": 12,
        }
        return subprocess.CompletedProcess(cmd, 0, stdout=json.dumps(payload), stderr="")

    monkeypatch.setattr("evals.harness.replay.subprocess.run", fake_run)

    skill_score = run_replay(
        run_dir=run_dir,
        clawperator_cmd=["clawperator"],
        operator_package="com.clawperator.operator.dev",
        device_serial="device-123",
        timeout_s=1,
    )

    assert skill_score["replay_status"] == "pass"
    assert skill_score["replay_answer_normalized"] == "15"
    assert skill_score["replay_answer_correct"] is True
