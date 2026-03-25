# Operator App

## Purpose

Diagnose installation, permission, handshake, and crash-recovery problems involving the Clawperator Operator APK.

## Sources

- Setup command: `apps/node/src/cli/commands/operatorSetup.ts`
- Setup phases: `apps/node/src/domain/device/setupOperator.ts`
- Permission grants: `apps/node/src/domain/device/grantPermissions.ts`
- Readiness checks: `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- Error codes: `apps/node/src/contracts/errors.ts`

## Operator Setup Phases

`clawperator operator setup` is a three-phase workflow:

1. install APK
2. grant accessibility and notification permissions
3. verify the package is installed

Failures are surfaced with distinct structured codes:

| Phase | Code |
| --- | --- |
| local APK path missing | `OPERATOR_APK_NOT_FOUND` |
| adb install failed | `OPERATOR_INSTALL_FAILED` |
| permission grant failed | `OPERATOR_GRANT_FAILED` |
| post-install verification failed | `OPERATOR_VERIFY_FAILED` |

Successful setup returns all three phase objects plus a follow-up message:

```json
{
  "operatorPackage": "com.clawperator.operator.dev",
  "install": {
    "ok": true
  },
  "permissions": {
    "accessibility": {
      "ok": true
    },
    "notification": {
      "ok": true,
      "skipped": false
    },
    "notificationListener": {
      "ok": true
    }
  },
  "verification": {
    "ok": true,
    "packageInstalled": true
  },
  "message": "Operator installed and ready. Run clawperator doctor to verify."
}
```

Verification pattern after any repair:

```bash
clawperator operator setup --apk <path> --device <device_serial> --operator-package <package> --json
clawperator doctor --json --device <device_serial> --operator-package <package>
clawperator snapshot --json --device <device_serial> --operator-package <package>
```

Treat the repair as complete only when:

- `operator setup` returns `install.ok: true`, successful permission objects, and `verification.ok: true`
- doctor reports `criticalOk: true`
- `readiness.apk.presence` and `readiness.handshake` are both passing checks
- `snapshot --json` returns a success envelope

## Installation Failures

### `OPERATOR_APK_NOT_FOUND`

Meaning:

- the local file given to `--apk` does not exist

Fix:

- verify the path on disk
- rerun `clawperator operator setup --apk <path>`

Exact failure shape:

```json
{
  "code": "OPERATOR_APK_NOT_FOUND",
  "message": "APK file not found: /abs/path/to/operator.apk",
  "operatorPackage": "com.clawperator.operator.dev",
  "install": {
    "ok": false,
    "error": "APK file not found: /abs/path/to/operator.apk"
  }
}
```

### `OPERATOR_INSTALL_FAILED`

Meaning:

- `adb install -r <apkPath>` returned non-zero

The error payload includes the install phase details from `setupOperator()`.

Typical fixes:

- confirm the device is connected and in adb state `device`
- rerun with the intended package variant
- verify the APK itself is buildable or downloadable

Exact failure shape:

```json
{
  "code": "OPERATOR_INSTALL_FAILED",
  "message": "adb: failed to install /abs/path/to/operator.apk: Failure [INSTALL_FAILED_VERSION_DOWNGRADE]",
  "operatorPackage": "com.clawperator.operator.dev",
  "install": {
    "ok": false,
    "error": "adb: failed to install /abs/path/to/operator.apk: Failure [INSTALL_FAILED_VERSION_DOWNGRADE]",
    "exitCode": 1
  }
}
```

### `OPERATOR_VERIFY_FAILED`

Meaning:

- install completed, but `pm list packages` could not confirm the expected package afterward

Typical causes:

- multiple variants installed and package selection ambiguous
- wrong package expected after install

Exact failure shape:

```json
{
  "code": "OPERATOR_VERIFY_FAILED",
  "message": "Package com.clawperator.operator.dev was not found after install.",
  "operatorPackage": "com.clawperator.operator.dev",
  "install": {
    "ok": true
  },
  "verification": {
    "ok": false,
    "packageInstalled": false,
    "error": "Package com.clawperator.operator.dev was not found after install."
  }
}
```

## Permission Issues

### `OPERATOR_GRANT_FAILED`

Meaning:

- one of the permission grant steps failed after install

Current permission steps are:

- accessibility service enablement
- notification permission grant
- notification listener enablement

Important implementation details:

- notification permission grant may be marked as skipped but still treated as okay for known Android responses like "already granted", "unknown permission", or "not a changeable permission type"
- accessibility and notification listener grants must succeed

Exact failure shape:

```json
{
  "code": "OPERATOR_GRANT_FAILED",
  "message": "Could not set accessibility_enabled",
  "operatorPackage": "com.clawperator.operator.dev",
  "install": {
    "ok": true
  },
  "permissions": {
    "accessibility": {
      "ok": false,
      "error": "Could not set accessibility_enabled"
    },
    "notification": {
      "ok": true,
      "skipped": false
    },
    "notificationListener": {
      "ok": true
    }
  }
}
```

### `DEVICE_ACCESSIBILITY_NOT_RUNNING`

This usually appears from doctor or handshake flows when the APK is installed but the accessibility service is not active.

Recovery:

```bash
clawperator grant-device-permissions --device <device_serial> --operator-package <package>
clawperator doctor --json --device <device_serial> --operator-package <package>
```

Check the doctor response for:

- `checks[].id == "readiness.handshake"`
- `checks[].code == "DEVICE_ACCESSIBILITY_NOT_RUNNING"` when accessibility is still the problem
- `nextActions` including `clawperator grant-device-permissions --device <device_serial> --operator-package <package>`

If that does not recover the device:

- reopen Android Accessibility Settings
- ensure the Clawperator accessibility service is enabled
- rerun `doctor`

## Variant Mismatch

### `OPERATOR_VARIANT_MISMATCH`

Meaning:

- the device has one known Operator package installed, but it is not the package currently requested

Typical cases:

| Requested | Installed | Fix |
| --- | --- | --- |
| `com.clawperator.operator` | `com.clawperator.operator.dev` | pass `--operator-package com.clawperator.operator.dev` or reinstall release |
| `com.clawperator.operator.dev` | `com.clawperator.operator` | pass `--operator-package com.clawperator.operator` or reinstall debug |

Use `clawperator doctor --json` to confirm which variant the readiness check found.

The readiness check emits a warning, not a hard setup failure:

```json
{
  "id": "readiness.apk.presence",
  "status": "warn",
  "code": "OPERATOR_VARIANT_MISMATCH",
  "summary": "Wrong Operator variant installed.",
  "detail": "Expected com.clawperator.operator.dev but found com.clawperator.operator.",
  "fix": {
    "title": "Switch variant"
  }
}
```

## Handshake Failures

### `RESULT_ENVELOPE_TIMEOUT`

Meaning:

- Node sent the command, but no `[Clawperator-Result]` envelope was received before the timeout

The doctor handshake check uses:

- Android payload timeout: `5000`
- envelope wait timeout: `7000`

Exact doctor failure shape:

```json
{
  "id": "readiness.handshake",
  "status": "fail",
  "code": "RESULT_ENVELOPE_TIMEOUT",
  "summary": "Handshake timed out.",
  "detail": "No [Clawperator-Result] envelope received within 7000ms. Broadcast dispatch: dispatched. Operator package: com.clawperator.operator.dev. Device: <device_serial>."
}
```

The trailing `Re-run with --verbose to inspect correlated Android log lines.` sentence is conditional. `readinessChecks.ts` appends it only when correlated Android log lines were captured for the failure.

Recommended recovery:

```bash
clawperator grant-device-permissions --device <device_serial> --operator-package <package>
clawperator snapshot --device <device_serial> --operator-package <package> --timeout 5000 --verbose
clawperator doctor --json --device <device_serial> --operator-package <package>
```

### `BROADCAST_FAILED`

Meaning:

- adb broadcast dispatch to the Operator package failed before a result envelope could be read

This is different from envelope timeout:

- timeout means dispatch happened but result was missing
- broadcast failure means the dispatch itself failed

If the broadcast diagnostics show the package is missing, the code can be `OPERATOR_NOT_INSTALLED` instead of `BROADCAST_FAILED`.

Typical failure shape:

```json
{
  "code": "BROADCAST_FAILED",
  "message": "Failed to dispatch broadcast to Operator package.",
  "details": {
    "broadcastDispatchStatus": "failed",
    "operatorPackage": "com.clawperator.operator.dev",
    "deviceId": "<device_serial>"
  }
}
```

Recovery pattern:

- if the package is missing, reinstall with `clawperator operator setup --apk <path> ...`
- if the package is present, rerun `doctor --json --verbose` and inspect the handshake detail plus `adb logcat`

## Crash Recovery

There is no dedicated "operator crashed" error code in the Node API. In practice, a crash often looks like one of these:

- `RESULT_ENVELOPE_TIMEOUT`
- `DEVICE_ACCESSIBILITY_NOT_RUNNING`
- handshake fails after a previously healthy setup

Recovery sequence:

1. rerun `clawperator doctor --json --device <serial> --operator-package <pkg>`
2. if accessibility is down, run `clawperator grant-device-permissions ...`
3. if package presence is wrong or missing, rerun `clawperator operator setup --apk <path> ...`
4. rerun `doctor`
5. confirm with `clawperator snapshot --json ...`

The runtime hint generated by execution failures also points here. When accessibility is down, `runExecution.ts` adds a hint like:

- `clawperator doctor --fix --device <device_id>`
- `clawperator operator setup --apk <path-to-apk> --device <device_id>`

## Crash Logs Access

The Node CLI does not currently expose a dedicated crash-log command. Use adb logcat directly.

Useful commands:

```bash
adb -s <device_serial> logcat
adb -s <device_serial> logcat | rg 'clawperator|AndroidRuntime|FATAL EXCEPTION'
adb -s <device_serial> logcat -d
```

For command-specific correlation, also use:

```bash
clawperator snapshot --device <device_serial> --operator-package <package> --verbose
```

That helps line up CLI execution with Android-side logging.

Verification pattern:

- clear or dump logcat close to the failing command
- rerun one failing command such as `snapshot --verbose`
- search for `clawperator`, `AndroidRuntime`, and `FATAL EXCEPTION`
- correlate the timestamp with the CLI command that failed

## Recommended Recovery Order

Use this order for a broken Operator state:

1. verify device connectivity with `clawperator devices`
2. run `clawperator doctor --json --device <serial> --operator-package <pkg>`
3. fix permissions with `clawperator grant-device-permissions ...` if accessibility is the problem
4. rerun `clawperator operator setup --apk <path> ...` if install or variant state is wrong
5. rerun `doctor`
6. confirm with `clawperator snapshot --json ...`

## What Success Looks Like

Treat the Operator as recovered only when:

- `doctor --json` returns `criticalOk: true`
- `checks` includes a passing `readiness.apk.presence`
- `checks` includes a passing `readiness.handshake`
- a follow-up `snapshot` returns `envelope.status == "success"`

## Related Pages

- [Setup](../setup.md)
- [Doctor](../api/doctor.md)
- [Devices](../api/devices.md)
- [Errors](../api/errors.md)
- [Version Compatibility](compatibility.md)
