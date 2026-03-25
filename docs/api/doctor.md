# Doctor

## Purpose

Define the `clawperator doctor` report contract, the exact check sequence, critical-versus-advisory behavior, exit-code rules, and the remediation fields an agent can execute directly.

## Sources

- Report contract: `apps/node/src/contracts/doctor.ts`
- CLI behavior and pretty output: `apps/node/src/cli/commands/doctor.ts`
- Check sequencing and `nextActions`: `apps/node/src/domain/doctor/DoctorService.ts`
- Critical check list: `apps/node/src/domain/doctor/criticalChecks.ts`
- Check implementations: `apps/node/src/domain/doctor/checks/`

## Command

```bash
clawperator doctor [--json] [--device <serial>] [--operator-package <pkg>] [--fix] [--full] [--check-only]
```

Flags:

| Flag | Valid values | Effect |
| --- | --- | --- |
| `--device` | adb serial | targets one device explicitly |
| `--operator-package` | package name string | overrides the default operator package for package checks, launch, and handshake |
| `--fix` | flag | executes shell-type remediation steps during finalization |
| `--full` | flag | adds Java/build/install/launch/smoke checks |
| `--check-only` | flag | forces exit code `0` regardless of failures |
| `--json` | flag | returns the full `DoctorReport` JSON object |

Defaults:

- without `--operator-package`, doctor uses `process.env.CLAWPERATOR_OPERATOR_PACKAGE` if set, otherwise the runtime default package
- without `--device`, doctor tries discovery first and may auto-resolve one connected device
- without `--full`, doctor skips Java/build/install/launch/smoke checks
- without `--fix`, doctor reports remediation steps but does not run them

## `DoctorReport` Contract

`DoctorReport` is:

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "optional string",
  "operatorPackage": "optional string",
  "checks": [
    {
      "id": "host.node.version",
      "status": "pass",
      "code": "optional string",
      "summary": "summary string",
      "detail": "optional detail",
      "fix": {
        "title": "fix title",
        "platform": "mac",
        "steps": [
          { "kind": "shell", "value": "command" },
          { "kind": "manual", "value": "instruction" }
        ],
        "docsUrl": "optional URL"
      },
      "deviceGuidance": {
        "screen": "screen name",
        "steps": ["manual on-device step"]
      },
      "evidence": {}
    }
  ],
  "nextActions": ["optional command or instruction"]
}
```

Field meaning:

| Field | Meaning |
| --- | --- |
| `ok` | currently the same value as `criticalOk`; true only when all critical checks avoided `fail` |
| `criticalOk` | true when every critical check status is not `fail` |
| `deviceId` | resolved device serial, if doctor could determine one |
| `operatorPackage` | package used for doctor checks |
| `checks` | ordered list of `DoctorCheckResult` entries |
| `nextActions` | deduplicated shell commands or manual instructions collected from failing/warning checks, plus a success hint when everything passed |

## `DoctorCheckResult` Contract

Each entry in `checks[]` has:

| Field | Valid values | Meaning |
| --- | --- | --- |
| `id` | string | stable check identifier such as `device.discovery` |
| `status` | `pass`, `warn`, `fail` | check outcome |
| `code` | optional error code or runtime string | machine-usable reason for warnings or failures |
| `summary` | string | one-line status summary |
| `detail` | optional string | longer explanation or stderr |
| `fix.title` | string | remediation summary |
| `fix.platform` | `mac`, `linux`, `win`, `any` | host platform scope for remediation |
| `fix.steps[].kind` | `shell`, `manual` | whether the step can be executed directly or requires human action |
| `fix.steps[].value` | string | command or manual instruction |
| `fix.docsUrl` | optional URL | direct docs link for that failure family |
| `deviceGuidance.screen` | string | Android screen where the user should go |
| `deviceGuidance.steps[]` | string array | manual on-device guidance |
| `evidence` | optional object | structured proof such as versions, serials, or display metrics |

## Passing JSON Example

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev",
  "checks": [
    {
      "id": "host.node.version",
      "status": "pass",
      "summary": "Node version v22.12.0 is compatible."
    },
    {
      "id": "host.adb.presence",
      "status": "pass",
      "summary": "adb is installed.",
      "evidence": {
        "version": "Android Debug Bridge version 1.0.41"
      }
    },
    {
      "id": "device.discovery",
      "status": "pass",
      "summary": "Device emulator-5554 is connected and reachable.",
      "evidence": {
        "serial": "emulator-5554"
      }
    },
    {
      "id": "device.capability",
      "status": "pass",
      "summary": "Device shell is available.",
      "evidence": {
        "sdk": "34",
        "wmSize": "Physical size: 1080x2400",
        "wmDensity": "Physical density: 420"
      }
    },
    {
      "id": "readiness.apk.presence",
      "status": "pass",
      "summary": "Operator APK (com.clawperator.operator.dev) is installed."
    },
    {
      "id": "readiness.version.compatibility",
      "status": "pass",
      "summary": "CLI 0.1.0 is compatible with installed APK 0.1.0.",
      "evidence": {
        "cliVersion": "0.1.0",
        "apkVersion": "0.1.0",
        "apkVersionCode": 1,
        "operatorPackage": "com.clawperator.operator.dev"
      }
    },
    {
      "id": "readiness.handshake",
      "status": "pass",
      "summary": "Handshake successful.",
      "detail": "Node successfully dispatched a command and received a valid result envelope."
    }
  ],
  "nextActions": [
    "Docs: https://docs.clawperator.com/getting-started/first-time-setup/",
    "Try: clawperator snapshot --device emulator-5554"
  ]
}
```

