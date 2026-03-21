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
  Import path: `import { checkApkPresence } from "../doctor/checks/readinessChecks.js"`.
  Signature: `checkApkPresence(config: RuntimeConfig): Promise<DoctorCheckResult>`.
- **Exact insertion point**: In the `performExecution` function in `runExecution.ts`, the
  device resolution block ends at `config.deviceId = deviceId` and is immediately followed
  by the `tryAcquire` call. Insert the APK check between those two statements:

  ```typescript
  // existing
  config.deviceId = deviceId;
  } catch (e) {
    return { execution, result: { ok: false, error: e as ..., deviceId } };
  }

  // INSERT HERE: APK pre-flight
  const apkCheck = await checkApkPresence(config);
  if (apkCheck.status !== "pass") {
    return { execution, result: { ok: false, error: { code: "RECEIVER_NOT_INSTALLED",
      message: `Operator APK (${config.receiverPackage}) is not installed on ${deviceId}. ` +
        `Install it with: clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id ${deviceId}`,
    }, deviceId } };
  }

  // existing
  if (!tryAcquire(deviceId, execution.commandId)) {
  ```

  This placement is after device resolution (so `config.deviceId` is set and
  `config.receiverPackage` is final) and before lock acquisition (so we return early
  without holding the device lock on failure).

- **`--receiver-package` propagation**: `config` is built at the top of `performExecution`
  with `receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE`.
  This means if the caller passes `--receiver-package com.clawperator.operator.dev`, the
  pre-flight will check for that package. No extra wiring is needed; verify this is still
  the case when reading the function fresh before implementing.

- **adb failure during pre-flight**: If `checkApkPresence` itself encounters an adb error
  (e.g. `pm list packages` returns non-zero exit), the function should return `status: "warn"`
  rather than `"fail"` for that sub-case. By the time we reach the pre-flight, `resolveDevice`
  has already confirmed adb is responding, so a `pm` failure is likely transient. A `"warn"`
  means the pre-flight does not block execution, but the issue is surfaced in logs. Add a unit
  test for this case (T9 below).
- The adb round-trip is ~100ms. No session-level cache is warranted: each `clawperator execute` is a separate process, so in-memory caching provides no benefit. Keep it a fresh check on every invocation.
- Follow the `injectServiceUnavailableHint` pattern already in `runExecution.ts` for the hint text.
- Gate placement: the check belongs in `runExecution.ts` only - this is the layer that actually requests device access (via `broadcastAgentCommand`). Do NOT add the gate to `runSkill.ts`. `runSkill.ts` launches arbitrary scripts; many skill scripts do not require device access and should not be blocked. Skills that call `clawperator execute` from within their script will hit the gate naturally at `runExecution.ts`. Skills that call `adb` directly already bypass the Node layer entirely and are a separate (pre-existing) concern.

### 4. `--check-only` semantics

`--check-only` is an existing flag on `clawperator doctor` that suppresses the exit code, returning 0 regardless of check results. `install.sh` uses this path to inspect the report without triggering a failure exit.

This PR does not add a new mode. The only change is: `doctor` without `--check-only` now exits 1 when the APK is absent (because the check is promoted from warn to fail). `--check-only` continues to exit 0 in all cases. This distinction must be documented precisely - do not add any prose that implies a new flag or new mode exists.

### 5. `install.sh`: post-install docs banner

The success banner at the end of `install.sh` already contains (line 750):
```
For more info, visit: https://docs.clawperator.com
```

Extend this with the `llms.txt` line immediately after — do not duplicate or replace the
existing reference:

```
  Docs:        https://docs.clawperator.com
  Agent guide: https://docs.clawperator.com/llms.txt

If you are an AI agent, read the agent guide before running any commands.
```

This belongs in PR-1 because it describes the same change (APK absence is now blocking,
here is where to read about it).

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
- Full docs consolidation (PRD-6)
- `observe screenshot` and `observe snapshot`: these dispatch to the device via adb but
  do not go through `runExecution.ts`. They will still timeout on a missing APK. This is a
  known limitation; gate them in a follow-on if it becomes a reported pain point.

