# Findings: SNAPSHOT_EXTRACTION_FAILED with Overlay / Launcher Race

## Summary

Multiple skills fail with `SNAPSHOT_EXTRACTION_FAILED` after `open_app` returns
success. In at least two observed cases the target app was in the foreground while
a `com.sec.android.app.launcher` (Samsung launcher) window was also present as an
overlay. This document maps every relevant code path and explains exactly what
mechanisms produce the failure.

---

## 1. Current Behavior

### 1.1 open_app pipeline

**Node side - execution builder**

`apps/node/src/domain/actions/openApp.ts` (lines 3-20) builds a single-action
`Execution` with `type: "open_app"`, a 15 000 ms `timeoutMs`, and no mode override
(defaults to `artifact_compiled`). The builder applies no post-launch wait logic.
There is no `wait_for_navigation` or sleep baked in.

**Android command parser**

`apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
(lines 95-100) parses `open_app` into `UiAction.OpenApp` with
`retry = TaskRetryPresets.AppLaunch`. The `AppLaunch` preset
(`TaskRetryPresets.kt` lines 29-33) allows up to 4 attempts with an initial delay
of 750 ms and max delay of 4 s.

**Android action engine**

`apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngineDefault.kt`
(lines 109-119) calls `taskScope.openApp(action.applicationId, action.retry)` and
immediately returns a `UiActionStepResult` with `success=true` and
`data = mapOf("application_id" to ...)`. It does not wait for any UI state after
the call returns.

**TaskScopeDefault.openApp**

`apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt`
(lines 131-170):
1. Calls `appsRepository.findTriggerShortcut(applicationId).first()` to look up
   the shortcut.
2. Calls `triggerManager.trigger(triggerShortcut.triggerEvent)` - this is a
   fire-and-forget Intent dispatch.
3. Retries are scoped around the shortcut lookup and intent dispatch, not around
   waiting for the app to be visible.

There is no block on "app is now in the foreground" anywhere in the `open_app`
action. The open_app action succeeds as soon as the intent has been dispatched.

**TriggerManagerDefault**

`apps/android/shared/data/trigger/src/main/kotlin/clawperator/trigger/TriggerManagerDefault.kt`
(lines 38-67) dispatches the intent synchronously (non-coroutine call on the route
open path) via `OpenAppManagerAndroid.open`. The method fires a
`FLAG_ACTIVITY_NEW_TASK` intent and returns immediately. There is no confirmation
that the target activity reached `onResume` or that the accessibility tree has
settled.

**OpenAppManagerAndroid**

`apps/android/shared/data/toolkit/src/main/kotlin/clawperator/openapp/OpenAppManager.kt`
(lines 18-50): starts the activity via `startActivityHelper.startActivity(intent)`.
Any exception is caught and silently swallowed. There is no success or failure
feedback back to the caller beyond "the call did not throw."

**Result: `open_app` returns success the moment the intent is handed to Android.
There is no guarantee that the target app has received focus, drawn its first frame,
or that the accessibility tree reflects the target app at all.**

---

### 1.2 snapshot_ui pipeline

**Android side**

`UiActionEngineDefault.executeSnapshotUi` (lines 610-633) calls
`taskScope.logUiTree(retry = action.retry)`. The default retry supplied by the
parser is `TaskRetryPresets.UiReadiness` (max 5 attempts, initial 500 ms, max 3 s).

`TaskScopeDefault.logUiTree` (lines 230-309):
1. Calls `uiTreeInspector.getCurrentUiHierarchyDump()`.
2. Throws `IllegalStateException("SNAPSHOT_HIERARCHY_UNAVAILABLE: ...")` if the
   dump returns `null`.
3. On success, logs the hierarchy dump to logcat with the tag pattern:
   `[TaskScope] UI Hierarchy:\n<xml>`.
4. Collects window metadata (foreground package, overlay info) and returns it in
   `UiSnapshotResult`.

`UiTreeInspectorAndroid.getCurrentUiHierarchyDump` (lines 92-110):
1. Obtains `rootInActiveWindow` from the `AccessibilityService`.
2. Returns `null` if service is not available or `rootInActiveWindow` is null.
3. Calls `rootNode.toUiAutomatorHierarchyDump(rotation)` to produce XML.
4. `rootInActiveWindow` reflects whichever window currently has accessibility
   focus - this is not necessarily the most recently launched app.

**Key behavior**: when `rootInActiveWindow` returns the launcher window instead of
the target app (because the app has not yet received accessibility focus), the dump
will show the launcher hierarchy and log it under the `[TaskScope] UI Hierarchy:`
marker. The metadata will show `foregroundPackage = "com.sec.android.app.launcher"`
and the snapshot data will contain the launcher tree, not the target app tree.

If `rootInActiveWindow` is null (can happen briefly during window transitions), the
dump returns `null`, the exception `SNAPSHOT_HIERARCHY_UNAVAILABLE` is thrown, and
the retry logic fires up to 5 times. If all retries exhaust during a transition, the
task fails from the Android side as `TaskResult.Failed`.

**Node side - snapshot extraction**

`apps/node/src/domain/executions/runExecution.ts` (lines 663-671):
1. Checks whether any step has `actionType === "snapshot_ui"`.
2. Calls `extractSnapshotsFromLogs(result.snapshotLogLines ?? [])` to find all
   `[TaskScope] UI Hierarchy:` blocks in the logcat lines captured during the
   execution window.
3. Calls `attachSnapshotsToStepResults` to match snapshots to steps (last-in,
   last-out pairing).
4. Calls `markExtractionFailedSnapshotSteps` (lines 148-167) which converts any
   `snapshot_ui` step that is `success: true` but has no `data.text` to
   `success: false` with `error: "SNAPSHOT_EXTRACTION_FAILED"`.

`apps/node/src/domain/executions/snapshotHelper.ts` - `extractSnapshotsFromLogs`
(lines 9-71): parses logcat lines looking for `[TaskScope] UI Hierarchy:` markers.
It only processes lines whose tag is `TaskScopeDefault`. It terminates a snapshot
block when it sees a line starting with `[` (but not `<?xml` or `<`) - a heuristic
to detect the start of the next log entry.

**`isSnapshotLogLine`** in `apps/node/src/adapters/android-bridge/logcatResultReader.ts`
(line 26): a line is captured as a snapshot log line only if it contains the string
`"TaskScopeDefault"`. If logcat uses a different process/tag format on some devices,
lines may not match and the snapshot body will not be captured.

**The dispatch capture timing window** (`logcatResultReader.ts` lines 160-181):
`captureSnapshotLines` is only set to `true` inside `beginDispatchCapture`. Lines
emitted before the broadcast is dispatched and `beginDispatchCapture` fires are not
collected into `snapshotLogLines`. The forced-replay-drain path further delays
setting `captureSnapshotLines = true` by an extra `SIGNAL_BROADCAST_REPLAY_DRAIN_MS`
(25 ms). If the broadcast is delayed or logcat is slow to start, snapshot log lines
from the early part of execution may be missed.

---

### 1.3 Where SNAPSHOT_EXTRACTION_FAILED is raised

`apps/node/src/domain/executions/runExecution.ts`, `markExtractionFailedSnapshotSteps`
(lines 148-167):

Condition triggers when ALL of the following are true:
- `step.actionType === "snapshot_ui"`
- `step.success === true` (Android reported success)
- `step.data.text === undefined` (no hierarchy XML was attached)

This means Android's `logUiTree` succeeded (returned non-null, logged something),
the envelope was received successfully by Node, but `extractSnapshotsFromLogs` found
zero matching XML blocks in the captured logcat lines. The step is retroactively
failed with `SNAPSHOT_EXTRACTION_FAILED`.

---

### 1.4 Overlay detection behavior

`UiTreeInspectorAndroid.getCurrentWindowMetadata` (lines 50-90) iterates over
`service.windows`. It marks a window as benign only if it is `TYPE_SYSTEM` AND from
`com.android.systemui` AND not active. Everything else - including the Samsung
launcher appearing as `TYPE_APPLICATION` or `TYPE_ACCESSIBILITY_OVERLAY` during a
transition - sets `overlayPackage`.

The overlay metadata is included in the `snapshot_ui` step result data fields
(`has_overlay`, `overlay_package`, `window_count`) but **has no effect on whether
the snapshot succeeds or fails.** A snapshot that captures the launcher tree while
the launcher is still foreground will be reported as success with `has_overlay=true`
and `overlay_package=com.sec.android.app.launcher`. The data reaches the caller
but is not acted upon by the runtime.

---

### 1.5 Skills-level current patterns

Three skills in `../clawperator-skills` use `open_app`:

- `com.globird.energy.get-usage` (`skills/com.globird.energy.get-usage/artifacts/usage.recipe.json`):
  `close_app` -> `open_app` -> `wait_for_node` (15 000 ms timeout). Never calls
  `snapshot_ui` directly. No snapshot race.

- `com.solaxcloud.starter.get-battery` (`skills/com.solaxcloud.starter.get-battery/artifacts/battery.recipe.json`):
  `close_app` -> `open_app` -> `sleep 12 000` -> `snapshot_ui` -> `read_text`. Fixed
  12 s sleep to cover app startup. Susceptible if device is slower.

- `com.theswitchbot.switchbot.get-bedroom-temperature` (`skills/com.theswitchbot.switchbot.get-bedroom-temperature/artifacts/bedroom-temperature.recipe.json`):
  `close_app` -> `open_app` -> `sleep 3 500` -> `snapshot_ui` -> `read_text`. 3.5 s
  fixed sleep. Most susceptible to the race on slow devices or devices where the
  Samsung launcher overlay persists longer than expected.

No skill uses `wait_for_navigation` before `snapshot_ui`.

---

## 2. Failure Modes

### 2.1 Race: open_app returns before app reaches foreground

`open_app` fires an intent and returns. Android schedules the activity start, but
the actual `onResume` and first accessibility tree traversal happen asynchronously.
The next action in the recipe (even after a sleep) may execute while:
- The launcher is still the active window (`rootInActiveWindow` belongs to
  `com.sec.android.app.launcher`).
- The transition animation is running (window visibility is partial).

Result: `logUiTree` succeeds but logs the launcher or a partially-drawn hierarchy.
Node receives an envelope with `snapshot_ui: success`, but `extractSnapshotsFromLogs`
finds the launcher XML (or fragmented XML). The step is retroactively marked
`SNAPSHOT_EXTRACTION_FAILED`.

The `UiReadiness` retry inside `logUiTree` does NOT help here. Retry only fires on
a `null` dump (thrown exception). A non-null launcher dump is transparently accepted
as success and the retry loop exits immediately.

### 2.2 logcat capture window miss

The `captureSnapshotLines` gate only opens after `beginDispatchCapture` fires
(triggered by broadcast success or stdout signal). If:
- The broadcast is slow to dispatch.
- The `snapshot_ui` step executes very quickly after the broadcast.
- Logcat lines arrive and are processed before the gate opens.

Then the `[TaskScope] UI Hierarchy:` lines are not collected into `snapshotLogLines`,
`extractSnapshotsFromLogs` returns an empty array, and `SNAPSHOT_EXTRACTION_FAILED`
is produced even though the hierarchy dump was correctly logged by the device.

### 2.3 Fragmented or premature snapshot log termination

`extractSnapshotsFromLogs` (`snapshotHelper.ts` lines 40-53) ends a snapshot block
when it sees a line starting with `[` that is not XML. If logcat interleaves other
log lines from the same tag during the hierarchy dump (possible under high log
volume), the parser terminates the block prematurely and yields incomplete XML.
The caller receives a partial hierarchy with no `</hierarchy>` close.

### 2.4 rootInActiveWindow null during transition

If `rootInActiveWindow` returns `null` exactly during the launcher-to-target-app
window transition, `SNAPSHOT_HIERARCHY_UNAVAILABLE` is thrown. With `UiReadiness`
retry (max 5 attempts, 500 ms initial delay), this can recover in most cases. If
all retries exhaust (total ~12+ s), the task fails from the Android side as
`TaskResult.Failed` with a non-zero step failure, which produces a different error
than `SNAPSHOT_EXTRACTION_FAILED`.

### 2.5 Fixed-sleep insufficient for device speed

The 3.5 s and 12 s fixed sleeps in switchbot and solaxcloud skills assume a given
device's cold-start performance. On slower devices or when the Play Store or system
services are active in the background, the app may not be fully loaded or the
launcher overlay may still be visible.

---

## 3. Candidate Solution Set

### Option A - Add wait_for_navigation before snapshot_ui in skills (skill-layer fix)

**What:** Update skill recipes to insert `wait_for_navigation` (with
`expectedPackage = <target_app_package>`) between `open_app` and `snapshot_ui`
(or between `open_app` and any action requiring app readiness). Replace fixed
sleeps with this semantic wait.

**How it works:** `TaskScopeDefault.waitForNavigation` (lines 374-430) polls
`getCurrentWindowMetadata().foregroundPackage` every 200 ms until the foreground
package matches and a transition was observed. Default timeout 10 000-15 000 ms.

**Pros:**
- Zero runtime change required - the feature already exists.
- Gives accurate "app is now foreground" signal without relying on sleep duration.
- Captures the gap between intent dispatch and accessibility tree settling.
- Consistent with what globird already does (uses `wait_for_node` equivalently).

**Cons:**
- Must update each affected skill individually.
- `waitForNavigation` checks `foregroundPackage` from `rootInActiveWindow`, so it
  satisfies once accessibility focus transfers - not necessarily once the app's first
  screen is fully rendered. Narrows the race but doesn't close it completely.
- Does not address the logcat capture window miss (failure mode 2.2).

### Option B - Runtime: open_app returns only after navigation-ready probe

**What:** Change `UiActionEngine.executeOpenApp` to automatically trigger a
`waitForNavigation` (to the launched package) before returning the step result.
Expose this as an optional `params.waitForPackageMs` field (default 0 for backward
compatibility).

**Pros:**
- Centralizes the fix: all callers of `open_app` get the benefit without changing
  individual skills.
- Consistent behavior across all skill authoring styles.
- The API contract explicitly documents post-launch readiness semantics.

**Cons:**
- Requires Android build change and a Node contract update.
- Default of 0 ms means backward compatible but callers must opt in.
- Adds latency when apps launch quickly (polling every 200 ms).
- Same caveat as Option A: satisfies on accessibility focus transfer, not full
  UI render.

### Option C - Runtime: snapshot_ui retries on overlay-detected result

**What:** When a `snapshot_ui` step succeeds but `has_overlay=true` and
`overlay_package` matches a known launcher package, treat it as a transient
failure and retry the snapshot step. Implementable:
- Android side: inside `TaskScopeDefault.logUiTree` retry loop, add an overlay
  check before accepting the result as final.
- Node side: a new post-processing step after `markExtractionFailedSnapshotSteps`
  could detect overlay-only steps and re-issue the snapshot.

**Pros:**
- Addresses the root symptom (overlay present = wrong tree captured).
- Overlay metadata is already available in step data.

**Cons:**
- Android-side: requires a hard-coded or configurable list of "transient" launcher
  packages. Fragile across OEMs.
- Node-side re-issue is architecturally awkward: re-issuing a full execution from
  within post-processing violates current single-flight invariants and creates a new
  result envelope / commandId that callers don't know to expect.
- A legitimate permissions dialog or system overlay would be silently retried past,
  which is wrong behavior.
- Does not address logcat capture window miss.

### Option D - Improve logcat capture window reliability

**What:** Review and tighten the `captureSnapshotLines` gate timing in
`apps/node/src/adapters/android-bridge/logcatResultReader.ts`. Options:
- Capture all `TaskScopeDefault` lines from the start of the logcat stream before
  the gate, then filter by proximity to the result envelope timestamp to back-fill
  the snapshot. The 25 ms drain guard exists to avoid stale replay from the
  previous command.
- Add commandId tagging to the `[TaskScope] UI Hierarchy:` log line on the Android
  side so Node can correlate snapshot blocks to commands precisely rather than
  relying on line timing.

**Pros:**
- Addresses failure mode 2.2 directly.
- No skill changes needed.
- Transparent to API callers.

**Cons:**
- Capturing pre-gate lines risks attaching a stale snapshot from a previous command
  (the drain guard exists for this reason). Proper solution requires Android-side
  commandId embedding in the snapshot log line.
- Android-side change needed for the precise fix (adding commandId to the hierarchy
  log marker).
- Increases memory pressure for noisy logcat streams.

### Option E - Documentation + skill authoring guidance

**What:** Document that `open_app` provides no UI-readiness guarantee and that every
skill using `open_app` followed by `snapshot_ui` or any read must insert either:
1. `wait_for_navigation` (preferred - gives package-level readiness).
2. `wait_for_node` targeting a stable element on the app's first screen (best -
   gives app-specific readiness and is the pattern used by globird).

Provide a canonical template recipe in `docs/skills/`. Document the meaning of
`has_overlay` and `overlay_package` so skill authors can diagnose failures.

**Pros:**
- Zero code change.
- `wait_for_node` is the strongest readiness guarantee for app-specific skills.
- Generalizes across all devices and apps, not just Samsung launcher.

**Cons:**
- Requires discipline; does not prevent incorrect skill authoring.
- Existing published skills remain broken until individually updated.
- Does not address the logcat capture window miss.

### Option F - open_app blocks until app is foreground by default, with opt-out (recommended)

**What:** Change `open_app` to block until the launched package is the active
accessibility window before returning success. This makes `open_app` truthfully
mean "the app is open," not "an intent was dispatched." Add an opt-out param
(`skipNavigationWait: true` in the action contract, exposed as `--no-wait` or
equivalent on the CLI) for callers that explicitly want fire-and-forget behavior.

**How it works:**
- `UiActionEngineDefault.executeOpenApp` calls `triggerManager.trigger(...)` as
  today, then immediately enters the existing `TaskScopeDefault.waitForNavigation`
  poll loop targeting the launched `applicationId`.
- The poll loop already exists and works (`TaskScopeDefault` lines 374-430). This
  change is an addition to one call site in the engine.
- If the navigation wait times out (package never reaches foreground within
  `timeoutMs`), the step fails with a distinct error - distinguishable from an
  intent dispatch failure.
- The existing `timeoutMs` on `open_app` (15 000 ms) must cover both the intent
  dispatch and the foreground wait. This timeout value may need to be increased
  as part of the change, or split into two separate timeout params.
- With `skipNavigationWait: true`, behavior is identical to today - intent fires
  and the step returns immediately.

**Why this is the right default:**
- The action name `open_app` implies the app is open on completion. The current
  behavior breaks that contract for every caller. Every skill that calls
  `open_app` then `snapshot_ui` or any read action is exposed to the race without
  knowing it.
- Options A and B shift the burden to callers. Option A requires updating every
  affected skill; Option B requires callers to opt in to safe behavior. Option F
  inverts the burden: callers opt out only when they have a specific reason (e.g.,
  they are about to do their own custom wait).
- The wait logic (`waitForNavigation`) already exists in the runtime and has been
  validated in other contexts. This is not a new algorithm.

**Readiness level provided:**
`waitForNavigation` confirms that `rootInActiveWindow.packageName` matches the
target package - i.e., accessibility focus has transferred. This is the
"package is foreground" guarantee, not the "app's first screen is fully loaded"
guarantee. Skill authors that need content-level readiness (e.g., waiting for a
specific DOM node) still need a subsequent `wait_for_node`. However, this closes
the launcher-overlay race that causes `SNAPSHOT_EXTRACTION_FAILED` in the
observed failures.

**Edge cases:**
- App already foreground: `waitForNavigation` satisfies in the first poll
  (package already matches). No additional latency.
- App crashes on launch: currently this reports success (intent dispatched). With
  Option F, the step correctly fails because the package never reaches foreground.
  This is a behavior improvement.
- System permission dialog before app foreground: the poll waits past these
  because the target package eventually receives focus after the dialog. Whether
  this is desirable depends on context; it can be addressed by a future
  `interruptOnDialog` param if needed.
- App that launches a different package: e.g., a deep link that opens a third
  package. The poll would time out. This is an existing edge case not made worse
  by this change; the opt-out param is the escape hatch.

**Impact on Options A, B, E:**
If Option F is implemented, Options A (per-skill wait) and E (docs telling
skill authors to add waits) become unnecessary for the open_app race. They are
both workarounds for what should be default behavior. Option D (logcat capture
window) is orthogonal and should still be addressed independently.

**Pros:**
- Every caller of `open_app` is safe by default - no per-skill changes needed.
- Semantics are correct: success means the app is actually open.
- No new algorithm needed - reuses `waitForNavigation` already in the runtime.
- App-crash-on-launch is now correctly reported as failure rather than silent
  success.
- Reduces cognitive overhead for skill authors: no need to know about the
  timing race.

**Cons:**
- Breaking change to existing contract: callers that rely on `open_app` returning
  before the app is foreground (e.g., fire-and-forget chains) must add
  `skipNavigationWait: true`. Current skills are unlikely to need this since the
  whole point of `open_app` is to bring an app to the foreground.
- Increases the typical latency of `open_app` by the time it takes for
  accessibility focus to transfer (usually 200-1000 ms extra on most devices).
- Still only closes the accessibility-focus-level race. Skill authors that need
  content-level readiness still need `wait_for_node`. Must document this
  distinction clearly.
- Timeout semantics become compound: the same `timeoutMs` now covers intent
  dispatch plus foreground wait. If the current 15 000 ms budget is tight on slow
  devices, this needs adjustment (or a separate `navigationTimeoutMs`).
- Requires Android build change and Node contract update (minor: add
  `skipNavigationWait` param, thread it through the engine).

---

## 4. Test / Verification Plan

### 4.1 Unit tests (Node layer)

- `markExtractionFailedSnapshotSteps`: add a case where `snapshotLogLines` is
  non-empty but the `[TaskScope] UI Hierarchy:` marker appears before
  `captureSnapshotLines` would have been true (simulating capture window miss).
  File: `apps/node/src/test/unit/runExecution.test.ts`.
- `extractSnapshotsFromLogs`: add a test with interleaved non-snapshot log lines
  causing premature block termination.
  File: `apps/node/src/test/unit/` (new snapshot helper test or extend existing).

### 4.2 Unit tests (Android layer)

- `UiActionEngineDefaultTest.kt`: add a case where `logUiTree` succeeds with
  `has_overlay=true` and `overlayPackage = "com.sec.android.app.launcher"`.
  Confirm the step reports success and overlay metadata is propagated - documents
  current behavior and makes future overlay-handling changes visible.

### 4.3 Integration test (device)

1. Install the debug Operator APK on a Samsung device.
2. Run a recipe: `close_app` -> `open_app` -> `snapshot_ui` (zero sleep, no wait).
3. Confirm `SNAPSHOT_EXTRACTION_FAILED` or launcher tree is captured (establishes
   the race is reproducible).
4. Apply fix (e.g., add `wait_for_navigation`).
5. Confirm the step captures the target app's tree and `has_overlay=false`.
6. Run the same recipe on a second non-Samsung device to confirm it doesn't regress.

### 4.4 Timing edge case

On a device with the debug APK, use `logcatBroadcastDelayMs = 2000` and a
`snapshot_ui` recipe that completes in under 500 ms. Confirm `SNAPSHOT_EXTRACTION_FAILED`
is produced. Verify that a fix for failure mode 2.2 (Option D) resolves it.

---

## 5. Open Questions

1. **Does `rootInActiveWindow` return the target app's root when the launcher
   overlay is still visible but inactive?** `getCurrentWindowMetadata` uses
   `service.windows` (all visible windows), but `getCurrentUiHierarchyDump` uses
   only `rootInActiveWindow` (the active window). These differ. Static analysis
   cannot confirm what Android returns for `rootInActiveWindow` on Samsung devices
   when the launcher is overlaying but the target app holds accessibility focus.
   Needs device-side verification using `window_count`, `has_overlay`, and
   `foreground_package` output from a real execution.

2. **Is Samsung's `com.sec.android.app.launcher` the only launcher that causes
   this?** The issue description names it specifically. Other OEM launchers (MIUI,
   Pixel Launcher) may behave differently. Any fix should be tested on at least one
   non-Samsung device.

3. **Does `wait_for_navigation` satisfy based on `rootInActiveWindow` package or
   on the full window list?** It calls `getCurrentWindowMetadata().foregroundPackage`
   which comes from `activeRoot.packageName` (the active root only). So it confirms
   accessibility focus has transferred, not full screen render. The exact moment
   accessibility focus transfers on Samsung devices vs. when the screen is fully
   drawn is unknown from static analysis alone.

4. **Can the logcat capture miss (failure mode 2.2) be confirmed as a real-world
   cause?** Both the open_app race and the capture window miss are credible from
   static analysis. A structured debug session using `--log-file` output alongside
   `logcat -v threadtime` would show whether `[TaskScope] UI Hierarchy:` lines
   appear in raw logcat but not in `snapshotLogLines`.

5. **Does the UiReadiness retry on `snapshot_ui` help at all in this scenario?**
   Retry fires only when `logUiTree` throws (`SNAPSHOT_HIERARCHY_UNAVAILABLE` from
   a null dump). A non-null launcher dump is accepted as success and the retry loop
   exits immediately. So the retry does not help for failure mode 2.1.

6. **What is the behavior of `appsRepository.findTriggerShortcut` for apps not in
   the known-apps list?** The fallback in `OpenAppManagerAndroid.openApp` (line 37)
   uses `getLaunchIntentForPackage`. It is unknown whether this path produces the
   same accessibility event sequence on Samsung devices as the shortcut path, or
   whether it triggers a different animation that holds the launcher overlay for
   longer.
