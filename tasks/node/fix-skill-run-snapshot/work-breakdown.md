# open_app Readiness and Snapshot Extraction Reliability - Work Breakdown

Parent plan: `tasks/node/fix-skill-run-snapshot/plan.md`

## Executive Summary

2 PRs, 3 phases. Phase 1 (PR-1) implements the Android side of the `open_app`
readiness fix. Phase 2 (PR-1) implements the Node side, docs, device validation,
and skill cleanup. Phase 3 (PR-2) closes the logcat capture timing gap with
commandId-tagged snapshot log lines. Do not start PR-2 work until PR-1 is merged.

| PR | Phases | Agent tier | State |
| --- | --- | --- | --- |
| PR-1 | 1, 2 | default, default | done |
| PR-2 | 3 | default | not started |

## Status

| Item | Value |
| --- | --- |
| State | PR-1 implemented locally |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | 1, 2 |
| Remaining | 3 |
| Current / Next | Phase 3 |
| Blockers | Non-Samsung skill validation remained blocked by the Solax dashboard read failure |

## Hard Rules

- Do not start Phase 3 (PR-2) until PR-1 is merged.
- `skipNavigationWait` must default to `false` at every layer: Kotlin data class
  default, Android parser absent-field handling, and Node contract default.
  Do not leave any layer with opt-in behavior as the default.
- The navigation wait must reuse `TaskScopeDefault.waitForNavigation` as the
  canonical polling logic. However, current code does not satisfy when
  `initialPackage == expectedPackage`; PR-1 must add an open-app-safe allowance
  for the already-foreground case, either through an internal helper option or an
  explicit fast path. Keep the existing public `wait_for_navigation` behavior
  covered by tests if the helper signature changes.
- Android unit tests for Phase 1 behavior must ship in the same commit as the
  Android behavior change. Do not defer them.
- Node unit tests for Phase 2 behavior must ship in the same commit as the Node
  contract change. Do not defer them.
- The old snapshot log marker format `[TaskScope] UI Hierarchy:` must remain
  parseable in the Node reader after PR-2. Do not break old APK compatibility.
- Do not edit `sites/docs/.build/` directly. If docs regeneration is needed,
  run the docs-build workflow. In practice, `docs/api/actions.md` is authored
  source and does not require regeneration unless it feeds a generated page.
- One commit per logical step is preferred, but the Android behavior and the unit
  tests that prove it may ship in one coherent commit if splitting them would leave
  an intermediate commit with a changed contract and no regression coverage.
- Do not increase the global `open_app` execution timeout to paper over slow
  foreground transitions. Use an explicit navigation wait timeout source instead
  so launch dispatch and foreground readiness remain independently understandable.
