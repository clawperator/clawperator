# PRD-1: Shared Readiness Gate

Workstream: WS-1
Priority: 1 (highest)
Proposed PR: PR-1

Merged from both agents. This is the highest-confidence finding with the clearest code path.

---

## Problem Statement

Agents reach a `RESULT_ENVELOPE_TIMEOUT` when the Operator APK is missing because nothing stops `execute` or `skills run` from dispatching an adb broadcast to a receiver that does not exist. Clawperator already knows how to detect this condition. The problem is that the detection is advisory-only in `doctor` and is not reused as a gate before live device dispatch.

---

## Evidence

**From `apps/node/src/domain/doctor/criticalChecks.ts`:**

`readiness.apk.presence` is absent from `CRITICAL_DOCTOR_CHECK_PREFIXES`. Doctor does not halt on APK absence.

**From `apps/node/src/domain/doctor/checks/readinessChecks.ts`:**

```typescript
return {
  id: "readiness.apk.presence",
  status: "warn",               // warn, not fail
  code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
  ...
};
```

**From `apps/node/src/domain/executions/runExecution.ts`:**

The call sequence is:
1. `validateExecution(input)` - validates payload shape
2. `resolveDevice(config)` - resolves device serial
3. `broadcastAgentCommand(...)` - sends to Android

No APK presence check between steps 2 and 3.

**From `apps/node/src/domain/executions/runExecution.ts` (existing pattern):**

`injectServiceUnavailableHint` already injects a hint into the result envelope for `SERVICE_UNAVAILABLE`. The pre-flight pattern should follow the same approach: check early, return a structured error immediately.

**From `sites/landing/public/install.sh`:**

`install.sh` already calls `doctor --format json` and parses the JSON result to conditionally install the APK. Changing doctor severity must preserve this behavior.

**From `docs/first-time-setup.md` (lines ~244-246):**

Describes `RECEIVER_NOT_INSTALLED` as leading to an unhealthy exit. This matches the intended behavior but not the shipped behavior. The contradiction must be fixed in the same PR.

**From `docs/reference/node-api-doctor.md`:**

Documents APK absence as advisory today. Must be updated to reflect the new blocking behavior.

**From `tasks/node/agent-usage/issues.md` (GloBird incident):**

> GloBird skill timed out. Is it the app? The APK? The device? No logs to check.
> Had to manually verify APK was installed - it wasn't.

---

## Current Behavior

1. `doctor` reports `RECEIVER_NOT_INSTALLED` as a warning. Exits 0 if all critical checks pass.
2. `execute` validates the payload, resolves the device, broadcasts - no APK check.
3. `skills run` delegates to the skill script with no device readiness guarantee.
4. `install.sh` parses doctor JSON and can install the APK, but cannot force a hard stop if the agent proceeds before installation.
5. 30-120 seconds elapse before `RESULT_ENVELOPE_TIMEOUT` is returned.

---

## Proposed Change

### 1. `criticalChecks.ts`: add `readiness.apk.presence`

Add `"readiness.apk.presence"` to `CRITICAL_DOCTOR_CHECK_PREFIXES`. This makes doctor halt when the APK is absent.

### 2. `readinessChecks.ts`: `RECEIVER_NOT_INSTALLED` becomes `fail`

Change `status: "warn"` to `status: "fail"` for the `RECEIVER_NOT_INSTALLED` case.

Keep `RECEIVER_VARIANT_MISMATCH` as `warn` - the `--receiver-package` workaround makes it recoverable without reinstalling.

### 3. `runExecution.ts`: APK presence pre-flight

Before `broadcastAgentCommand`, run `checkApkPresence(config)`. On failure, return immediately:

```json
{
  "ok": false,
  "error": {
    "code": "RECEIVER_NOT_INSTALLED",
    "message": "Operator APK (com.clawperator.operator) is not installed on <device_id>. Install it with: clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>"
  }
}
```

Implementation notes:
- Reuse `checkApkPresence` from `readinessChecks.ts` directly - do not duplicate the adb call.
- The adb round-trip is ~100ms. No session-level cache is warranted: each `clawperator execute` is a separate process, so in-memory caching provides no benefit. Keep it a fresh check on every invocation.
- Follow the `injectServiceUnavailableHint` pattern already in `runExecution.ts` for the hint text.
- `skills run` does NOT inherit this check automatically. `runSkill.ts` spawns an arbitrary script process - it has no call to `runExecution`. Skills that happen to call `clawperator execute` from within their script will hit the check. Skills that use `adb` directly or omit execution entirely will not. The `runSkill.ts` wrapper must therefore also call `checkApkPresence` before spawning the skill script, so the gate is enforced regardless of how the script is written.

### 4. `--check-only` semantics preserved

