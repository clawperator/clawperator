# Doctor

## Purpose

Verify host, device, package, and runtime readiness before automation starts.

## Usage

```bash
clawperator doctor [--json] [--device <serial>] [--operator-package <pkg>]
```

Optional flags:

- `--fix`: run best-effort shell fixes from `fix.steps`
- `--full`: include Android build, install, launch, and smoke checks
- `--check-only`: always exit `0`, even when checks fail

## Output Contract

`apps/node/src/contracts/doctor.ts` defines:

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "<resolved_or_requested_serial>",
  "operatorPackage": "com.clawperator.operator",
  "checks": [
    {
      "id": "host.node.version",
      "status": "pass",
      "code": "NODE_TOO_OLD",
      "summary": "Node version v22.0.0 is compatible.",
      "detail": "<optional>",
      "fix": {
        "title": "<summary>",
        "platform": "any",
        "steps": [{"kind":"shell","value":"<command>"}],
        "docsUrl": "https://docs.clawperator.com/setup/"
      },
      "deviceGuidance": {
        "screen": "<android_screen>",
        "steps": ["<manual_step>"]
      },
      "evidence": {}
    }
  ],
  "nextActions": ["<command_or_guidance>"]
}
```

Exit code behavior:

- `0` when `criticalOk` is true
- `1` when a critical check fails
- `0` when `--check-only` is set, regardless of failures

## Checks

| Check id | When it runs | Meaning |
| --- | --- | --- |
| `host.node.version` | always | Node.js major version is at least 22 |
| `host.adb.presence` | always | `adb` exists on `PATH` |
| `host.adb.server` | always | `adb start-server` succeeds |
| `host.java.version` | `--full` only | Java 17 or 21 is available for Android builds |
| `build.android.assemble` | `--full` only | `./gradlew :app:assembleDebug` succeeds |
| `device.discovery` | always | A target device exists, is authorized, and can be resolved |
| `build.android.install` | `--full` only | `./gradlew :app:installDebug` succeeds |
| `build.android.launch` | `--full` only | The Operator main activity launches |
| `device.capability` | after device resolution | Device shell responds and exposes sdk / wm info |
| `readiness.apk.presence` | after device capability | Requested Operator package is installed, or a mismatch is detected |
| `readiness.version.compatibility` | when APK presence passes | CLI and installed APK versions are compatible |
| `readiness.settings.dev_options` | after version check | Developer options setting is enabled |
| `readiness.settings.usb_debugging` | after version check | USB debugging setting is enabled |
| `readiness.handshake` | when APK presence and compatibility pass | Node can broadcast and receive a `[Clawperator-Result]` envelope |
| `readiness.smoke` | `--full` only and after handshake | Settings app opens and a `snapshot_ui` step succeeds |

## Critical vs Advisory

Critical checks are the ids listed in `apps/node/src/domain/doctor/criticalChecks.ts`. A failing critical check makes `criticalOk = false`. Advisory warnings remain in `checks[]` but do not block exit code `0`.

Notable advisory case:

- `device.discovery` with `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` is a warning, not a failure. The host is usable, but you still must add `--device`.

## Fix Structure

`fix` is optional. When present:

- `title` summarizes the remediation
- `platform` scopes the steps (`mac`, `linux`, `win`, `any`)
- `steps[]` contains executable shell steps or manual steps
- `docsUrl` links directly to the relevant public doc page when one exists

Pretty output prints the summary, detail, fix title, fix steps, optional docs URL, and any `deviceGuidance`.

## Common Failures

| Code | Meaning | Typical recovery |
| --- | --- | --- |
| `ADB_NOT_FOUND` | adb missing | Install Android Platform Tools and rerun doctor |
| `DEVICE_UNAUTHORIZED` | adb authorization prompt not accepted | Accept the prompt on the device and rerun doctor |
| `DEVICE_OFFLINE` | adb sees the device but it is not usable | Restart adb or reconnect the device |
| `OPERATOR_NOT_INSTALLED` | Requested package missing | Run `clawperator operator setup --apk <path> ...` |
| `OPERATOR_VARIANT_MISMATCH` | Wrong release/debug package installed | Pass the installed package or reinstall the intended variant |
| `VERSION_INCOMPATIBLE` | CLI and APK versions disagree | Install the matching APK or CLI version |
| `RESULT_ENVELOPE_TIMEOUT` | Broadcast sent but no result envelope arrived | Re-grant permissions, rerun `snapshot --verbose`, and verify package selection |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | Handshake returned a runtime failure | Re-grant permissions or re-enable the accessibility service |

## Related Pages

- [Setup](../setup.md)
- [Devices](devices.md)
- [Errors](errors.md)
- [Operator App Troubleshooting](../troubleshooting/operator.md)
- [Version Compatibility](../troubleshooting/compatibility.md)
