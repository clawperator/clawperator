# Task Pack: open_app readiness and snapshot extraction reliability

## Background

Multiple skills produce `SNAPSHOT_EXTRACTION_FAILED` after `open_app` returns
success. Investigation traced this to two independent bugs in the runtime.
The primary bug affects every skill that calls `open_app` followed by any action
that reads the UI. The secondary bug is a logcat capture timing gap that can cause
`SNAPSHOT_EXTRACTION_FAILED` even when the device logged valid XML.

These are runtime bugs, not skill bugs. Fixing them in the runtime eliminates the
failure mode for all current and future skills without requiring per-skill changes.

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
`data.text` (or launcher XML where the target app's XML was expected), and
retroactively marks the step `SNAPSHOT_EXTRACTION_FAILED`.

The overlay metadata (`has_overlay=true`, `overlay_package`) is populated correctly
in the step result but is informational only - the runtime takes no action on it.

This race affects every skill that calls `open_app` then reads the UI. Fixed sleeps
(e.g., 3.5 s in switchbot, 12 s in solaxcloud) narrow the window but do not close
it on slow devices or under background load.

### The fix: open_app blocks until the app is foreground by default

Change `open_app` so that it does not return success until the launched package is
the active accessibility window. The `waitForNavigation` poll loop already exists and
works - this is an addition of one call after intent dispatch in `executeOpenApp`,
not a new algorithm.

**Default behavior after fix:**
`open_app` dispatches the intent, then polls `rootInActiveWindow.packageName` until
it matches `applicationId` or the timeout is reached. Returns success only when the
package is confirmed foreground. Returns a distinct failure if the timeout expires
before the package becomes foreground (e.g., app crashed, intent was rejected).

**Opt-out for fire-and-forget callers:**
Add a `skipNavigationWait` boolean param to the `open_app` action contract (default
`false`). When `true`, behavior is identical to today. Expose this on the CLI as
`--skip-navigation-wait`. This is the escape hatch for callers that launch an app
and immediately do their own custom wait.

**Why default-on is correct:**
The action name `open_app` implies the app is open on completion. Today it means
"intent was dispatched." Every caller is silently exposed to the race. Making safe
behavior the default means skill authors get correctness without needing to know
about the timing race. Callers that want fire-and-forget explicitly opt out.

**Readiness level this provides:**
`waitForNavigation` satisfies when `rootInActiveWindow.packageName` matches the
target - i.e., accessibility focus has transferred to the target package. This is
not a guarantee that the app's first screen content is fully loaded. Skill authors
that need content-level readiness (waiting for a specific element) should still use
`wait_for_node` after `open_app`, as the globird skill already does. Document this
distinction in the updated `open_app` API docs.

**Edge cases to verify:**
- App already foreground: poll satisfies on first check, no added latency.
- App crashes on launch: step now correctly fails instead of silently succeeding.
- System permission dialog before app foreground: poll waits past it since the
  target package eventually receives focus. Acceptable current behavior.
- App that launches a third package (deep link): poll times out. Caller should use
  `skipNavigationWait: true` and handle readiness themselves. Document this.
- Timeout budget: the current `open_app` timeout is 15 000 ms. With the foreground
  wait included, this budget now covers intent dispatch plus navigation. Verify this
  is sufficient on a slow device, or split into `intentTimeoutMs` /
  `navigationTimeoutMs`. Default of 15 000 ms total is likely fine for most apps
  but should be confirmed on device.

### Implementation touch points

Android:
- `UiActionEngineDefault.kt` - after `taskScope.openApp(...)` succeeds, call
  `taskScope.waitForNavigation(expectedPackage = action.applicationId, ...)` unless
  `action.skipNavigationWait == true`
- `UiAction.OpenApp` data class - add `skipNavigationWait: Boolean = false`
- `AgentCommandParser.kt` - parse `skipNavigationWait` from the incoming command

Node:
- `apps/node/src/contracts/execution.ts` - add `skipNavigationWait?: boolean` to
  the `open_app` action params type
- `apps/node/src/domain/actions/openApp.ts` - thread the param through the builder
- CLI: expose `--skip-navigation-wait` flag on the `open-app` command if it exists
  as a standalone command, or document in the recipe format reference

### Tests to add

Node unit:
- `openApp.ts` builder: confirm `skipNavigationWait` defaults to `false` and is
  passed through to the execution contract correctly.

Android unit (`UiActionEngineDefaultTest.kt`):
- `open_app` with `skipNavigationWait = false`: mock `waitForNavigation` and confirm
  it is called after intent dispatch; confirm `success=true` only when navigation
  wait resolves.
- `open_app` with `skipNavigationWait = true`: confirm `waitForNavigation` is not
  called and the step returns immediately after intent dispatch.
- `open_app` where `waitForNavigation` times out: confirm step fails with a
  navigation-wait timeout error, distinct from an intent dispatch failure.

Integration (device):
1. Run `close_app` -> `open_app` -> `snapshot_ui` with zero sleep and
   `skipNavigationWait = false` (the new default).
2. Confirm snapshot captures the target app's tree (not the launcher).
3. Confirm `has_overlay = false` and `foreground_package` matches target.
4. Run on a second non-Samsung device to confirm no regression.
5. Run with `skipNavigationWait = true` and confirm the old race is reproducible
   (this validates the test harness and the flag behavior simultaneously).

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

This failure mode is independent of Bug 1. It can occur even after Bug 1 is fixed if
the snapshot step executes very quickly.

### The fix: tag snapshot log lines with commandId on the Android side

The root cause of the timing gate is that Node has no reliable way to tell whether a
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
- Confirm the commandId is accessible in scope at the log site.

Node:
- `isSnapshotLogLine` (`logcatResultReader.ts` line 26) - update to extract commandId
  from the new marker format
- `captureSnapshotLines` gate - can be relaxed to collect all matching lines, filtering
  by commandId instead of the timing gate
- `extractSnapshotsFromLogs` (`snapshotHelper.ts`) - update parser to handle the new
  marker format and propagate commandId for filtering
- Maintain backward compatibility with the old marker format during the transition
  period (devices running older APKs)

**Priority note:** Bug 2 is less urgent than Bug 1. The logcat capture window miss
is a secondary failure mode. After Bug 1 is fixed, the `snapshot_ui` step will
execute later in the timeline (after the navigation wait completes), giving the
logcat gate more time to open. Bug 2 should be tracked and fixed but may not need to
ship in the same PR.

### Tests to add

Node unit:
- `extractSnapshotsFromLogs`: add a test where the `[TaskScope] UI Hierarchy:` marker
  line contains a commandId and confirm it is parsed correctly.
- `markExtractionFailedSnapshotSteps`: add a test simulating the capture window miss
  (non-empty `snapshotLogLines` but no matching blocks) and confirm it produces
  `SNAPSHOT_EXTRACTION_FAILED`.

Integration:
- With a forced broadcast delay, run a recipe where `snapshot_ui` completes very
  quickly. With the commandId fix in place, confirm the snapshot is correctly
  attached. Without the fix, confirm `SNAPSHOT_EXTRACTION_FAILED` is produced
  (establishes the race is reproducible and validates the fix).

---

## Open questions

1. **Does `rootInActiveWindow` return the target app's root when the launcher
   overlay is still visible but inactive?** `getCurrentWindowMetadata` uses
   `service.windows` (all visible windows), but `getCurrentUiHierarchyDump` uses
   only `rootInActiveWindow` (the active window). These differ. On Samsung devices,
   when the launcher is overlaying but the target app holds accessibility focus,
   `rootInActiveWindow` may still be the launcher. Needs device-side confirmation
   using `window_count`, `has_overlay`, and `foreground_package` output from a real
   execution. This affects whether `waitForNavigation` alone is sufficient.

2. **Is the 15 000 ms `open_app` timeout sufficient with the navigation wait
   included?** On a slow device or one under background load, intent dispatch plus
   accessibility focus transfer may approach or exceed this. Measure on a real device
   to confirm, and consider a separate `navigationTimeoutMs` param if needed.

3. **Does `appsRepository.findTriggerShortcut` use the same launch path as
   `getLaunchIntentForPackage` for unknown apps?** The fallback path may produce a
   different animation or accessibility event sequence on Samsung devices, potentially
   holding the launcher overlay longer. Verify on device.

4. **Can the logcat capture miss (Bug 2) be confirmed as a real-world cause in
   observed failures?** A debug session using `--log-file` output alongside
   `logcat -v threadtime` would show whether `[TaskScope] UI Hierarchy:` lines appear
   in raw logcat but not in `snapshotLogLines`. Worth doing before deprioritizing
   Bug 2.

---

## Affected skills in clawperator-skills

After the runtime fix for Bug 1 lands, these skills should be re-validated on device:

- `com.theswitchbot.switchbot.get-bedroom-temperature` - `open_app` -> `sleep 3500` ->
  `snapshot_ui`. The fixed sleep can be removed or reduced after the runtime fix.
- `com.solaxcloud.starter.get-battery` - `open_app` -> `sleep 12000` -> `snapshot_ui`.
  Same - the sleep was compensating for the race.
- `com.globird.energy.get-usage` - already uses `wait_for_node` correctly; verify no
  regression from the `open_app` change.
