# Navigation Patterns for Agents

This page collects the practical operating patterns that help a cold-start
agent succeed on unknown Android screens.

Use it for:

- scrolling through unfamiliar layouts
- handling overlays and dialogs safely
- dealing with OEM-specific Settings differences
- minimizing wasted round trips

## Default loop for unknown apps

Use a tight observe-decide-act loop:

1. `snapshot_ui`
2. choose one action or one short action sequence
3. execute
4. `snapshot_ui` again
5. reassess before continuing

This is slower than long optimistic macros, but it is the safest default when
you have not yet learned the app's structure.

## Prefer explicit containers for scrolling

When a screen has more than one scrollable node, auto-detection can pick an
outer wrapper instead of the content list you really want.

Recommended pattern:

1. take a snapshot
2. identify the true content list by `resource-id`
3. pass that node as `params.container`

This is especially important for:

- Settings screens
- nested recycler views
- drawers and tabbed layouts
- OEM-modified system apps

## Treat targeted scrolls as "reveal, then verify"

Even with `TARGET_FOUND` support, a scrolling action should not be your final
source of truth about the whole screen state.

Good pattern:

1. `scroll_until` with explicit `container` and `target`
2. capture a fresh `snapshot_ui`
3. confirm the target is visible and still the intended node
4. click or read only after that confirmation when the workflow is sensitive

This matters because some Android layouts expose clipped descendants in raw XML
near the viewport edge.

## UI settle delay

After a `click` or `scroll_and_click`, the visible screen can update before the
accessibility hierarchy catches up. If you call `snapshot_ui` immediately, you
can get a successful snapshot from the previous screen.

Recommended delay:

- minimum: `500ms`
- slower or OEM-modified devices: `1000-1500ms`

Canonical pattern:

1. `click` or `scroll_and_click`
2. `sleep`
3. `snapshot_ui`

The runtime adds `data.warn` automatically on successful `snapshot_ui` steps
when it detects a preceding `click` or `scroll_and_click` without an
intervening `sleep` step.

## Use snapshot metadata as a hint, not a verdict

Successful snapshots may include:

- `foreground_package`
- `has_overlay`
- `overlay_package`
- `window_count`

Interpret them like this:

- `has_overlay: "true"` means another meaningful accessibility window was
  detected
- it does not guarantee the screen is blocked
- `window_count > 1` alone is normal on some Android builds

When overlay metadata appears, the safest next move is usually another
observation step rather than an immediate destructive action.

## Overlay and dialog handling

Unexpected dialogs are one of the biggest sources of agent confusion.

Recommended order of operations:

1. confirm whether the dialog is the current foreground problem
2. prefer an explicit dismiss action only if the button meaning is clear
3. avoid reflexively sending `press_key: back` unless you are willing to lose
   current navigation context
4. if the underlying content is still actionable and you know the correct
   scroll container, continue carefully with an explicit container selector

Good dialog selectors often use:

- `textEquals`
- `textContains`
- `contentDescEquals`

because many system dialogs have weak or missing `resource-id` values.

## OEM variation strategy

Assume system apps differ across vendors.

Examples:

- stock Android may place Android version directly in `About phone`
- Samsung may place it inside `Software information`

Recommended pattern:

1. identify the current package with `foreground_package` or snapshot XML
2. branch on visible labels, not assumptions about one vendor layout
3. keep selectors descriptive and local to the current screen
4. preserve fallback paths when a known OEM split exists

## Stable selector order

When choosing a selector for navigation, prefer:

1. `resourceId`
2. `contentDescEquals`
3. `textEquals`
4. `contentDescContains`
5. `textContains`

Use `role` as a semantic narrowing field, not the primary anchor, unless the
screen gives you no stronger handle.

## When to split across multiple executions

Split the workflow when:

- the next decision depends on newly revealed UI
- a dialog or overlay may appear
- the screen is known to re-layout heavily after clicks
- you are exploring a new app for the first time

Combine actions into one execution only when the path is already known and the
steps are tightly coupled.

## Quick recovery heuristics

If a step fails:

- `NODE_NOT_FOUND`: re-observe before changing selectors
- `CONTAINER_NOT_FOUND`: inspect the scrollable nodes and pass `container`
  explicitly
- `SNAPSHOT_EXTRACTION_FAILED`: retry snapshot briefly, then check
  compatibility and doctor output
- `EXECUTION_CONFLICT_IN_FLIGHT`: wait and serialize work per device

## Related docs

- [Agent Quickstart](agent-quickstart.md)
- [Action Types Reference](../reference/action-types.md) - Action params, result shapes, and examples
- [Clawperator Snapshot Format](../reference/snapshot-format.md)
- [Execution Model](../reference/execution-model.md)
- [Error Handling Guide](../reference/error-handling.md)
- [Operator Automation Playbook](../design/operator-llm-playbook.md)
