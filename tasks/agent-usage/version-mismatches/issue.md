# APK Version Mismatch: Agent Diagnostic Findings

## Scenario

During Phase 2 skills validation, all three target skills
(`com.android.vending.search-app`, `com.android.vending.install-app`,
`com.solaxcloud.starter.get-battery`) failed with `RESULT_ENVELOPE_TIMEOUT`
immediately after the Phase 2 CLI changes were applied and the local build was
rebuilt.

Device: (physical, connected over USB)
CLI version at the time: 0.4.1 (branch-local build)
APK version installed: 0.3.3-d (stale debug build)

---

## The Error Fingerprint

```json
{
  "code": "RESULT_ENVELOPE_TIMEOUT",
  "message": "No [Clawperator-Result] envelope within 35000ms",
  "lastCorrelatedEvents": [],
  "broadcastDispatchStatus": "sent",
  "deviceId": "<redacted>",
  "operatorPackage": "com.clawperator.operator.dev"
}
```

The two critical fields that distinguish a version mismatch from other
`RESULT_ENVELOPE_TIMEOUT` causes:

| Field | Version mismatch value | Other causes |
|-------|------------------------|--------------|
| `broadcastDispatchStatus` | `"sent"` | `"sent"` or `"failed"` |
| `lastCorrelatedEvents` | `[]` (empty array) | Partial events present |

When `lastCorrelatedEvents` is empty and `broadcastDispatchStatus` is `"sent"`,
the broadcast reached the OS but the APK never processed it. This pattern means
the APK does not understand the command shape being sent - a version mismatch
or a completely unresponsive APK (e.g. accessibility service not granted).

When `lastCorrelatedEvents` has entries, the APK received the command but
failed mid-execution (crash, assertion, bad params). That is a different
problem with a different fix.

---

## Diagnostic Path

The initial reaction was to suspect a locked device screen or flaky USB
connection. Retrying the same command produced the same result. The correct
first step - which was not obvious from the error output alone - was:

```bash
clawperator doctor --device <device_id>
```

`doctor` immediately reported:

```
CLI version:  0.4.1
APK version:  0.3.3-d
Status:       MISMATCH - rebuild and reinstall the APK
```

Resolution from that point was straightforward:

```bash
./gradlew :app:assembleDebug && ./gradlew :app:installDebug
clawperator grant-device-permissions --device <device_id>
```

The `grant-device-permissions` step is required after every fresh APK install
because Android revokes the accessibility service grant on reinstall.

Total time to resolution once `doctor` was run: under 5 minutes.
Time spent before running `doctor` (retrying, checking logs): ~15 minutes.

---

## API Gaps Identified

### 1. `RESULT_ENVELOPE_TIMEOUT` does not hint at version mismatch

**Current behavior:** The error message says only "No [Clawperator-Result]
envelope within Xms". There is no hint that `doctor` exists or that an empty
`lastCorrelatedEvents` array points to an APK mismatch.

**Suggested improvement:** When `lastCorrelatedEvents` is empty and
`broadcastDispatchStatus` is `"sent"`, append a hint to the error message:

> "No correlated events received. This pattern often indicates an APK/CLI
> version mismatch. Run `clawperator doctor --device <id>` to check."

This would have cut the diagnostic time from ~15 minutes to under 2 minutes.

---

### 2. Troubleshooting docs do not document this pattern

**Current state:** `docs/troubleshooting.md` does not have a dedicated entry for
`RESULT_ENVELOPE_TIMEOUT` + empty `lastCorrelatedEvents`. The version mismatch
scenario is mentioned in passing in `SKILL.md` files but only in the context of
snapshot extraction failures, not general command timeouts.

**Suggested improvement:** Add a dedicated section to `docs/troubleshooting.md`:

```
## RESULT_ENVELOPE_TIMEOUT with no correlated events

Fingerprint:
  "code": "RESULT_ENVELOPE_TIMEOUT"
  "lastCorrelatedEvents": []
  "broadcastDispatchStatus": "sent"

Cause: APK/CLI version mismatch, or accessibility service not granted.

Fix:
  1. clawperator doctor --device <id>
  2. If version mismatch: ./gradlew :app:assembleDebug && :app:installDebug
  3. clawperator grant-device-permissions --device <id>
```

---

### 3. `clawperator_grant_android_permissions.sh` fails silently with multiple devices

**Current state:** With two devices connected (physical + emulator) and no
`DEVICE_ID` set, the shell script runs but produces only adb ambiguity errors
without explaining the root cause. The script does not detect multi-device
ambiguity upfront.

**Suggested improvement:** At the start of the script, if `DEVICE_ID` is unset
and `adb devices` returns more than one device, print a clear error:

> "Multiple devices connected. Set DEVICE_ID=<serial> and retry."

The CLI command `clawperator grant-device-permissions --device <id>` handles
this correctly and is the better path for agents in multi-device scenarios.

---

### 4. `doctor` output does not mention accessibility service post-reinstall

**Current state:** `doctor` correctly identifies version mismatches and prints
a rebuild instruction. It does not mention that a fresh APK install resets the
accessibility service grant and that `grant-device-permissions` must be run
afterward.

**Suggested improvement:** When `doctor` reports a version mismatch, include
a remediation note:

> "After reinstall, run `clawperator grant-device-permissions --device <id>`
> to re-enable the accessibility service. Android revokes this grant on every
> fresh install."

This is a non-obvious step that caused an additional round of debugging after
the APK was rebuilt.

---

## Summary for Future Agents

If you see `RESULT_ENVELOPE_TIMEOUT` with `lastCorrelatedEvents: []`:

1. Run `clawperator doctor --device <device_id>` first - do not retry the
   failing command.
2. If doctor reports a version mismatch, rebuild and reinstall the debug APK.
3. After reinstall, always run `clawperator grant-device-permissions --device
   <device_id>` - accessibility service is reset on every fresh install.
4. Use `--operator-package com.clawperator.operator.dev` for local dev builds.

The global `clawperator` binary may lag behind a checked-out branch. Set
`CLAWPERATOR_BIN` or use the local build directly:
`export CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js`

