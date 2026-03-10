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

## User-facing product framing

The capability described in this doc should be called **"zero-shot automation"** in all
user-facing copy. This is the established term from the AI/ML space for performing a
task with no prior examples or pre-written scripts, and it is increasingly legible to a
general AI-curious audience.

The product has two distinct modes that must be differentiated clearly in copy and
documentation:

**Explore mode** (zero-shot automation):
The agent encounters an app it has never automated before. It inspects the live UI tree,
reasons about what to press, executes actions, re-observes, and completes the task -
all without any pre-written skill. No setup. No script. Works on any app the user has
installed and signed into on their device.

**Skill mode** (known-flow execution):
The agent uses a pre-built skill - either from the shared skills library or from a
skill the agent itself synthesized during a prior explore-mode session. The flow is
known in advance. Multi-action payloads can be used. Execution is faster and more
reliable because the UI path has been validated before.

Copy should highlight that skills built during explore mode are **private and
user-specific**: they encode that user's app version, account state, regional UI
variant, and personal navigation path. They are not generic scripts. This distinction
matters both for the value proposition (the skill is yours, tuned to your device and
your apps) and for setting correct expectations (a skill built on one account may not
work identically on another).

The transition from explore mode to skill mode - where the agent packages its
explore-mode observations into a reusable skill - is a key product moment. The doc
should make this path legible even if it does not fully describe skill authoring (that
is covered elsewhere).

---

## Why this is a separate task

The `update-docs-for-emulator` branch covers device environment setup. This
task covers agent runtime behavior and output interpretation. They are
orthogonal. Mixing them would delay the emulator docs merge.

The related task `tasks/fix-documentation-gaps/plan.md` covers reference
accuracy - making sure documented contracts match the code. This task covers
the usage pattern that builds on top of those contracts. Both should be done,
but this task depends on `fix-documentation-gaps` being complete first, or at
minimum on the snapshot format and action type names being confirmed from source.

---

## What already exists

These are documented and do not need to be rewritten:

- Execution payload structure and required fields (`node-api-for-agents.md`)
- Action types list in playbook (incomplete and has errors - see `fix-documentation-gaps`)
- Error codes (`node-api-for-agents.md`)
- Single-flight, no-hidden-retries, determinism guarantees (`node-api-for-agents.md`)
- Skills system (`node-api-for-agents.md`, skills docs)
- Post-navigation settle delay recommendation mentioned in playbook

---

## Prerequisites

This doc depends on `tasks/fix-documentation-gaps/` being complete, or at minimum on
the following gaps from that task being closed:

- **Gap 9** (snapshot output format): annotated ASCII and JSON examples with confirmed
  field names. The snapshot section of this doc is built directly from those examples.
- **Gap 1** (`enter_text` action type): confirmed name and full params.
- **Gap 3** (action params per type): all confirmed params per action type.
- **Gap 5** (ResultEnvelope `data` shapes): confirmed per-action `data` contents.

The format capture and contract verification work belongs in `fix-documentation-gaps`.
Do not re-do it here. Pick up the outputs from that task.

### Architectural note: ASCII-only CLI, JSON via execute payload

Confirmed from source (`apps/node/src/domain/observe/snapshot.ts`):
`clawperator observe snapshot` (CLI) is hardcoded to `format: "ascii"`. The format
parameter is not exposed at the CLI level.

- **JSON format is only available via the raw execute API** - `snapshot_ui` action
  with `params: { format: "json" }` in a full execute payload.
- **`clawperator observe snapshot` always returns ASCII.** There is no `--format json`
  flag.

This split is the structural foundation of the snapshot section in this doc. It must
appear early, before any snapshot examples.

---

## What is missing

### 1. The observe-decide-act loop pattern

No doc currently describes the complete interaction pattern for ad-hoc app
automation. This is the core thing this doc exists to provide.

The basic loop:

1. `open_app` - launch the target app
2. `sleep` 1000ms or `wait_for_node` on a stable element - let the app settle
3. `observe snapshot` or `snapshot_ui` (json) - read current UI state
4. Agent inspects tree, identifies the target element, reads its matcher fields
5. Construct an action payload (click, enter_text, scroll_and_click) targeting
   that element by its most stable matcher
6. Execute and read `stepResults[].success`
7. Re-observe to confirm expected state change
8. Repeat until task complete or terminal error

### 2. Multi-action payload vs. sequential observe loop

**This is the most conceptually important decision an agent must make, and it
is completely absent from current docs.**

Getting this wrong in either direction causes real problems:

- **Too many actions in one payload**: if any intermediate step hits an
  unexpected screen (popup, login prompt, A/B test variant, first-run flow,
  network error state), the whole payload fails. The agent receives the failure
  error code but has no visibility into what the UI looked like at the point of
  failure. The agent is now blind and must re-observe from scratch.
