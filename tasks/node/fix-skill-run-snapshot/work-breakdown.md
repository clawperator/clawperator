# open_app Readiness and Snapshot Extraction Reliability - Work Breakdown

Parent plan: `tasks/node/fix-skill-run-snapshot/plan.md`

## Executive Summary

2 PRs, 3 phases. Phase 1 (PR-1) implements the Android side of the `open_app`
readiness fix. Phase 2 (PR-1) implements the Node side, docs, device validation,
and skill cleanup. Phase 3 (PR-2) closes the logcat capture timing gap with
commandId-tagged snapshot log lines. Do not start PR-2 work until PR-1 is merged.

| PR | Phases | Agent tier | State |
| --- | --- | --- | --- |
| PR-1 | 1, 2 | default, default | not started |
| PR-2 | 3 | default | not started |

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not start Phase 3 (PR-2) until PR-1 is merged.
- `skipNavigationWait` must default to `false` at every layer: Kotlin data class
  default, Android parser absent-field handling, and Node contract default.
  Do not leave any layer with opt-in behavior as the default.
- The navigation wait must reuse `TaskScopeDefault.waitForNavigation` exactly as
  it exists. Do not write a new polling loop.
- Android unit tests for Phase 1 behavior must ship in the same commit as the
  Android behavior change. Do not defer them.
- Node unit tests for Phase 2 behavior must ship in the same commit as the Node
  contract change. Do not defer them.
- The old snapshot log marker format `[TaskScope] UI Hierarchy:` must remain
  parseable in the Node reader after PR-2. Do not break old APK compatibility.
- Do not edit `sites/docs/.build/` directly. If docs regeneration is needed,
  run the docs-build workflow. In practice, `docs/api/actions.md` is authored
  source and does not require regeneration unless it feeds a generated page.
- One commit per logical step. Do not batch Android contract changes, engine
  changes, and test changes into one commit.
- If device testing reveals the 15 000 ms timeout is insufficient on a slow device,
  the fix is a separate `navigationTimeoutMs` param. Do not increase the global
  `open_app` timeout without explicit approval.