Success conditions:

- exit code is `0` unless `--check-only` changed it
- `criticalOk == true`
- every critical check has `status != "fail"`

## Failing JSON Example

```json
{
  "ok": false,
  "criticalOk": false,
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev",
  "checks": [
    {
      "id": "readiness.handshake",
      "status": "fail",
      "code": "RESULT_ENVELOPE_TIMEOUT",
      "summary": "Handshake timed out.",
      "detail": "No [Clawperator-Result] envelope received within 7000ms. Broadcast dispatch: broadcast_sent. Operator package: com.clawperator.operator.dev. Device: emulator-5554. Re-run with --verbose to inspect correlated Android log lines.",
      "fix": {
        "title": "Grant accessibility permissions via adb",
        "platform": "any",
        "steps": [
          {
            "kind": "shell",
            "value": "clawperator grant-device-permissions --device emulator-5554 --operator-package com.clawperator.operator.dev"
          },
          {
            "kind": "shell",
            "value": "clawperator snapshot --device emulator-5554 --operator-package com.clawperator.operator.dev --timeout 5000 --verbose"
          }
        ],
        "docsUrl": "https://docs.clawperator.com/troubleshooting/operator/"
      },
      "deviceGuidance": {
        "screen": "Accessibility Settings",
        "steps": [
          "Ensure Clawperator Accessibility Service is ON in Android Settings"
        ]
      }
    }
  ],
  "nextActions": [
    "clawperator grant-device-permissions --device emulator-5554 --operator-package com.clawperator.operator.dev",
    "clawperator snapshot --device emulator-5554 --operator-package com.clawperator.operator.dev --timeout 5000 --verbose",
    "On device, open Accessibility Settings and follow the listed steps."
  ]
}
```

Failure conditions:

- exit code is `1` unless `--check-only` was passed
- `criticalOk == false`
- at least one critical check has `status == "fail"`

## Check Sequence

Doctor runs checks in this order:

| Order | Check IDs | When they run |
| --- | --- | --- |
| 1 | `host.node.version`, `host.adb.presence`, `host.adb.server` | always |
| 2 | `host.java.version`, `build.android.assemble` | only with `--full` |
| 3 | `device.discovery` | always |
| 4 | device resolution via `resolveDevice.ts` | after discovery when doctor still needs a target device |
| 5 | `build.android.install`, `build.android.launch` | only with `--full` and after device resolution |
| 6 | `device.capability` | after device resolution |
| 7 | `readiness.apk.presence` | after device capability |
| 8 | `readiness.version.compatibility` | only if APK presence passed |
| 9 | `readiness.settings.dev_options`, `readiness.settings.usb_debugging` | after version check gate is known |
| 10 | `readiness.handshake` | only if APK presence passed and version compatibility passed |
| 11 | `readiness.smoke` | only with `--full`, and only if APK presence and version compatibility passed |

