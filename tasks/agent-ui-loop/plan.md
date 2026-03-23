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

## What already exists

These are documented and do not need to be rewritten:

- Execution payload structure and required fields (`node-api-for-agents.md`)
- Action types list in playbook and Node API guide
- Error codes (`node-api-for-agents.md`)
- Single-flight, no-hidden-retries, determinism guarantees (`node-api-for-agents.md`)
- Skills system (`node-api-for-agents.md`, skills docs)
- Post-navigation settle delay recommendation mentioned in playbook
- `snapshot_ui` extraction failure contract: `success: false` + `data.error: "SNAPSHOT_EXTRACTION_FAILED"` when logcat marker not found (`node-api-for-agents.md`, `troubleshooting.md`)

---

## Prerequisites

Reference-contract accuracy is no longer blocked. The current source of truth for this
task is:

- `docs/node-api-for-agents.md` for the canonical action, matcher, envelope, and
  snapshot contracts
- `docs/design/operator-llm-playbook.md` for operator-facing usage constraints
- current Node and Android source only when a doc detail needs reconfirmation

### Architectural note: single canonical snapshot format

Confirmed from the current branch source and live device validation:

- `clawperator snapshot` (flat CLI) and `snapshot_ui` (inside `execute`) both return the same canonical
  snapshot format: `hierarchy_xml`
- successful snapshot steps report `data.actual_format = "hierarchy_xml"`
- the Android runtime writes the hierarchy dump to logcat and the Node layer injects
  that raw XML into `data.text`
- there is no longer a public or supported `snapshot_ui.params.format` choice

This single-format contract is the structural foundation of the snapshot section in
this doc. It must appear early, before any loop examples.

---

## What is missing

### 1. The observe-decide-act loop pattern

No doc currently describes the complete interaction pattern for ad-hoc app
automation. This is the core thing this doc exists to provide.

The basic loop:

1. `open_app` - launch the target app
2. `sleep` 1000ms or `wait_for_node` on a stable element - let the app settle
3. `clawperator snapshot` or a `snapshot_ui` step in `execute` - read current UI state
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

### 3. Snapshot output format - canonical `hierarchy_xml`

This section of the doc must cover:

- The two access paths (flat CLI `snapshot` and execute action `snapshot_ui`) and the fact that both
  return the same `hierarchy_xml` output
- How to read the XML hierarchy to identify elements and extract matcher field values
- How `data.text` and `data.actual_format` are delivered in the result envelope
- When to use hierarchy XML vs screenshot (modality decision guide)

### 4. Full NodeMatcher reference

Six matcher fields in source (`apps/node/src/contracts/selectors.ts`).
Only `textEquals` appears in current docs. All six with priority guidance:

1. `resourceId` - most stable. Format: `"com.example.app:id/element_name"`.
   Only present when the app developer set it - absent in many third-party apps.
2. `contentDescEquals` - stable for icon buttons with no visible text. Read
   from the `content-desc` attribute in hierarchy XML snapshot output.
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
Confirmed from the current Node and Android source:

- `open_app` - `params.applicationId` (string)
- `close_app` - `params.applicationId` (string)
- `click` - `params.matcher` (NodeMatcher), `params.clickType` ("default" | "long_click" | "focus")
- `enter_text` - **this is the correct action type name** (NOT `type_text`).
  Params: `matcher` (NodeMatcher), `text` (string), `submit` (boolean, default false),
  `clear` (accepted by Node, currently ignored by Android runtime)
- `read_text` - `params.matcher` (NodeMatcher). Confirmed.
- `wait_for_node` - `params.matcher` (NodeMatcher). Retry behavior comes from runtime
  retry config, not a `durationMs` param.