- Use the `.dev` Operator APK and `--operator-package com.clawperator.operator.dev`
  for all device validation unless explicitly told otherwise.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/fix-skill-run-snapshot/plan.md` | Stable contract, scope boundaries, and decision rules |
| `apps/node/src/contracts/execution.ts` | Current `open_app` action params type - add `skipNavigationWait` here |
| `apps/node/src/domain/actions/openApp.ts` | Current Node builder for `open_app` |
| `apps/android/.../task/runner/UiActionEngineDefault.kt` | `executeOpenApp` entry point - where the wait call is inserted |
| `apps/android/.../task/runner/TaskScopeDefault.kt` | `waitForNavigation` implementation (lines 374-430) and `logUiTree` (lines 230-309) |
| `apps/android/.../agent/AgentCommandParser.kt` | Where `skipNavigationWait` must be parsed (lines 95-100 area) |
| `apps/node/src/adapters/android-bridge/logcatResultReader.ts` | `captureSnapshotLines` gate and `beginDispatchCapture` (for Phase 3) |
| `apps/node/src/domain/executions/snapshotHelper.ts` | `extractSnapshotsFromLogs` parser (for Phase 3) |
| `docs/api/actions.md` | Current `open_app` docs - update in Phase 2 |

## PR / Phase Plan

| PR | Branch | Purpose | Phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `node/open-app-delay` | `open_app` blocks until app is foreground | 1, 2 | default, default | none |
| PR-2 | `node/snapshot-commandid` | Snapshot log lines tagged with commandId | 3 | default | PR-1 merged |

---

## Phase 1: Android - open_app navigation wait

### Agent Tier

default

### Goal

Change the Android `open_app` action to block until the launched package is the
active accessibility window before returning success. Add `skipNavigationWait`
opt-out. Ship Android unit tests in the same commit.

### Files to Change

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/`
  - The `UiAction.OpenApp` data class - add `skipNavigationWait: Boolean = false`
  - `AgentCommandParser.kt` - parse `skipNavigationWait` from incoming command JSON;
    treat absent field as `false`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngineDefault.kt`
  - `executeOpenApp` - after `taskScope.openApp(...)` succeeds, call
    `taskScope.waitForNavigation(expectedPackage = action.applicationId, timeoutMs = ...)`
    unless `action.skipNavigationWait == true`
- Android unit test file for `UiActionEngineDefault` (locate existing test or
  create adjacent to the class)

### Steps

1. Read `UiActionEngineDefault.kt` `executeOpenApp` and `TaskScopeDefault.kt`
   `waitForNavigation` fully before writing anything. Confirm `waitForNavigation`
   is accessible from the engine call site and accepts an `expectedPackage` and
   `timeoutMs` argument.
2. Add `skipNavigationWait: Boolean = false` to `UiAction.OpenApp`.
3. Update `AgentCommandParser.kt` to read `skipNavigationWait` from the command
   JSON. Absent field must parse as `false`.
4. In `executeOpenApp`, after the existing `taskScope.openApp(...)` call succeeds,
   add: if `!action.skipNavigationWait`, call `taskScope.waitForNavigation(...)`.
   Use the remaining timeout budget (subtract intent-dispatch time from
   `action.timeoutMs`). If `waitForNavigation` throws or times out, return a step
   failure with a clear error message that is distinct from an intent dispatch
   failure.
5. Add Android unit tests:
   - `open_app skipNavigationWait=false`: mock `waitForNavigation` to succeed;
     confirm it is called after intent dispatch; confirm step returns `success=true`.
   - `open_app skipNavigationWait=true`: confirm `waitForNavigation` is NOT called;
     step returns immediately after intent dispatch.
   - `open_app skipNavigationWait=false, waitForNavigation times out`: confirm step
     returns `success=false` with a navigation-timeout error message.
   - `open_app skipNavigationWait absent in JSON`: confirm it parses as `false`.
6. Build and run Android unit tests before committing.

### Acceptance Criteria

Mechanical:
- `./gradlew app:assembleDebug` succeeds with no new warnings
- `./gradlew app:testDebugUnitTest` passes, including all four new test cases
- `UiAction.OpenApp` has `skipNavigationWait: Boolean = false`
- `AgentCommandParser` parses `skipNavigationWait` and defaults to `false` when absent
- `executeOpenApp` calls `waitForNavigation` when `skipNavigationWait` is false

Human review:
- The wait call is conditional and uses the existing `waitForNavigation` - no new
  algorithm introduced
- The navigation-timeout error message is clearly distinct from intent dispatch failure
- No other `executeOpenApp` behavior changed

### Validation

```bash
./gradlew app:assembleDebug
./gradlew app:testDebugUnitTest
```

### Expected Commit

```
feat(android): open_app blocks until app is foreground by default