Halting rule:

- doctor stops early only when a critical check returns `status == "fail"`
- warnings do not halt
- a `device.discovery` warning for `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` causes early finalization later because no device can be resolved for subsequent device-specific checks

## Critical Vs Advisory

Critical checks are any checks whose ID starts with one of these prefixes:

```text
host.node.version
host.adb.presence
host.adb.server
host.java.version
device.discovery
device.capability
build.android.assemble
build.android.install
build.android.launch
readiness.apk.presence
readiness.version.compatibility
readiness.handshake
readiness.smoke
```

Advisory behavior:

- checks not matching those prefixes can still appear as `warn`
- advisory warnings remain in `checks[]` but do not set `criticalOk` to `false`

Important special case:

- `device.discovery` with `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is a `warn`, not a `fail`
- even so, you still cannot proceed to device-specific execution without passing `--device`

## Exit Codes

`cmdDoctor` sets the exit code like this:

| Condition | Exit code |
| --- | --- |
| `--check-only` passed | `0` |
| otherwise and `(report.criticalOk ?? report.ok) == true` | `0` |
| otherwise | `1` |

Machine-checkable success gate:

- require exit code `0`
- require `criticalOk == true`

## `--fix` Behavior

`--fix` does not change the report shape. It changes how doctor handles `fix.steps` during finalization:

- `shell` steps are executed best-effort through the runtime shell runner
- `manual` steps are still only reported
- all steps still contribute to the returned `nextActions` if they are manual or if shell execution was not requested
- failed auto-fix attempts are intentionally swallowed so diagnostics remain deterministic

Use `--fix` when:

- you want unattended recovery loops for shell-based remediations
- you still plan to rerun `doctor --json` afterward to verify `criticalOk == true`

Do not treat `--fix` alone as success. The success gate remains the follow-up report.

## Pretty Output

Pretty output is grouped into:

- critical checks
- advisory checks
- count of additional passed non-critical checks
- final summary line
- `Next actions:` section

For a failing check, pretty output includes:

- `summary`
- `detail` when present
- `fix.title`
- each `fix.steps[].value`
- `Docs: <fix.docsUrl>` when present
- on-device guidance grouped under `On device (<screen>):`

## Check Reference

| Check ID | Statuses seen in current code | Typical codes | What it verifies |
| --- | --- | --- | --- |
| `host.node.version` | `pass`, `fail` | `NODE_TOO_OLD` | Node.js major version is at least 22 |
| `host.adb.presence` | `pass`, `fail` | `ADB_NOT_FOUND` | adb exists and can report a version |
| `host.adb.server` | `pass`, `fail` | `ADB_SERVER_FAILED` | adb server can start |
| `host.java.version` | `pass`, `fail` | `HOST_DEPENDENCY_MISSING` or no explicit code | Java 17 or 21 is available for full Android build checks |
| `build.android.assemble` | `pass`, `fail` | `ANDROID_BUILD_FAILED` | `./gradlew :app:assembleDebug` succeeds |
| `device.discovery` | `pass`, `warn`, `fail` | `NO_DEVICES`, `DEVICE_UNAUTHORIZED`, `DEVICE_OFFLINE`, `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`, `DEVICE_NOT_FOUND` | a target device exists and is reachable |
| `build.android.install` | `pass`, `fail` | `ANDROID_INSTALL_FAILED` | `./gradlew :app:installDebug` succeeds |
| `build.android.launch` | `pass`, `fail` | `ANDROID_APP_LAUNCH_FAILED` | Operator main activity launches |
| `device.capability` | `pass`, `fail` | `DEVICE_SHELL_UNAVAILABLE` or no explicit code | shell access, SDK version, screen size, and density are readable |
| `readiness.apk.presence` | `pass`, `warn`, `fail` | `DEVICE_SHELL_UNAVAILABLE`, `OPERATOR_VARIANT_MISMATCH`, `OPERATOR_NOT_INSTALLED` | requested operator package is installed |
| `readiness.version.compatibility` | `pass`, `fail` | `VERSION_INCOMPATIBLE`, `APK_VERSION_UNREADABLE`, `APK_VERSION_INVALID`, `CLI_VERSION_INVALID` | CLI and installed APK are compatible |
| `readiness.settings.dev_options` | `pass`, `warn` | `DEVICE_DEV_OPTIONS_DISABLED` | developer options setting is enabled |
| `readiness.settings.usb_debugging` | `pass`, `warn` | `DEVICE_USB_DEBUGGING_DISABLED` | USB debugging setting is enabled |
| `readiness.handshake` | `pass`, `fail` | `DEVICE_ACCESSIBILITY_NOT_RUNNING`, `RESULT_ENVELOPE_TIMEOUT`, `BROADCAST_FAILED`, `OPERATOR_NOT_INSTALLED` | Node can dispatch and receive a valid result envelope |
| `readiness.smoke` | `pass`, `fail` | `SMOKE_OPEN_SETTINGS_FAILED` | settings app opens and snapshot succeeds |

## Common Failure Recovery

### `NO_DEVICES`

Meaning:

- `checkDeviceDiscovery` saw no adb entries at all

Recovery:

- connect a device or boot an emulator
- rerun `clawperator devices`
- rerun `clawperator doctor --json`

### `DEVICE_UNAUTHORIZED`

Meaning:

- the target device is visible to adb but waiting for RSA authorization

Recovery:

- unlock the device
- accept the USB debugging prompt
- rerun doctor

### `DEVICE_OFFLINE`

Meaning:

- adb sees the device but it is not currently usable

Recovery:

```bash
adb kill-server
adb start-server
```

Then rerun doctor.

### `OPERATOR_NOT_INSTALLED`

Meaning:

- the requested package was not found by `pm list packages`

Recovery:

- if using release APKs, install the exact version doctor points to
- run the generated `clawperator operator setup --apk ...` command from `nextActions`

### `OPERATOR_VARIANT_MISMATCH`

Meaning:

- the requested package is missing, but the alternate known package variant is installed

Recovery:

- either pass `--operator-package` for the installed variant
- or reinstall the intended variant

### `RESULT_ENVELOPE_TIMEOUT`

Meaning:

- handshake broadcast was sent, but no `[Clawperator-Result]` envelope arrived within 7000ms

Recovery:

- run `clawperator grant-device-permissions --device <serial> [--operator-package <pkg>]`
- rerun `clawperator snapshot --device <serial> [--operator-package <pkg>] --timeout 5000 --verbose`
- verify accessibility service is enabled

### `DEVICE_ACCESSIBILITY_NOT_RUNNING`

Meaning:

- handshake returned an envelope, but the runtime reported an accessibility-related failure

Recovery:

- run `clawperator grant-device-permissions ...`
- follow `deviceGuidance.screen == "Accessibility Settings"`
- rerun doctor

## Agent Sequence

Recommended doctor loop:

1. Run `clawperator doctor --json [--device <serial>] [--operator-package <pkg>]`.
2. Require exit code `0` and `criticalOk == true` before treating the environment as ready.
3. If `criticalOk == false`, iterate through `checks[]` in order and branch on the first critical `fail`.
4. If `fix.steps[].kind == "shell"` and you trust the environment, either execute them yourself or rerun doctor with `--fix`.
5. If `deviceGuidance` is present, surface `deviceGuidance.screen` and `deviceGuidance.steps[]` to the human operator.
6. Rerun `doctor --json` after remediation and require `criticalOk == true`.
7. Only then move on to device commands such as `snapshot`.

## Related Pages

- [Setup](../setup.md)
- [Devices](devices.md)
- [Errors](errors.md)
- [Operator App Troubleshooting](../troubleshooting/operator.md)
- [Version Compatibility](../troubleshooting/compatibility.md)
