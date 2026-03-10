# Task: Agent UI Loop Documentation

## Goal

Document how an LLM agent can use Clawperator to drive arbitrary Android apps
without any pre-written skills. This is the foundational usage model for the
product - skills are additive convenience, not a prerequisite.

The expected use case is:

1. A user asks an agent: "turn on my living room AC" or "what's my battery level?"
2. No skill exists for that app yet.
3. The agent opens the app, inspects the UI tree, reasons about what to press,
   executes the action, re-observes to confirm, and returns the result.

This requires the agent to understand snapshot output format, how to construct
action payloads from that output, and how to run a reliable observe-decide-act
loop.

---

## Why this is a separate task

The `update-docs-for-emulator` branch covers device environment setup. This
task covers agent runtime behavior and output interpretation. They are
orthogonal. Mixing them would delay the emulator docs merge with no benefit.

---

## What already exists

These are documented and do not need to be rewritten:

- Execution payload structure and required fields (`node-api-for-agents.md`)
- Action types list: `open_app`, `close_app`, `sleep`, `wait_for_node`,
  `click`, `scroll_and_click`, `read_text`, `snapshot_ui` (`operator-llm-playbook.md`)
- Error codes (`node-api-for-agents.md`)
- Single-flight, no-hidden-retries, determinism guarantees (`node-api-for-agents.md`)
- Skills system (`node-api-for-agents.md`, skills docs)
- Post-navigation settle delay recommendation mentioned in playbook

---

## What is missing

The contracts exist in code but are not documented in any agent-facing doc:

### 1. Full NodeMatcher reference (`apps/node/src/contracts/selectors.ts`)

Six matcher fields are defined. Only `textEquals` appears in any current
example. The full set:

- `resourceId` - Android resource ID (e.g. `com.example.app:id/button_login`)
- `role` - Accessibility role/class name
- `textEquals` - Exact visible text match
- `textContains` - Partial visible text match
- `contentDescEquals` - Exact content description match (accessibility label)
- `contentDescContains` - Partial content description match

Agents need to know: which matcher to prefer, when to fall back, and how to
read the snapshot output to find values for each field.

### 2. Full ActionParams reference (`apps/node/src/contracts/execution.ts`)

Most params are undocumented. Relevant ones for skillless loop:

For `click`: `matcher`, `clickType` (default | long_click | focus)

For `type_text`: `matcher`, `text`, `submit` (submit keyboard), `clear`
(clear field before typing)

For `scroll_and_click`: `target` (NodeMatcher for element to click),
`container` (NodeMatcher for scrollable ancestor), `direction` (up/down/left/right),
`maxSwipes`, `distanceRatio`, `settleDelayMs`, `findFirstScrollableChild`

For `wait_for_node`: `matcher`, `durationMs`

For `snapshot_ui`: `format` (ascii | json) - default is ascii, json gives
structured tree

For `sleep`: `durationMs`

The `retry`, `scrollRetry`, `clickRetry` params exist but are advanced - note
their existence and defer to source until behavior is confirmed.

### 3. `snapshot_ui` / `observe snapshot` output format

This is the biggest gap. Agents need to know what the output actually looks like
to be able to use it for decision-making.

Two formats exist: `ascii` and `json`. Both need to be documented with real
example output, annotated to show what each field means.

Key questions to answer from source code and live testing:

- What fields does a JSON snapshot node have?
  (expected: nodeId/id, text, contentDescription, resourceId, className/role,
  bounds/rect, isClickable, isEnabled, isScrollable, children[])
- What does the ASCII tree look like? How are nodes indented? What attributes
  are shown inline?
- How does `snapshot_ui` within an execution differ from `clawperator observe
  snapshot` at the CLI? (CLI wraps an implicit execution; output shape should
  be identical but confirm)
- Where in the ResultEnvelope does the snapshot live?
  (`stepResults[n].data` for `snapshot_ui` action; `observe snapshot` stdout)
- Are node IDs stable across re-observations of the same screen? Across
  app restarts?

Source locations to check:
- Android app: UI tree serialization code
- `apps/node/src/` observe/snapshot command handler
- Any existing snapshot fixtures in test files

### 4. ResultEnvelope shape (`apps/node/src/contracts/result.ts`)

The contract is:

```ts
interface StepResult {
  id: string;
  actionType: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

interface ResultEnvelope {
  commandId: string;
  taskId: string;
  status: "success" | "failed";
  stepResults: StepResult[];
  error?: string | null;
}
```

Missing: documentation of what `data` contains per action type. Minimum
needed for the skillless loop:

- `snapshot_ui` - `data` contains the UI tree (ascii string or json object)
- `read_text` - `data` contains the extracted text string
- `click`, `open_app`, `close_app` - `data` is likely empty or minimal on
  success

This needs verification from source or live testing, then documentation.

### 5. The observe-decide-act loop pattern

No doc currently describes the complete interaction loop for ad-hoc app
automation. This is the core missing pattern.

What needs to be written:

