# GAP-01 Post-Implementation: Gaps and Improvement Notes

Audience: agents and the humans who build for them. Written after completing the standalone `scroll` action implementation.

---

## 1. Missing: `scroll_until` - bounded scroll loop action

**Gap:** Reaching the top or bottom of a scrollable list requires a polling loop in the agent - send one scroll, check `scroll_outcome`, repeat. For a pagination task this generates N round trips where N is list length / scroll step size.

**Impact on agents:** High latency on long lists. A 50-item Settings list on a slow device with 300ms settle delay can take 15+ seconds just to reach the bottom.

**Design constraint:** Many Android views have no reachable edge - social feeds, lazy-loaded lists, any `RecyclerView` backed by server pagination. The action cannot promise `EDGE_REACHED` as the terminal state. It must execute a bounded loop and report honestly why it stopped.

**Proposed action:** `scroll_until` - a convenience loop built on top of `scroll`. Scrolls repeatedly until a termination condition fires. Always applies caps; caps are not optional.

```json
{
  "id": "go-bottom",
  "type": "scroll_until",
  "params": {
    "direction": "down",
    "container": { "resourceId": "com.android.settings:id/recycler_view" },
    "maxScrolls": 25,
    "maxDurationMs": 10000,
    "settleDelayMs": 250
  }
}
```

Result:
```json
{
  "id": "go-bottom",
  "status": "completed",
  "data": {
    "scrolls_executed": 12,
    "termination_reason": "EDGE_REACHED",
    "position_changed": true
  }
}
```

**`termination_reason` values:**
- `EDGE_REACHED` - content ended naturally (finite list)
- `MAX_SCROLLS_REACHED` - hit `maxScrolls` cap (expected on infinite feeds)
- `MAX_DURATION_REACHED` - hit `maxDurationMs` cap
- `NO_POSITION_CHANGE` - repeated scrolls produced no movement (stalled/bounced)
- `CONTAINER_NOT_FOUND` - container resolution failed before any scroll
- `CONTAINER_NOT_SCROLLABLE` - resolved container is not scrollable

**Design rules:**
- `MAX_SCROLLS_REACHED` and `MAX_DURATION_REACHED` are clean terminal states, not errors.
- Defaults must always apply when not user-specified. Suggested: `maxScrolls: 20`, `maxDurationMs: 10000`.
- `EDGE_REACHED` reuses the `edge_reached` signal from the `scroll` primitive - no new heuristic needed.

**Extension - `until` param:** `scroll_until` can also cover Gap #4 (scroll-until-visible) via an optional `until` field, avoiding a separate action type:

```json
{
  "type": "scroll_until",
  "params": {
    "direction": "down",
    "until": "ELEMENT_VISIBLE",
    "target": { "textContains": "Privacy" },
    "maxScrolls": 20,
    "maxDurationMs": 8000
  }
}
```

Returns `termination_reason: "TARGET_FOUND"` when the element appears, or a cap reason if it never does.

---

## 2. Missing: scroll position metadata in step results and snapshots

**Gap:** `scroll` returns `scroll_outcome` and `direction` but no indication of where in the list the view currently sits. `snapshot_ui` has no scroll position field either. Agents can infer top/bottom from `edge_reached` but intermediate positions are opaque.

**Impact on agents:** If an agent interrupts a scroll loop and resumes later, it has no position reference and must scroll back to top and restart. Pagination of large lists is always O(2N) instead of O(N).

**Proposed fix:** Add optional `scroll_position_percent` to scroll step result data:
```json
{ "scroll_outcome": "moved", "scroll_position_percent": "42" }
```
This is best-effort - Android does not always expose exact scroll position - but the accessibility node's `scrollY` / `maxScrollY` fields are available on many views.

---

## 3. Missing: container identity in scroll step results

**Gap:** When `container` is omitted from a `scroll` action, the runtime auto-detects the first scrollable node. The step result does not report which container was selected.

**Impact on agents:** If the wrong list scrolled (e.g., a nested horizontal scroller was picked instead of the main vertical list), the result gives no signal. The agent cannot diagnose or correct without a follow-up `snapshot_ui`.

**Proposed fix:** Include the resolved container's `resourceId` (or role/bounds fallback) in the step result:
```json
{ "scroll_outcome": "moved", "resolved_container": "com.android.settings:id/list" }
```

---

