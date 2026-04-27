# Task Pack: open_app readiness and snapshot extraction reliability

## Scope and phasing

This task pack covers two independent runtime bugs that both produce
`SNAPSHOT_EXTRACTION_FAILED` across skills. Neither is a skill-layer bug - both
must be fixed in the runtime to protect all current and future skills.

The work ships as two sequential PRs:

- **PR-1** - `open_app` blocks until the app is foreground (Bug 1). Closes the
  dominant failure mode. Skills with fixed sleeps after `open_app` can have those
  sleeps removed or reduced once this lands.
- **PR-2** - Snapshot log lines tagged with commandId, closing the logcat capture
  timing gap (Bug 2). Orthogonal to PR-1; can be developed in parallel but should
  ship after PR-1 is validated.

The issue is not resolved until both PRs ship. PR-1 alone significantly reduces
the failure rate but leaves a known residual: a `snapshot_ui` step that executes
very quickly can still miss the logcat capture window even after the navigation
wait completes. The residual is real but low-frequency. Shipping PR-1 first is
acceptable as an incremental improvement; calling the issue "fixed" requires PR-2.

---

## Bug 1: open_app returns before the app is foreground

### Current behavior

`open_app` fires a `FLAG_ACTIVITY_NEW_TASK` intent and returns success immediately
after dispatch. It makes no guarantee that the target app has received accessibility
focus, drawn its first frame, or that the accessibility tree reflects the target app.

Call chain (all Android-side):
- `UiActionEngineDefault.executeOpenApp` (`apps/android/.../UiActionEngineDefault.kt` lines 109-119) -
  calls `taskScope.openApp(...)` and immediately returns `success=true`
- `TaskScopeDefault.openApp` (`apps/android/.../TaskScopeDefault.kt` lines 131-170) -
  calls `triggerManager.trigger(...)`, retries cover intent dispatch only, not foreground wait
- `TriggerManagerDefault.trigger` (`apps/android/.../TriggerManagerDefault.kt` lines 38-67) -
  fire-and-forget intent via `OpenAppManagerAndroid`
- `OpenAppManagerAndroid` (`apps/android/.../OpenAppManager.kt` lines 18-50) -
  calls `startActivity`, swallows exceptions, returns no confirmation

The retry preset for `open_app` is `TaskRetryPresets.AppLaunch` (max 4 attempts,
750 ms initial delay): these retries cover shortcut lookup and intent dispatch,
not waiting for the app to appear.

`waitForNavigation` already exists in `TaskScopeDefault` (lines 374-430) and polls
`getCurrentWindowMetadata().foregroundPackage` every ~200 ms until the active window
matches the expected package. It is not called by `open_app`.

### Failure mechanism

When `snapshot_ui` executes after `open_app` (even after a fixed sleep), the
accessibility service's `rootInActiveWindow` may still return the launcher window
(`com.sec.android.app.launcher`) because the transition animation has not completed.
`logUiTree` succeeds and logs the launcher hierarchy. The `UiReadiness` retry inside
`logUiTree` does not help - retry only fires on a `null` dump (thrown exception). A
non-null launcher dump is accepted and the retry loop exits immediately.

On the Node side, `markExtractionFailedSnapshotSteps` (`runExecution.ts` lines
148-167) then finds a `snapshot_ui` step with `success=true` but no attached
`data.text`, and retroactively marks the step `SNAPSHOT_EXTRACTION_FAILED`.

The overlay metadata (`has_overlay=true`, `overlay_package`) is populated correctly
in the step result but is informational only - the runtime takes no action on it.

### Fix: open_app blocks until the app is foreground by default

Change `open_app` so that it does not return success until the launched package is
the active accessibility window. The `waitForNavigation` poll loop already exists and
works - this is an addition of one call after intent dispatch in `executeOpenApp`,
not a new algorithm.

**Default behavior after fix:**
`open_app` dispatches the intent, then polls `rootInActiveWindow.packageName` until
it matches `applicationId` or the timeout is reached. Returns success only when the
package is confirmed foreground. Returns a distinct failure if the timeout expires
before the package becomes foreground (e.g., app crashed, intent was rejected).