a) The basic loop:
   1. `open_app` - launch the target app
   2. `snapshot_ui` (json format) - observe current state
   3. Agent inspects tree, identifies target element and its matcher
   4. Construct action (click, type_text, scroll_and_click) with that matcher
   5. Execute
   6. Re-observe to confirm expected state change
   7. Repeat until task complete or terminal error

b) When to pack multiple actions into one payload vs. observe between each step:
   - Use multi-action payloads for deterministic flows where the UI path is
     known (skills-style)
   - Use single-action + re-observe for exploratory flows where the agent does
     not know the next UI state in advance
   - Single-flight lock applies per payload: an agent doing a single action +
     observe loop will be slower but more adaptive

c) Settle delays - when the UI is in transition:
   - After `open_app`, wait for the app's launch animation to settle before
     observing (use `sleep` action or `wait_for_node` on a known stable element)
   - After navigation actions (taps that cause screen transitions), settle
     before the next snapshot
   - The playbook recommends 500-1500ms; document this with concrete examples

d) Handling `NODE_NOT_FOUND`:
   - The element the agent expected is not present
   - Agent should re-observe to understand current state (unexpected screen,
     popup, loading state)
   - Do not retry the same action - diagnose first

e) Using `screenshot` alongside snapshots:
   - ASCII/JSON tree gives structure but not visual context
   - Screenshots give visual context but cost more tokens (image input)
   - Recommended: use snapshot as primary; screenshot for disambiguation when
     tree alone is insufficient
   - Screenshot is not a substitute for snapshot when targeting elements -
     the tree is required for node selection

### 6. Selector priority guidance

Agents need to know which matcher field to prefer when multiple options are
available from the snapshot. Documented priority order should be:

1. `resourceId` - most stable, app-controlled, survives text localization
2. `contentDescEquals` - stable for icon buttons with no visible text
3. `textEquals` - stable for fixed labels, fragile for server-driven text
4. `textContains` - useful for dynamic content (partial match)
5. `contentDescContains` - fallback for partial accessibility labels
6. `role` - last resort, high ambiguity (many elements share the same role)

Note: resource IDs are only present when the app developer set them. Many
third-party apps have inconsistent or absent resource IDs - the agent must
fall back gracefully.

### 7. `type_text` action (currently undocumented as a named action)

The `text`, `submit`, and `clear` params in `ActionParams` suggest a text
input action. Needs verification: is the action type named `type_text` or
`type`? Check `apps/node/src/cli/commands/` and the Android action handler.

Once confirmed, document:
- How to target the input field (matcher)
- `text`: the string to type
- `submit`: whether to submit the keyboard (e.g. search, enter)
- `clear`: whether to clear the field contents before typing

---

## Deliverables

### New doc: `docs/agent-ui-loop.md`

The primary deliverable. Covers:

1. Overview - what skillless loop usage is and when to use it
2. The snapshot output format - JSON and ASCII, annotated example
3. NodeMatcher reference - all six fields, priority order, when to use each
4. ActionParams reference - relevant params per action type
5. ResultEnvelope - full shape, what `data` contains per action
6. The observe-decide-act loop - the complete interaction pattern with example
7. Multi-action payload vs. sequential observe loop - when to use each
8. Settle delays and timing - when and why
9. Error recovery - handling `NODE_NOT_FOUND`, unexpected screens, timeouts
10. Screenshot vs. snapshot - modality guide

### Updates to `docs/design/operator-llm-playbook.md`

- Expand the "Supported action types" section with param detail for each type
  (currently it is a bare list)
- Add `type_text` if it exists but is missing from the list
- Link to the new `agent-ui-loop.md` for the loop pattern

### Update to `docs/node-api-for-agents.md`

- Add a brief "Skillless usage" subsection or FAQ entry pointing to the new doc
- Expand the execution payload example to show `snapshot_ui` with `format: "json"`
- Add NodeMatcher and ActionParams detail or link to new doc

### `sites/docs/` updates

- Add `agent-ui-loop.md` to `source-map.yaml` under `ai-agents` section
- Add nav entry to `mkdocs.yml` under "For AI Agents"
- Regenerate `sites/docs/docs/` via the `clawperator-generate-docs` skill

---

## Pre-work required before writing

The snapshot output format cannot be documented accurately from source alone.
Before writing `agent-ui-loop.md`, the implementer should:

1. Provision an emulator or connect a physical device
2. Open a real app (e.g. `com.android.settings`)
3. Run `clawperator observe snapshot --output json` and capture real output
4. Run `clawperator observe snapshot` (ascii) and capture real output
5. Run a `snapshot_ui` action within an execution payload with `format: "json"`
   and inspect the raw `[Clawperator-Result]` envelope from logcat to confirm
   the `stepResults[].data` shape
6. Confirm the `type_text` action name and params by checking source or live
   testing a text input flow

This grounding ensures the doc reflects actual runtime behavior and not
assumptions about field names or shapes.

---

## Scope boundaries

Do NOT change in this task:

- CLI command reference (code-derived, separate maintenance path)
- Error code reference (code-derived)
- Any execution payload schema (contract changes require code changes first)
- Skills documentation (separate concern)
- Device setup documentation (covered by `update-docs-for-emulator`)

---

## Suggested branch name

`docs-agent-ui-loop`
