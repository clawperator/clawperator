# Task: Fix Documentation Gaps

## Goal

Audit the current Clawperator documentation against the actual source contracts and close
every gap where the docs describe a different, incomplete, or absent contract from what
the code actually implements.

This is a contract accuracy task. It is not about adding new concepts or usage patterns -
that is covered by `tasks/agent-ui-loop/`. This task is about making sure that what is
currently documented is correct, complete, and verifiable against source.

---

## Why this is a separate task

The `agent-ui-loop` doc depends on accurate contract documentation as its foundation.
If the NodeMatcher field names are wrong, or an action type is missing, the loop doc
cannot be written correctly. This task must be completed - or at minimum, the specific
facts needed for the loop doc must be confirmed - before `tasks/agent-ui-loop/` can
produce a reliable doc.

The emulator docs (`update-docs-for-emulator` branch) are orthogonal and do not block
or depend on this task.

---

## Confirmed gaps (from source audit)

### Gap 1: `enter_text` missing from the playbook

**Severity: Critical.** This is the primary action for any text input use case. An agent
following only the playbook would not know this action exists.

From `apps/node/src/domain/actions/typeText.ts`:

```typescript
type: "enter_text"
params: {
  matcher: NodeMatcher,
  text: string,
  submit?: boolean,   // default false - submits after typing (e.g. pressing Enter)
  clear?: boolean     // default false - clears field before typing
}
```

The playbook section "Supported action types (current)" lists 8 types. `enter_text` is
not among them. There is no reference to it anywhere in the current docs.

The CLI command is `clawperator action type` (note: CLI uses `type`, execution payload
uses `enter_text` - this distinction must be documented clearly).

**Fix:** Add `enter_text` to the playbook action type list. Add full params. Add a note
clarifying that the CLI command `action type` maps to the `enter_text` action type in
execution payloads.

---

### Gap 2: NodeMatcher reference is incomplete

**Severity: High.** Agents cannot target UI elements using matchers they don't know
exist.

From `apps/node/src/contracts/selectors.ts`, the full NodeMatcher interface has six
fields. Current docs mention only `textEquals` (in a brief aside in the playbook skill
authoring section). Zero field-level documentation exists anywhere in the public docs.

The six fields:

| Field | Notes |
| :--- | :--- |
| `resourceId` | Most stable. Format: `"com.example.app:id/element_name"`. Only present when developer set it. |
| `contentDescEquals` | Exact match on accessibility content description. Use for icon buttons with no visible text. |
| `textEquals` | Exact match on visible text. Fragile for server-driven or localized text. |
| `textContains` | Substring match on visible text. Use when full text is dynamic or truncated. |
| `contentDescContains` | Substring match on accessibility label. Fallback for partial accessibility labels. |
| `role` | Matches by element role/class. Low selectivity - many elements share a role. Last resort or secondary constraint only. |

All fields are combined with AND semantics. When multiple fields are specified, all must
match.

The playbook states "Prefer stable selectors first (`resourceId`), text matching
second" in the skill authoring rules but does not explain what fields are available,
what their exact names are, how to find their values in snapshot output, or what AND
semantics means in practice.

**Fix:** Add a NodeMatcher reference section to `node-api-for-agents.md` or the
playbook. Document all six fields with stability ranking, the AND combination rule,
and a worked example using multiple fields together. This section is also the
foundation of the NodeMatcher reference in `tasks/agent-ui-loop/`.

---

### Gap 3: Action params not documented per action type

**Severity: High.** The playbook lists action type names but no params for any of them.
`node-api-for-agents.md` shows one example payload with `open_app`, `click`, and
`snapshot_ui` but does not describe params systematically.

Confirmed params from source:

| Action | Confirmed params | Notes |
| :--- | :--- | :--- |
| `open_app` | `applicationId: string` | Confirmed |
| `click` | `matcher: NodeMatcher`, `clickType?: "default" \| "long_click" \| "focus"` | `clickType` undocumented |
| `enter_text` | `matcher: NodeMatcher`, `text: string`, `submit?: boolean`, `clear?: boolean` | Entirely undocumented |
| `read_text` | `matcher: NodeMatcher` | Confirmed |
| `wait_for_node` | `matcher: NodeMatcher`, `durationMs: number` | Confirmed |
| `snapshot_ui` | `format?: "ascii" \| "json"` (default `"ascii"`) | format option undocumented |
| `sleep` | `durationMs: number` | Needs verification from source |
| `close_app` | Needs verification | Not confirmed from source |
| `scroll_and_click` | `target: NodeMatcher`, `container: NodeMatcher`, `direction`, `maxSwipes`, `distanceRatio`, `settleDelayMs`, `findFirstScrollableChild` | All params undocumented |

The `clickType` param on `click` is completely invisible in current docs. The
`submit` and `clear` params on `enter_text` provide critical control over form
interactions (submit triggers a keyboard submit/enter, clear prevents appending to
existing text) - both missing.