Doctor with `--check-only` must remain non-blocking and return the full JSON even when the APK is absent. The installer uses this path. The severity change must not break the installer's conditional logic.

Verify: after this change, `clawperator doctor --check-only --output json` still returns a parseable result with `status: "fail"` in the APK check but does not exit non-zero.

### 5. `install.sh`: post-install docs banner

In the success banner at the end of `install.sh`, add:

```
  Docs:        https://docs.clawperator.com
  Agent guide: https://docs.clawperator.com/llms.txt

If you are an AI agent, read the agent guide before running any commands.
```

This belongs in PR-1 because it describes the same change (APK absence is now blocking, here is where to read about it).

### 6. Documentation updates in PR-1

- `docs/first-time-setup.md`: align the `RECEIVER_NOT_INSTALLED` wording with shipped behavior (now a hard failure).
- `docs/reference/node-api-doctor.md`: update APK absence from advisory to blocking.
- `docs/reference/error-handling.md`: clarify that `RECEIVER_NOT_INSTALLED` now fails fast at execute time.
- `docs/troubleshooting.md`: add a `RECEIVER_NOT_INSTALLED` section with the install command.

---

## Why This Matters for Agent Success

The 30-120 second timeout is the worst possible failure signal. Every other improvement - better error messages, logs, docs links - is less valuable than not waiting 2 minutes before getting a diagnosis.

This is also the only change where the code path is entirely clear: two lines in `criticalChecks.ts`, one line in `readinessChecks.ts`, and a pre-flight guard in `runExecution.ts`.

---

## Scope Boundaries

In scope:
- `criticalChecks.ts`, `readinessChecks.ts`, `runExecution.ts`
- `install.sh` docs banner
- Four doc updates (first-time-setup, node-api-doctor, error-handling, troubleshooting)

Out of scope:
- `RECEIVER_VARIANT_MISMATCH` severity (stays warn)
- Streaming output (PRD-4)
- Skill payload dry-run (PRD-3)
- Full docs consolidation (PRD-5)

---

## Dependencies

None. This is the first PR and depends on no other workstream.

---

## Risks and Tradeoffs

**Risk: installer behavior**
`install.sh` parses `doctor --format json` and uses the result to decide whether to install the APK. The installer must handle `status: "fail"` for APK absence correctly after this change. Verify that the installer's JSON parsing does not treat a `fail` severity as an unrecoverable error that prevents the install step from running.

**Risk: adb round-trip in execute and runSkill**
The pre-flight adds ~100ms per invocation. Each CLI call is a new process, so no in-memory cache is possible. The raw adb cost is acceptable. If it proves measurable, a short-lived on-disk stamp (e.g. `~/.clawperator/cache/apk-<serial>.json` with a 5-second TTL) is the right follow-on optimization - do not add that complexity in this PR.

**Risk: gate placement in runSkill.ts**
The check added to `runSkill.ts` runs before the skill script is spawned. If a skill is designed to install the APK itself (unusual but possible), the pre-flight will incorrectly block it. Document that self-installing skills should call `clawperator operator setup` before being invoked via `skills run`.

---

## Validation Plan

1. Unit test: `isCriticalDoctorCheck({ id: "readiness.apk.presence", ... })` returns `true`.
2. Unit test: `checkApkPresence` returns `status: "fail"` (not `"warn"`) when the package is absent.
3. Unit test: `runExecution` returns `RECEIVER_NOT_INSTALLED` error before broadcasting when APK absent.
3a. Unit test: `runSkill` returns `RECEIVER_NOT_INSTALLED` error before spawning the script when APK absent (gate at `runSkill.ts` layer, not just `runExecution.ts`).
4. Integration test: `clawperator execute` with no APK returns `RECEIVER_NOT_INSTALLED` in under 2 seconds.
5. Integration test: `clawperator doctor --output json` exits non-zero when APK is absent.
6. Integration test: `clawperator doctor --check-only --output json` exits 0 and returns parseable JSON even when APK is absent.
7. Integration test: `install.sh` still successfully installs the APK when doctor reports failure.

---

## Acceptance Criteria

- `clawperator doctor` exits non-zero when the Operator APK is absent.
- `clawperator execute` returns `RECEIVER_NOT_INSTALLED` with install command in under 2 seconds when the APK is absent.
- `clawperator doctor --check-only --output json` exits 0 and returns parseable JSON regardless of APK state.
- `RECEIVER_VARIANT_MISMATCH` remains a `warn` (not a hard failure).
- `install.sh` still installs the APK when the device is ready.
- `install.sh` post-install banner includes `https://docs.clawperator.com/llms.txt`.
- `docs/first-time-setup.md` and `docs/reference/node-api-doctor.md` agree on APK absence behavior.
