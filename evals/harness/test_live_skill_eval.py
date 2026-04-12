from __future__ import annotations

import json

from evals.harness import live_skill_eval


def test_choose_target_requires_observed_value():
    target, note = live_skill_eval._choose_target(None, (35, 40, 45))

    assert target is None
    assert "unavailable" in note


def test_choose_target_picks_first_distinct_candidate():
    target, note = live_skill_eval._choose_target(40, (35, 40, 45))

    assert target == 35
    assert "differed" in note


def test_classify_run_accepts_only_cold_start_verified_success():
    result_payload = {
        "skillResult": {
            "status": "success",
            "terminalVerification": {
                "status": "verified",
                "observed": {"text": "Discharge to 45% \ue660"},
            },
        }
    }

    classified = live_skill_eval._classify_run(
        normalization_before_skill={"outside_app_proven": True},
        observed_percent=40,
        target_percent=45,
        result_payload=result_payload,
    )

    assert classified["classification"] == "cold_start_verified"
    assert classified["proof_mode"] == "cold-start"
    assert classified["passed"] is True


def test_classify_run_distinguishes_continuation_only_success():
    result_payload = {
        "skillResult": {
            "status": "success",
            "terminalVerification": {
                "status": "verified",
                "observed": {"text": "Discharge to 35%"},
            },
        }
    }

    classified = live_skill_eval._classify_run(
        normalization_before_skill={"outside_app_proven": False},
        observed_percent=40,
        target_percent=35,
        result_payload=result_payload,
    )

    assert classified["classification"] == "continuation_success_only"
    assert classified["proof_mode"] == "continuation-only"
    assert classified["passed"] is False


def test_render_summary_markdown_lists_runs():
    summary = {
        "eval_id": live_skill_eval.SOLAX_COLD_START_EVAL_ID,
        "batch_id": "batch-1",
        "device_serial": "device-123",
        "operator_package": "com.clawperator.operator.dev",
        "skills_registry": "/tmp/skills-registry.json",
        "runs_requested": 2,
        "aggregate_status": "failed",
        "counts": {
            "cold_start_verified": 1,
            "continuation_success_only": 1,
            "outside_app_not_proven": 0,
            "target_selection_failed": 0,
            "verification_mismatch": 0,
        },
        "runs": [
            {
                "run_name": "run-01",
                "observed_percent": 40,
                "target_percent": 45,
                "classification": "cold_start_verified",
                "proof_mode": "cold-start",
                "passed": True,
            },
            {
                "run_name": "run-02",
                "observed_percent": 45,
                "target_percent": 35,
                "classification": "continuation_success_only",
                "proof_mode": "continuation-only",
                "passed": False,
            },
        ],
    }

    rendered = live_skill_eval._render_summary_markdown(summary)

    assert "run-01" in rendered
    assert "continuation-only" in rendered
    assert "cold_start_verified" in rendered


def test_sanitize_json_value_redacts_device_and_repo_paths(tmp_path):
    skills_registry = tmp_path / "clawperator-skills" / "skills" / "skills-registry.json"
    skills_registry.parent.mkdir(parents=True)
    replacements = live_skill_eval._artifact_replacements("device-123", skills_registry)
    payload = {
        "device": "device-123",
        "registry": str(skills_registry),
        "repo": str(live_skill_eval.REPO_ROOT),
    }

    sanitized = live_skill_eval._sanitize_json_value(payload, replacements)

    assert sanitized["device"] == "<device_serial>"
    assert sanitized["registry"] == "/<local_user>/src/clawperator-skills/skills/skills-registry.json"
    assert sanitized["repo"] == "/<local_user>/src/clawperator"


def test_run_eval_dispatches_solax_eval(monkeypatch, tmp_path):
    registry = tmp_path / "skills-registry.json"
    registry.write_text("{}\n", encoding="utf-8")
    batch_dir = tmp_path / "artifacts" / "batch-1"
    batch_dir.mkdir(parents=True)
    (batch_dir / "summary.json").write_text(
        json.dumps(
            {
                "aggregate_status": "passed",
                "counts": {"cold_start_verified": 2},
                "runs_requested": 2,
            }
        ),
        encoding="utf-8",
    )

    calls: dict[str, object] = {}

    def fake_run_solax(**kwargs):
        calls.update(kwargs)
        return batch_dir

    from evals import run_eval

    monkeypatch.setattr(run_eval, "run_solax_orchestrated_cold_start_eval", fake_run_solax)

    exit_code = run_eval.main(
        [
            live_skill_eval.SOLAX_COLD_START_EVAL_ID,
            "--device",
            "device-123",
            "--operator-package",
            "com.clawperator.operator.dev",
            "--runs",
            "2",
            "--skills-registry",
            str(registry),
            "--artifacts-dir",
            str(tmp_path / "artifacts"),
        ]
    )

    assert exit_code == 0
    assert calls["device_serial"] == "device-123"
    assert calls["runs"] == 2
