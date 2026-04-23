# Setup

## Purpose

Get from an empty host to a first successful `clawperator snapshot --json` with one deterministic path and machine-checkable success conditions.

## Prerequisites

| Requirement | Minimum | Machine check |
| --- | --- | --- |
| Node.js | v24+ | `node -v` |
| Java | 17 or 21 | `java -version` |
| adb | On `PATH` | `adb version` |
| Android target | One device or emulator visible to adb | `clawperator devices` |

**Java note:** The installer provisions Java 17 automatically on supported platforms (macOS with Homebrew, Ubuntu/Debian, Arch). Java 17 or 21 is required as the host JDK for Android builds (AGP 8.x requirement). The Android Gradle build compiles Java and Kotlin with Java 17 settings; device compatibility is handled by Android's DEX pipeline, not by targeting an older bytecode level.

## 1. Install the CLI

Recommended - the installer handles Node, Java 17, adb, CLI, APK download, device setup, and CLI-owned host artifacts in one step:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

If the installer succeeds, skip to [5. Verify readiness with doctor](#5-verify-readiness-with-doctor).

When more than one adb-visible device is present, the installer reports each
detected device, runs `doctor` against each ready `adb` device, installs the
current release APK on any ready device that is missing or incompatible, and
then finishes with explicit `--device <serial>` guidance for later commands.

Alternatively, install the CLI only via npm (Node.js 24+ required):

```bash
npm install -g clawperator
```

Success conditions:

- `clawperator version` exits `0` and prints a version string.
- If you used `install.sh`, the installer also downloads the current release APK to `~/.clawperator/downloads/operator.apk` for that run. For later manual setup or recovery, redownload from `https://clawperator.com/operator.apk`.

### Durable host-agent artifacts from the CLI bootstrap

If `install.sh` reaches its post-bootstrap onboarding phase, it calls `clawperator host setup` and writes these durable onboarding files under `~/.clawperator/`:

| Path | Meaning | When to read it |
| --- | --- | --- |
| `~/.clawperator/AGENTS.md` | Local Clawperator guide with runtime-skill discovery commands and current bundled-skills status | First stop for a host agent that needs to discover what Clawperator can do on this machine |
| `~/.clawperator/install-state.json` | Durable install metadata written by `clawperator host setup` during install | Use when you need the last known install facts without rerunning `doctor` |
| `~/.clawperator/mcp-config-snippet.json` | Paste-ready MCP config for Claude Desktop, Codex, and a generic stdio MCP consumer | Use when the host should connect through `clawperator mcp serve` instead of shelling out to the CLI |

Early prerequisite failures and early doctor failures exit before these files
are written.

The runtime-skills registry is discovered automatically from
`~/.clawperator/skills/skills/skills-registry.json` after `clawperator skills install`, so
`install.sh` no longer writes `CLAWPERATOR_SKILLS_REGISTRY` into shell RC files.

Canonical public next step after install:

- read [Host Agent Orientation](host-agents.md) when you need to decide between
  `clawperator skills`, `clawperator mcp serve`, and direct CLI automation

`install-state.json` currently has this shape:

```json
{
  "schemaVersion": 1,
  "installedAt": "2026-04-17T08:12:34Z",
  "cliVersion": "1.2.3",
  "registryPath": "/Users/<local_user>/.clawperator/skills/skills/skills-registry.json",
  "apkVersion": "1.2.3",
  "lastDeviceSerial": null
}
```

Field rules:

- `schemaVersion` and `installedAt` are always present
- `cliVersion` is `null` when the installer could not run `clawperator --version`
- `registryPath` is `null` when the installer cannot resolve any readable runtime-skills registry path from the current install run, `CLAWPERATOR_SKILLS_REGISTRY`, prior install state, or the default installed home path
- `apkVersion` is `null` when the installer does not have a known operator version
- `lastDeviceSerial` is `null` when install did not pick one unambiguous device

Shared-agent bridge behavior is intentionally bounded:

- if `~/.agents/AGENTS.md` already exists, `clawperator host setup` appends one Clawperator-owned bridge block there
- that bridge points back to `~/.clawperator/AGENTS.md` plus the `clawperator skills` discovery commands
- if `~/.agents/AGENTS.md` does not exist, the installer does not create it
- the installer does not copy runtime skills into shared agent skill directories

Verification:

```bash
ls ~/.clawperator/AGENTS.md ~/.clawperator/install-state.json ~/.clawperator/mcp-config-snippet.json
clawperator skills list --json
test ! -f ~/.agents/AGENTS.md || grep -F "CLAWPERATOR_SHARED_AGENT_BRIDGE:START" ~/.agents/AGENTS.md
```

When choosing the host-facing surface:

- use `clawperator skills` when you want to discover or run installed runtime skills by app, keyword, or id
- no shell profile export is required for the default runtime-skills registry path
- use MCP when your host already supports stdio MCP and wants registered tools such as `devices`, `snapshot`, and `execute`

See [Host Agent Orientation](host-agents.md) for the post-install decision flow
and the first discovery commands to try.

## 2. Prepare the Android target

Required device state:

1. Enable Developer options (Settings > About phone > tap Build Number 7 times).
2. Enable USB debugging (Settings > Developer options > USB debugging).
3. Connect the device via USB, or boot an emulator via Android Studio or `clawperator emulator create`.
4. Accept the adb authorization prompt if Android shows one.

Emulators have USB debugging enabled by default. Physical devices require steps 1-2 and the RSA key acceptance in step 4.

Success condition:

```bash
clawperator devices
```

Expected output shape:

```json
{"devices":[{"serial":"<device_serial>","state":"device"}]}
```

If state is `unauthorized`, unlock the device and accept the USB debugging prompt. If state is `offline`, restart adb:

```bash
adb kill-server && adb start-server
```

If more than one target is connected, record the serial you will use and pass `--device <serial>` on every later command.

## 3. Install the Operator APK

To avoid stale cached copies, always refresh the stable release APK before
running setup or reinstall:

```bash
mkdir -p ~/.clawperator/downloads
curl -fsSL https://clawperator.com/operator.apk -o ~/.clawperator/downloads/operator.apk
```

Canonical public APK URL: `https://clawperator.com/operator.apk`

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk
```

With explicit device targeting:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device <device_serial>
```

For a local debug APK instead of the release APK:

```bash
clawperator operator setup \
  --apk <local_debug_apk_path> \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev
```

| Variant | Package name | When to use |
| --- | --- | --- |
| Release | `com.clawperator.operator` | Default. Installed by the installer. |
| Debug | `com.clawperator.operator.dev` | Local development, built from source. |

The CLI auto-detects which variant is installed when exactly one is present. If both are installed, pass `--operator-package` explicitly.

Behavior:

- Installs the APK on the device via adb.
- Grants accessibility and notification permissions.
- Verifies that the package is visible to the package manager.

Success condition:

- Command exits without a structured error object.
- A follow-up `clawperator doctor --json` no longer reports `OPERATOR_NOT_INSTALLED` for `readiness.apk.presence`.

Do not use raw `adb install` for setup. The CLI setup command is the only path that performs install, permission grant, and verification as one operation.

## 4. Re-grant permissions (recovery only)

```bash
clawperator grant-device-permissions --device <device_serial>
```

Use this only after the Operator APK crashes or Android revokes accessibility / notification permissions. For the first install, use `clawperator operator setup`.

If you force-stop the Operator package during debugging and the next handshake
or snapshot stops working, use this same recovery step before trusting the
runtime again, then re-run `clawperator doctor --json`.

## 5. Verify readiness with doctor

```bash
clawperator doctor --json
```

With explicit targeting:

```bash
clawperator doctor --json --device <device_serial>
```

### Doctor checks

| Check ID | What it verifies |
| --- | --- |
| `host.node.version` | Node.js >= 24 |
| `host.java.version` | Java 17 or 21 is installed |
| `host.adb.presence` | adb is installed and on PATH |
| `host.adb.server` | adb server starts successfully |
| `device.discovery` | At least one device is connected and in state `device` |
| `device.capability` | Device shell is available (SDK version, screen size) |
| `readiness.apk.presence` | Operator APK is installed on the device |
| `readiness.settings.dev_options` | Developer options enabled |
| `readiness.settings.usb_debugging` | USB debugging enabled |
| `readiness.version.compatibility` | CLI version is compatible with installed APK version |
| `readiness.handshake` | Node can dispatch a command and receive a result envelope from the Operator |
| `readiness.smoke` | End-to-end test: open Settings, capture UI snapshot |

### DoctorReport shape

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "<device_serial>",
  "operatorPackage": "com.clawperator.operator",
  "checks": [
    {
      "id": "host.node.version",
      "status": "pass",
      "summary": "Node version v24.x.x is compatible."
    }
  ],
  "nextActions": []
}
```

Failed checks include additional fields:

```json
{
  "id": "readiness.handshake",
  "status": "fail",
  "code": "RESULT_ENVELOPE_TIMEOUT",
  "summary": "Handshake timed out.",
  "detail": "No [Clawperator-Result] envelope received within 7000ms.",
  "fix": {
    "title": "Grant accessibility permissions via adb",
    "platform": "any",
    "steps": [
      { "kind": "shell", "value": "clawperator grant-device-permissions --device <device_serial>" }
    ]
  }
}
```

### Success conditions

- Exit code `0` means all critical checks passed.
- JSON has `"criticalOk": true`.
- `checks[]` contains only `"pass"` or non-critical `"warn"` statuses.
- Each check has `status`: `"pass"`, `"warn"`, or `"fail"`.

### Doctor flags

- `doctor --fix` automatically executes shell-type remediation steps from failed checks. Manual steps are still reported. Use this for unattended recovery loops.
- `doctor --check-only` always exits `0` regardless of failures. Do not use it as the setup gate.

See [Doctor](api/doctor.md) for the full report contract and [Errors](api/errors.md) for recovery by code.

## 6. Run the first command

```bash
clawperator snapshot --json
```

With explicit targeting:

```bash
clawperator snapshot --json --device <device_serial>
```

Success conditions:

- Exit code `0`.
- `envelope.status` is `"success"`.
- `envelope.stepResults[0].actionType` is `"snapshot_ui"`.
- `envelope.stepResults[0].success` is `true`.
- `envelope.stepResults[0].data.text` contains the XML hierarchy.

If the snapshot step succeeds but `data.text` is missing, Node converts that step into `SNAPSHOT_EXTRACTION_FAILED`.

## Agent sequence

### Brain / hand model

Clawperator is the hand. The agent is the brain. The agent decides what to do, then calls the Node CLI or the local serve API with explicit commands and waits for a structured result envelope.

### Programmatic first-run sequence

1. Run `clawperator doctor --json [--device <serial>] [--operator-package <pkg>]`.
2. If `readiness.apk.presence` fails, run `clawperator operator setup --apk <path> ...`.
3. If `readiness.handshake` fails after a known-good install, run `clawperator grant-device-permissions ...`.
4. For multiple failures, `clawperator doctor --json --fix ...` auto-executes shell remediation steps.
5. Re-run `clawperator doctor --json ...` and require `criticalOk: true`.
6. Run `clawperator snapshot --json ...`.
7. Branch only on structured fields: `criticalOk`, `checks[].code`, `envelope.status`, `envelope.errorCode`, `stepResults[].success`.

### How to confirm success without a human

- Treat `doctor --json` as ready only when `criticalOk` is `true`.
- Treat a device command as successful only when `envelope.status` is `"success"` and every `stepResults[].success` is `true`.
- Prefer exact codes over message matching. Examples: `NO_DEVICES`, `OPERATOR_NOT_INSTALLED`, `RESULT_ENVELOPE_TIMEOUT`.

### Common first-run failures and recovery

| Code | Meaning | Recovery |
| --- | --- | --- |
| `NO_DEVICES` | No adb target in state `device` | Connect or boot a target, rerun `clawperator devices` then `doctor`. |
| `DEVICE_UNAUTHORIZED` | adb key prompt not accepted | Accept the prompt on the device screen, rerun `doctor`. |
| `DEVICE_OFFLINE` | Device unreachable | `adb kill-server && adb start-server`, rerun `doctor`. |
| `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | More than one target connected | Pick a serial from `clawperator devices`, pass `--device <serial>` to all commands. |
| `OPERATOR_NOT_INSTALLED` | Expected package missing | `clawperator operator setup --apk <path> [--device <serial>]`. |
| `OPERATOR_VARIANT_MISMATCH` | Release/debug package mismatch | Pass `--operator-package <installed-package>` or reinstall the intended APK. |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Handshake returned a runtime failure | `clawperator grant-device-permissions [--device <serial>]`, rerun `doctor` and `snapshot`. |
| `RESULT_ENVELOPE_TIMEOUT` | Broadcast sent, no result envelope arrived | If no correlated log lines were captured, run `doctor` to check version compatibility and accessibility; otherwise re-grant permissions, rerun `snapshot --timeout 5000 --verbose`, and verify `--operator-package`. |
| `VERSION_INCOMPATIBLE` | CLI and APK version mismatch | Reinstall CLI (`npm install -g clawperator@latest`) or APK to align versions. |

### When to pass `--device` and `--operator-package`

- `--device <serial>`: required when more than one target is connected.
- `--operator-package <package>`: required when both release and debug variants are installed on the same device.

For deterministic automation, always pass both flags explicitly.

## Debugging setup issues

If setup fails, use `clawperator logs` to inspect what happened:

```bash
# Stream logs in one terminal
clawperator logs

# Run the failing command in another terminal
clawperator doctor --json --device <device_serial> --operator-package <package>
```

Log file location: `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`

Key events to look for:

- `doctor.check` - Individual doctor check results
- `adb.command` / `adb.complete` - ADB operations
- `preflight.apk.pass` / `preflight.apk.missing` - APK presence checks

See [Logging](api/logging.md) for complete documentation.

## Related pages

- [Host Agent Orientation](host-agents.md)
- [Quickstart](quickstart.md)
- [API Overview](api/overview.md)
- [Devices](api/devices.md)
- [Doctor](api/doctor.md)
- [Errors](api/errors.md)
- [Environment Variables](api/environment.md)
- [Troubleshooting](troubleshooting/operator.md)
- [Logging](api/logging.md)