- **One action at a time, always**: correct but unnecessarily slow for
  confirmed-deterministic flows where the UI path is already known.

The doc must give a concrete decision framework:

**Use a multi-action payload when:**
- The full UI path is known in advance and has been validated (skill-level
  knowledge of that app's flow)
- All steps are strictly sequential with no conditional branching
- Intermediate states are irreversible regardless (e.g., form submission)
- The agent can tolerate reduced diagnostic visibility for speed

**Use single-action + re-observe when (default for skillless usage):**
- Exploring an app for the first time - the agent does not know what UI state
  each action will produce
- Any step could land on an unexpected screen
- The agent needs to extract data from an intermediate state before acting again
- Recovery from failure is more important than execution speed
- Any step depends on conditions visible only after the previous step completes

**The rule**: for skillless, exploratory usage the default must always be
single-action + re-observe. Multi-action payloads are an optimization that
requires prior knowledge of the UI flow, not a starting point.

This must be a first-class section with concrete examples - not a footnote.

### 3. Snapshot output format - ASCII and JSON

The annotated ASCII and JSON examples for this section come from
`tasks/fix-documentation-gaps/` Gap 9. Do not capture or document the raw format here.

This section of the doc must cover:

- The two access paths (CLI = ASCII only, execute payload = ASCII or JSON) - see
  architectural note in the Prerequisites section above
- How to read the ASCII tree to identify elements and extract matcher field values
- How to traverse the JSON tree programmatically to find target nodes
- When to use ASCII vs JSON vs screenshot (modality decision guide)

### 4. Full NodeMatcher reference

Six matcher fields in source (`apps/node/src/contracts/selectors.ts`).
Only `textEquals` appears in current docs. All six with priority guidance:

1. `resourceId` - most stable. Format: `"com.example.app:id/element_name"`.
   Only present when the app developer set it - absent in many third-party apps.
2. `contentDescEquals` - stable for icon buttons with no visible text. Read
   from the `contentDescription` field in JSON snapshot output.
3. `textEquals` - stable for fixed UI labels. Fragile for server-driven,
   localized, or dynamically formatted text.
4. `textContains` - useful for dynamic or truncated text where a stable
   substring exists.
5. `contentDescContains` - fallback for partial accessibility labels.
6. `role` - last resort. Many elements share the same role. Only useful as
   a secondary constraint combined with another field.

Matchers are combined with AND semantics: all specified fields must match.
This should be documented with an example (e.g., targeting by both `resourceId`
and `textEquals` for disambiguation when multiple elements share a resource ID).

### 5. Action type names and params - confirmed from source

The playbook lists action types but is incomplete and has at least one omission.
Confirmed from `apps/node/src/domain/actions/`:

- `open_app` - `params.applicationId` (string)
- `close_app` - needs verification from Android code
- `click` - `params.matcher` (NodeMatcher), `params.clickType` ("default" | "long_click" | "focus")
- `enter_text` - **this is the correct action type name** (NOT `type_text`).
  Confirmed in `typeText.ts`. Not listed in the playbook at all.
  Params: `matcher` (NodeMatcher), `text` (string), `submit` (boolean, default false),
  `clear` (boolean, default false)
- `read_text` - `params.matcher` (NodeMatcher). Confirmed.
- `wait_for_node` - `params.matcher` (NodeMatcher), `params.durationMs`. Confirmed.
- `snapshot_ui` - `params.format` ("ascii" | "json", default "ascii"). Confirmed.
- `sleep` - `params.durationMs`. Needs verification.
- `scroll_and_click` - `target` (NodeMatcher), `container` (NodeMatcher),
  `direction`, `maxSwipes`, `distanceRatio`, `settleDelayMs`,
  `findFirstScrollableChild`. Needs full verification from Android code.

`enter_text` being absent from the playbook is the most significant accuracy
gap. It must be confirmed and documented before the loop doc can be written.

### 6. ResultEnvelope and per-action data shapes

From `apps/node/src/contracts/result.ts`:

```json
{
  "commandId": "...",
  "taskId": "...",
  "status": "success",
  "stepResults": [
    {
      "id": "snap",
      "actionType": "snapshot_ui",
      "success": true,
      "data": { ... },
      "error": null
    }
  ],
  "error": null
}
```

The `data` field contents per action type must be confirmed from live device
output before documenting. Expected (unconfirmed):
- `snapshot_ui`: UI tree (string for ascii, object for json)
- `read_text`: extracted text value
- `click`, `enter_text`, `open_app`: minimal or empty on success
- Any failed step: `error` contains the error code string

### 7. Settle delays and timing

After `open_app`, Android UI transitions are asynchronous - the Activity must
load and render. After a tap that navigates, the destination screen must settle.
A snapshot taken before the UI settles captures a transitional state.

Must document:
- `sleep` - fixed delay. Simple but fragile. Use as a last resort.
- `wait_for_node` - waits for a specific element to appear. More reliable
  because it succeeds as soon as the element is present rather than waiting
  a fixed duration.
- Typical values for `sleep`: 500ms for minor transitions, 1000-1500ms for
  full-screen navigations and app launches.
- The playbook's 500-1500ms recommendation applies here. Expand it with examples.

### 8. Error recovery patterns

What each error means in an explore loop context, and what the agent should do:

- `NODE_NOT_FOUND`: expected element not present. Do not retry the same action.
  Re-observe first - the UI may be on a completely different screen.
- `RESULT_ENVELOPE_TIMEOUT`: accessibility service may have been disabled or
  app crashed. Run `doctor` to diagnose.
- `EXECUTION_CONFLICT_IN_FLIGHT`: another execution is active. Wait and retry.
- `NODE_NOT_CLICKABLE`: element found but not interactable. May need to scroll
  it into view first, or the element may require a different interaction type.
- `SECURITY_BLOCK_DETECTED`: Android blocked the action. Cannot be worked
  around without changing the approach (e.g., secure keyboard blocks typing).

### 9. Screenshot vs. snapshot modality

- **ASCII snapshot**: default path. Low context cost. Use for all targeting.
- **JSON snapshot**: structured tree. More useful for agent reasoning. Only
  available via execute payload.
- **Screenshot** (`observe screenshot` or `POST /observe/screenshot`): visual
  context. Higher token cost (image input). Use for disambiguation when the
  tree alone is insufficient to understand the current screen state. Cannot
  substitute the tree for element targeting.

Concrete guidance: the agent should start with ASCII snapshot. Use JSON when
building reusable automation that needs to traverse the tree programmatically.
Use screenshot when the ASCII tree is ambiguous (e.g., multiple elements with
the same text, or the agent needs to understand spatial layout).

### 10. The two snapshot access paths

This must appear early in the doc, before any snapshot examples:

**Path A - CLI shortcut (ASCII only):**
```bash
clawperator observe snapshot --device-id <serial>
```

**Path B - Execute payload (ASCII or JSON):**
```json
{
  "commandId": "snap-001",
  "taskId": "snap-001",
  "source": "my-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "snap", "type": "snapshot_ui", "params": { "format": "json" } }
  ]
}
```

---

## Deliverables

### New doc: `docs/agent-ui-loop.md`

Section outline:

1. Overview - skillless usage model and when to use it vs. skills
2. The two snapshot access paths - ASCII via CLI, JSON via execute payload
3. The observe-decide-act loop - complete pattern with worked example
4. Multi-action payload vs. sequential observe loop - decision framework
   (must be a standalone section, not a sub-bullet)
5. Snapshot output format - annotated ASCII and JSON examples from live device
6. NodeMatcher reference - all six fields, priority order, how to find values
7. Action reference - all confirmed action types with params
8. ResultEnvelope - full shape and per-action `data` contents
9. Settle delays and timing - sleep vs. wait_for_node, typical values
10. Error recovery - what each error means in context
11. Screenshot vs. snapshot - modality guide

### Updates to `docs/design/operator-llm-playbook.md`

- Fix action type list: add `enter_text`, verify and add `close_app` and `sleep`
- Expand each action type with its params
- Link to `agent-ui-loop.md` for the loop pattern

### Update to `docs/node-api-for-agents.md`

- Add "Skillless usage" subsection or FAQ entry pointing to `agent-ui-loop.md`
- Note that `observe snapshot` CLI is ASCII-only; JSON requires execute payload
- Show a `snapshot_ui` with `format: "json"` in the execution payload example

### `sites/docs/` updates

- Add `agent-ui-loop.md` to `source-map.yaml` under `ai-agents` section
- Add nav entry to `mkdocs.yml` under "For AI Agents"
- Regenerate `sites/docs/docs/` via the `clawperator-generate-docs` skill

---

## Dependencies

This task depends on `tasks/fix-documentation-gaps/` being complete, specifically
Gaps 1, 3, 5, and 9. The snapshot output format (Gap 9) and confirmed action params
(Gaps 1, 3) are direct inputs to this doc. Do not start writing the snapshot section
or action reference section of this doc without those gaps being closed.

---

## Scope boundaries

Do not change in this task:

- CLI command reference (code-derived)
- Error code reference (code-derived)
- Any execution payload schema (contract changes require code changes first)
- Skills documentation
- Device setup documentation (covered by `update-docs-for-emulator`)

---

## Suggested branch name

`docs-agent-ui-loop`
