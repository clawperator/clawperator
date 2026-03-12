# Scroll Follow-up TODO

This file keeps the durable follow-up items that should survive deletion of the current `tasks/api/scroll/` working notes at merge time.

These are not part of the current branch scope unless explicitly picked up in separate work.

## 1. Improve container auto-detection heuristics on nested-scroll layouts

### Problem

When `scroll` or `scroll_until` is called without an explicit `container`, the runtime currently picks the first visible `scrollable="true"` node.

That is unreliable on nested-scroll screens. On real device verification, Samsung Settings exposed an outer `ScrollView` before the actual content list `RecyclerView`, which means the runtime can scroll the wrong surface while still returning a plausible success result.

### Why it matters

- Agents can get misleading `scroll_outcome` / `termination_reason` values while operating on the wrong container.
- Smoke tests can produce false confidence if they only prove that some scrollable node moved.
- The current public docs already warn agents to prefer explicit `container.resourceId` matchers on complex screens, but the runtime behavior is still weak.

### Desired outcome

Improve automatic container resolution so it is more likely to select the intended content list rather than an outer wrapper.

### Candidate directions

- Prefer deeper nested scrollables over outer wrappers when both are visible.
- Prefer common content-list classes such as `RecyclerView` over generic `ScrollView` wrappers when both qualify.
- Consider filtering out broad layout containers whose bounds largely subsume a more specific scrollable descendant.
- Return stronger observability so agents can always see which container was auto-selected.
- Add targeted runtime tests for nested-scroll layouts.
- Add a smoke scenario that proves the intended container, not just any scrollable node.

### Guardrails

- Do not silently introduce app-specific heuristics in the core runtime.
- Keep behavior deterministic and explainable.
- Any heuristic change must be reflected in agent docs if it changes caller expectations.

## 2. Distinguish mid-loop container loss from true edge exhaustion

### Problem

`scroll_until` currently maps mid-loop container disappearance to `EDGE_REACHED`.

If the app navigates away, rebuilds the tree, swaps fragments, or otherwise loses the resolved container during the loop, the runtime can report a clean terminal reason that looks identical to "the list naturally ended."

### Why it matters

- Agents can incorrectly conclude a list is exhausted when the UI actually drifted.
- This collapses a real runtime state change into a misleading success condition.
- The public API docs already include a caveat advising agents to follow `scroll_until` with `snapshot_ui` or `wait_for_node` in risky flows, but the runtime contract should ideally become more precise.

### Desired outcome

Introduce a distinct termination reason for container disappearance, for example `CONTAINER_LOST`, and propagate it consistently through:

- Android runtime result mapping
- Node contracts / TypeScript types
- validation and docs
- tests and smoke coverage

### Candidate directions

- Differentiate between:
  - container not found before the loop starts
  - container not scrollable before the loop starts
  - container lost after one or more successful scroll attempts
- Decide whether `CONTAINER_LOST` should be:
  - `success: false`, because the intended scroll target no longer exists
  - or a separate non-success terminal state with a strong warning contract
- Add regression tests covering navigation-away and tree-rebuild scenarios.

### Guardrails

- Do not overload `EDGE_REACHED` for state-loss conditions once a better signal exists.
- Keep result semantics easy for agents to branch on.