Add skipNavigationWait: Boolean = false to UiAction.OpenApp.
After intent dispatch, executeOpenApp calls waitForNavigation targeting
the launched package unless skipNavigationWait is true.
Navigation timeout returns a step failure distinct from intent dispatch failure.
Absent skipNavigationWait field in command JSON defaults to false (safe default).
```

---

## Phase 2: Node contract, CLI, docs, device validation, skill cleanup

### Agent Tier

default

### Goal

Update the Node contract and builder to carry `skipNavigationWait`. Update the
CLI. Update `docs/api/actions.md` for the new `open_app` readiness contract.
Validate on device. Remove compensatory sleeps from affected skills.

### Files to Change

- `apps/node/src/contracts/execution.ts` - add `skipNavigationWait?: boolean` to
  `open_app` action params
- `apps/node/src/domain/actions/openApp.ts` - thread `skipNavigationWait` through
  the builder (default `false` when not supplied)
- CLI: if `open-app` exists as a standalone CLI command, add `--skip-navigation-wait`
  flag; check `apps/node/src/cli/registry.ts` to confirm
- `apps/node/src/test/unit/` - Node unit tests for the contract changes (find the
  relevant existing test file or create a focused one)
- `docs/api/actions.md` - update `open_app` entry
- `../clawperator-skills/skills/com.theswitchbot.switchbot.get-bedroom-temperature/artifacts/bedroom-temperature.recipe.json`
- `../clawperator-skills/skills/com.solaxcloud.starter.get-battery/artifacts/battery.recipe.json`

### Steps

1. Add `skipNavigationWait?: boolean` to `open_app` params in `execution.ts`.
2. Update `openApp.ts` builder to pass `skipNavigationWait` through to the action.
   When the caller does not supply it, the field must be absent or explicitly
   `false` - do not default to `true`.
3. Check `apps/node/src/cli/registry.ts` for an `open-app` command entry. If it
   exists as a standalone command, add `--skip-navigation-wait` boolean flag.
   If `open_app` is only used inside recipe JSON and not as a direct CLI command,
   skip this step and note it in the commit message.
4. Add Node unit tests:
   - `openApp.ts` builder with no `skipNavigationWait` supplied: confirm field is
     `false` or absent in the resulting action object.
   - `openApp.ts` builder with `skipNavigationWait: true`: confirm field is `true`
     in the resulting action object.
5. Update `docs/api/actions.md` `open_app` entry:
   - State that `open_app` now blocks until the launched package is the active
     accessibility window before returning success.
   - Describe `skipNavigationWait` and when to use it.
   - State that success means package-foreground readiness, not content-level
     readiness. Callers that need a specific element present should follow with
     `wait_for_node`.
6. Build and test Node before device validation:
   ```bash
   npm --prefix apps/node run build
   npm --prefix apps/node run test
   ```
7. Device validation (requires debug APK from Phase 1 installed):
   a. Run `clawperator devices` and identify the target device serial.
   b. Run a recipe: `close_app` -> `open_app` -> `snapshot_ui` with zero sleep,
      `skipNavigationWait` absent (default false). Use the switchbot or solaxcloud
      app as the target.
   c. Confirm: snapshot step captures target app's tree (not launcher); step result
      `foreground_package` matches target; no `SNAPSHOT_EXTRACTION_FAILED`.
   d. Run the same recipe with `skipNavigationWait: true` to confirm the old race
      is reproducible (validates the test harness and flag behavior).
   e. Run on a second non-Samsung device if available.
8. Remove the fixed sleep actions from affected skill recipes. Confirm skills run
   cleanly end-to-end on device after sleep removal.

### Acceptance Criteria

Mechanical:
- `npm --prefix apps/node run build` succeeds
- `npm --prefix apps/node run test` passes, including new contract tests
- `execution.ts` `open_app` params has `skipNavigationWait?: boolean`
- `openApp.ts` defaults to `skipNavigationWait: false` when not supplied
- `docs/api/actions.md` describes the new readiness contract and `skipNavigationWait`
- Affected skill recipes do not contain fixed sleeps after `open_app`
- Device validation run produces no `SNAPSHOT_EXTRACTION_FAILED` (default params)

Human review:
- `docs/api/actions.md` accurately describes the package-foreground vs.
  content-level readiness distinction without overpromising
- The `skipNavigationWait` description in docs is clear about when it should be used
- The docs change does not claim content-level readiness that the implementation
  does not provide

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
clawperator devices
# then run validation recipe as described in step 7 above
```

### Expected Commits

```
feat(node): add skipNavigationWait param to open_app contract and builder
```

```
docs(api): update open_app to describe foreground readiness contract and opt-out
```

```
feat(skills): remove compensatory sleeps from switchbot and solaxcloud recipes
```

---

## Phase 3: Logcat snapshot commandId tagging (PR-2)

### Agent Tier

default

### Prerequisite

Do not start this phase until PR-1 is merged.

### Goal

Embed `commandId` in the Android snapshot log marker so Node can filter snapshot
lines by command rather than relying on the timing gate. Close the logcat capture
window miss. Maintain backward compatibility with old APK log format.

### Steps

**Step 1: Confirm Bug 2 is real before implementing (investigation)**

Run a debug session to determine whether the logcat capture window miss is an
observed real-world cause, not only a theoretically credible one:

