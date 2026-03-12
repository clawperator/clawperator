# Scroll Action - Discovery Findings

## Summary

The codebase already contains a mature internal scroll implementation (`scrollUntil` / `scrollIntoView`) used by `scroll_and_click`. A standalone `scroll` action can be built almost entirely from existing primitives. The core gap is a result contract that reports whether content actually moved, not merely whether a gesture was attempted.

---

## 1. Existing Scroll and Gesture Code

### Internal task-layer scroll primitives

**`TaskUiScope.scrollUntil` and `scrollIntoView`**
- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt`
- Full implementations in `TaskUiScopeDefault.kt` (same directory)
- `scrollUntil` performs gesture-based scrolling with:
  - Container auto-detection (`findFirstScrollable`) or explicit `NodeMatcher`
  - Direction: `Down | Up | Left | Right` (content-direction semantics, not finger direction)
  - `distanceRatio` (fraction of container height/width per swipe, default 0.7)
  - `settleDelay` between swipes (default 250ms)
  - `leadingChildSignature` before/after comparison to detect whether content moved (stuck detection)
  - Early exit when `stuckCount >= 2` (two consecutive no-movement swipes)
- `scrollIntoView` wraps `scrollUntil` and throws on `NotFoundExhausted`

### Gesture dispatch infrastructure

**`UiTreeManager.swipeWithinVertical` / `swipeWithinHorizontal`**
- File: `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`
- Interface with default `durationMs = 250`
- Android impl: `UiTreeManagerAndroid.kt` (same directory)
  - Reads `boundsInScreenRect` from the live `AccessibilityNodeInfo`
  - Computes absolute pixel coordinates from ratio inputs
  - Calls `service.dispatchSwipe`

**`AccessibilityService.dispatchSwipe`**
- File: `apps/android/shared/data/uitree/src/main/kotlin/clawperator/accessibilityservice/AccessibilityNodeInfoExtAndroid.kt`
- Coroutine-friendly: `suspendCancellableCoroutine` on `GestureResultCallback`
- Returns `true` only when `onCompleted` fires, `false` on `onCancelled` or dispatch rejection
- Uses `GestureDescription` / `Path.lineTo` for a straight-line swipe

**`AccessibilityGesturesAndroid.kt`**
- File: `apps/android/shared/data/toolkit/src/main/kotlin/clawperator/accessibilityservice/AccessibilityGesturesAndroid.kt`
- Contains `executeSwipeGesture` (lower-level helper used for app-close gestures)
- Also contains `performRightEdgeSwipeUp`, `performCenterTapHoldSwipeUp` - these are app-close-specific and not relevant to content scrolling

### Progress detection mechanism

In `TaskUiScopeDefault.leadingChildSignature`:
- Takes the first 3 children of the container node
- Encodes each child as `"<resourceId|nodeId>@y=<bounds.top>"` (vertical) or `"@x=<bounds.left>"` (horizontal)
- Compares signature before and after gesture
- Detects "stuck" state when signature is unchanged for 2 consecutive swipes

This is the critical existing mechanism for distinguishing "gesture attempted" from "content moved."

### Scroll direction enum

**`TaskScrollDirection`**
- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScrollDirection.kt`
- Values: `Down, Up, Left, Right`
- Semantics: content direction (Down = reveal more content below, finger moves up)
- Already handles all four directions in both vertical and horizontal swipe code paths

### Existing `scroll_and_click` action

**UiAction definition**
- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- `UiAction.ScrollAndClick` data class with fields: `target`, `container`, `clickTypes`, `direction`, `maxSwipes`, `distanceRatio`, `settleDelayMs`, `scrollRetry`, `clickRetry`, `findFirstScrollableChild`

