# open_app Readiness and Snapshot Extraction Reliability

## Executive Summary

Two independent runtime bugs both produce `SNAPSHOT_EXTRACTION_FAILED` across
skills. This pack fixes both at the runtime layer so every current and future
skill is protected without per-skill changes. 2 PRs, 3 phases. PR-1 fixes the
dominant failure mode: `open_app` returning before the app is foreground. PR-2
fixes an independent logcat capture timing gap. Neither bug lives in skill logic;
both must be fixed in the runtime to close the failure mode for all callers.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After both PRs ship, `open_app` followed immediately by `snapshot_ui` must
reliably capture the target app's UI hierarchy on devices running the updated
APK and updated Node CLI. `SNAPSHOT_EXTRACTION_FAILED` must not occur in any
skill that follows `open_app` with a UI read action when executed on the validated
runtime versions (Samsung Galaxy device class and one non-Samsung device). Skills
running against an older APK that predates this fix remain exposed to Bug 1 until
the APK is updated; that is an expected compat gap, not a validation failure.

## Why Now

Multiple unrelated skills (`com.theswitchbot.switchbot.get-bedroom-temperature`,
`com.solaxcloud.starter.get-battery`) have produced `SNAPSHOT_EXTRACTION_FAILED`
in practice. In observed failures, the Samsung launcher (`com.sec.android.app.launcher`)
was present as an overlay while the target app was foreground. Root-cause analysis
confirmed the issue is in the runtime, not the skill recipes. Every skill that
calls `open_app` is silently exposed to this race.

## In Scope

- Change `open_app` to block until the launched package is the active
  accessibility window before returning success (PR-1)
- Add `skipNavigationWait` opt-out param to the `open_app` action contract (PR-1)
- Update Node contract, builder, and CLI to carry the new param (PR-1)
- Add Android unit tests and Node unit tests for the new behavior (PR-1)
- Validate on device and remove the fixed sleeps in affected skills (PR-1)
- Update public API docs for the changed `open_app` contract (PR-1)
- Add `commandId` to the Android snapshot log marker to close the logcat capture
  timing gap (PR-2)
- Update Node snapshot parsing to filter by commandId and maintain backward
  compatibility with old APK log format (PR-2)

## Out of Scope

- Changes to skill recipes beyond removing compensatory sleeps after PR-1 lands
- Any new retry or overlay-detection logic on the snapshot side
- Snapshot content validation (verifying the captured tree is meaningful)
- Changes to `wait_for_navigation` behavior
- Fixes to other error codes or result envelope fields

## Existing Artifact Scope

PR-1 modifies existing contracts and implementation files. The `open_app` action
contract gains one optional field. The engine gains one conditional call after
intent dispatch. The public API docs at `docs/api/actions.md` must be updated to
describe the new readiness contract and opt-out.

PR-2 modifies the Android log marker and the Node snapshot parsing path. The
format change is additive (commandId embedded in the marker line). Old APK log
format must continue to parse correctly.

## Surfaces and Ownership

| Surface | Paths |
| --- | --- |
| Android action engine | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` |
| Android task scope | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` |
| Android action model | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` and `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` |
| Node execution contract | `apps/node/src/contracts/execution.ts` |
| Node openApp builder | `apps/node/src/domain/actions/openApp.ts` |
| Node logcat reader | `apps/node/src/adapters/android-bridge/logcatResultReader.ts` |
| Node snapshot helper | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Node execution runner | `apps/node/src/domain/executions/runExecution.ts` |
| Public API docs | `docs/api/actions.md` |
| Affected skills | `../clawperator-skills/skills/com.theswitchbot.switchbot.get-bedroom-temperature/` and `com.solaxcloud.starter.get-battery/` |

## Source of Truth

| Topic | Verify against |
| --- | --- |
| open_app action params | `apps/node/src/contracts/execution.ts` |
| Android action parsing | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` |
| Android action engine entry | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` `UiActionEngineDefault.executeOpenApp` |
| waitForNavigation implementation | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` lines 374-430 |
| logcat capture gate | `logcatResultReader.ts` `captureSnapshotLines`, `beginDispatchCapture` |
| snapshot extraction | `snapshotHelper.ts` `extractSnapshotsFromLogs` |
| SNAPSHOT_EXTRACTION_FAILED condition | `runExecution.ts` `markExtractionFailedSnapshotSteps` lines 148-167 |
| Public action docs | `docs/api/actions.md` |

## Deterministic Versus Judgment