- `snapshot_ui` - no params required for the canonical `hierarchy_xml` snapshot path.
- `sleep` - `params.durationMs` (number).
- `scroll_and_click` - `target` (NodeMatcher), `container` (NodeMatcher),
  `direction`, `maxSwipes`, `distanceRatio`, `settleDelayMs`,
  `findFirstScrollableChild`. Defaults and ranges are documented in the Node API guide.

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
      "data": { ... }
    }
  ],
  "error": null
}
```

The `data` field contents per action type are now documented in the Node API guide.
Important shapes for this loop doc:
- `snapshot_ui`: `data.actual_format = "hierarchy_xml"` and `data.text` contains the XML tree
- `read_text`: extracted text value
- `click`, `enter_text`, `open_app`: minimal or empty on success
- Any failed step: `data.error` contains the error code string

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

- **Hierarchy XML snapshot**: default path. Low context cost. Use for targeting and
  machine-readable UI inspection.
- **Screenshot** (`clawperator screenshot` or `POST /observe/screenshot`): visual
  context. Higher token cost (image input). Use for disambiguation when the
  tree alone is insufficient to understand the current screen state. Cannot
  substitute the tree for element targeting.

Concrete guidance: the agent should start with the hierarchy XML snapshot. Use
screenshot when the tree is ambiguous (e.g., multiple elements with the same
text, or the agent needs to understand spatial layout).

### 10. The two snapshot access paths

This must appear early in the doc, before any snapshot examples:

**Path A - CLI shortcut:**
```bash
clawperator snapshot --device <serial>
```

**Path B - Execute payload:**
```json
{
  "commandId": "snap-001",
  "taskId": "snap-001",
  "source": "my-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "snap", "type": "snapshot_ui" }
  ]
}
```

Both paths return the same snapshot content contract:

- `stepResults[0].data.actual_format` is `"hierarchy_xml"` on success
- `stepResults[0].data.text` contains the raw UI hierarchy XML

---

## Deliverables

### New doc: `docs/agent-ui-loop.md`

Section outline:

1. Overview - skillless usage model and when to use it vs. skills
2. The two snapshot access paths - CLI and execute payload, both returning `hierarchy_xml`
3. The observe-decide-act loop - complete pattern with worked example
4. Multi-action payload vs. sequential observe loop - decision framework
   (must be a standalone section, not a sub-bullet)
5. Snapshot output format - annotated `hierarchy_xml` example from live device
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
- Keep the snapshot contract wording aligned to the canonical `hierarchy_xml` format
- Show `snapshot_ui` examples without a `format` param

### `sites/docs/` updates

- Add `agent-ui-loop.md` to `source-map.yaml` under `ai-agents` section
- Add nav entry to `mkdocs.yml` under "For AI Agents"
- Regenerate `sites/docs/docs/` via the `docs-generate` skill

---

## Dependencies

This task depends on the current branch contract remaining stable:

- `snapshot_ui` and flat CLI `snapshot` continue to expose canonical `hierarchy_xml`
- the Node API guide remains the source of truth for per-action params and result data
- any future contract changes must update this plan before implementation work starts

---

## Scope boundaries

Do not change in this task:

- CLI command reference (code-derived)
- Error code reference (code-derived)
- Any execution payload schema (contract changes require code changes first)
- Skills documentation
- Device setup documentation (covered in `docs/first-time-setup.md` and `docs/troubleshooting.md`)

---

## API gaps identified during source audit

These issues were found by cross-referencing TypeScript contracts, Android Kotlin
source, and Node post-processing on this branch. They are
not documentation problems - they are behavioral inconsistencies or broken contracts
in the implementation itself. They are captured here so they can be considered when
designing the `agent-ui-loop` doc and deciding whether to work around them, route
around them, or surface them as known limitations.

### Gap A: `enter_text` `clear` param is silently ignored

**Source:** `apps/node/src/contracts/execution.ts` (defines `clear?: boolean`),
`apps/node/src/domain/actions/typeText.ts` (passes `clear` in params), vs.
`apps/android/.../AgentCommandParser.kt` (does not parse `clear`) and
`apps/android/.../UiAction.kt` (`EnterText` has no `clear` field).

**Behavior:** The `clear` param is accepted by the Node layer and forwarded to Android,
but the Android runtime silently ignores it. An agent that passes `clear: true` to
overwrite a pre-filled field gets text appended to the existing content instead.

**Impact on loop doc:** The loop doc should not describe `clear` as a working param.
Either note it as unimplemented and document the workaround (clear the field manually
via a separate action or rely on `select all` via another mechanism), or omit it
entirely until the Android side implements it.

**Candidate fix:** Implement `clear` in `AgentCommandParser.kt` and `UiAction.EnterText`
to clear the field before typing. Alternatively, remove `clear` from the TypeScript
contract to avoid the misleading signal.

---

### Gap B: `close_app` step result is always `success: false` even when the operation succeeds

**Source:** `apps/android/.../UiActionEngine.kt` (`executeCloseApp` always returns
`success = false` with `UNSUPPORTED_RUNTIME_CLOSE`). `apps/node/src/domain/executions/runExecution.ts`
(pre-flight runs `adb shell am force-stop` before dispatch).

**Behavior:** The Node layer correctly force-stops the app before sending the payload
to Android. The Android step always fails with `UNSUPPORTED_RUNTIME_CLOSE`. The
overall execution `status` is `"success"` (Android uses `buildCanonicalSuccessLine`
whenever execution completes), but `stepResults[n].success` is `false`.

**Impact on loop doc:** The loop doc must warn agents not to branch on `stepResults[].success`
for `close_app` steps. Any agent that checks per-step success before continuing will
incorrectly detect failure and halt. The loop pattern needs to explicitly handle this.

**Candidate fix:** The Node layer already has the pre-flight result (ADB exit code).
It could synthesize a `success: true` override for the `close_app` step result, or
strip the Android step result from the envelope and inject a Node-generated one.
Alternatively, the Android side could detect the force-stop and return success.

---

### Gap C: `StepResult.error` is a phantom field in the TypeScript contract

**Source:** `apps/node/src/contracts/result.ts` (`StepResult` declares `error?: string`
as a top-level sibling of `data`). `apps/android/.../ClawperatorResultEnvelope.kt`
(`CanonicalStepResult` has no `error` field - only `id`, `actionType`, `success`, `data`).

**Behavior:** The TypeScript type says `step.error` exists. Android never emits it.
Agents or Node consumers that check `step.error` will always get `undefined`. Per-step
failure details are in `step.data.error` (inside the `data` map) - a completely
different access path.

**Impact on loop doc:** The loop doc must use `step.data.error` for per-step error
codes, not `step.error`. This is already the correct documented behavior, but the
TypeScript type creates a trap for consumers writing typed code against the contract.

**Candidate fix:** Remove `error?: string` from `StepResult` in `result.ts` to match
the actual emitted JSON. Or, add `error` to `CanonicalStepResult` in Kotlin and emit
it as a top-level field for step failures (which would require choosing one canonical
location for per-step error codes).

---

