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
- Gate placement: the check belongs in `runExecution.ts` only - this is the layer that actually requests device access (via `broadcastAgentCommand`). Do NOT add the gate to `runSkill.ts`. `runSkill.ts` launches arbitrary scripts; many skill scripts do not require device access and should not be blocked. Skills that call `clawperator execute` from within their script will hit the gate naturally at `runExecution.ts`. Skills that call `adb` directly already bypass the Node layer entirely and are a separate (pre-existing) concern.

### 4. `--check-only` semantics

`--check-only` is an existing flag on `clawperator doctor` that suppresses the exit code, returning 0 regardless of check results. `install.sh` uses this path to inspect the report without triggering a failure exit.

This PR does not add a new mode. The only change is: `doctor` without `--check-only` now exits 1 when the APK is absent (because the check is promoted from warn to fail). `--check-only` continues to exit 0 in all cases. This distinction must be documented precisely - do not add any prose that implies a new flag or new mode exists.

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
- Full docs consolidation (PRD-6)

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

### Fixtures and Mocks

**`scripts/fake_adb.sh` extensions (env var `FAKE_ADB_PACKAGES`):**
- `FAKE_ADB_PACKAGES=present` — `pm list packages com.clawperator.operator` returns
  `package:com.clawperator.operator`
- `FAKE_ADB_PACKAGES=absent` — same command returns empty output (no packages)
- `FAKE_ADB_PACKAGES=variant` — same command returns `package:com.clawperator.operator.dev`

**Unit test doubles (inject via module mock or dependency parameter):**
- `mockCheckApkPresence(result: DoctorCheckResult)` — replaces the real adb call in
  `runExecution.ts` unit tests
- `spyBroadcastAgentCommand` — records call count and arguments; replaces the real
  broadcast in `runExecution.ts` unit tests

**Shared execution payload fixture (`test/fixtures/execution-minimal-valid.json`):**
```json
{
  "commandId": "test-cmd-001",
  "taskId": "test-task-001",
  "actions": [{ "id": "t1", "type": "tap", "params": { "x": 100, "y": 200 } }]
}
```

### TDD Sequence

Write each test before making the code change it targets. Run the test first — it must
fail before the change and pass after. Do not proceed to the next step until the previous
step's tests pass and nothing already passing has broken.

**Step 1 — before changing `criticalChecks.ts`:**
Write T1. It fails (prefix absent). Add `"readiness.apk.presence"` to
`CRITICAL_DOCTOR_CHECK_PREFIXES`. T1 must pass.

**Step 2 — before changing `readinessChecks.ts`:**
Write T2, T3, T4 together. T2 and T4 pass immediately (those behaviors are not changing
yet). T3 fails (status is `"warn"`). Change `RECEIVER_NOT_INSTALLED` case to
`status: "fail"`. Re-run all three: all must pass. T2 and T4 are the regression anchors -
if either fails after the change, stop and investigate before committing.

**Step 3 — before touching `runExecution.ts`:**
Write T5 and T6 together. Both fail (no guard exists). Add `checkApkPresence` call before
`broadcastAgentCommand`. Both must pass. Verify `spyBroadcastAgentCommand` call counts
explicitly - do not rely on the return value alone.

**Step 4 — integration tests after all unit tests pass:**
Run T7–T10 under `CLAWPERATOR_RUN_INTEGRATION=1` with a device that has the APK
uninstalled. Reinstall after T7 to avoid cascading failures in subsequent tests.

### Unit Tests

**T1 — `isCriticalDoctorCheck` recognizes the APK check id**
- Call: `isCriticalDoctorCheck({ id: "readiness.apk.presence", status: "fail",
  code: "RECEIVER_NOT_INSTALLED", message: "" })`
- Expected: `true`
- Failure mode protected: prefix absent from `CRITICAL_DOCTOR_CHECK_PREFIXES`; doctor
  exits 0 when APK is absent; `--check-only` is the only exit-0 path

**T2 — `checkApkPresence` passes when APK is installed (happy-path anchor)**
- Setup: `FAKE_ADB_PACKAGES=present`; config uses default `com.clawperator.operator`
- Expected: `{ id: "readiness.apk.presence", status: "pass" }`
- Failure mode protected: over-broad check always returns "fail"; all commands blocked
- Note: must pass before AND after the `readinessChecks.ts` change

**T3 — `checkApkPresence` returns `"fail"` when APK is absent**
- Setup: `FAKE_ADB_PACKAGES=absent`
- Expected: `{ id: "readiness.apk.presence", status: "fail", code: "RECEIVER_NOT_INSTALLED" }` and `fix.steps` is a non-empty array containing an install command
- Failure mode protected: status stays `"warn"`; gate never fires; 30-120s timeouts
  continue
- Note: must fail before the change, pass after

**T4 — `checkApkPresence` warns (not fails) on variant mismatch (regression anchor)**
- Setup: `FAKE_ADB_PACKAGES=variant` (dev APK installed, release expected)
- Expected: `{ id: "readiness.apk.presence", status: "warn", code: "RECEIVER_VARIANT_MISMATCH" }`
- Failure mode protected: severity accidentally promoted to "fail"; users with the dev APK
  get hard-blocked
- Note: must pass before AND after the change — this case is not being modified

**T5 — `runExecution` blocks broadcast when APK absent**
- Setup: `mockCheckApkPresence({ status: "fail", code: "RECEIVER_NOT_INSTALLED",
  message: "...", fix: { steps: [...] } })`; `spyBroadcastAgentCommand` initialized