**Android parser**
- File: `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- Case `"scroll_and_click"` in `parseAction` switch
- Parameters parsed: `target`, `container`, `direction`, `maxSwipes` (coerced 1-50), `distanceRatio` (coerced 0-1), `settleDelayMs` (coerced 0-10000), `scrollRetry`, `clickRetry`, `findFirstScrollableChild`

**Engine execution**
- File: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- `executeScrollAndClick` calls `taskScope.ui { clickAfterScroll(...) }`
- Returns `UiActionStepResult` with `max_swipes`, `direction`, `click_types` in `data`

**Node validation**
- File: `apps/node/src/domain/executions/validateExecution.ts`
- Case `"scroll_and_click"`: validates `params.target` is required
- Direction, maxSwipes, distanceRatio are permissively accepted (no enum check on direction)

**Node contracts**
- File: `apps/node/src/contracts/execution.ts`
- `ActionParams` contains all scroll_and_click fields already

---

## 2. No `ACTION_SCROLL_FORWARD` / `ACTION_SCROLL_BACKWARD` Usage Found

The codebase does not currently call `AccessibilityNodeInfo.ACTION_SCROLL_FORWARD` or `ACTION_SCROLL_BACKWARD`. All scrolling uses gesture injection (`GestureDescription`). This is intentional - gesture-based scrolling works on all container types and does not depend on the container implementing the accessibility scroll actions.

---

## 3. Accessibility Service Class

**`AccessibilityNodeInfoExtAndroid.kt`**
- Contains `dispatchSwipe`, `dispatchSingleTap`, `dispatchLongPress` as extension functions on `AccessibilityService`
- `dispatchSwipe` is used by `UiTreeManagerAndroid` for all scroll gestures
- `boundsInScreenRect` extension property reads `getBoundsInScreen`

The accessibility service implementation is in `apps/android/shared/app/app-adapter/src/main/kotlin/clawperator/system/accessibility/` (the actual service registration) and leverages the toolkit module.

---

## 4. Screen Dimension APIs

**`WindowDimens` interface**
- File: `apps/android/shared/core/common/src/main/kotlin/action/utils/WindowDimens.kt`
- Properties: `density`, `displaySize: Point`, `maxDisplayDimension`, `minDisplayDimension`

**`WindowDimensSystem`**
- File: `apps/android/shared/core/common/src/main/kotlin/action/utils/WindowDimensSystem.kt`
- Reads real display size via `WindowManager.defaultDisplay.getRealSize`
- Available in the DI graph

**`WindowFrame` / `WindowFrameManager`**
- Used by `AppCloseManagerAndroid` to get `deviceWidthPx` / `deviceHeightPx`
- Provides screen metrics where needed in the Android layer

Screen dimensions are available. The gesture-based swipe implementation in `UiTreeManagerAndroid` does not need them directly - it computes gesture coordinates from the container node's `boundsInScreenRect`, which are already in absolute pixel space.

---

## 5. Container Identification

The existing `scrollUntil` already handles container resolution:

- `container == null`: finds the first node with `hints["scrollable"] == "true"` using `UiTreeTraversal.findAll`
- `container != null`: matches by `NodeMatcher`, then checks `isScrollable`, optionally descends to first scrollable child if `findFirstScrollableChild == true`

The `scrollable` hint is extracted from `AccessibilityNodeInfo.isScrollable` during tree construction in `AccessibilityNodeInfoExtAndroid.toUiAutomatorHierarchyDump` (attribute `scrollable="true"` in the XML dump) and in `mapToUiNode` (stored in `hints["scrollable"]`).

The `NodeMatcher` system (resourceId, role, textEquals, textContains, contentDescEquals, contentDescContains) is the only container targeting mechanism in the codebase. There is no bounds-based or index-based matching.

---

## 6. Edge Detection Capability

The current `leadingChildSignature` approach detects stuck-ness but does not explicitly detect "at edge" vs "content moved" for a single swipe. It requires 2 consecutive stuck observations before declaring exhaustion.

For a standalone `scroll` action, the same before/after signature comparison can be applied to a single swipe to report:
- `"moved"`: signature changed - content scrolled
- `"edge_reached"`: signature unchanged after swipe - container was already at the edge (or content is too short to scroll)

A single-swipe stuck observation is sufficient for the standalone scroll action because there is no target to keep searching for.

Note: `leadingChildSignature` can return `null` when the container has no children (empty list or leaf node). This case should be treated as `"edge_reached"` from the result perspective since there is nothing to scroll through.

---

## 7. `scrollable` Node Attribute in Snapshot Output

The `hierarchy_xml` snapshot format already includes `scrollable="true"` on container nodes (verified in `appendUiAutomatorNodeXml`). Agents can identify scroll containers from snapshot output and pass their `resource-id` as the `container` matcher. This is documented in the existing API docs.

---

## 8. Existing API Documents

**`docs/node-api-for-agents.md`**
- Full API contract document
- `scroll_and_click` is fully documented at lines 225, 483, 529
- Error codes table at line 644
- No standalone `scroll` action exists yet

---

## 9. Node API Side - Files That Need Changes

| File | Purpose |
|------|---------|
| `apps/node/src/contracts/execution.ts` | `ActionParams` - add `scroll` params |
| `apps/node/src/contracts/aliases.ts` | `CANONICAL_ACTION_TYPES` - add `"scroll"` |
| `apps/node/src/domain/executions/validateExecution.ts` | `supportedTypes`, validation case for `"scroll"` |
| `apps/node/src/contracts/errors.ts` | Add scroll error codes |

---

## 10. Android Side - Files That Need Changes

| File | Purpose |
|------|---------|
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` | Add `UiAction.Scroll` data class |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Add `executeScroll` handler |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Add `"scroll"` case to `parseAction` |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt` | Add `scroll` method (single-step, no target) |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Implement `scroll` |
| `apps/android/shared/test/src/main/kotlin/clawperator/task/TaskUiScopeTest.kt` | Add stub for `scroll` |

---

## 11. New Result Contract Requirements

The `scroll` action must report whether content actually moved. The existing `UiActionStepResult.data` map (`Map<String, String>`) can carry this as a `"scroll_outcome"` key. Possible values:

- `"moved"`: gesture was dispatched and leading-child signature changed
- `"edge_reached"`: gesture was dispatched but signature was unchanged (container at edge or non-scrollable content)
- `"gesture_failed"`: `dispatchSwipe` returned false (accessibility service rejected the gesture)

This is distinct from the action's `success` field:
- `success: false` should be reserved for hard errors: container not found, container not scrollable, gesture mechanically failed
- `"edge_reached"` should be `success: true` with `scroll_outcome: "edge_reached"` - the action ran correctly, the container was just already at its limit

---

## 12. Reuse Assessment

| Existing Component | Reuse for `scroll` |
|---|---|
| `TaskScrollDirection` enum | Direct reuse |
| `gestureSwipeWithin` (vertical + horizontal) | Direct reuse |
| `leadingChildSignature` | Reuse as before/after detector |
| `findFirstScrollable` | Reuse for container auto-detection |
| `findFirstScrollableDescendant` | Reuse for `findFirstScrollableChild` |
| `isScrollable` helper | Reuse |
| `NodeMatcher` system | Reuse for container targeting |
| `dispatchSwipe` extension | Reuse unchanged |
| `UiTreeManagerAndroid.swipeWithinVertical/Horizontal` | Reuse unchanged |
| `TaskRetryPresets.UiScroll` | Reuse as default retry |
| `AgentCommandParser.parseDirection` | Reuse |
| `AgentCommandParser.parseMatcherOrNull` | Reuse |

---

## 13. Gaps and Architectural Observations

**No `ACTION_SCROLL_FORWARD` / `ACTION_SCROLL_BACKWARD`**
The accessibility action API would be simpler and more semantically correct (the OS knows when an edge is reached), but:
- Not all containers implement it (WebViews, custom views, carousels often ignore it)
- It does not expose scroll distance control
- The codebase has deliberately chosen gesture injection for `scroll_and_click` and that choice should be consistent
- Recommendation: gesture injection as primary, no accessibility action fallback in v1

**No pixel-level distance control**
The `distanceRatio` parameter in `scrollUntil` is a ratio of container height/width (0.0-1.0). This is the existing approach and works well for proportional scrolling. There is no pixel-count or line-count scroll distance option. This is intentional and should remain the API surface for `scroll`.

**`leadingChildSignature` limitations**
- Returns `null` when container has no children - treat as `"edge_reached"` since there is nothing to scroll
- Children must have stable resourceId or id values for reliable comparison; apps that recycle all IDs (e.g., heavy virtualization) could give false `"moved"` readings. This is a known trade-off.
- Only compares the first 3 leading children - sufficient for detecting any shift in the list

**Post-scroll stabilization**
`scrollUntil` currently applies `settleDelay` (default 250ms) after each swipe, before re-checking. The standalone `scroll` action should apply the same settle delay before comparing signatures and returning.

**Nested scroll containers**
The `findFirstScrollableChild` flag handles the common case where a scrollable descendant exists inside a matched container. This should be available on `scroll` as well.

---

## 14. Recommendations

**Implementation approach**
Use gesture injection (`gestureSwipeWithin`) as the only scroll mechanism. This is consistent with `scroll_and_click` and works across all container types.

**Result semantics**
`"edge_reached"` must be `success: true`. From an agent loop perspective, scrolling to an edge is successful completion of the requested operation. An agent pattern like "scroll until edge_reached" requires this to be a non-error outcome to avoid false alarm retries.

**Distance parameter**
Keep `distanceRatio` as the sole distance parameter. It maps cleanly to the existing implementation and avoids the complexity of pixel/line count calculation (which would require reading DPI and text metrics). Default 0.7 is proven by `scroll_and_click` usage.

**Direction defaults**
Default direction should be `"down"` to match `scroll_and_click` convention.

**Post-scroll settle**
Apply a `settleDelayMs` (default 250ms) before reading the post-gesture signature. This is already the pattern in `scrollUntil` and prevents false "moved" readings due to OS animation frames.

**Relationship to `scroll_and_click`**
`scroll_and_click` should remain as-is in v1. It is a composite action with a different intent (find-and-click). In a future refactor, `scroll_and_click` could internally use `scroll` as a primitive, but that should be a separate change after `scroll` is proven stable.
