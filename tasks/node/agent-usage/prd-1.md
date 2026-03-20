# PRD-1: Fast-fail on Missing Operator APK

Workstream: WS-1
Priority: 1 (highest)
Proposed PR: PR-1

---

## Problem Statement

When the Clawperator Operator APK is not installed on the target device, nothing stops `execute` or `skills run` from dispatching an adb broadcast to a receiver that does not exist. The broadcast is sent, no result envelope is returned, and the command times out after 30-120 seconds with `RESULT_ENVELOPE_TIMEOUT`. This is the #1 agent confusion source. It produces the worst possible debugging experience: maximum wait time, minimum information.

---

## Evidence

**From logs (GloBird incident, the triggering event for issues.md):**
> GloBird skill timed out. Is it the app? The APK? The device? No logs to check. Had to manually verify APK was installed (it wasn't, but we had uninstalled it earlier and I forgot).

**From `apps/node/src/domain/doctor/checks/readinessChecks.ts`:**

```typescript
return {
  id: "readiness.apk.presence",
  status: "warn",               // warn, not fail
  code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
  ...
};
```

**From `apps/node/src/domain/doctor/criticalChecks.ts`:**

`readiness.apk.presence` is absent from `CRITICAL_DOCTOR_CHECK_PREFIXES`. Doctor does not halt on APK absence.

**From `docs/openclaw-first-run.md` Step 5:**
> "If doctor does not pass, stop and fix the environment before moving on."

The intent is correct. The enforcement is absent. Doctor "passes" (exits 0) even with the APK missing.

**From `docs/reference/error-handling.md`:**
> `RECEIVER_NOT_INSTALLED`: Fix environment first. Do not blindly retry the same execution.

The guidance is correct. Nothing in the execution path enforces it.

---

## Current Behavior

1. Operator APK is not installed on device.
2. Agent runs `clawperator doctor`.
3. Doctor emits `RECEIVER_NOT_INSTALLED` as a warning. Report status: pass (no critical failures). Exit 0.
4. Agent proceeds, believing environment is healthy.
5. Agent runs `clawperator execute` or `clawperator skills run`.
6. Node dispatches broadcast via adb.
7. No receiver is listening. No result envelope is returned.
8. After 30-120 seconds: `RESULT_ENVELOPE_TIMEOUT`.
9. Agent has no information about which link in the chain failed.

---

## Proposed Change

### 1. Make APK absence a critical (halting) check in doctor

In `apps/node/src/domain/doctor/criticalChecks.ts`, add `"readiness.apk.presence"` to `CRITICAL_DOCTOR_CHECK_PREFIXES`.

In `apps/node/src/domain/doctor/checks/readinessChecks.ts`, change `status: "warn"` to `status: "fail"` for the `RECEIVER_NOT_INSTALLED` case.

The `RECEIVER_VARIANT_MISMATCH` case (wrong variant installed) should remain a `warn` - the other variant can be addressed with `--receiver-package`, which is a usable workaround.

### 2. Add APK presence pre-flight to `execute`

At the start of the `execute` command handler, before dispatching any broadcast, run the equivalent of `checkApkPresence(config)`. If the check fails, return immediately with:

```json
{
  "ok": false,
  "error": {
    "code": "RECEIVER_NOT_INSTALLED",
    "message": "Operator APK (com.clawperator.operator) is not installed on device <device_id>. Install it with: clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>"
  }
}
```

Exit code: non-zero.

This check should be:
- Fast: a single `adb shell pm list packages` call (~100ms)
- Cacheable: if a recent successful check result is available (written by `operator setup` or by a recent `doctor` run), skip the adb round-trip
- Suppressible: `--skip-preflight` flag for agents that have already verified readiness externally (e.g., running their own doctor call within the same session)

### 3. Documentation updates

- `docs/troubleshooting.md`: Add a `RECEIVER_NOT_INSTALLED` section explaining the new fast-fail behavior and the install command.
- `docs/reference/node-api-doctor.md`: Update the `readiness.apk.presence` check description to reflect `fail` severity.
- `docs/reference/error-handling.md`: Update the `RECEIVER_NOT_INSTALLED` triage row to note it now fails fast rather than requiring manual doctor invocation.

---

## Why This Matters for Agent Success

The 30-120 second timeout is the worst possible failure signal for an agent. The agent cannot distinguish "APK missing" from "app crashed" from "UI element not found" from "device asleep." Every other improvement in this plan - better error messages, docs links, persistent logs - is less valuable than simply not waiting 2 minutes before getting a diagnosis.

This change is also the minimal-scope version of a "pre-flight checklist." It does not require running the full doctor suite before every execute. It runs exactly the one check that guards against the most common first-run failure mode.

---

## Scope Boundaries

In scope:
- `criticalChecks.ts`: add `readiness.apk.presence`
- `readinessChecks.ts`: `warn` -> `fail` for `RECEIVER_NOT_INSTALLED`
- `execute` command: APK presence pre-flight
- Three doc updates (troubleshooting, node-api-doctor, error-handling)

Out of scope:
- Streaming output (WS-5/WS-6)
- Logging to disk (WS-5)
- `skills run` pre-flight (skills run calls execute internally; if execute pre-flights, skills inherits it)
- `RECEIVER_VARIANT_MISMATCH` severity change (remains warn - usable workaround exists)

---

## Dependencies

None. This is the first PR and depends on no other workstream.

---

## Risks and Tradeoffs

**Risk: adb round-trip latency per execute call**
Adding ~100ms to every `execute` call. Acceptable for the typical skill run (seconds to minutes). Mitigation: cache the result for the duration of a CLI session, or write a state token after `operator setup` that execute can read before making the adb call.

**Risk: agents that scripted around the warn behavior**
Any agent that explicitly parses doctor output and ignores `RECEIVER_NOT_INSTALLED` warnings will now get a hard failure. This is the intended behavior. The change is semantically correct; the previous behavior was a bug.

**Tradeoff: `--skip-preflight` scope**
If we add `--skip-preflight`, agents can opt out. This is useful for automated pipelines that already verify readiness. But it also creates a footgun. Keep it undocumented or restrict it to `--output json` mode only.

---

## Validation Plan

1. Unit test: `checkApkPresence` returns `fail` when pm list packages returns empty.
2. Unit test: `isCriticalDoctorCheck` returns true for `readiness.apk.presence`.
3. Integration test: `clawperator execute` with no APK installed returns `RECEIVER_NOT_INSTALLED` error within 2 seconds (not timeout after 30+).
4. Integration test: `clawperator doctor` exits non-zero when APK is absent.
5. Manual verification: install.sh path on clean device, uninstall APK, run doctor, observe hard failure.

---

## Acceptance Criteria

- `clawperator doctor` exits non-zero when the Operator APK is absent.
- `clawperator execute` returns `RECEIVER_NOT_INSTALLED` in under 2 seconds when the APK is absent, not `RESULT_ENVELOPE_TIMEOUT` after 30+ seconds.
- The `RECEIVER_NOT_INSTALLED` error response includes the install command.
- `RECEIVER_VARIANT_MISMATCH` remains a warning (not a hard failure).
- All existing doctor tests pass.
- `docs/troubleshooting.md`, `docs/reference/node-api-doctor.md`, and `docs/reference/error-handling.md` reflect the new behavior.
