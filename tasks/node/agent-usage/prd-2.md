# PRD-2: Error Message Context

Workstream: WS-2
Priority: 2
Proposed PR: PR-2

From this analysis. The other agent classified this as "already solved" - see `reconciliation.md`
for why that classification is wrong.

---

## Problem Statement

When a payload is invalid, `EXECUTION_VALIDATION_FAILED` names the schema violation but not the action that caused it. When a command times out, `RESULT_ENVELOPE_TIMEOUT` says nothing about which phase of the pipeline was in flight. Both errors require the agent to guess. Both are fixable with additive changes to existing types.

---

## Evidence

**From `apps/node/src/domain/executions/validateExecution.ts:306-331`:**

```typescript
export interface ValidationFailure {
  code: typeof ERROR_CODES.EXECUTION_VALIDATION_FAILED;
  message: string;
  details?: { path?: string; reason?: string };
}

export function validateExecution(input: unknown): Execution {
  const parsed = executionSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const err: ValidationFailure = {
      code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
      message: first?.message ?? "Invalid execution payload",
      details: {
        path: first?.path.join("."),    // e.g. "actions.2.params.format"
        reason: parsed.error.message,  // raw Zod message
      },
    };
    throw err;
  }
  return parsed.data as Execution;
}
```

`path` is the Zod path joined with dots. For the GloBird failure (`format: "ascii"` in the third action), this would be `"actions.2.params"`. The agent still has to count through its payload to find the action - and the semantic `id` field (e.g. `"snap"`) is never surfaced.

**From `tasks/node/agent-usage/issues.md`, Issue #5:**
> I spent time guessing whether the GloBird app was the problem, when it was actually the `format: "ascii"` parameter in a completely different action. The error didn't point me to the right place.

**From `tasks/agent-ui-loop/docs-audit.md`:**
`UNSUPPORTED_RUNTIME_CLOSE` is undocumented in the error codes table. Other codes may be missing.

**Known silent contract violation (from `tasks/agent-ui-loop/api-improvement-suggestions.md`, GAP-02):**
`enter_text clear: true` is accepted by Node validation but silently ignored by the Android receiver. The field is in the contract but never executed. This must be documented as a known limitation.

---

## Current Behavior

### `EXECUTION_VALIDATION_FAILED`

Response shape:
```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_VALIDATION_FAILED",
    "message": "Unrecognized key(s) in object: 'format'",
    "details": {
      "path": "actions.2.params",
      "reason": "..."
    }
  }
}
```

The `path` identifies the Zod path by array index. The action's semantic `id` and `type` are absent.

### `RESULT_ENVELOPE_TIMEOUT`

Response shape:
```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "message": "Timed out waiting for result envelope"
  }
}
```

No action context. No elapsed time. No configured timeout value.

---

## Proposed Change

### 1. `validateExecution.ts`: enrich `ValidationFailure`

When payload validation fails, extract the action `id` and `type` from the input payload using the Zod path index. Add to `ValidationFailure.details`:
- `actionId`: the `id` field of the offending action (string, from the parsed input at `actions[N].id`)
- `actionType`: the `type` field of the offending action (string, from `actions[N].type`)
- `invalidKeys`: array of the unrecognized or missing parameter names
- `hint`: optional short string for a small set of known removed/renamed parameters

Known hint entries (initial set):
- `snapshot_ui.format` -> `"'format' was removed from snapshot_ui. Remove this parameter."`

Keep the existing `path` and `reason` fields unchanged. This is additive.

Example enriched response:
```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_VALIDATION_FAILED",
    "message": "Action 'snap' (snapshot_ui): unrecognized key 'format'",
    "details": {
      "actionId": "snap",
      "actionType": "snapshot_ui",
      "invalidKeys": ["format"],
      "hint": "'format' was removed from snapshot_ui. Remove this parameter.",
      "path": "actions.2.params",
      "reason": "..."
    }
  }
}
```

### 2. `runExecution.ts`: enrich `RESULT_ENVELOPE_TIMEOUT`

When the timeout fires, include in the error response:
- `details.commandId`: the `commandId` from the execution payload (when present)
- `details.taskId`: the `taskId` from the execution payload (when present)
- `details.lastActionId`: the `id` of the last action in the payload
- `details.lastActionType`: the `type` of the last action in the payload
- `details.elapsedMs`: milliseconds elapsed since broadcast was dispatched
- `details.timeoutMs`: the configured timeout

**Critical caveat on "last action":** `details.lastActionId` and `details.lastActionType` are the last action in the *payload*, not the action Android was executing when the timeout fired. Node does not receive per-action acknowledgments from Android. This limitation must be documented explicitly in both the code comment and the error-handling docs so agents do not assume Android reached the named action.

Including `commandId` and `taskId` is the more reliable correlation handle - agents can use those to match the timeout against their own task tracking, regardless of which action Android was on.

