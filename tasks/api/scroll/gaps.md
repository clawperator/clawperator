# GAP-01 Post-Implementation: Gaps and Improvement Notes

Audience: agents and the humans who build for them. Written after completing the standalone `scroll` action implementation.

---

## 1. Missing: bounded scroll loop action (NOT `scroll_to_edge`)

**Gap:** Reaching the top or bottom of a scrollable list currently requires a polling loop - send one scroll, check `scroll_outcome`, repeat. For a pagination task that's a fundamental workflow, this generates N round trips where N is the length of the list / scroll step size.

**Impact on agents:** High latency tasks with long lists. A 50-item Settings list on a slow device with 300ms settle delay can take 15+ seconds just to reach the bottom.

**Why `scroll_to_edge` is the wrong name:**

The originally suggested name `scroll_to_edge` is semantically incorrect and should not be used. Many real-world Android views do not have a reachable edge:

- Social feeds (Instagram, Play Store recommendations)
- Lazy-loaded lists with server pagination
- Any `RecyclerView` backed by infinite data

For these, "scroll to the edge" is either impossible or means "scroll until we give up." An API named `scroll_to_edge` implies a contract the runtime cannot guarantee. The name would mislead agents into assuming `EDGE_REACHED` is always the success terminal, when it is in fact only sometimes the terminal.

**The right framing:** This is a *bounded scroll loop* - it scrolls repeatedly until some termination condition fires, and it honestly reports *which condition* stopped it. The edge is one possible termination reason, not the guaranteed outcome.

**Proposed name:** `scroll_until`

This name was chosen over `scroll_loop` and `scroll_max` for reasons specific to this API:

- It pairs with `wait_for_node` - both are condition-based polling actions. Agents already understand "keep doing X until a condition fires" from `wait_for_node`; `scroll_until` arrives pre-explained.
- It enables unification with Gap #4 (`scroll_until_visible`) through an optional `until` param (see below), reducing total API surface.
- `scroll_max` implies hitting the cap is the primary outcome. For finite lists (Settings, preferences screens), the agent wants `EDGE_REACHED`. `scroll_max` anchors the wrong termination reason.
- `scroll_loop` describes a runtime mechanism, not an agent intent. Other action names (`tap`, `scroll`, `type`, `wait_for_node`) describe what the agent is asking for, not how the runtime implements it.

**Basic contract (bounded loop, no target):**

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
- `MAX_SCROLLS_REACHED` - hit `maxScrolls` cap (normal for infinite feeds)
- `MAX_DURATION_REACHED` - hit `maxDurationMs` cap
- `NO_POSITION_CHANGE` - repeated scrolls produced no movement (stalled/bounced)
- `CONTAINER_NOT_FOUND` - container resolution failed before any scroll
- `CONTAINER_NOT_SCROLLABLE` - resolved container is not scrollable

**Key design rules:**
- `MAX_SCROLLS_REACHED` and `MAX_DURATION_REACHED` are not errors - they are clean terminal states. Agents writing to paginate an infinite feed expect them.
- Defaults must always be applied even when not user-specified. Suggested defaults: `maxScrolls: 20`, `maxDurationMs: 10000`. A scroll loop with no bound is unsafe.
- `EDGE_REACHED` should reuse `edge_reached` from the existing `scroll` primitive as its detection signal - no new edge heuristic needed.

**Unification with Gap #4 via `until` param (future extension):**