**Fix:** Add a per-action params table to `node-api-for-agents.md` and/or the playbook.
The `scroll_and_click` and `close_app` params require verification from Android source
before documenting.

---

### Gap 4: `snapshot_ui` format param is undocumented

**Severity: High.** This is the only way to get JSON output, which is substantially
more useful for agent reasoning than ASCII. Agents who don't know about it default to
ASCII permanently.

The `snapshot_ui` action accepts `params: { format: "ascii" | "json" }`. The default
is `"ascii"` if params are omitted. This is documented nowhere.

Compound issue: the CLI path (`clawperator observe snapshot`) always returns ASCII.
This is a CLI implementation detail confirmed from
`apps/node/src/domain/observe/snapshot.ts` - `buildSnapshotExecution()` is hardcoded
to `format: "ascii"` and `cmdObserveSnapshot` does not pass a format option. There is
no `--format json` flag and adding one is out of scope for this task.

The two access paths currently exist but only one is documented:
- ASCII via CLI: `clawperator observe snapshot --device-id <serial>`
- JSON via execute payload: `snapshot_ui` action with `params: { format: "json" }`

**Fix:** Document both paths and the `format` param in `node-api-for-agents.md`. Add a
note in the CLI reference table that `observe snapshot` is ASCII-only and that JSON
format requires the execute API. This is also a hard prerequisite for
`tasks/agent-ui-loop/`.

---

### Gap 5: ResultEnvelope per-action `data` contents undocumented

**Severity: Medium.** Agents cannot extract data from results without knowing what
shape `stepResults[].data` takes per action type.

From `apps/node/src/contracts/result.ts`, the envelope shape is:

```typescript
// Emitted JSON shape (matches Android CanonicalStepResult - source of truth)
{
  commandId: string,
  taskId: string,
  status: "success" | "failed",
  stepResults: Array<{
    id: string,
    actionType: string,
    success: boolean,
    data: Record<string, string>,    // error code in data.error on failure
                                     // (note: TypeScript contract has error?: string
                                     //  as a sibling here, but it is never emitted)
  }>,
  error?: string | null              // top-level error code
}
```

The `data` field shape per action type is not documented. Expected (requires live
device confirmation before documenting):
- `snapshot_ui` with `format: "ascii"`: `data` is a string containing the ASCII tree
- `snapshot_ui` with `format: "json"`: `data` is a structured object (node tree)
- `read_text`: `data` contains the extracted text value
- `click`, `enter_text`, `open_app`, `close_app`, `sleep`: likely minimal or `null` on
  success
- Any failed step: `error` contains the error code string, `success: false`

The top-level error path (`envelope.error`) vs. per-step error path
(`stepResults[].error`) is also not clearly explained. The current `node-api-for-agents.md`
says "Branch agent logic on codes from `envelope.error` or `stepResults[].data.error`"
but the field name in source is `stepResults[].error` (not `.data.error`).

**Fix:** Confirm `data` shapes from live device output. Document the full envelope
shape. Correct the error path reference from `stepResults[].data.error` to
`stepResults[].error`. Add per-action `data` shapes once confirmed.

---

### Gap 6: TypeScript contract has an unimplemented field (`StepResult.error`)

**Severity: Medium - code issue, docs are actually correct.**

`apps/node/src/contracts/result.ts` defines `StepResult.error?: string` as a
top-level sibling of `data`. This field is **not emitted** by the Android runtime.
The Kotlin `CanonicalStepResult` class does not include an `error` field. Instead,
per-step failure details are encoded inside the `data` map as `data.error`.