1. On a connected device, run a `snapshot_ui` recipe and capture both the
   Clawperator `--log-file` output and raw `logcat -v threadtime` output
   simultaneously.
2. Compare: do `[TaskScope] UI Hierarchy:` lines appear in raw logcat but not
   in the `snapshotLogLines` captured by Node?
3. If yes: Bug 2 is confirmed. Proceed with the fix below.
4. If no (lines are always captured): record the finding and confirm the fix is
   still worth implementing for correctness and future-proofing. Note the finding
   in the commit message.

**Step 2: Android - add commandId to snapshot log marker**

Files:
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`
  `logUiTree` (lines 230-309)

1. Confirm that the `commandId` (or equivalent task identifier) is accessible in
   scope at the log site in `logUiTree`. If it must be threaded through from
   `executeSnapshotUi`, add it as a parameter to `logUiTree`.
2. Change the log marker from:
   `"[TaskScope] UI Hierarchy:\n$xmlDump"`
   to:
   `"[TaskScope] UI Hierarchy [commandId=$commandId]:\n$xmlDump"`
   Use the exact format specified. Do not alter the XML content or any other log line.

**Step 3: Node - update snapshot parsing to use commandId**

Files:
- `apps/node/src/adapters/android-bridge/logcatResultReader.ts`
- `apps/node/src/domain/executions/snapshotHelper.ts`

1. Update `isSnapshotLogLine` (line 26) to accept both the new format
   (`[TaskScope] UI Hierarchy [commandId=...]`) and the old format
   (`[TaskScope] UI Hierarchy:`). Both must match.
2. Update `extractSnapshotsFromLogs` to extract and return the `commandId` from
   the new marker format when present.
3. In the snapshot-to-step matching logic, when a `commandId` is present in the
   log line, use it to filter: only attach the snapshot to the execution whose
   `commandId` matches. When `commandId` is absent (old format), fall back to
   the current timing-gate behavior.
4. The `captureSnapshotLines` gate can remain for old-format lines. New-format
   lines with a matching commandId can be accepted regardless of gate state.

**Step 4: Add tests**

Node unit tests:
- `extractSnapshotsFromLogs` with new marker format: confirm commandId is parsed
  correctly and returned.
- `extractSnapshotsFromLogs` with old marker format: confirm backward-compatible
  parse produces a result (no commandId, timing-gate behavior unchanged).
- `extractSnapshotsFromLogs` with two different commandId blocks interleaved:
  confirm only the matching commandId block is returned for a given execution.
- `markExtractionFailedSnapshotSteps` with non-empty `snapshotLogLines` but no
  matching commandId blocks: confirm produces `SNAPSHOT_EXTRACTION_FAILED`.

Android unit tests:
- `logUiTree` emits the new marker format containing the commandId.
- Confirm the XML content is unchanged.

**Step 5: Build, test, and validate**

```bash
./gradlew app:assembleDebug
./gradlew app:testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Device integration: with a forced delay (if injectable) or by natural timing,
confirm `SNAPSHOT_EXTRACTION_FAILED` does not occur when the fix is active.

### Acceptance Criteria

Mechanical:
- `./gradlew app:testDebugUnitTest` passes including new Android tests
- `npm --prefix apps/node run test` passes including all four new Node tests
- `logUiTree` log output contains `[commandId=$commandId]` in the marker line
- Old `[TaskScope] UI Hierarchy:` format (no commandId) still parses correctly
- Snapshot extraction does not produce `SNAPSHOT_EXTRACTION_FAILED` in a recipe
  that previously failed due to the timing gap (if Bug 2 confirmed in Step 1)

Human review:
- Backward compatibility fallback is in place and exercised by a test
- No existing snapshot behavior changed for executions where commandId is absent

### Validation

```bash
./gradlew app:assembleDebug
./gradlew app:testDebugUnitTest
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commits

```
feat(android): embed commandId in snapshot log marker for precise Node correlation
```

```
feat(node): filter snapshot lines by commandId, fall back to timing gate for old format
```