- Use the `.dev` Operator APK and `--operator-package com.clawperator.operator.dev`
  for all device validation unless explicitly told otherwise.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/fix-skill-run-snapshot/plan.md` | Stable contract, scope boundaries, and decision rules |
| `apps/node/src/contracts/execution.ts` | Current `open_app` action params type - add `skipNavigationWait` here |
| `apps/node/src/domain/actions/openApp.ts` | Current Node builder for `open_app` |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | `UiActionEngineDefault.executeOpenApp` entry point - where the wait call is inserted |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` | `waitForNavigation` implementation (lines 374-430) and `logUiTree` (lines 230-309) |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Where `skipNavigationWait` must be parsed (lines 95-100 area) |
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

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
  - The `UiAction.OpenApp` data class - add `skipNavigationWait: Boolean = false`
    and the explicit navigation timeout source if used
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
  - parse `skipNavigationWait` from incoming command JSON; treat absent field as
    `false`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
  - `executeOpenApp` - after `taskScope.openApp(...)` succeeds, call
    `taskScope.waitForNavigation(expectedPackage = action.applicationId, timeoutMs = ...)`
    unless `action.skipNavigationWait == true`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScope.kt`
  and `TaskScopeDefault.kt` if needed to support the already-foreground open-app
  case without changing the public `wait_for_navigation` semantics
- Android unit test file for `UiActionEngineDefault` (locate existing test or
  create adjacent to the class)

### Steps

1. Read `UiActionEngine.kt` `executeOpenApp` and `TaskScopeDefault.kt`
   `waitForNavigation` fully before writing anything. Confirm `waitForNavigation`
   is accessible from the engine call site and accepts an `expectedPackage` and
   `timeoutMs` argument. Also confirm the current already-foreground behavior and
   decide the smallest implementation that makes `open_app` idempotent without
   weakening explicit `wait_for_navigation`.
2. Add `skipNavigationWait: Boolean = false` to `UiAction.OpenApp`. Add a
   deterministic navigation timeout source, preferably
   `navigationTimeoutMs: Long = 15_000`, because `OpenApp` does not currently have
   `action.timeoutMs`.
3. Update `AgentCommandParser.kt` to read `skipNavigationWait` from the command
   JSON. Absent field must parse as `false`. If `navigationTimeoutMs` is added,
   parse it from params, reject invalid values, and default absent values to
   15 000 ms.
4. In `executeOpenApp`, after the existing `taskScope.openApp(...)` call succeeds,
   add: if `!action.skipNavigationWait`, call `taskScope.waitForNavigation(...)`.
   Use the explicit navigation timeout from the action model. If
   `waitForNavigation` returns `success=false`, return a step failure with
   `error = "NAVIGATION_TIMEOUT"` or a more specific open-app navigation code.
   Do not throw for this case. Include `application_id`, `last_package`, and
   `navigation_elapsed_ms` when available.
5. Add Android unit tests:
   - `open_app skipNavigationWait=false`: mock `waitForNavigation` to succeed;
     confirm it is called after intent dispatch; confirm step returns `success=true`.
   - `open_app skipNavigationWait=true`: confirm `waitForNavigation` is NOT called;
     step returns immediately after intent dispatch.
   - `open_app skipNavigationWait=false, waitForNavigation times out`: confirm step
     returns `success=false` with a navigation-timeout error message.
   - `open_app skipNavigationWait absent in JSON`: confirm it parses as `false`.
   - `open_app target already foreground`: confirm the action succeeds without
     timing out. If this required a helper option, also confirm explicit
     `wait_for_navigation` still preserves its previous transition semantics.
6. Build and run Android unit tests before committing.

### Acceptance Criteria

Mechanical:
- `./gradlew app:assembleDebug` succeeds with no new warnings
- `./gradlew app:testDebugUnitTest` passes, including all new test cases
- `UiAction.OpenApp` has `skipNavigationWait: Boolean = false` and an explicit
  navigation timeout source if the implementation needs one
- `AgentCommandParser` parses `skipNavigationWait` and defaults to `false` when absent
- `executeOpenApp` calls `waitForNavigation` when `skipNavigationWait` is false
- the already-foreground case succeeds instead of timing out

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

### Expected Commits

Three commits, in this order. Do not combine them.

```
feat(android): add skipNavigationWait param to UiAction.OpenApp and parser

Add skipNavigationWait: Boolean = false to UiAction.OpenApp.
Update AgentCommandParser to parse skipNavigationWait from command JSON.
Absent field defaults to false (safe default).
```

```
feat(android): open_app blocks until app is foreground by default

After intent dispatch, executeOpenApp calls waitForNavigation targeting
the launched package unless action.skipNavigationWait is true.
Navigation timeout returns a step failure distinct from intent dispatch failure.
```

```
test(android): add unit tests for open_app navigation wait behavior

Cases: skipNavigationWait=false (wait called), skipNavigationWait=true
(wait not called), waitForNavigation timeout (step fails), absent field (parses
as false), and already-foreground open_app succeeds without waiting for a package
transition.
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
- `apps/node/src/domain/executions/validateExecution.ts` - add the new params to
  `actionParamsSchema`, with type and range validation
- `apps/node/src/domain/actions/openApp.ts` - thread `skipNavigationWait` through
  the builder (default `false` when not supplied)
