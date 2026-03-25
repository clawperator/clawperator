# Clawperator Timeout Budgeting

Clawperator validates `execution.timeoutMs` in the range `1000` to `120000`
milliseconds.

That timeout is an execution-wide wall-clock budget, not a per-step budget.
Every action in the payload consumes from the same clock:

- app launches
- scroll loops
- retries
- sleeps
- snapshots
- result-envelope delivery

Use this page to choose a realistic timeout before you start guessing upward by
trial and error.

## Core rules

1. Budget for the whole sequence, not the slowest single action.
2. Keep one execution focused on one short navigation goal.
3. Split very long workflows into multiple executions instead of pinning
   everything to `120000`.
4. If a flow is device-sensitive or OEM-sensitive, leave extra headroom.
5. Prefer `wait_for_node` over large fixed `sleep` values when the UI can
   become ready early.

## Recommended starting budgets

These are practical starting points, not guarantees.

| Workflow shape | Suggested `timeoutMs` |
|---|---:|
| Single `snapshot_ui` or `snapshot` | `10000`-`15000` |
| `open_app` + brief settle + snapshot | `15000`-`25000` |
| One click or text-entry step plus verification snapshot | `15000`-`30000` |
| Short deterministic sequence in one screen | `20000`-`30000` |
| Targeted `scroll_until` in a known finite list | `30000`-`60000` |
| Multi-screen navigation with one or two long scroll loops | `60000`-`90000` |
| Complex skill flow on a slower physical device | `90000`-`120000` |

## Action-specific guidance

### `snapshot_ui`

Start with `10000` to `15000` ms for a plain observation pass.

If the app is in motion, on first launch, or opening a heavy screen, treat the
snapshot as part of a larger flow and budget that larger flow instead of only
the snapshot step.

### `open_app`

For a warm app launch, `15000` ms is usually enough.

If this is the app's first launch after install, after force-stop, or after a
permission change, prefer `20000` to `30000` ms and follow it with a snapshot.

### `click`, `enter_text`, `press_key`, `read_text`

For a single interaction in an already-settled screen, `15000` to `30000` ms
is usually sufficient when paired with a verification snapshot.

If the action is expected to trigger navigation, loading, or a dialog, budget
the post-click transition too.

### `scroll`

A single bounded scroll usually fits comfortably inside `15000` to `30000` ms.

If you are chaining several `scroll` actions in one execution, add time for
each gesture and settle period rather than assuming one default budget still
holds.

### `scroll_until`

This is usually the action that dominates the execution budget.

Good starting points:

- `30000` to `45000` ms for a short known list
- `45000` to `90000` ms for Settings-style navigation or OEM-heavy screens
- `90000` to `120000` ms only when a skill really needs one long bounded pass

Practical budgeting rule:

`scroll_until` often needs about 2 to 3 seconds per scroll on a real device
once gesture time, settling, and matching are included. For example:

- `maxScrolls: 10` -> start around `30000` to `40000`
- `maxScrolls: 20` -> start around `50000` to `70000`
- `maxScrolls: 30` -> consider splitting the workflow unless you truly need one
  long execution

Also budget for the rest of the payload:

- `open_app`
- any pre-scroll click
- any post-scroll click
- any verification snapshot

### `sleep`

Use `sleep` sparingly. It spends budget without learning anything.

If you need a deliberate pause, keep it short and explicit. Large fixed sleeps
are usually a sign that `wait_for_node` or an extra snapshot would produce a
more reliable flow.

### `wait_for_node`

Prefer this over long sleeps when the screen may become ready earlier than the
worst case.

Still remember that all waiting happens inside the same outer `timeoutMs`
budget.

## How to size one execution

If you are unsure, estimate from the slowest likely path:

1. Start with the known expensive action, usually `scroll_until`.
2. Add launch or transition time before it.
3. Add one verification snapshot after it.
4. Add a small buffer for retries or slower device response.

Example:

- `open_app` + settle: ~10s
- `scroll_until` with `maxScrolls: 12`: ~25s to 35s
- verification snapshot: ~5s
- buffer: ~10s

Suggested `timeoutMs`: `60000`

## When to split the workflow

Split into multiple executions when:

- the flow is likely to exceed `90000` ms
- you are crossing several screens with branching logic
- you need to inspect the UI after a major navigation step anyway
- a timeout would otherwise discard too much progress at once

This usually matches the recommended agent loop better:

1. observe
2. decide
3. execute one short sequence
4. inspect the result
5. continue

## Timeout failure semantics

When the execution-wide budget expires, Clawperator returns an execution error.
Treat that as "the whole bounded command exceeded its wall-clock budget", not
"the last action alone was invalid."

Recommended agent response:

1. inspect any returned partial step results
2. decide whether the flow was genuinely too long or merely under-budgeted
3. retry with a larger `timeoutMs` only if the same bounded workflow still
   makes sense
4. otherwise split the workflow into smaller executions

For skill wrappers that use `execFileSync`, keep the wrapper timeout at or
above the Clawperator execution timeout so the wrapper does not abort before
structured output can be captured.

See also:

- [Execution Model](execution-model.md)
- [Clawperator Node API - Agent Guide](../ai-agents/node-api-for-agents.md)
- [Skill Authoring Guidelines](../skills/skill-authoring-guidelines.md)