`scroll_until` can absorb `scroll_until_visible` (Gap #4) without a separate action type. An optional `until` field selects the primary early-exit condition:

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

This gives `termination_reason: "TARGET_FOUND"` when successful, and falls back to cap-based termination if the element is never found. One action type covers both use cases.

**Relationship to `scroll` primitive:** `scroll_until` is a convenience loop built entirely on top of `scroll`. It is a higher-level action, not a replacement.

---

## 2. Missing: scroll position metadata in step results and snapshots

**Gap:** `scroll` returns `scroll_outcome` and `direction` but no indication of *where* in the list the current view is. `snapshot_ui` also has no scroll position field. Agents can infer "I'm at the bottom" from `edge_reached` and "I'm at the top" from the upward `edge_reached`, but intermediate positions are opaque.

**Impact on agents:** If an agent interrupts a scroll loop and needs to resume, it has no way to know how much of the list it has already seen. It must scroll back to top and restart. Pagination of large lists is always O(2N) instead of O(N).

**Proposed fix:** Add optional `scrollPosition` to scroll step result data:
```json
{ "scroll_outcome": "moved", "scroll_position_percent": "42" }
```
This is best-effort (Android does not always expose exact scroll position) but the accessibility node's `scrollY` / `maxScrollY` fields are available on many views.

---

## 3. Missing: container identity in scroll step results

**Gap:** When `container` is omitted from a `scroll` action, the runtime auto-detects the first scrollable node. The step result does not report which container was selected (no `resource_id` or descriptor in `data`).

**Impact on agents:** If an agent sends a scroll without specifying a container and gets an unexpected result (wrong list scrolled, e.g., a nested horizontal scroll was selected instead of the main vertical list), there is no signal in the result. The agent has no way to diagnose or correct without a follow-up `snapshot_ui`.

**Proposed fix:** Include the resolved container's `resourceId` (or role/bounds fallback) in the step result:
```json
{ "scroll_outcome": "moved", "resolved_container": "com.android.settings:id/list" }
```

---

## 4. Missing: `wait_for_node` + scroll combination (scroll-until-visible without click)

**Gap:** `scroll_and_click` scrolls until a node is visible, then clicks. There is no action that scrolls until a node is visible *without* clicking. `wait_for_node` polls for a node to appear but does not scroll to reveal it.

**Impact on agents:** A common pattern is "scroll down until I see the Privacy section header, then read its content." Currently requires either: (a) using `scroll_and_click` on a dummy element (wrong semantic, confusing), or (b) scroll-snap-check loop (multiple round trips).

**Proposed fix:** If `scroll_until` (Gap #1) is implemented with the `until` param extension, this gap is resolved without a separate action type:

```json
{
  "id": "find",
  "type": "scroll_until",
  "params": {
    "until": "ELEMENT_VISIBLE",
    "target": { "textContains": "Privacy" },
    "direction": "down",
    "maxScrolls": 20,
    "maxDurationMs": 8000
  }
}
```

If `scroll_until` is shipped without the `until` param in v1, the interim fix is a `clickAfter: false` option on the existing `scroll_and_click` action. This is lower-risk than a new action type and unblocks the use case immediately.

**Termination policy note:** Whether implemented as `scroll_until` with `until: "ELEMENT_VISIBLE"` or as a standalone action, termination caps are required. If the target does not exist on a finite list, `EDGE_REACHED` terminates cleanly. If the target does not exist on an infinite feed, `MAX_SCROLLS_REACHED` or `MAX_DURATION_REACHED` terminates cleanly. `TARGET_NOT_FOUND` should not be an error code - it is a normal `termination_reason` that the agent handles.

---

## 5. API friction: `findFirstScrollableChild` is a leaky abstraction

**Gap:** Both `scroll` and `scroll_and_click` expose a `findFirstScrollableChild: boolean` flag. This exists because some containers (e.g., `RecyclerView` wrapped in a `FrameLayout`) are not themselves scrollable but have a scrollable first child. The flag tells the runtime to descend one level.

**Impact on agents:** Agents must know about Android view hierarchy conventions to use this correctly. It's an implementation detail of Android's accessibility tree, not a user-intent concept.

**Proposed fix:** Make `findFirstScrollableChild: true` the default (or change the auto-detection to always walk one level down when the container itself isn't scrollable). The current `false` default means agents get silent failures on common layouts.

If the flag needs to stay explicit, improve the error message: `CONTAINER_NOT_SCROLLABLE` currently says "not scrollable and `findFirstScrollableChild` is false" but should say "try adding `findFirstScrollableChild: true`" as a concrete recovery hint in the `hint` field of the error.

---

## 6. Documentation gap: direction semantics need a one-liner at the top

**Gap:** The direction semantics ("down" means reveal content further down, finger swipes up) are documented in the behavior note for `scroll` but buried below the params table. Agents that scan the params table first will guess wrong.

**Proposed fix:** Add to the params table row:
```
direction: "down" = reveal more content below (swipe finger up). Default: "down".
```

---

## 7. Documentation gap: pagination loop pattern is example code, not a recipe

**Gap:** The `scroll` behavior note shows a 3-step observe-scroll-observe pattern. But the full pagination loop (scroll until edge, collect all content, scroll back) is a very common task and has no canonical recipe.

**Impact on agents:** Every agent that needs to enumerate a list will independently rediscover the loop pattern and likely make mistakes (no max-steps guard, no `edge_reached` check, unnecessary re-scrolling).

**Proposed fix:** Add a "Pagination Recipe" section to the docs with a full pseudo-code loop showing the correct terminal condition and a note on `scroll_until` once Gap #1 is implemented. The recipe should also show the manual loop as the v1 pattern so agents have something to follow before the convenience action exists. Critically, the recipe must include a `maxScrolls` guard even in the manual loop - any agent-side loop without a step cap is fragile on infinite feeds.

---

## 8. Implementation note: `retry` on `scroll` defaults to `TaskRetry.None`

**Gap:** All UI actions default to `TaskRetryPresets.UiReadiness` (3 attempts, exponential backoff). `scroll` defaults to `TaskRetry.None`. This is correct - retrying a scroll that returned `edge_reached` would be wasteful - but it creates an inconsistency that agents may notice if they inspect retry behavior.

**Impact on agents:** An agent that sends a `scroll` expecting the same retry resilience as `click` may get `CONTAINER_NOT_FOUND` on the first attempt if the view hasn't loaded yet, and it won't automatically retry.

**Proposed fix:** Keep `TaskRetry.None` as the default but document it explicitly in the params table. Or: default to a single retry with a short delay (e.g., `maxAttempts: 2, initialDelayMs: 500`) so transient loading states are handled.

---

## 9. Implementation note: `settle_delay_ms` is not in the step result data

**Gap:** The `scroll` step result reports `direction` and `distance_ratio` but not `settle_delay_ms`. Agents that tune settle delay for different list types can't verify what was applied from the result alone.

**Minor fix:** Add `settle_delay_ms` to the step result `data` map for full observability.

---

## 10. Nice-to-have: `scroll_outcome` enum in the Node API contracts

**Gap:** `scroll_outcome` values (`"moved"`, `"edge_reached"`, `"gesture_failed"`) are documented in markdown but not expressed as a TypeScript type in the contracts layer. Agents using TypeScript wrappers can't get type safety on these strings.

**Proposed fix:** Export a `ScrollOutcome` type from `apps/node/src/contracts/`:
```typescript
export type ScrollOutcome = "moved" | "edge_reached" | "gesture_failed";
```
And include it in the result typing for scroll step data.