- CLI: `open-app` and `open_app` are synonyms for the `open` command in
  `apps/node/src/cli/registry.ts`; if exposing the opt-out on CLI, add
  `--skip-navigation-wait` to that command and pass it through `cmdActionOpenApp`
- `apps/node/src/test/unit/` - Node unit tests for the contract changes (find the
  relevant existing test file or create a focused one)
- `docs/api/actions.md` - update `open_app` entry
- `../clawperator-skills/skills/com.theswitchbot.switchbot.get-bedroom-temperature/artifacts/bedroom-temperature.recipe.json`
- `../clawperator-skills/skills/com.solaxcloud.starter.get-battery/artifacts/battery.recipe.json`

**Cross-repo note:** The skill recipe changes live in `../clawperator-skills`, a
separate repository. Make skill changes on a branch named `fix/open-app-sleep-removal`
in that repo. Do not commit them to the `clawperator` repo. The skill changes must
be committed and pushed in `../clawperator-skills` before the Phase 2 device
validation step (step 8) so validation runs against the updated recipes. Validation
of the skill changes uses `clawperator skills run` against the updated recipe files.

### Steps

1. Add `skipNavigationWait?: boolean` to `open_app` params in `execution.ts`.
   If Phase 1 added `navigationTimeoutMs`, add `navigationTimeoutMs?: number`
   there too.
2. Update `openApp.ts` builder to pass `skipNavigationWait` through to the action.
   When the caller does not supply it, the field must be absent or explicitly
   `false` - do not default to `true`.
3. Update `validateExecution.ts` so `skipNavigationWait` is accepted only as a
   boolean. If `navigationTimeoutMs` exists, validate it as a non-negative number
   within the same action-timeout bounds used by comparable fields.
4. Update `apps/node/src/cli/registry.ts` and `apps/node/src/cli/commands/action.ts`
   if the opt-out is exposed on CLI. Add `--skip-navigation-wait` to the `open`
   command's supported flags and pass it through the builder for package targets
   only. URL/URI opens must ignore or reject the flag deterministically.
5. Add Node unit tests:
   - `openApp.ts` builder with no `skipNavigationWait` supplied: confirm field is
     `false` or absent in the resulting action object.
   - `openApp.ts` builder with `skipNavigationWait: true`: confirm field is `true`
     in the resulting action object.
   - `validateExecution` rejects non-boolean `skipNavigationWait`.
   - if CLI support is added: valid flag passes through; invalid/missing values and
     global vs command-local placement preserve the JSON and exit-code contracts.
6. Update `docs/api/actions.md` `open_app` entry:
   - State that `open_app` now blocks until the launched package is the active
     accessibility window before returning success.
   - Describe `skipNavigationWait` and when to use it.
   - State that success means package-foreground readiness, not content-level
     readiness. Callers that need a specific element present should follow with
     `wait_for_node`.
7. Build and test Node before device validation:
   ```bash
   npm --prefix apps/node run build
   npm --prefix apps/node run test
   ```
8. Device validation (requires debug APK from Phase 1 installed):
   a. **Baseline:** Before testing the fix, run a recipe with `skipNavigationWait: true`
      (old behavior) 5 times on the Samsung device. Record how many runs produce
      `SNAPSHOT_EXTRACTION_FAILED`. This confirms the race is reproducible and
      establishes a pre-fix baseline. If zero of 5 runs fail, note it and proceed -
      the fix is still correct, but the device may not reproduce the race reliably.
   b. Run `clawperator devices` and identify the Samsung device serial.
   c. Run a recipe: `close_app` -> `open_app` -> `snapshot_ui` with zero sleep,
      `skipNavigationWait` absent (default false). Use the switchbot or solaxcloud
      app as the target. **Pass criterion: 5 of 5 consecutive runs succeed with no
      `SNAPSHOT_EXTRACTION_FAILED` and `foreground_package` matching the target app.**
   d. Run the same validation on a second non-Samsung device. **Pass criterion: 3 of 3
      consecutive runs succeed.**
   e. These numeric thresholds are the hard pass gate. Do not proceed to step 8
      unless both device pass criteria are met.