## 4. Missing: scroll-until-visible without click

**Gap:** `scroll_and_click` scrolls until a node is visible, then clicks. There is no action that scrolls until a node is visible without clicking. `wait_for_node` polls for a node but does not scroll to reveal it.

**Impact on agents:** A common pattern is "scroll down until I see the Privacy section header, then read its content." Currently requires either using `scroll_and_click` on a dummy element (wrong semantic) or a scroll-snap-check loop (multiple round trips).

**Proposed fix:** Implement via `scroll_until` with `until: "ELEMENT_VISIBLE"` (see Gap #1 extension). If `scroll_until` ships without the `until` param in v1, the interim fix is a `clickAfter: false` option on `scroll_and_click` - lower risk and unblocks the use case immediately.

Termination caps are required either way. `TARGET_NOT_FOUND` is not an error code - it is a normal `termination_reason` that the agent handles.

---

## 5. API friction: `findFirstScrollableChild` is a leaky abstraction

**Gap:** Both `scroll` and `scroll_and_click` expose a `findFirstScrollableChild: boolean` flag. It exists because some containers (e.g., `RecyclerView` wrapped in a `FrameLayout`) are not themselves scrollable but have a scrollable first child. The flag tells the runtime to descend one level.

**Impact on agents:** Agents must know Android view hierarchy conventions to use this correctly. It is an implementation detail of the accessibility tree, not a user-intent concept.

**Proposed fix:** Make `findFirstScrollableChild: true` the default, or change auto-detection to always walk one level down when the container itself is not scrollable. The current `false` default causes silent failures on common layouts.

If the flag must stay explicit, add a concrete recovery hint to the `CONTAINER_NOT_SCROLLABLE` error: "try adding `findFirstScrollableChild: true`".

---

## 6. Documentation gap: direction semantics need a one-liner at the top

**Gap:** The direction semantics ("down" = reveal content further down, finger swipes up) are documented in the behavior note but buried below the params table. Agents that scan the params table first will guess wrong.

**Proposed fix:** Add inline to the params table row:
```
direction: "down" = reveal more content below (swipe finger up). Default: "down".
```

---

## 7. Documentation gap: no canonical pagination recipe

**Gap:** The `scroll` behavior note shows a 3-step observe-scroll-observe pattern but the full pagination loop (scroll to bottom collecting content, scroll back to top) has no canonical recipe.

**Impact on agents:** Every agent that needs to enumerate a list will independently rediscover the loop and likely make mistakes - no step cap, no `edge_reached` terminal check, unnecessary re-scrolling.

**Proposed fix:** Add a "Pagination Recipe" section to the docs. Show the manual loop as the v1 pattern. Update to reference `scroll_until` once Gap #1 is implemented. The manual loop example must include a `maxScrolls` guard - any agent-side scroll loop without a step cap is fragile on infinite feeds.

---

## 8. Implementation gap: `scroll` retry defaults to `TaskRetry.None`

**Gap:** All other UI actions default to `TaskRetryPresets.UiReadiness` (3 attempts, exponential backoff). `scroll` defaults to `TaskRetry.None`.

**Impact on agents:** An agent relying on standard retry resilience may get `CONTAINER_NOT_FOUND` on the first attempt if the view hasn't fully loaded, with no automatic retry.

**Proposed fix:** Keep `TaskRetry.None` as default but document it explicitly in the params table. Alternatively, default to a single retry with a short delay (`maxAttempts: 2, initialDelayMs: 500`) to handle transient loading states.

---

## 9. Implementation gap: `settle_delay_ms` absent from step result data

**Gap:** The `scroll` step result reports `direction` and `distance_ratio` but not `settle_delay_ms`. Agents tuning settle delay for different list types cannot verify what was applied from the result alone.

**Proposed fix:** Add `settle_delay_ms` to the step result `data` map.

---

## 10. Nice-to-have: `ScrollOutcome` type in Node API contracts

**Gap:** `scroll_outcome` values (`"moved"`, `"edge_reached"`, `"gesture_failed"`) are documented in markdown but not expressed as a TypeScript type. Agents using TypeScript wrappers have no type safety on these strings.

**Proposed fix:** Export a `ScrollOutcome` type from `apps/node/src/contracts/`:
```typescript
export type ScrollOutcome = "moved" | "edge_reached" | "gesture_failed";
```
Include it in the result typing for scroll step data.