Example:
```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "message": "Timed out after 30000ms waiting for commandId 'cmd-001' (last action in payload: 'open-energy-tab' / open_app - not confirmed executing)",
    "details": {
      "commandId": "cmd-001",
      "taskId": "task-001",
      "lastActionId": "open-energy-tab",
      "lastActionType": "open_app",
      "lastActionCaveat": "payload-last only; Android execution position is unknown",
      "elapsedMs": 30021,
      "timeoutMs": 30000
    }
  }
}
```

### 3. Document `enter_text clear: true` gap

In `docs/node-api-for-agents.md`, add a note to the `enter_text` action entry:

> `clear: true` is accepted in the payload schema but the Android receiver does not currently implement field clearing. Text will be appended to the existing field contents. Do not rely on this parameter until a future Operator APK release implements it.

This prevents new skills from being written with a false assumption. It is not a runtime fix but it is a contract accuracy fix.

### 4. Documentation updates

- `docs/reference/error-handling.md`: document the new `details` fields for both error types.
- `docs/node-api-for-agents.md`: update error section; add `enter_text clear: true` caveat.
- `docs/reference/error-codes.md` (if it exists): add `UNSUPPORTED_RUNTIME_CLOSE` and any other undocumented codes found during implementation.

---

## Why This Matters for Agent Success

With action context in the error, the GloBird fix is a 10-second edit ("remove `format` from the `snap` action") rather than a multi-minute guessing session. With last-action context in the timeout, an agent knows whether to retry, wait, or check the device. Both changes go from "guess and ask" to "observe and act."

---

## Scope Boundaries

In scope:
- `ValidationFailure` type extension in `validateExecution.ts`
- `RESULT_ENVELOPE_TIMEOUT` context in `runExecution.ts`
- Known-hint list (small, tied to parameter deprecation process)
- `enter_text clear: true` documentation caveat
- Error code docs updates

Out of scope:
- Android-side error enrichment (requires APK changes)
- Per-step result enrichment in `stepResults[n]` (separate concern)
- Full streaming of action events (PRD-4)
- Enumerating all valid parameters in the error (use `--help`)

---

## Dependencies

None. Independent of PRD-1. Can be developed in parallel.

---

## Risks and Tradeoffs

**Risk: envelope shape change**
The `error` object gains a `details` sub-object with new fields. This is additive. Agents parsing `error.code` and `error.message` are unaffected. The existing `path` and `reason` fields are preserved.

**Risk: hint list maintenance**
The known-hint list will become stale if not updated during API changes. Keep it to under 10 entries. Add a new hint at the same time a parameter is removed from the schema.

**Tradeoff: last-action context is payload-last, not execution-last**
`details.lastActionId` names the last action in the payload, not the action Android was executing when the timeout fired. Node does not receive per-action ACKs from Android. The `lastActionCaveat` field makes this explicit in the JSON. Agents should treat `commandId`/`taskId` as the primary correlation handle and `lastActionId` as a useful hint, not a confirmed execution position.

---

## Testing Plan

### Fixtures

**Invalid payload: action at index 0 (`test/fixtures/execution-invalid-action-0.json`):**
```json
{
  "commandId": "cmd-001", "taskId": "task-001",
  "actions": [{ "id": "snap", "type": "snapshot_ui", "params": { "format": "ascii" } }]
}
```

**Invalid payload: action at index 2 (`test/fixtures/execution-invalid-action-2.json`):**
```json
{
  "commandId": "cmd-001", "taskId": "task-001",
  "actions": [
    { "id": "open", "type": "open_app", "params": { "appId": "com.example" } },
    { "id": "wait", "type": "wait_for_element", "params": { "query": "..." } },
    { "id": "snap", "type": "snapshot_ui", "params": { "format": "ascii" } }
  ]
}
```

**Valid payload (`test/fixtures/execution-minimal-valid.json`):**
Already defined in PRD-1. Reuse it here.

**Payload without `commandId`/`taskId`:**
```json
{ "actions": [{ "id": "t1", "type": "tap", "params": { "x": 100, "y": 200 } }] }
```

### TDD Sequence

**Before touching `validateExecution.ts`:**
Write T1 (valid payload — no throw) and T2 (regression: existing `path` and `reason`
present). Both must pass against the unchanged code. They are anchors: if either fails
after the change, stop immediately.

Write T3, T4, T5 next. All three fail (new fields absent). Make the changes to
`validateExecution.ts`. All five must pass.

**Before touching `runExecution.ts` timeout handling:**
Write T6 and T7. Both fail. Add timeout context enrichment. Both must pass.

### Unit Tests

**T1 — valid payload passes without throwing (happy-path anchor)**
- Input: `test/fixtures/execution-minimal-valid.json`
- Expected: `validateExecution(input)` returns an `Execution` object; does not throw
- Failure mode protected: false-positive validation rejections after the change; a
  refactor that widens the error path accidentally blocks valid payloads
- When: write before touching `validateExecution.ts`; must pass before and after

**T2 — existing `details.path` and `details.reason` survive the change (regression anchor)**
- Input: `test/fixtures/execution-invalid-action-2.json`
- Expected: thrown error has `details.path === "actions.2.params.format"` and
  `details.reason` is a non-empty string