9. Remove the fixed sleep actions from affected skill recipes. Confirm the full
   skill runs end-to-end on device without `SNAPSHOT_EXTRACTION_FAILED` after removal.

### Acceptance Criteria

Mechanical:
- `npm --prefix apps/node run build` succeeds
- `npm --prefix apps/node run test` passes, including new contract tests
- `execution.ts` `open_app` params has `skipNavigationWait?: boolean`
- `validateExecution.ts` accepts the new params with strict type/range checks
- `openApp.ts` defaults to `skipNavigationWait: false` when not supplied
- `docs/api/actions.md` describes the new readiness contract and `skipNavigationWait`
- Affected skill recipes do not contain fixed sleeps after `open_app`
- Device validation passes numeric gate: 5/5 consecutive runs on Samsung device
  and 3/3 consecutive runs on non-Samsung device with zero `SNAPSHOT_EXTRACTION_FAILED`
  and correct `foreground_package` on all runs

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

The skills commit is in `../clawperator-skills` on branch `fix/open-app-sleep-removal`.
It is not part of the `clawperator` PR-1 commit set.

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

**Step 1: Confirm Bug 2 observation status before implementing**

Run a debug session to determine whether the logcat capture window miss is an
observed real-world cause or only theoretically credible:

1. On a connected device, run a `snapshot_ui` recipe and capture both the
   Clawperator `--log-file` output and raw `logcat -v threadtime` output
   simultaneously.
2. Compare: do `[TaskScope] UI Hierarchy:` lines appear in raw logcat but not
   in the `snapshotLogLines` captured by Node?
3. Apply this decision table and proceed accordingly. Do not deviate.

| Observation | Action |
| --- | --- |
| Lines appear in raw logcat but not in `snapshotLogLines` | Bug 2 confirmed. Proceed with the full fix as specified below. Include "Bug 2 confirmed in debug session" in the first commit message. |
| Lines always appear in `snapshotLogLines` | Bug 2 not observed. Proceed with the full fix anyway - commandId tagging improves correctness and eliminates the timing-gate dependency for future regressions regardless of current observation. Include "Bug 2 not reproduced; fix applied for correctness" in the first commit message. |

In both cases, implement the full fix. The investigation result affects the commit
message only, not whether to proceed.

**Step 2: Android - add commandId to snapshot log marker**

Files:
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`
  `logUiTree` (lines 230-309)

1. Confirm that the `commandId` (or equivalent task identifier) is accessible in
   scope at the log site in `logUiTree`. Current code does not expose commandId
   through `TaskScopeDefault`; `TaskStatusElement` carries only a `TaskStatusSink`,
   and `UiActionPlan.commandId` is visible to the engine but not to `TaskScope`.
   Likely implementation options are: add `commandId`/`taskId` to the task
   coroutine context, or thread command identity through `TaskScope.logUiTree`.
   Pick one canonical path and update tests. Do not assume commandId is already
   available in `TaskScopeDefault`.
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
2. Update `extractSnapshotsFromLogs` or add a structured companion helper to
   extract `commandId` from the new marker format when present. The current helper
   returns `string[]`; commandId filtering requires a structured result or an
   explicit `expectedCommandId` parameter.
3. Update `attachSnapshotsToStepResults`/runExecution flow coherently. When a
   `commandId` is present in the log line, attach only snapshots whose commandId
   matches the current execution. When `commandId` is absent (old format), fall
   back to the current timing-gate behavior.
4. The `captureSnapshotLines` gate can remain for old-format lines. New-format
   lines with a matching commandId can be accepted regardless of gate state, but
   this requires changing `logcatResultReader.ts` to capture candidate hierarchy
   blocks before `beginDispatchCapture`; a marker-only `isSnapshotLogLine` change
   is not sufficient because XML body lines are currently captured only while the
   gate is open.

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