This is confirmed by:
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/ClawperatorResultEnvelope.kt`:
  `CanonicalStepResult` has fields `id`, `actionType`, `success`, `data` only.
- `apps/node/src/test/unit/envelopeParser.test.ts`: parser tests assert
  `step.data?.error` for per-step failure codes, not `step.error`.

The current docs text (`stepResults[].data.error`) matches the actual emitted JSON
and should remain. The TypeScript contract has a phantom field that is never populated.

**Fix required (code, not docs):** Either remove `error?: string` from `StepResult`
in `result.ts` to match the emitted JSON, or update the Android `CanonicalStepResult`
to emit it as a top-level field. This is a separate code task and out of scope here.
The docs should continue to document `stepResults[].data.error` until the code is
aligned.

---

### Gap 7: `scroll_and_click` params entirely undocumented

**Severity: Medium.** Listed in the playbook action type list but no params described.

From `apps/node/src/contracts/execution.ts`, the params include:
`target` (NodeMatcher), `container` (NodeMatcher), `direction`, `maxSwipes`,
`distanceRatio`, `settleDelayMs`, `findFirstScrollableChild`.

The Android implementation (in the Android app source, not the Node layer) owns the
semantics of these fields and must be the source of truth. The exact types and defaults
for `direction`, `maxSwipes`, `distanceRatio`, etc. must be confirmed from Android
source before documenting.

**Fix:** Confirm param types and defaults from Android source. Add a
`scroll_and_click` entry to the action params table.

---

### Gap 8: `close_app` and `sleep` params not verified

**Severity: Low.** Both listed in the playbook but no params documented. Both likely
have simple or empty params.

Expected (unconfirmed):
- `close_app`: likely `params: { applicationId: string }` - mirrors `open_app`
- `sleep`: likely `params: { durationMs: number }`

**Fix:** Confirm from source. Add to action params table.

---

### Gap 9: Snapshot output format not documented

**Severity: High.** An agent cannot parse or act on snapshot output without knowing
what that output looks like. This is also a direct prerequisite for
`tasks/agent-ui-loop/` - the snapshot section of that doc is built from the annotated
examples produced here.

The `snapshot_ui` action and `clawperator observe snapshot` CLI produce output in two
formats. Neither is documented anywhere.

**ASCII format** (via CLI or `snapshot_ui` with `format: "ascii"`):
The exact line format, indentation scheme, and which attributes appear per line must be
captured from live device output. Do not document this from assumptions.

**JSON format** (via `snapshot_ui` with `format: "json"`, execute payload only):
Node tree field names are unconfirmed. Likely fields (must be verified from live output
before documenting): `text`, `contentDescription`, `resourceId`, `className`,
`bounds`/`rect`, `isClickable`, `isEnabled`, `isScrollable`, `children`, `nodeId`/`id`.

Node ID stability must also be confirmed: do node IDs remain the same across
re-observations of the same screen? Across app restarts?

**Live capture procedure (agent-completable, no user intervention required):**
The agent executing this task can run these steps autonomously with a connected device.
Before running live captures, examine existing skill scripts and snapshot artifacts in
`~/src/clawperator-skills` for bootstrap context, and read the Android app source for
the accessibility node tree structure.

1. Run `clawperator observe snapshot --device-id <serial>` and record the full output
   with annotations on what each line represents.
2. Execute a payload with `snapshot_ui` and `params: { format: "json" }`, then record
   the JSON tree from `stepResults[0].data`.
3. Confirm whether ASCII from the CLI matches `snapshot_ui` with `format: "ascii"` in
   an execute payload.
4. Inspect the raw `[Clawperator-Result]` envelope from logcat to confirm the exact
   `stepResults[].data` shape for `snapshot_ui`, `read_text`, and `click`.
5. Re-observe the same screen multiple times and compare node IDs to confirm stability
   across observations and across app restarts.

**Fix:** Add annotated ASCII and JSON snapshot examples to `node-api-for-agents.md`.
These examples are the direct input for the snapshot section in `agent-ui-loop.md`.

---

## What is NOT in scope for this task

- The full agent loop pattern and usage guide - that is `tasks/agent-ui-loop/`
- Changing execution contracts - this is a doc accuracy task, not a code task
- CLI command reference beyond what is needed to correct errors

---

## Deliverables

### 1. Fix `docs/node-api-for-agents.md`

- Add NodeMatcher reference section (all six fields, AND semantics, stability ranking)
- Add note that `observe snapshot` CLI is ASCII-only; JSON format requires execute API
- Add annotated ASCII snapshot example (from live capture per Gap 9)
- Add annotated JSON snapshot example with confirmed field names (from live capture per Gap 9)
- Add a `snapshot_ui` with `format: "json"` example to the execution payload sample
- Add per-action params table (all confirmed action types)
- Add ResultEnvelope shape with `data` field clarification (note unconfirmed `data`
  shapes as requiring live confirmation)

### 2. Fix `docs/design/operator-llm-playbook.md`

- Add `enter_text` to the action type list
- Expand the action type list to include params for each type
- Add a note that the `action type` CLI command maps to `enter_text` in payloads
- Fix any other inaccuracies found during the audit

### 3. `sites/docs/` updates

- Regenerate `sites/docs/docs/` via the `clawperator-generate-docs` skill after source
  fixes are complete

---

## Pre-work required before some fixes

### Requires live device confirmation

The following cannot be documented accurately without running against a real device or
emulator:

- The exact shape of `stepResults[].data` for each action type (especially `snapshot_ui`
  JSON output and `read_text` text value field name)
- Whether `stepResults[].data` is `null`, omitted, or an empty object on success for
  `click`, `enter_text`, `open_app`

These are Medium-severity gaps. The High-severity gaps (Gap 1 through 4) can all be
fixed from source code alone without a device.

### Requires Android source audit

- `scroll_and_click` param types and defaults (Gap 7)
- `close_app` param shape (Gap 8)

---

## Suggested branch name

`docs-fix-documentation-gaps`

## Dependency

This task is a prerequisite for `tasks/agent-ui-loop/` or at minimum must be completed
in parallel with it. The `agent-ui-loop` doc can proceed for sections that do not depend
on unconfirmed facts, but the NodeMatcher reference, action params, and ResultEnvelope
sections of that doc require this task's output.