- Input: `test/fixtures/execution-minimal-valid.json`
- Expected: returns `{ ok: false, error: { code: "RECEIVER_NOT_INSTALLED",
  message: <contains install command and device ID> } }`; `spyBroadcastAgentCommand` call
  count is 0
- Failure mode protected: guard added to wrong location; error returned but broadcast
  still fires; error message missing actionable install step

**T6 — `runExecution` passes through when APK present (happy-path anchor)**
- Setup: `mockCheckApkPresence({ status: "pass" })`; `spyBroadcastAgentCommand` returns
  `{ ok: true, data: { result: "pass" } }`
- Input: `test/fixtures/execution-minimal-valid.json`
- Expected: returns `{ ok: true }`; `spyBroadcastAgentCommand` call count is exactly 1
- Failure mode protected: over-broad gate fires even when APK is installed; all commands
  permanently blocked

### Integration Tests

Run with `CLAWPERATOR_RUN_INTEGRATION=1`. Requires a connected device.

**T7 — Fast-fail when APK absent**
- Precondition: `adb uninstall com.clawperator.operator` (record elapsed time to confirm
  the old path takes 30+ seconds)
- Command: `clawperator execute --execution test/fixtures/execution-minimal-valid.json`
- Expected: process exits in under 2 seconds; output contains `RECEIVER_NOT_INSTALLED`;
  error message contains the string `clawperator operator setup` or equivalent install
  command
- Failure mode protected: timeout path still fires (2 minute wait); no actionable guidance
- After test: reinstall APK before running T8

**T8 — `doctor` exits non-zero when APK absent**
- Precondition: APK uninstalled
- Command: `clawperator doctor --output json`; capture stdout and exit code
- Expected: exit code is non-zero; `JSON.parse(stdout)` succeeds; APK check entry has
  `"status": "fail"`; `fix.steps` array has at least one entry
- Failure mode protected: exit code stays 0; `install.sh` cannot detect failure; installer
  proceeds without installing APK

**T9 — `doctor --check-only` exits 0 with honest data**
- Precondition: APK uninstalled
- Command: `clawperator doctor --check-only --output json`; capture stdout and exit code
- Expected: exit code 0; `JSON.parse(stdout)` succeeds; APK check entry still has
  `"status": "fail"` (data is honest; exit code is suppressed by `--check-only`)
- Failure mode protected: `--check-only` semantics broken; installer bails instead of
  reading the JSON and proceeding to install

**T10 — `install.sh` handles `status: "fail"` from doctor**
- Fixture: write a mock doctor JSON response to `/tmp/mock-doctor-output.json`:
  ```json
  { "checks": [{ "id": "readiness.apk.presence", "status": "fail",
    "code": "RECEIVER_NOT_INSTALLED", "fix": { "steps": [] } }] }
  ```
- Run the installer's conditional parsing block against that file in a subshell
- Expected: the install step is reached (not skipped); exit 0
- Failure mode protected: installer bails on `"fail"` severity; APK install step never
  runs after the severity change

### CLI / Contract Regression

**T11 — Doctor JSON output remains parseable after the change**
- Command: `clawperator doctor --output json` (against any device state)
- Expected: `JSON.parse(stdout)` succeeds; `report.checks` is an array; no extra commas,
  unquoted keys, or formatting artifacts
- Failure mode protected: serialization broken by the readinessChecks.ts edit

**T12 — `install.sh` success banner contains the agent docs URL**
- Method: `grep -F 'llms.txt' sites/landing/public/install.sh`
- Expected: `https://docs.clawperator.com/llms.txt` present in the install.sh success
  output block
- Failure mode protected: banner added to wrong position; URL missing or wrong

### Manual Verification

**M1 — Fast-fail confirmed on device**
- Uninstall: `adb uninstall com.clawperator.operator`
- Run: `time clawperator execute --execution test/fixtures/execution-minimal-valid.json`
- Confirm: total elapsed time under 2 seconds
- Confirm: error message names the device ID and provides an install command the user
  can copy-paste without looking up docs
- Record elapsed time as a benchmark for comparison

**M2 — No regression on device with APK installed**
- Install: `adb install <path/to/operator.apk>`
- Run: `clawperator execute --execution test/fixtures/execution-minimal-valid.json`
- Confirm: command completes successfully (not `RECEIVER_NOT_INSTALLED`)
- Run: `clawperator doctor`
- Confirm: exits 0; APK check is `"pass"`

---

## Acceptance Criteria

- `clawperator doctor` exits non-zero when the Operator APK is absent.
- `clawperator execute` returns `RECEIVER_NOT_INSTALLED` with install command in under 2 seconds when the APK is absent. Gate is in `runExecution.ts` only.
- `clawperator doctor --check-only` continues to exit 0 regardless of APK state. No new flag or mode is introduced; `--check-only` is the pre-existing escape hatch.
- `RECEIVER_VARIANT_MISMATCH` remains a `warn` (not a hard failure).
- `install.sh` still installs the APK when the device is ready (handles `status: "fail"` from doctor JSON).
- `install.sh` post-install banner includes `https://docs.clawperator.com/llms.txt`.
- `docs/first-time-setup.md` and `docs/reference/node-api-doctor.md` agree on APK absence behavior.
- No `runSkill.ts` changes in this PR. Skill scripts that call `execute` get the gate naturally.