**Why `waitForNavigation` is the right readiness probe:**
`waitForNavigation` and `snapshot_ui` both operate on `rootInActiveWindow`. If the
navigation wait resolves (target package = active root), then `snapshot_ui` will
capture exactly that same root's tree. The two operations are consistent by
construction. A launcher overlay that remains visually present but has lost
accessibility focus will show `has_overlay=true` in metadata but will not affect the
snapshot content, because `snapshot_ui` captures the active root (the target app),
not the overlay. This closes the observed failure mode.

Device verification on Samsung is required as a pre-ship gate (see validation plan)
to confirm `rootInActiveWindow` transitions from launcher to target as expected
during cold-start. This is a verification step, not a design uncertainty.

**Opt-out for fire-and-forget callers:**
Add a `skipNavigationWait` boolean param to the `open_app` action contract (default
`false`). When `true`, behavior is identical to today. This is the escape hatch for
callers that launch an app and immediately do their own custom wait, or that need
to launch without blocking (e.g., background launch before navigating to a different
screen first).

**Why default-on is correct:**
The action name `open_app` implies the app is open on completion. Today it means
"intent was dispatched." Every caller is silently exposed to the race. Making safe
behavior the default means skill authors get correctness without needing to know
about the timing race. Callers that want fire-and-forget explicitly opt out.

**What this readiness level provides:**
`waitForNavigation` satisfies when `rootInActiveWindow.packageName` matches the
target - i.e., accessibility focus has transferred to the target package. This is
not a guarantee that the app's first screen content is fully loaded. Skill authors
that need content-level readiness (waiting for a specific element) should still use
`wait_for_node` after `open_app`. The globird skill already does this correctly and
represents the best-practice pattern for content-dependent skills. Document this
distinction in the updated `open_app` API docs.

**Edge cases:**
- App already foreground: poll satisfies on first check, no added latency.
- App crashes on launch: step now correctly fails instead of silently succeeding.
- System permission dialog before app foreground: poll waits past it since the
  target package eventually receives focus. Acceptable current behavior.
- App that launches a third package (deep link): poll times out. Caller should use
  `skipNavigationWait: true` and handle readiness themselves. Document this.
- Timeout budget: the current `open_app` timeout is 15 000 ms. With the foreground
  wait included, this budget now covers intent dispatch plus navigation. Measure on
  a slow device. If 15 000 ms is insufficient, prefer a separate
  `navigationTimeoutMs` param over increasing the global timeout, so the two phases
  are independently tunable.

### Compatibility matrix

`skipNavigationWait` is added as a new optional param. The Node-Android version skew
cases are:

| Node version | APK version | Behavior |
|---|---|---|
| New (sends `skipNavigationWait=false`) | New (reads param) | Correct: waits for foreground |
| New (sends `skipNavigationWait=true`) | New (reads param) | Correct: fire-and-forget |
| Old (does not send field) | New (reads param) | APK treats absent field as `false` - waits by default. Safe. |
| New (sends `skipNavigationWait=false`) | Old (ignores field) | Old APK does not wait. Bug 1 not fixed on old APK. |
| Old (does not send field) | Old (ignores field) | Old behavior preserved. No regression. |

**Implication:** The runtime fix only takes effect when the APK is updated. A Node
update alone does nothing. Document the minimum APK version that provides the fix.
Old APK users remain exposed to Bug 1 until they update the APK. This is expected
behavior for a contract change and does not require a migration shim.

The Android-side parser must default `skipNavigationWait` to `false` when the field
is absent (not present in the command JSON). The Kotlin data class default value
handles this if the field is typed `Boolean = false`.

### Implementation touch points

Android:
- `UiActionEngineDefault.kt` - after `taskScope.openApp(...)` succeeds, call
  `taskScope.waitForNavigation(expectedPackage = action.applicationId, ...)` unless
  `action.skipNavigationWait == true`
- `UiAction.OpenApp` data class - add `skipNavigationWait: Boolean = false`
- `AgentCommandParser.kt` - parse `skipNavigationWait` from the incoming command
  (absent = `false` via default)

Node:
- `apps/node/src/contracts/execution.ts` - add `skipNavigationWait?: boolean` to
  the `open_app` action params type
- `apps/node/src/domain/actions/openApp.ts` - thread the param through the builder
- CLI: expose `--skip-navigation-wait` flag on the `open-app` command if it exists
  as a standalone command, or document in the recipe format reference

Docs:
- Update `open_app` API docs to describe the new default readiness contract,
  the `skipNavigationWait` opt-out, and the distinction between package-foreground
  readiness (what `open_app` now provides) vs. content-level readiness (requires
  `wait_for_node`).

