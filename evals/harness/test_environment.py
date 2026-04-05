from __future__ import annotations

import subprocess
from pathlib import Path

import pytest

from evals.harness import environment
from evals.harness.runner import build_prompt


def _fake_run_factory(version: str):
    def _fake_run(cmd: list[str], env: dict[str, str], cwd: Path | None = None):
        if cmd[-1] == "devices":
            return subprocess.CompletedProcess(cmd, 0, stdout="List of devices attached\nR5CT22AGEEF\tdevice\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "persist.sys.timezone"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="Australia/Brisbane\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "ro.build.version.release"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="15\n", stderr="")
        if "doctor" in cmd:
            return subprocess.CompletedProcess(cmd, 0, stdout="{}\n", stderr="")
        if cmd[-1] == "version":
            return subprocess.CompletedProcess(cmd, 0, stdout=f'{{"cliVersion":"{version}"}}\n', stderr="")
        raise AssertionError(f"unexpected command: {cmd!r}")

    return _fake_run


def test_preflight_published_binary_missing(monkeypatch):
    def fake_which(name: str):
        if name == "adb":
            return "/usr/bin/adb"
        if name == "clawperator":
            return None
        return f"/usr/bin/{name}"

    monkeypatch.setattr(environment.shutil, "which", fake_which)
    monkeypatch.setattr(environment, "_run", _fake_run_factory("0.5.2"))

    with pytest.raises(EnvironmentError, match="published_binary_not_found"):
        environment.resolve_inputs(None, runtime="published")


def test_published_runtime_forces_release_operator_package(monkeypatch):
    def fake_which(name: str):
        if name == "adb":
            return "/usr/bin/adb"
        if name == "clawperator":
            return "/opt/homebrew/bin/clawperator"
        return f"/usr/bin/{name}"

    def fake_run(cmd: list[str], env: dict[str, str], cwd: Path | None = None):
        if cmd[-1] == "devices":
            return subprocess.CompletedProcess(cmd, 0, stdout="List of devices attached\nR5CT22AGEEF\tdevice\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "persist.sys.timezone"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="Australia/Brisbane\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "ro.build.version.release"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="15\n", stderr="")
        if "doctor" in cmd:
            return subprocess.CompletedProcess(cmd, 0, stdout="{}\n", stderr="")
        if cmd[-1] == "version":
            return subprocess.CompletedProcess(cmd, 0, stdout="clawperator 0.5.1\n", stderr="")
        raise AssertionError(f"unexpected command: {cmd!r}")

    monkeypatch.setattr(environment.shutil, "which", fake_which)
    monkeypatch.setattr(environment, "_run", fake_run)
    monkeypatch.setenv("CLAWPERATOR_OPERATOR_PACKAGE", "com.clawperator.operator.dev")

    inputs = environment.resolve_inputs(None, runtime="published")

    assert inputs.operator_package == environment.RELEASE_OPERATOR_PACKAGE
    assert inputs.requested_operator_package == "com.clawperator.operator.dev"
    assert inputs.clawperator_version == "0.5.1"
    assert inputs.clawperator_npm_version == "0.5.1"


def test_published_preflight_preserves_requested_operator_package(monkeypatch):
    def fake_which(name: str):
        if name == "adb":
            return "/usr/bin/adb"
        if name == "clawperator":
            return "/opt/homebrew/bin/clawperator"
        return f"/usr/bin/{name}"

    def fake_run(cmd: list[str], env: dict[str, str], cwd: Path | None = None):
        if cmd[-1] == "devices":
            return subprocess.CompletedProcess(cmd, 0, stdout="List of devices attached\nR5CT22AGEEF\tdevice\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "persist.sys.timezone"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="Australia/Brisbane\n", stderr="")
        if cmd[-3:] == ["shell", "getprop", "ro.build.version.release"]:
            return subprocess.CompletedProcess(cmd, 0, stdout="15\n", stderr="")
        if "doctor" in cmd:
            return subprocess.CompletedProcess(cmd, 0, stdout="{}\n", stderr="")
        if cmd[-1] == "version":
            return subprocess.CompletedProcess(cmd, 0, stdout='{"cliVersion":"0.5.2"}\n', stderr="")
        raise AssertionError(f"unexpected command: {cmd!r}")

    monkeypatch.setattr(environment.shutil, "which", fake_which)
    monkeypatch.setattr(environment, "_run", fake_run)
    monkeypatch.setenv("CLAWPERATOR_OPERATOR_PACKAGE", "com.clawperator.operator.dev")

    inputs = environment.resolve_inputs(None, runtime="published")
    env = environment.preflight(None, runtime="published", resolved_inputs=inputs)

    assert env.operator_package == environment.RELEASE_OPERATOR_PACKAGE
    assert env.requested_operator_package == "com.clawperator.operator.dev"


@pytest.mark.parametrize(
    ("runtime", "expected_cmd_prefix", "expected_npm_version"),
    [
        ("local-dev", "node", "0.5.3"),
        ("published", "/opt/homebrew/bin/clawperator", "0.5.2"),
    ],
)
def test_preflight_populates_clawperator_npm_version(monkeypatch, tmp_path, runtime, expected_cmd_prefix, expected_npm_version):
    local_cli = tmp_path / "apps" / "node" / "dist" / "cli" / "index.js"
    local_cli.parent.mkdir(parents=True, exist_ok=True)
    local_cli.write_text("#!/usr/bin/env node\n", encoding="utf-8")

    def fake_which(name: str):
        if name == "adb":
            return "/usr/bin/adb"
        if name == "node":
            return "/usr/bin/node"
        if name == "clawperator":
            return "/opt/homebrew/bin/clawperator" if runtime == "published" else None
        return f"/usr/bin/{name}"

    monkeypatch.setattr(environment, "LOCAL_CLI", local_cli)
    monkeypatch.setattr(environment.shutil, "which", fake_which)
    monkeypatch.setattr(environment, "_run", _fake_run_factory(expected_npm_version))

    env = environment.preflight(None, runtime=runtime)

    assert env.clawperator_npm_version == expected_npm_version
    assert env.clawperator_version == expected_npm_version
    assert env.clawperator_cmd[0] == expected_cmd_prefix


def test_full_repo_prompt_substitutes_repo_root():
    prompt_path = Path(environment.REPO_ROOT / "evals/specs/android-version/prompt-full-repo.md")
    prompt = build_prompt(
        str(prompt_path),
        {
            "CLAWPERATOR_CMD": "clawperator",
            "CLAWPERATOR_OPERATOR_PACKAGE": "com.clawperator.operator",
            "DEVICE_SERIAL": "device-123",
            "DOCS_URL": "https://docs.clawperator.com",
            "REPO_ROOT": str(environment.REPO_ROOT),
        },
    )

    assert "$REPO_ROOT" not in prompt
    assert str(environment.REPO_ROOT) in prompt


def test_probe_clawperator_version_plain_text_fallback(monkeypatch):
    def fake_run(cmd: list[str], env: dict[str, str], cwd: Path | None = None):
        if cmd[-1] == "version":
            return subprocess.CompletedProcess(cmd, 0, stdout="clawperator 0.5.4-beta.1\n", stderr="")
        raise AssertionError(f"unexpected command: {cmd!r}")

    monkeypatch.setattr(environment, "_run", fake_run)

    version = environment._probe_clawperator_version(["clawperator"], {"PATH": "/usr/bin", "HOME": "/tmp"})

    assert version == "0.5.4-beta.1"