**Deterministic** (no re-derivation):
- The `skipNavigationWait` field defaults to `false` (absent field = wait by default)
- The navigation wait reuses `TaskScopeDefault.waitForNavigation` as the canonical
  polling logic - no new polling loop. Current code does not satisfy when
  `initialPackage == expectedPackage`, so PR-1 must add an open-app-safe allowance
  or fast path for the already-foreground case while preserving explicit
  `wait_for_navigation` behavior.
- The commandId format for the log marker is `[TaskScope] UI Hierarchy [commandId=$commandId]:` -
  implementing agent must use this exact format
- Old marker format `[TaskScope] UI Hierarchy:` must remain parseable in the Node reader
- Android `UiAction.OpenApp` currently has no action-level timeout field. PR-1
  must introduce a deterministic navigation timeout source, preferably
  `navigationTimeoutMs` with a 15 000 ms default and parser bounds consistent
  with comparable action timeouts. Do not rely on a non-existent `action.timeoutMs`.

**Judgment** (implementing agent decides):
- Which canonical commandId threading path PR-2 should use. Current code exposes
  `UiActionPlan.commandId` to the engine but not to `TaskScopeDefault.logUiTree`;
  `TaskStatusElement` carries only a sink. Decide between a task identity context
  element and a `TaskScope.logUiTree` signature change before implementing.
- Exact Node test file location if a new file is warranted vs. extending existing

## Decision Rules

| Scenario | Required behavior |
| --- | --- |
| `skipNavigationWait` absent in command JSON | Parse as `false` (wait by default) |
| `skipNavigationWait = false` | Dispatch intent, then wait until the active package is `applicationId`, reusing `waitForNavigation` polling with an already-foreground allowance |
| `skipNavigationWait = true` | Dispatch intent, return immediately (current behavior) |
| `waitForNavigation` times out | `open_app` step fails with a navigation-timeout error distinct from intent dispatch failure |
| App already foreground when `open_app` fires | `open_app` succeeds without waiting for a package transition; add regression coverage because current helper behavior would otherwise timeout |
| New APK + old Node (no field sent) | APK defaults to wait (`false`). Safe. |
| Old APK + new Node (field sent, APK ignores) | Old behavior: no wait. Bug 1 not fixed on old APK. Expected compat gap. |
| Log line has new commandId marker | Node extracts commandId and uses it for filtering |
| Log line has old marker format (no commandId) | Node falls back to current timing-gate behavior for that line |

## Failure Modes To Prevent

- Implementing the wait as opt-in only - this leaves every new skill author exposed
  to the race until they know to opt in
- Treating `waitForNavigation` satisfaction as "app fully loaded" in docs - it is
  package-foreground only; document the distinction clearly
- Losing backward compatibility with old APK log format in the Node snapshot parser
- Adding the commandId in Node-only without the Android-side change - the commandId
  must originate from the Android log line
- Starting PR-2 implementation before confirming Bug 2 is a real-world cause in
  observed failures (debug session required first)
- Deferring Android unit tests to a later phase - tests must ship in the same commit
  as the behavior change

## Output Contract

**PR-1:** `open_app` success means the target package is the active accessibility
window. `open_app` failure with navigation timeout means the package never reached
foreground within the navigation timeout budget. `skipNavigationWait: true` opts
out to current fire-and-forget behavior. Android and Node unit tests pass.
Affected skills re-validated on device with fixed sleeps removed.
`docs/api/actions.md` updated.

**PR-2:** `SNAPSHOT_EXTRACTION_FAILED` does not occur when the Android runtime
correctly logs a hierarchy dump but the log lines arrive before the Node capture
gate opens. Node snapshot parser accepts both old and new log marker formats.
Android and Node unit tests pass.

## Idempotency

`open_app` with `skipNavigationWait = false` is idempotent if the app is already
foreground. The implementation must handle this explicitly because the current
`waitForNavigation` helper does not satisfy an already-matching initial package.
It is not idempotent if the app is not installed or crashes - those produce a
navigation-timeout failure on every run, which is the correct behavior.

The commandId log tagging change is additive. Running a recipe against an old APK
after PR-2 Node changes land produces a timing-gate fallback for snapshot lines,
same as today.

## Durable Follow-Up

After this task pack completes:

- `docs/api/actions.md` must reflect the new `open_app` readiness contract and
  `skipNavigationWait` opt-out
- `docs/skills/` should include a note on the distinction between package-foreground
  readiness (provided by `open_app`) and content-level readiness (requires
  `wait_for_node`)
- Minimum APK version that provides the Bug 1 fix should be documented in
  `docs/setup.md` or release notes so users know an APK update is required
