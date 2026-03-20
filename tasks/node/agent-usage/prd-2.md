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

- `test/fixtures/execution-invalid-action-0.json`: single `snapshot_ui` action with
  `format: "ascii"` at index 0, with `commandId` and `taskId`
- `test/fixtures/execution-minimal-valid.json`: reuse from PRD-1
- Inline: a payload without `commandId`/`taskId` (construct in test body)

### TDD Sequence

1. Write T1 (valid payload no throw) and T2 (existing `path`/`reason` present). Both pass
   unchanged — these are anchors. If either fails after the change, stop.
2. Write T3, T4, T5. All fail. Change `validateExecution.ts`. All five must pass.
3. Write T6 (timeout enrichment) and T7 (absent correlation fields). Both fail. Add
   enrichment to `runExecution.ts`. Both must pass.

### Unit Tests

**T1 — valid payload returns Execution without throwing (happy-path anchor)**
- Input: `test/fixtures/execution-minimal-valid.json`; expected: returns `Execution`, no throw
- Protects: false-positive rejections after the change; must pass before and after

**T2 — existing `details.path` and `details.reason` survive the change (regression anchor)**
- Input: `execution-invalid-action-0.json`; expected: `details.path` and `details.reason`
  both present and non-empty
- Protects: additive change accidentally drops fields existing agents depend on; must pass
  before and after

**T3 — new fields extracted for invalid action at index 0**
- Input: `execution-invalid-action-0.json`
- Expected: `details.actionId === "snap"`, `details.actionType === "snapshot_ui"`,
  `details.invalidKeys` contains `"format"`
- Protects: Zod path index 0 is falsy; `path[1] || null` style extraction silently returns
  null for the first action

**T4 — hint populated for known removed parameter; absent for unknown key**
- Input 1: `snapshot_ui` with `format` param → `details.hint` is non-empty string
- Input 2: action with an unknown key not in the hint list → `details.hint` is `undefined`
  (not the string `"undefined"`)
- Protects: hint fires for cases it doesn't apply to; missing for the one known case

**T5 — timeout error carries all correlation fields**
- Setup: mock `broadcastAgentCommand` to never resolve; `timeoutMs: 50`; payload has
  `commandId` and `taskId`
- Expected: `details.commandId`, `details.taskId`, `details.lastActionId`,
  `details.lastActionType`, `details.lastActionCaveat` (non-empty string),
  `details.elapsedMs >= 50`, `details.timeoutMs === 50`
- Protects: agent has no correlation handle after timeout; caveat string absent

**T6 — timeout handles absent `commandId`/`taskId` without throwing**
- Setup: same timeout setup but payload has no `commandId` or `taskId`
- Expected: no throw; `details.commandId` absent from the object (not the string
  `"undefined"`)
- Protects: `String(undefined)` coercion baked into the error envelope

### Integration Tests

No device-side integration test needed — validation runs before any device contact.

**T7 — enriched error visible in CLI output**
- Command: `clawperator execute --execution test/fixtures/execution-invalid-action-0.json`
  (fails before device contact; no device needed)
- Expected: output contains `"actionId"` and `"snapshot_ui"`; exit non-zero
- Protects: unit tests pass but CLI layer strips or reformats the error before output

### Manual Verification

- Run the invalid payload command; output should name the action and parameter explicitly;
  a developer should be able to fix the skill in under 30 seconds without opening docs

---

## Acceptance Criteria

- `EXECUTION_VALIDATION_FAILED` includes `details.actionId`, `details.actionType`, `details.invalidKeys` (array).
- `details.hint` is populated for known removed parameters, absent otherwise.
- `RESULT_ENVELOPE_TIMEOUT` includes `details.commandId`, `details.taskId` (when present in the payload), `details.lastActionId`, `details.lastActionType`, `details.lastActionCaveat`, `details.elapsedMs`, `details.timeoutMs`.
- Existing `details.path` and `details.reason` fields are unchanged.
- `docs/node-api-for-agents.md` documents the `enter_text clear: true` limitation.
- `docs/reference/error-handling.md` documents the new `details` fields.
