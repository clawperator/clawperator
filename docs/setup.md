# Setup

## Purpose

Get from an empty host to a first successful `clawperator snapshot --json` with one deterministic path and machine-checkable success conditions.

## Prerequisites

| Requirement | Minimum | Machine check |
| --- | --- | --- |
| Node.js | v22+ | `node -v` |
| adb | On `PATH` | `adb version` |
| Android target | One device or emulator visible to adb | `clawperator devices` |
| Operator APK target | Release package `com.clawperator.operator` by default | `clawperator doctor --json` |

## 1. Install the CLI

Use one of these commands:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

```bash
npm install -g clawperator
```

Success conditions:

- `clawperator --version` prints a version string.
- If you used `install.sh`, the installer also downloads the current release APK to `~/.clawperator/downloads/operator.apk`.

## 2. Prepare the Android target

Required device state:

1. Enable Developer options.
2. Enable USB debugging.
3. Connect the device or boot the emulator.
4. Accept the adb authorization prompt if Android shows one.

Success conditions:

```bash
clawperator devices
```

Expected JSON shape:

```json
{"devices":[{"serial":"<device_serial>","state":"device"}]}
```

If more than one target is connected, record the serial you will use and pass `--device <serial>` on every later command. See [Devices](api/devices.md).

## 3. Install the Operator APK

Canonical command:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk
```

Use `--device <serial>` when more than one target is connected:

```bash
clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device <device_serial>
```

Use `--operator-package com.clawperator.operator.dev` when you are validating a local debug APK instead of the release APK:

```bash
clawperator operator setup \
  --apk <local_debug_apk_path> \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev
```

Behavior:

- Installs the APK.
- Grants required permissions.
- Verifies that the package is visible to the package manager.

Success condition:

- Command exits without a structured error object.
- A follow-up `clawperator doctor --json` no longer reports `OPERATOR_NOT_INSTALLED` for `readiness.apk.presence`.

Do not use raw `adb install` for the normal setup path. The CLI setup command is the only path that performs install, permission grant, and verification as one operation.

## 4. Re-grant permissions only for recovery

Recovery command:

```bash
clawperator grant-device-permissions --device <device_serial>
```

Repo-local recovery helper:

```bash
./scripts/clawperator_grant_android_permissions.sh --serial <device_serial>
```

Use this only after the Operator APK crashes or Android revokes accessibility / notification permissions. For the first install, use `clawperator operator setup`.

## 5. Verify readiness with doctor

Run:

```bash
clawperator doctor --json
```

If you are targeting a non-default package or a specific device, pass the same flags you will use later:

```bash
clawperator doctor --json --device <device_serial> --operator-package com.clawperator.operator.dev
```

Success conditions:

- Exit code `0` means all critical checks passed.
- JSON has `"criticalOk": true` or, on older reports, `"ok": true`.
- `checks[]` contains only `"pass"` or non-critical `"warn"` statuses for the target you intend to use.

Important behavior:

- `doctor --check-only` always exits `0`. Do not use it as the setup gate.
- A warning for `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` means the host is healthy, but automation is still non-deterministic until you add `--device`.

See [Doctor](api/doctor.md) for the full report contract and [Errors](api/errors.md) for recovery by code.

## 6. Run the first command

Run:

```bash
clawperator snapshot --json
```

With explicit target selection:

```bash
clawperator snapshot --json --device <device_serial> --operator-package com.clawperator.operator.dev
```

Success conditions:

- Exit code `0`.
- Output contains `envelope.status = "success"`.
- `envelope.stepResults[0].actionType = "snapshot_ui"`.
- `envelope.stepResults[0].success = true`.
- `envelope.stepResults[0].data.text` contains the XML hierarchy.

If the snapshot step succeeds but `data.text` is missing, Node converts that step into `SNAPSHOT_EXTRACTION_FAILED`.

## Agent Sequence

### Brain / hand model

Clawperator is the hand. The agent is the brain. The agent decides what to do, then calls the Node CLI or the local serve API with explicit commands and waits for a structured result envelope.

### Programmatic first-run sequence

1. Run `clawperator doctor --json [--device <serial>] [--operator-package <pkg>]`.
2. If `readiness.apk.presence` fails, run `clawperator operator setup --apk <path> ...`.
3. If `readiness.handshake` fails after a known-good install, run `clawperator grant-device-permissions ...`.
4. Re-run `clawperator doctor --json ...` and require `criticalOk: true`.
5. Run `clawperator snapshot --json ...`.
6. Branch only on structured fields such as `criticalOk`, `checks[].code`, `envelope.status`, `envelope.errorCode`, and `stepResults[].success`.

### How to confirm success without a human

- Treat `doctor --json` as ready only when `criticalOk` is `true`.
- Treat a device command as successful only when `envelope.status` is `"success"` and every `stepResults[].success` is `true`.
- Prefer exact codes over message matching. Examples: `NO_DEVICES`, `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`, `OPERATOR_NOT_INSTALLED`, `OPERATOR_VARIANT_MISMATCH`, `RESULT_ENVELOPE_TIMEOUT`.

### Common first-run failures and automated recovery

| Code or check | Meaning | Deterministic recovery |
| --- | --- | --- |
| `NO_DEVICES` | No adb target in `device` state | Connect or boot a target, then rerun `clawperator devices` and `clawperator doctor --json`. |
| `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | More than one connected target | Pick one serial from `clawperator devices` and rerun every command with `--device <serial>`. |
| `DEVICE_UNAUTHORIZED` | adb key prompt not accepted | Accept the prompt on the device, then rerun `clawperator doctor --json`. |
| `OPERATOR_NOT_INSTALLED` | Expected package missing | Run `clawperator operator setup --apk <path> ...`. |
| `OPERATOR_VARIANT_MISMATCH` | Release/debug package mismatch | Pass the installed package via `--operator-package` or reinstall the intended APK. |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Handshake returned a runtime failure | Run `clawperator grant-device-permissions ...`, then rerun `doctor` and `snapshot`. |
| `RESULT_ENVELOPE_TIMEOUT` | Broadcast sent but no result envelope arrived | Re-grant permissions, rerun `snapshot --timeout 5000 --verbose`, and verify the package passed via `--operator-package`. |

## Related Pages

- [API Overview](api/overview.md)
- [Devices](api/devices.md)
- [Doctor](api/doctor.md)
- [Errors](api/errors.md)
- [Operator App Troubleshooting](troubleshooting/operator.md)