### Validation plan

**Baseline:** Before implementing, run the three affected skills on a Samsung device
and record the `SNAPSHOT_EXTRACTION_FAILED` rate. This establishes the pre-fix
baseline for comparison.

**Success criteria:**
- Zero `SNAPSHOT_EXTRACTION_FAILED` on all three affected skills across five
  consecutive runs each, on both a Samsung device (primary regression target) and
  one non-Samsung device.
- `foreground_package` in the `snapshot_ui` step result matches the target app
  package (not the launcher) on every run.
- `open_app` step result includes evidence the navigation wait was exercised:
  timing of step completion should be >0 ms after intent dispatch (not instant).

**Unit tests (Node):**
- `openApp.ts` builder: confirm `skipNavigationWait` defaults to `false` and is
  passed through to the execution contract correctly.
- Confirm `skipNavigationWait: true` is passed through when explicitly set.

**Unit tests (Android - `UiActionEngineDefaultTest.kt`):**
- `open_app` with `skipNavigationWait = false` (default): mock `waitForNavigation`
  and confirm it is called after intent dispatch; confirm `success=true` only when
  navigation wait resolves.
- `open_app` with `skipNavigationWait = true`: confirm `waitForNavigation` is not
  called and step returns immediately after intent dispatch.
- `open_app` where `waitForNavigation` times out: confirm step fails with a
  navigation-wait timeout error, distinct from an intent dispatch failure.
- `open_app` with absent `skipNavigationWait` field in command JSON: confirm it
  parses as `false` (the safe default).

**Integration test matrix (device):**

| Scenario | Device | Expected result |
|---|---|---|
| `open_app` -> `snapshot_ui`, no sleep, default params | Samsung | Target app tree captured, no SNAPSHOT_EXTRACTION_FAILED |
| Same | Non-Samsung | Same |
| `open_app` (skipNavigationWait=true) -> `snapshot_ui` | Samsung | Race reproducible (validates test harness and flag) |
| `open_app` -> `wait_for_node` -> downstream action (globird pattern) | Any | No regression |
| App already foreground when `open_app` fires | Any | No added latency, correct result |
| App crashes on launch | Any | Step fails with navigation timeout error, not silent success |
| Deep-link app (launches third package) | Any | Times out with navigation error; confirm skipNavigationWait=true is the documented workaround |
| Dialog-heavy app (permission dialog on launch) | Any | Navigation wait completes after dialog resolves; snapshot captures target app |

---

## Bug 2: Snapshot log lines dropped due to logcat capture window timing

### Current behavior

`captureSnapshotLines` in `apps/node/src/adapters/android-bridge/logcatResultReader.ts`
(lines 160-181) is only set to `true` inside `beginDispatchCapture`. Log lines that
arrive before the broadcast is dispatched and `beginDispatchCapture` fires are not
collected into `snapshotLogLines`. A forced-replay-drain guard adds an additional
`SIGNAL_BROADCAST_REPLAY_DRAIN_MS` (25 ms) delay before the gate opens, to avoid
re-attaching stale log output from a previous command.

If the broadcast is slow or the `snapshot_ui` step executes very quickly after the
broadcast, the `[TaskScope] UI Hierarchy:` lines may arrive and be processed before
the gate opens. `extractSnapshotsFromLogs` (`snapshotHelper.ts` lines 9-71) returns
an empty array, and `markExtractionFailedSnapshotSteps` produces
`SNAPSHOT_EXTRACTION_FAILED` even though the device logged valid XML.

This failure mode is independent of Bug 1. It can occur in any execution where
`snapshot_ui` runs quickly - not only after `open_app`.

**Confirming Bug 2 in observed failures:** Before implementing the fix, run a debug
session using `--log-file` output alongside `logcat -v threadtime` on a known-failing
run. If `[TaskScope] UI Hierarchy:` lines appear in raw logcat but not in
`snapshotLogLines`, Bug 2 is confirmed as a real-world contributor (not only
theoretically credible). This should be done as the first step of PR-2 work.

### Fix: tag snapshot log lines with commandId on the Android side

The root cause is that Node has no reliable way to tell whether a
`[TaskScope] UI Hierarchy:` line belongs to the current command or was replayed from
a previous one. The drain guard is a blunt approximation.