---

## Dependencies

None. This is the first PR and depends on no other workstream.

---

## Risks and Tradeoffs

**Risk: installer behavior**
`install.sh` parses `doctor --format json` and uses the result to decide whether to install the APK. The installer must handle `status: "fail"` for APK absence correctly after this change. Verify that the installer's JSON parsing does not treat a `fail` severity as an unrecoverable error that prevents the install step from running.

**Risk: adb round-trip in execute**
The pre-flight adds ~100ms per `execute` invocation. Each CLI call is a new process, so no in-memory cache is possible. The raw adb cost is acceptable. If it proves measurable in practice, a short-lived on-disk stamp (e.g. `~/.clawperator/cache/apk-<serial>.json` with a 5-second TTL) is the right follow-on optimization - do not add that complexity in this PR.

**Risk: skills that use adb directly**
Skill scripts that call `adb` directly rather than `clawperator execute` will not hit the gate. This is a pre-existing bypass of the Node layer and is out of scope for this PR. If a direct-adb skill is common, add a note to the skill authoring guide that `clawperator execute` is the required path for device dispatch.

---

## Testing Plan

### Fixtures and Injection Patterns

All unit tests for adb-dependent code use `FakeProcessRunner` from
`test/unit/fakes/FakeProcessRunner.ts`. Do not use `fake_adb.sh` for unit tests.

For `checkApkPresence` unit tests, queue the `pm list packages` result directly:
```typescript
const runner = new FakeProcessRunner();
const config = getDefaultRuntimeConfig({ runner, deviceId: "test-device",
  receiverPackage: "com.clawperator.operator" });
// APK present: pm list packages returns "package:com.clawperator.operator"
runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator", stderr: "" });
// APK absent: pm list packages returns empty output
runner.queueResult({ code: 0, stdout: "", stderr: "" });
// Variant: dev package installed instead of release
runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev", stderr: "" });
```

For `runExecution` unit tests, inject a `runner` via `getDefaultRuntimeConfig` as shown
in the existing `runCloseAppPreflight` tests. Use a runner whose `run` method returns
instantly with the APK state you need, then spy on the broadcast call count.

`fake_adb.sh` is used only for the CLI-level integration test (T7). Add a new
`VARIANT_APK` scenario to `fake_adb.sh` for T8: when `FAKE_ADB_SCENARIO=VARIANT_APK`,
the `pm list packages com.clawperator.operator` command returns
`package:com.clawperator.operator.dev` instead.

`test/fixtures/execution-minimal-valid.json`:
`{ "commandId": "test-cmd-001", "taskId": "test-task-001", "source": "test",
  "expectedFormat": "android-ui-automator", "timeoutMs": 5000,
  "actions": [{ "id": "t1", "type": "tap", "params": { "x": 100, "y": 200 } }] }`

### TDD Sequence

1. Write T2 + T3 (happy path + APK absent). T2 passes immediately; T3 fails. Change
   `readinessChecks.ts`. Both must pass.
2. Write T4 (variant stays warn). Must pass before and after — behavior is not changing.
3. Write T1 (`isCriticalDoctorCheck`). Fails; add prefix; passes.
4. Write T5 + T6 (pre-flight blocks + passes through). Both fail. Add guard to
   `runExecution.ts`. Both must pass. Verify broadcast spy call count explicitly.
5. Run integration test T7 on a device with APK uninstalled.

### Unit Tests

**T1 — `isCriticalDoctorCheck` recognizes the APK check**
- Input: `{ id: "readiness.apk.presence", ... }`; expected: `true`
- Protects: prefix missing; doctor exits 0 on APK absence

**T2 — `checkApkPresence` returns pass when APK is present (happy-path anchor)**
- Setup: `FAKE_ADB_PACKAGES=present`; expected: `{ status: "pass" }`
- Protects: over-broad check always returns "fail"; must pass before and after the change

