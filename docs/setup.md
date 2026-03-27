# Setup

## Purpose

Get from an empty host to a first successful `clawperator snapshot --json` with one deterministic path and machine-checkable success conditions.

## Prerequisites

| Requirement | Minimum | Machine check |
| --- | --- | --- |
| Node.js | v22+ | `node -v` |
| adb | On `PATH` | `adb version` |
| Android target | One device or emulator visible to adb | `clawperator devices` |

## 1. Install the CLI

Recommended - the installer handles Node, adb, CLI, APK download, and device setup in one step:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

If the installer succeeds, skip to [5. Verify readiness with doctor](#5-verify-readiness-with-doctor).

Alternatively, install the CLI only via npm (Node.js 22+ required):

```bash
npm install -g clawperator
```

Success conditions:

- `clawperator version` exits `0` and prints a version string.
- If you used `install.sh`, the installer also downloads the current release APK to `~/.clawperator/downloads/operator.apk`.

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

## 5. Verify readiness with doctor

```bash
clawperator doctor --json
```

With explicit targeting:

```bash
clawperator doctor --json --device <device_serial> --operator-package com.clawperator.operator.dev
```

### Doctor checks

| Check ID | What it verifies |
| --- | --- |
| `host.node.version` | Node.js >= 22 |
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
      "summary": "Node version v22.x.x is compatible."
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
clawperator snapshot --json --device <device_serial> --operator-package com.clawperator.operator.dev
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

- [API Overview](api/overview.md)
- [Devices](api/devices.md)
- [Doctor](api/doctor.md)
- [Errors](api/errors.md)
- [Troubleshooting](troubleshooting/operator.md)
- [Logging](api/logging.md)
