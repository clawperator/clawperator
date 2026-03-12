# Scroll Action - Implementation Plan

## Overview

Add a standalone `scroll` action to the Clawperator execution API. The action performs a single scroll gesture within a container and reports whether content actually moved - not merely whether the gesture was dispatched.

---

## 1. API Shape

### Request

```json
{
  "id": "scroll1",
  "type": "scroll",
  "params": {
    "container": { "resourceId": "com.android.settings:id/recycler_view" },
    "direction": "down",
    "distanceRatio": 0.7,
    "settleDelayMs": 250,
    "findFirstScrollableChild": false,
    "retry": { "maxAttempts": 1 }
  }
}
```

**All params are optional.**

| Param | Type | Default | Notes |
|-------|------|---------|-------|
| `container` | `NodeMatcher` | auto-detect | Matcher for the scroll container. If omitted, the first scrollable node on screen is used. |
| `direction` | `"down" \| "up" \| "left" \| "right"` | `"down"` | Content direction semantics: `"down"` reveals content further down (finger swipes up). Same semantics as `scroll_and_click`. |
| `distanceRatio` | `number` | `0.7` | Swipe distance as a fraction of container height (vertical) or width (horizontal). Range: `0.0`-`1.0`. |
| `settleDelayMs` | `number` | `250` | Milliseconds to wait after the gesture before reading the post-scroll signature. Range: `0`-`10000`. |
| `findFirstScrollableChild` | `boolean` | `false` | If the matched container is not itself scrollable, use its first scrollable descendant. Handles wrapper-with-inner-scroll patterns. |
| `retry` | retry object | `TaskRetry.None` | Retry only the outer resolution step (container find). Default is single-attempt: scrolling itself is not retried. |

**Horizontal scroll in v1:** The `direction` enum includes `"left"` and `"right"` and they are fully handled by the existing `gestureSwipeWithinHorizontal` path. Horizontal scroll is supported from day one - the API space is not reserved, it is live.

### Response - `data` keys

| Key | Value |
|-----|-------|
| `scroll_outcome` | `"moved"` - content changed; `"edge_reached"` - gesture dispatched but no movement detected; `"gesture_failed"` - OS rejected the gesture dispatch |
| `direction` | Normalized direction string (`"down"`, `"up"`, `"left"`, `"right"`) |
| `distance_ratio` | Actual distance ratio used (string) |

### Success and error semantics

**`success: true` cases:**
- `scroll_outcome: "moved"` - scroll completed, content moved
- `scroll_outcome: "edge_reached"` - scroll completed, container was already at limit

**`success: false` cases (hard errors):**
- `data.error: "CONTAINER_NOT_FOUND"` - no matching container node found on screen
- `data.error: "CONTAINER_NOT_SCROLLABLE"` - matched container is not scrollable and `findFirstScrollableChild` is false (or no scrollable descendant exists)
- `data.error: "GESTURE_FAILED"` - `dispatchSwipe` returned false (OS rejected gesture - accessibility service not ready, secure window, etc.)

### EDGE_REACHED semantics rationale

`"edge_reached"` must be a successful no-op result (`success: true`), not an error. The reasoning:

- An agent issuing `scroll` commands in a loop to paginate a list needs to know when to stop. If `"edge_reached"` were an error, the agent would need exception handling rather than a clean conditional branch on `scroll_outcome`.
- The action performed its contract correctly: the gesture was dispatched, the container was valid. The container happened to be at its limit.
- Making it an error would force agents to write retry-suppressing logic for a routine expected condition.

### Stable error codes to add to `errors.ts`

These belong in the `data.error` per-step category (not top-level `error.code`):

```
CONTAINER_NOT_FOUND
CONTAINER_NOT_SCROLLABLE
GESTURE_FAILED
```

`GESTURE_FAILED` is new. The existing `GLOBAL_ACTION_FAILED` code is for `press_key` and has different meaning.

---

## 2. Implementation Strategy

### Primary approach: gesture injection

Use the existing `gestureSwipeWithin` path (`UiTreeManagerAndroid.swipeWithinVertical` / `swipeWithinHorizontal` calling `AccessibilityService.dispatchSwipe`). This is consistent with `scroll_and_click` and works across all container types regardless of whether they implement accessibility scroll actions.

No `ACTION_SCROLL_FORWARD` / `ACTION_SCROLL_BACKWARD` fallback in v1. Reasons:
- Consistency with the existing approach in `scroll_and_click`
- Accessibility scroll actions give no distance control
- Many production containers do not implement them (carousels, WebViews, custom RecyclerView decorators)
- The gesture path is battle-tested by `scroll_and_click`

### Detecting actual content movement

Use `leadingChildSignature` before and after the gesture:

1. Resolve and capture `sigBefore = leadingChildSignature(containerNode, direction)`
2. Dispatch `gestureSwipeWithin(containerNode, direction, distanceRatio)`
3. Wait `settleDelayMs`
4. Re-read the container from the fresh UI tree
5. Capture `sigAfter = leadingChildSignature(freshContainerNode, direction)`
6. `sigBefore != sigAfter` = `"moved"`; `sigBefore == sigAfter` (or `sigBefore == null`) = `"edge_reached"`

If `gestureSwipeWithin` returns `false`, return `success: false` with `GESTURE_FAILED`.

The `leadingChildSignature` function already exists in `TaskUiScopeDefault` as a private function. It should be extracted to a package-internal or companion-level function so the new `scroll` implementation can share it.

### Scroll distance control

`distanceRatio` is the only distance control parameter. This maps directly to the existing `gestureSwipeWithinVertical`/`gestureSwipeWithinHorizontal` ratio-based coordinate calculation. No pixel count, line count, or page count semantics are introduced in v1.

Rationale: ratio-based distance is device-independent, already proven, and sufficient for all known agent use cases. Adding pixel counts would require exposing DPI and font metrics which creates unnecessary complexity.

### Post-scroll stabilization

Apply `settleDelayMs` (default 250ms) after the gesture and before reading the post-scroll signature. This matches the `scrollUntil` pattern and prevents false "moved" readings during OS scroll animation frames.

Post-scroll stabilization is the caller's responsibility in the multi-step sense: agents must issue a `snapshot_ui` or `wait_for_node` after `scroll` if they need to inspect the new content. The `scroll` action only waits long enough to take the progress snapshot.

### Nested scroll container handling

`findFirstScrollableChild` flag, same as `scroll_and_click`. When `true` and the matched container is not scrollable itself, the implementation uses `findFirstScrollableDescendant` to locate the first scrollable descendant.

---

## 3. Implementation Phases

### Phase 1 - Core Android implementation and unit tests

**Scope:**
- Add `UiAction.Scroll` data class to `UiAction.kt`
- Add `scrollOnce` method to `TaskUiScope` interface (name `scrollOnce` to avoid collision with Java/Kotlin `scroll` conventions; alternatively `scrollBy` - resolve during review)
- Implement `scrollOnce` in `TaskUiScopeDefault.kt`:
  - Resolve container (auto or matched)
  - Capture `sigBefore`
  - Dispatch gesture
  - Wait `settleDelayMs`
  - Capture `sigAfter`
  - Return outcome enum: `Moved | EdgeReached | GestureFailed`
- Add `executeScroll` handler to `UiActionEngineDefault.kt`
- Add `"scroll"` case to `AgentCommandParser.kt`
- Add stub to `TaskUiScopeTest.kt` (returns `Moved` when target is found in tree, `EdgeReached` otherwise)
- Add unit tests in `UiActionEngineDefaultTest.kt` covering: moved, edge_reached, container_not_found, gesture_failed

**New files:** None (all additions to existing files)

**Key files to touch:**
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/test/src/main/kotlin/clawperator/task/TaskUiScopeTest.kt`
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt`

**Validation:**
- `./gradlew testDebugUnitTest` must pass
- `./gradlew :app:assembleDebug` must succeed

**Risks:**
- `leadingChildSignature` is currently private in `TaskUiScopeDefault`. It must be extracted or duplicated. Prefer extracting it to a package-level function in the same module so both `scrollUntil` and `scrollOnce` share it.

---

### Phase 2 - Node API integration and contract tests

**Scope:**
- Add `"scroll"` to `CANONICAL_ACTION_TYPES` in `apps/node/src/contracts/aliases.ts`
- Add scroll params to `ActionParams` interface in `apps/node/src/contracts/execution.ts`:
  - `container?: NodeMatcher` (already present for `scroll_and_click`)
  - `direction?: string` (already present)
  - `distanceRatio?: number` (already present)
  - `settleDelayMs?: number` (already present)
  - `findFirstScrollableChild?: boolean` (already present)
  - No new fields needed in `ActionParams` - all are shared with `scroll_and_click`
- Add `"scroll"` to `supportedTypes` array in `validateExecution.ts`
- Add validation case for `"scroll"` in `validateExecution.ts`:
  - No required params (container is optional, direction defaults)
  - Validate `direction` enum if provided: `"down" | "up" | "left" | "right"`
  - Validate `distanceRatio` range 0.0-1.0 if provided
  - Validate `settleDelayMs` range 0-10000 if provided
- Add error codes `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED` to `apps/node/src/contracts/errors.ts`
- Add unit tests in `apps/node/src/test/unit/validateExecution.test.ts` covering validation cases