- Failure mode protected: additive change becomes destructive; existing agent code that
  reads `details.path` breaks silently
- When: write before touching `validateExecution.ts`; must pass before and after

**T3 — action fields extracted at index 0**
- Input: `test/fixtures/execution-invalid-action-0.json` (invalid action at index 0)
- Expected: thrown error has `details.actionId === "snap"`,
  `details.actionType === "snapshot_ui"`, `details.invalidKeys` contains `"format"`
- Failure mode protected: Zod path extraction uses `path[1]` as the numeric index — when
  the action is at index 0 this is `0`, which is falsy; a check like `path[1] || null`
  would fail to extract the action id for index 0

**T4 — action fields extracted at index 2**
- Input: `test/fixtures/execution-invalid-action-2.json`
- Expected: `details.actionId === "snap"`, `details.actionType === "snapshot_ui"`,
  `details.invalidKeys` contains `"format"`
- Failure mode protected: index extraction works for 0 but not for arbitrary positions

**T5 — hint populated for known removed parameter**
- Input: `test/fixtures/execution-invalid-action-0.json` (`snapshot_ui` with `format`)
- Expected: `details.hint` contains the string `"format"` (the hint explains the removal)
- Also: run with a payload where the invalid key is something NOT in the hint list (e.g.,
  `"unknownParam"`); expected `details.hint` is `undefined`, not the string
  `"undefined"`
- Failure mode protected: hint firing for cases it doesn't apply to; hint missing for the
  one known case

**T6 — timeout error includes correlation handles when present**
- Setup: mock `broadcastAgentCommand` to never resolve; use payload with `commandId` and
  `taskId`; set `timeoutMs` to a small value (50ms for the test)
- Expected: returned error has `details.commandId === "cmd-001"`,
  `details.taskId === "task-001"`, `details.lastActionId === "t1"`,
  `details.lastActionType === "tap"`, `details.elapsedMs >= 50`,
  `details.timeoutMs === 50`, `details.lastActionCaveat` is a non-empty string
- Failure mode protected: fields absent from the error; agent has no correlation handle
  to match the timeout to its task tracking

**T7 — timeout error handles absent `commandId`/`taskId` cleanly**
- Setup: same as T6 but use the payload without `commandId`/`taskId`
- Expected: returned error does not throw; `details.commandId` is `undefined` (absent
  from the object), not the string `"undefined"`
- Failure mode protected: string coercion bug (`String(undefined) === "undefined"`)
  baked into the error envelope

### Integration Tests

Integration tests for PRD-2 are low-value relative to the unit tests — the contract
changes are purely in Node JS code and are well-covered by unit tests. Run one
smoke-level integration test after the unit tests pass:

**T8 — enriched error appears in live CLI output**
- Requires `CLAWPERATOR_RUN_INTEGRATION=1`
- Command: `clawperator execute --execution test/fixtures/execution-invalid-action-0.json`
  (no device needed — validation fails before any device contact)
- Expected: stdout/stderr contains `"actionId"` and `"snapshot_ui"`; exit non-zero
- Failure mode protected: unit test passes against internal function but CLI layer strips
  or reformats the error before output

### CLI / Contract Regression

**T9 — additive contract: `error.code` and `error.message` unchanged**
- Run `validateExecution` with `test/fixtures/execution-invalid-action-0.json`
- Expected: `error.code === "EXECUTION_VALIDATION_FAILED"`;
  `error.message` is a non-empty human-readable string (not changed to a machine code)
- Failure mode protected: the new fields inadvertently replace rather than supplement

### What to Skip

- Do not write a test for every possible invalid action type — T3 and T4 cover the
  extraction logic; additional cases are redundant.
- Do not write timing bounds tests for `elapsedMs` (e.g., `elapsedMs < timeoutMs + 500`).
  Timing tests are flaky under CI load. The existence of `elapsedMs` as a positive
  integer is sufficient.
- Defer URL-reachability checks on any docs URLs added here to the PRD-6 review.

### Manual Verification

**M1 — readable error on invalid payload**
- Run: `clawperator execute --execution test/fixtures/execution-invalid-action-0.json`
- Confirm: the error output names the action (`snap`) and the parameter (`format`)
  explicitly; a developer seeing this output can fix the skill in under 30 seconds
  without opening docs

---

## Acceptance Criteria

- `EXECUTION_VALIDATION_FAILED` includes `details.actionId`, `details.actionType`, `details.invalidKeys` (array).
- `details.hint` is populated for known removed parameters, absent otherwise.
- `RESULT_ENVELOPE_TIMEOUT` includes `details.commandId`, `details.taskId` (when present in the payload), `details.lastActionId`, `details.lastActionType`, `details.lastActionCaveat`, `details.elapsedMs`, `details.timeoutMs`.
- Existing `details.path` and `details.reason` fields are unchanged.
- `docs/node-api-for-agents.md` documents the `enter_text clear: true` limitation.
- `docs/reference/error-handling.md` documents the new `details` fields.
