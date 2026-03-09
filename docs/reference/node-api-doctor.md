# Clawperator Doctor

`clawperator doctor` is the runtime readiness check for the Node CLI. It verifies that the host environment, connected device, installed Operator APK, and end-to-end command path are in a usable state before an agent relies on the device.

This page describes the current shipped behavior. It replaces the older v0.1 design notes.

## Command Surface

```bash
clawperator doctor [--output <json|pretty>] [--device-id <id>] [--receiver-package <package>]
clawperator doctor --json
clawperator doctor --fix
clawperator doctor --full
clawperator doctor --check-only
```

Supported flags:

- `--output pretty|json` - select human-readable or machine-readable output
- `--format pretty|json` - alias for `--output`
- `--json` - shorthand for `--output json`
- `--device-id <id>` - target one device when multiple are connected
- `--receiver-package <package>` - override the target Operator package
- `--fix` - run shell-based remediation steps from failing checks
- `--full` - include Android build, install, launch, and smoke test checks
- `--check-only` - always exit `0`, even when critical checks fail; does not change halt behavior (doctor still returns early on critical failures)

Default receiver package:

- release APK: `com.clawperator.operator`
- local debug APK: `com.clawperator.operator.dev`

If you use a local debug APK, pass `--receiver-package com.clawperator.operator.dev` consistently to `doctor`, `grant-device-permissions`, `version --check-compat`, and `observe snapshot`.

## What Doctor Checks

Doctor runs checks in a fixed order. When a critical check fails, doctor returns immediately - all subsequent checks are skipped. The one exception is `device.capability`: it is a critical check (its failure marks the report as not ok), but a failure there does not halt the run; doctor continues into the runtime readiness phase regardless.

### 1. Host checks

- `host.node.version` - Node.js major version must be `22` or newer
- `host.adb.presence` - `adb` must be installed and reachable in `PATH`
- `host.adb.server` - `adb start-server` must succeed

### 2. Device discovery

- `device.discovery` - exactly one reachable target device must be available, or `--device-id` must disambiguate multiple devices
- `device.capability` - the target device shell must be reachable; the report also captures SDK level, `wm size`, and `wm density` as evidence

### 3. Runtime readiness

- `readiness.apk.presence` - confirms the requested receiver package is installed, or warns if the other release/debug variant is installed instead
- `readiness.version.compatibility` - verifies that the CLI and installed APK share a compatible `major.minor`
- `readiness.settings.dev_options` - warns if Android Developer Options are disabled
- `readiness.settings.usb_debugging` - warns if USB debugging is disabled
- `readiness.handshake` - sends a `doctor_ping` command and waits for one canonical `[Clawperator-Result]` envelope

### 4. Full-mode checks

`--full` adds Android build and runtime validation:

- `host.java.version` - Java 17 or 21 must be installed
- `build.android.assemble` - runs `./gradlew :app:assembleDebug`
- `build.android.install` - runs `./gradlew :app:installDebug`
- `build.android.launch` - launches `clawperator.activity.MainActivity`
- `readiness.smoke` - opens Android Settings and confirms it can be observed via `snapshot_ui`

## Critical vs Advisory Checks

Not every warning makes the environment unusable.

Critical checks currently include:

- host Node/adb/java checks
- device discovery and shell availability
- Android build/install/launch checks in `--full`
- APK version compatibility
- handshake
- smoke test in `--full`

Advisory warnings currently include:

- APK not installed or wrong release/debug variant installed
- Developer Options disabled
- USB debugging disabled

Exit behavior:

- normal mode exits `0` when all critical checks pass
- normal mode exits `1` when any critical check fails
- `--check-only` always exits `0`

In other words, `doctor` is allowed to report warnings while still exiting successfully if the critical command path is usable.

## Output Model

### Pretty output

Pretty output groups results into:

- critical checks
- advisory checks
- a count of additional passed checks
- a final readiness summary
- `Next actions` with commands or manual steps

### JSON output

`--output json`, `--format json`, and `--json` all return a `DoctorReport`:

```json
{
  "ok": true,
  "criticalOk": true,
  "deviceId": "<device_id>",
  "receiverPackage": "com.clawperator.operator",
  "checks": [
    {
      "id": "readiness.handshake",
      "status": "pass",
      "summary": "Handshake successful."
    }
  ],
  "nextActions": [
    "Try: clawperator observe snapshot --device-id <device_id>"
  ]
}
```

Important fields:

- `ok` - currently mirrors whether all critical checks passed
- `criticalOk` - explicit critical-check verdict used by the CLI exit code
- `checks[]` - ordered check results with IDs, status, summary, and optional diagnostics
- `nextActions[]` - optional; deduplicated shell commands or manual instructions; populated from failing check remediation steps, or suggested follow-up commands when all checks pass; omitted when there are no actions to surface

Each `DoctorCheckResult` can also include:

- `code` - stable error code when one is available
- `detail` - failure detail or extra context
- `fix` - shell or manual remediation steps
- `deviceGuidance` - on-device navigation instructions
- `evidence` - structured diagnostic facts such as versions or device properties

## How `--fix` Works Today

`--fix` does not have a separate repair plan. After the check run completes (or halts early on a critical failure), doctor applies available shell-based remediation steps from the collected checks during finalization. Checks are not re-run after fixes are applied. If the run halted early, only checks that ran before the halt will have their fix steps executed.

Today that can include actions such as:

- restarting the adb server
- running `clawperator grant-device-permissions`
- running follow-up diagnostic commands suggested by handshake failures

Manual steps and on-device guidance are still reported in `nextActions`; they are not automated.

Because `--fix` is driven by per-check shell steps, its behavior is intentionally narrow and deterministic. It is best treated as a convenience repair pass, not a full interactive bootstrap flow.

## Handshake Semantics

The handshake is the core end-to-end proof that the Node CLI can talk to the Operator app:

1. Doctor clears logcat for a clean capture window.
2. It broadcasts a `doctor_ping` execution to the configured receiver package.
3. It waits for a correlated `[Clawperator-Result]` envelope for up to 7000 ms.
4. It fails if the broadcast itself fails, the envelope times out, or the Operator returns a runtime error.

On handshake timeout, the report includes:

- broadcast dispatch status
- receiver package
- device id when available
- follow-up commands such as `clawperator grant-device-permissions` and `clawperator observe snapshot --timeout-ms 5000`

## Common Usage

Basic local check:

```bash
clawperator doctor --output pretty
```

Machine-readable installer or automation check:

```bash
clawperator doctor --format json
```

Target a specific device and debug APK:

```bash
clawperator doctor \
  --device-id <device_id> \
  --receiver-package com.clawperator.operator.dev \
  --output pretty
```

Best-effort repair pass:

```bash
clawperator doctor --fix
```

Full Android build/install/smoke validation:

```bash
clawperator doctor --full
```

## Related Commands

- `clawperator version --check-compat` - version compatibility check without the full doctor report
- `clawperator grant-device-permissions` - enable Accessibility and related app ops via adb
- `clawperator observe snapshot` - direct runtime check once doctor reports the environment is ready

For initial installation and device setup, see [First-Time Setup](../getting-started/first-time-setup.md) and [Agent Bootstrap Guide](../ai-agents/openclaw-remote-bootstrap.md).