**Key files to touch:**
- `apps/node/src/contracts/aliases.ts`
- `apps/node/src/contracts/execution.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- `apps/node/src/test/unit/validateExecution.test.ts`

**Validation:**
- `npm --prefix apps/node run build && npm --prefix apps/node run test` must pass

**Risks:**
- The `actionParamsSchema` in `validateExecution.ts` is `.strict()` - if any new param names differ from what the Android parser accepts, the validation schema and parser must be updated together

---

### Phase 3 - Edge detection and result metadata

**Scope:**
- Verify the `scroll_outcome` key is present in step result `data` for all paths
- Add integration with existing `envelopeParser.ts` in Node (verify `data` map is passed through unchanged - it is, based on reading `logcatResultReader` and `envelopeParser` behavior)
- Smoke test on a physical device: Android Settings RecyclerView, verify `scroll_outcome` values
- Consider extracting `leadingChildSignature` to a shared utility in the same module (if not done in Phase 1)

**Key files to touch:**
- No new files; this is a verification and hardening phase
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` (extract signature helper if not done)

**Validation:**
- `./scripts/clawperator_smoke_core.sh`
- Manual test: `clawperator execute --execution '{"commandId":"sc1","taskId":"t1","source":"test","expectedFormat":"android-ui-automator","timeoutMs":30000,"actions":[{"id":"s1","type":"scroll","params":{"direction":"down"}}]}'`

---

### Phase 4 - Documentation updates

**Scope:**
- Update `docs/node-api-for-agents.md`:
  - Add `scroll` to the Action Reference table
  - Add `scroll` to the Per-action result data table
  - Add `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED` to Error Codes table
  - Add CLI-to-action mapping for a future `action scroll` CLI shorthand (note: the CLI shorthand does not exist yet, just document the execution payload type)
  - Add a usage example showing snapshot-scroll-snapshot-verify pattern
- Regenerate `sites/docs/docs/` via `docs-generate` skill per documentation discipline in `CLAUDE.md`

**Key files to touch:**
- `docs/node-api-for-agents.md`
- Run `docs-generate` skill to update `sites/docs/docs/`

**Validation:**
- `./scripts/docs_build.sh` must succeed

---

### Phase 5 - Validation skill / demo

**Scope:**
- Write a soak validation script (~60 seconds): open Android Settings, issue 10 `scroll` actions in a loop, verify `scroll_outcome` transitions from `"moved"` to `"edge_reached"` as the list exhausts
- Add a snapshot-scroll-snapshot-verify loop: take snapshot, scroll, take snapshot, verify top-of-list node label changed
- Place in `scripts/` or as a local skill artifact

**Suggested script location:** `scripts/clawperator_smoke_scroll.sh`

**Validation criteria:**
- At least one `"moved"` result before any `"edge_reached"` result
- No `"gesture_failed"` results on a normal device
- Total execution time under 90 seconds

---

## 4. Testing Matrix

| Scenario | Expected outcome | How to verify |
|----------|-----------------|---------------|
| Android Settings RecyclerView, first scroll down from top | `scroll_outcome: "moved"` | `data.scroll_outcome == "moved"` |
| Android Settings RecyclerView, scroll up at top | `scroll_outcome: "edge_reached"` | `data.scroll_outcome == "edge_reached"` |
| Android Settings RecyclerView, repeat scroll down until exhausted | Last N results `"edge_reached"` | Loop until edge, check all tail results |
| Container not present on screen | `success: false`, `data.error: "CONTAINER_NOT_FOUND"` | Use non-existent resourceId |
| Google Play (lazy-loading list) | `scroll_outcome: "moved"` repeatedly until new content loads | Soak test |
| Horizontal carousel (e.g., category chips) | `scroll_outcome: "moved"` with `direction: "left"` | Manual with Google Home app |
| No container param, single scrollable on screen | Scrolls the only scrollable container | Android Settings main screen |
| `findFirstScrollableChild: true` with wrapper container | Scrolls inner RecyclerView | Google Home category chips |

**Unit test cases (Android Kotlin):**
- `execute scroll returns moved when signature changes`
- `execute scroll returns edge_reached when signature unchanged`
- `execute scroll returns gesture_failed when dispatchSwipe returns false`
- `execute scroll returns container_not_found when no scrollable on screen`
- `execute scroll returns container_not_scrollable when matched node is not scrollable`
- `execute scroll auto-detects first scrollable when no container param`

**Unit test cases (Node TypeScript):**
- `validateExecution accepts scroll with no params`
- `validateExecution accepts scroll with all optional params`
- `validateExecution rejects unknown direction`
- `validateExecution rejects distanceRatio outside 0-1`
- `validateExecution rejects settleDelayMs outside 0-10000`

