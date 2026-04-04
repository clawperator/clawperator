from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
LOCAL_CLI = REPO_ROOT / "apps/node/dist/cli/index.js"


@dataclass
class Environment:
    device_serial: str
    ground_truth_android_version: str
    ground_truth_collected_at: str
    clawperator_cmd: list[str]
    clawperator_version: str
    operator_package: str


@dataclass
class RuntimeInputs:
    device_serial: str
    clawperator_cmd: list[str]
    operator_package: str


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _minimal_env(device_serial: str | None = None, operator_package: str | None = None) -> dict[str, str]:
    env = {
        "PATH": os.environ["PATH"],
        "HOME": os.environ["HOME"],
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
    }
    if device_serial is not None:
        env["ANDROID_SERIAL"] = device_serial
    if operator_package is not None:
        env["CLAWPERATOR_OPERATOR_PACKAGE"] = operator_package
    return env


def _parse_authorized_devices(adb_output: str) -> list[str]:
    devices: list[str] = []
    for line in adb_output.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("List of devices attached"):
            continue
        parts = stripped.split()
        if len(parts) >= 2 and parts[1] == "device":
            devices.append(parts[0])
    return devices


def _resolve_clawperator_cmd() -> list[str]:
    explicit = os.environ.get("CLAWPERATOR_BIN")
    if explicit is not None and explicit.strip():
        return [explicit]
    if LOCAL_CLI.exists():
        return ["node", str(LOCAL_CLI)]
    global_bin = shutil.which("clawperator")
    if global_bin is not None:
        return ["clawperator"]
    raise EnvironmentError(
        "clawperator binary not found: checked CLAWPERATOR_BIN, "
        f"{LOCAL_CLI}, and shutil.which('clawperator')"
    )


def _run(cmd: list[str], env: dict[str, str], cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=False, capture_output=True, text=True, env=env, cwd=str(cwd) if cwd else None)


def resolve_inputs(device: str | None) -> RuntimeInputs:
    adb = shutil.which("adb")
    if adb is None:
        raise EnvironmentError("adb_not_found")

    adb_env = _minimal_env()
    devices_result = _run([adb, "devices"], env=adb_env)
    if devices_result.returncode != 0:
        raise EnvironmentError("adb_devices_failed")
    authorized = _parse_authorized_devices(devices_result.stdout)
    if device is not None:
        if device not in authorized:
            if not authorized:
                raise EnvironmentError("no_device")
            raise EnvironmentError("device_not_found")
        device_serial = device
    else:
        if len(authorized) == 0:
            raise EnvironmentError("no_device")
        if len(authorized) > 1:
            raise EnvironmentError("multiple_devices")
        device_serial = authorized[0]

    clawperator_cmd = _resolve_clawperator_cmd()
    if shutil.which(clawperator_cmd[0]) is None:
        raise EnvironmentError("clawperator_binary_not_found")

    operator_package = os.environ.get("CLAWPERATOR_OPERATOR_PACKAGE")
    if operator_package is None or not operator_package.strip():
        operator_package = "com.clawperator.operator.dev"

    return RuntimeInputs(
        device_serial=device_serial,
        clawperator_cmd=clawperator_cmd,
        operator_package=operator_package,
    )


def preflight(device: str | None) -> Environment:
    inputs = resolve_inputs(device)
    adb = shutil.which("adb")
    if adb is None:
        raise EnvironmentError("adb_not_found")

    doctor_env = _minimal_env(device_serial=inputs.device_serial, operator_package=inputs.operator_package)
    doctor_result = _run([*inputs.clawperator_cmd, "doctor", "--json", "--device", inputs.device_serial], env=doctor_env)
    if doctor_result.returncode != 0:
        raise EnvironmentError("doctor_preflight_failed")

    adb_env = _minimal_env()
    version_result = _run([adb, "-s", inputs.device_serial, "shell", "getprop", "ro.build.version.release"], env=adb_env)
    if version_result.returncode != 0:
        raise EnvironmentError("ground_truth_unreadable")
    ground_truth = version_result.stdout.strip()
    if not ground_truth:
        raise EnvironmentError("ground_truth_unreadable")
    collected_at = _timestamp()

    cli_version_result = _run([*inputs.clawperator_cmd, "version"], env=doctor_env)
    if cli_version_result.returncode != 0:
        raise EnvironmentError("clawperator_version_unreadable")
    try:
        version_payload = json.loads(cli_version_result.stdout.strip() or "{}")
    except json.JSONDecodeError as exc:
        raise EnvironmentError("clawperator_version_invalid") from exc
    cli_version = version_payload.get("cliVersion")
    if not isinstance(cli_version, str) or not cli_version.strip():
        raise EnvironmentError("clawperator_version_invalid")

    return Environment(
        device_serial=inputs.device_serial,
        ground_truth_android_version=ground_truth,
        ground_truth_collected_at=collected_at,
        clawperator_cmd=inputs.clawperator_cmd,
        clawperator_version=cli_version.strip(),
        operator_package=inputs.operator_package,
    )