The precise fix: embed the `commandId` (already available in the Android runtime as
part of the task context) into the `[TaskScope] UI Hierarchy:` log line on the
Android side. Node can then filter snapshot lines by matching commandId rather than
relying on temporal proximity.

With commandId in the log line, the drain guard becomes unnecessary for snapshot
lines. Node can collect all `TaskScopeDefault` snapshot lines from the logcat stream
and discard any whose commandId does not match the current execution. This closes
the capture window miss without risking stale snapshot attachment.

**Implementation touch points:**

Android:
- `TaskScopeDefault.logUiTree` (`apps/android/.../TaskScopeDefault.kt` lines 230-309) -
  include the active `commandId` (or `taskId`) in the `[TaskScope] UI Hierarchy:` log
  marker line, e.g.: `[TaskScope] UI Hierarchy [commandId=$commandId]:\n<xml>`
- Confirm the commandId is accessible in scope at the log site. If not, thread it
  through from the action engine.

Node:
- `isSnapshotLogLine` (`logcatResultReader.ts` line 26) - update to extract commandId
  from the new marker format
- `captureSnapshotLines` gate - relax to collect all matching lines, filtering by
  commandId instead of the timing gate
- `extractSnapshotsFromLogs` (`snapshotHelper.ts`) - update parser to handle the new
  marker format and propagate commandId for filtering
- Maintain backward compatibility with the old marker format (devices running older
  APKs that emit the old format without commandId)

**Compatibility:** Old APK emits old marker format (no commandId). Node must
continue to parse the old format and fall back to the current timing-gate behavior
for those lines. This avoids a hard dependency on APK update for Node to function.
New APK emits new format; Node uses commandId filtering for those lines.

### Validation plan

**Success criteria:**
- Zero `SNAPSHOT_EXTRACTION_FAILED` in a forced-delay scenario where the broadcast
  delay is artificially increased to make the capture window miss reproducible.
- With commandId fix in place, confirm the snapshot is correctly attached on the
  forced-delay run.
- Without the fix, confirm `SNAPSHOT_EXTRACTION_FAILED` is produced (validates the
  test harness and that the scenario is reproducible before claiming a fix).

**Unit tests (Node):**
- `extractSnapshotsFromLogs`: test with new marker format containing commandId -
  confirm correct parse.
- `extractSnapshotsFromLogs`: test with old marker format (no commandId) - confirm
  backward-compatible parse.
- `extractSnapshotsFromLogs`: test with mixed old and new lines from two different
  commands - confirm only the matching commandId block is returned.
- `markExtractionFailedSnapshotSteps`: test simulating capture window miss (non-empty
  `snapshotLogLines` but no matching commandId blocks) - confirm produces
  `SNAPSHOT_EXTRACTION_FAILED`.

**Integration:**
- With forced broadcast delay, run a recipe where `snapshot_ui` completes quickly.
  Confirm snapshot is correctly attached with the commandId fix in place.

---

## Open questions

1. **Is the 15 000 ms `open_app` timeout sufficient with the navigation wait
   included?** On a slow device or one under background load, intent dispatch plus
   accessibility focus transfer may exceed this. Measure on a slow device during
   integration testing. If needed, add `navigationTimeoutMs` as a separate param
   so the two phases are independently tunable without changing the overall timeout.

2. **Does `appsRepository.findTriggerShortcut` use the same launch path as
   `getLaunchIntentForPackage` for unknown apps?** The fallback path may produce a
   different animation or accessibility event sequence on Samsung devices, potentially
   holding the launcher overlay longer than the shortcut path. Verify with a test app
   not in the known-apps list.

3. **Is commandId accessible in scope at the `logUiTree` call site in
   `TaskScopeDefault`?** If not, it must be threaded through. Determine this before
   finalizing the PR-2 implementation plan.

---

## Affected skills in clawperator-skills

After PR-1 lands, re-validate these skills on device and remove or reduce the fixed
sleeps that were compensating for the race:

- `com.theswitchbot.switchbot.get-bedroom-temperature` - `open_app` -> `sleep 3500` ->
  `snapshot_ui`. Sleep can be removed.
- `com.solaxcloud.starter.get-battery` - `open_app` -> `sleep 12000` -> `snapshot_ui`.
  Sleep can be removed.
- `com.globird.energy.get-usage` - already correct pattern; verify no regression from
  the `open_app` contract change.