**Integration test (on-device):**
- `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_integration_canonical.sh` - add a scroll step to the canonical integration test

---

## 5. Commit Strategy

Split into narrow reviewable commits, not amending:

1. **`feat(android): add Scroll UiAction and TaskUiScope.scrollOnce`**
   - `UiAction.kt`, `TaskUiScope.kt`, `TaskUiScopeDefault.kt`, `TaskUiScopeTest.kt`
   - Android unit tests

2. **`feat(android): wire scroll action through parser and engine`**
   - `AgentCommandParser.kt`, `UiActionEngine.kt`
   - Engine unit tests for scroll

3. **`feat(node): add scroll to execution contract and validation`**
   - `aliases.ts`, `execution.ts`, `errors.ts`, `validateExecution.ts`
   - Node unit tests

4. **`feat(android): build and install verification`**
   - After all Android tests pass, `assembleDebug` confirmed clean

5. **`docs: add scroll action to node-api-for-agents.md`**
   - `docs/node-api-for-agents.md`
   - Regenerated `sites/docs/docs/`

6. **`test: add scroll smoke validation script`**
   - `scripts/clawperator_smoke_scroll.sh`

---

## 6. v1 Scope Boundaries (explicitly out of scope)

- **Fling gesture** - not in v1. Fling is a high-velocity gesture with momentum; different physics from a controlled scroll. Adds complexity with no clear agent use case that `distanceRatio` cannot solve.
- **Scroll-to-percent** - not in v1. Requires reading container scroll position and extent which the accessibility API exposes via `getScrollX`/`getScrollY`/`getScrollingContainer` but is brittle across container types.
- **Infinite feed heuristics** - not in v1. Determining when a lazy-loading list has "finished loading" requires waiting for network/render. This is the caller's responsibility via `wait_for_node` after `scroll`.
- **`scrollN` (scroll N pages)** - not in v1. Multiple scrolls should be expressed as multiple `scroll` actions in the execution payload. The 64-action limit is sufficient for typical pagination needs.
- **Velocity control** - not in v1. The `durationMs` parameter inside `dispatchSwipe` is fixed at 250ms. Exposing it creates complexity with no proven agent need.
- **Pixel-exact distance** - not in v1. See section 2 (distance control).
- **`action scroll` CLI shorthand** - not in v1. The `action` subcommand family requires Node-side CLI changes. Can be added in a follow-up.
- **`scroll_and_click` refactor** - not in v1. `scroll_and_click` should continue using its current internal path until `scroll` is proven stable in production.

---

## 7. Relationship to `scroll_and_click`

`scroll_and_click` is a composite action with intent: "find this element (scrolling as needed) and click it." It uses `scrollUntil` internally which loops across up to `maxSwipes` swipes.

`scroll` is a primitive action with intent: "perform one scroll gesture and report the outcome."

**They are not duplicates.** Agents should use:
- `scroll` when paginating, exploring, or reading content that requires scrolling without a known target
- `scroll_and_click` when targeting a specific element that may be off-screen

In a future major version, `scroll_and_click` could be refactored to call `scroll` internally. This is not planned for v1 because it would require changing a stable, battle-tested code path with no immediate benefit.

**Consistency requirement:** Both actions must use the same direction semantics (content-direction, not finger-direction). `scroll_and_click` already uses this convention and `TaskScrollDirection` is shared. `scroll` will use the same enum.

---

## 8. File Reference Summary

All files that must change for a complete v1 implementation:

**Android (Kotlin):**
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` - add `UiAction.Scroll`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt` - add `scrollOnce` method
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` - implement `scrollOnce`, extract `leadingChildSignature`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` - add `executeScroll`
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` - add `"scroll"` case
- `apps/android/shared/test/src/main/kotlin/clawperator/task/TaskUiScopeTest.kt` - add `scrollOnce` stub
- `apps/android/shared/test/src/test/kotlin/clawperator/task/runner/UiActionEngineDefaultTest.kt` - scroll unit tests

**Node (TypeScript):**
- `apps/node/src/contracts/aliases.ts` - add `"scroll"` to `CANONICAL_ACTION_TYPES`
- `apps/node/src/contracts/execution.ts` - verify `ActionParams` covers all scroll params (no new fields needed)
- `apps/node/src/contracts/errors.ts` - add `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED`
- `apps/node/src/domain/executions/validateExecution.ts` - add `"scroll"` to `supportedTypes`, add validation case
- `apps/node/src/test/unit/validateExecution.test.ts` - scroll validation unit tests

**Docs:**
- `docs/node-api-for-agents.md` - full documentation for `scroll` action
- `sites/docs/docs/` - regenerated via `docs-generate` skill

**Scripts:**
- `scripts/clawperator_smoke_scroll.sh` - new validation script