**T3 — `checkApkPresence` returns fail when APK is absent**
- Setup: `FAKE_ADB_PACKAGES=absent`
- Expected: `{ status: "fail", code: "RECEIVER_NOT_INSTALLED" }` with `fix.steps` non-empty
- Protects: status stays "warn"; 30-120s timeouts continue

**T4 — variant mismatch stays "warn" (regression anchor)**
- Setup: `FAKE_ADB_PACKAGES=variant`; expected: `{ status: "warn", code: "RECEIVER_VARIANT_MISMATCH" }`
- Protects: severity escalated; dev-APK users get hard-blocked

**T5 — `runExecution` blocks broadcast when APK absent**
- Setup: `FakeProcessRunner` queued to return empty `pm list packages` output (APK absent);
  also queue a failure response for any subsequent adb call to confirm broadcast never fires
- Expected: `result.ok === false`, `result.error.code === "RECEIVER_NOT_INSTALLED"`;
  `runner.calls` does not contain a broadcast call
- Protects: guard added but broadcast fires anyway; error missing install guidance

**T6 — `runExecution` passes through when APK present (happy-path anchor)**
- Setup: `FakeProcessRunner` queued with APK present, then normal broadcast/envelope responses
- Expected: `result.ok === true`; `runner.calls` contains the broadcast call
- Protects: over-broad gate fires even when APK is installed; all commands blocked

**T9 — adb failure during pre-flight does not block execution**
- Setup: `FakeProcessRunner` queued to return `{ code: 1, stdout: "", stderr: "error: device offline" }` for the `pm list packages` call (simulating a transient adb failure)
- Expected: `result.ok === true` (pre-flight treated as `warn`, execution continues); broadcast IS called
- Protects: transient adb failure causes all commands to fail-closed; pre-flight becomes more disruptive than the problem it solves

### Integration Tests

Run with `CLAWPERATOR_RUN_INTEGRATION=1`, device with APK uninstalled.

**T7 — fast-fail when APK absent**
- Command: `clawperator execute --execution test/fixtures/execution-minimal-valid.json`
- Expected: exits in under 2 seconds; output contains `RECEIVER_NOT_INSTALLED` and an
  install command
- Protects: timeout still fires (30-120s); no actionable guidance in the error

**T8 — `doctor --check-only` exits 0 with honest data**
- Command: `clawperator doctor --check-only --output json`
- Expected: exit code 0; JSON parseable; APK check shows `status: "fail"`
- Protects: `--check-only` broken; installer bails instead of reading JSON

### Manual Verification

- APK absent: confirm error arrives in under 2 seconds; install command is copy-pasteable
- APK installed: confirm normal execution still works (no regression from the gate)
- **Installer regression (required)**: run `install.sh` on a device that does not have the
  APK installed. Verify the installer detects the missing APK, proceeds to install it, and
  completes successfully. The severity change (warn -> fail) must not cause `install.sh` to
  abort before reaching the install step.

---

## Acceptance Criteria

- `clawperator doctor` exits non-zero when the Operator APK is absent.
- `clawperator execute` returns `RECEIVER_NOT_INSTALLED` with install command in under 2 seconds when the APK is absent. Gate is in `runExecution.ts` only.
- `clawperator doctor --check-only` continues to exit 0 regardless of APK state. No new flag or mode is introduced; `--check-only` is the pre-existing escape hatch.
- `RECEIVER_VARIANT_MISMATCH` remains a `warn` (not a hard failure).
- `install.sh` still installs the APK when the device is ready (handles `status: "fail"` from doctor JSON). Verified manually by running `install.sh` on a device without the APK present.
- `install.sh` post-install banner includes `https://docs.clawperator.com/llms.txt`.
- `docs/first-time-setup.md` and `docs/reference/node-api-doctor.md` agree on APK absence behavior.
- No `runSkill.ts` changes in this PR. Skill scripts that call `execute` get the gate naturally.
