# PRD-2: Richer Error Context

Workstream: WS-2
Priority: 2
Proposed PR: PR-2

---

## Problem Statement

When a Clawperator execution fails, the error message names the failure code but not the specific location or cause within the execution payload. Agents receiving `EXECUTION_VALIDATION_FAILED` must manually diff their payload against the schema to find the invalid action. Agents receiving `RESULT_ENVELOPE_TIMEOUT` have no information about which phase of the pipeline was in flight. Both cases require guessing or user intervention, which is exactly what agents should not need.

---

## Evidence

**From `tasks/node/agent-usage/issues.md`, Issue #5:**
> `Unrecognized key(s) in object: 'format'` - Doesn't tell me which action has the problem.
> I spent time guessing whether the GloBird app was the problem, when it was actually the `format: "ascii"` parameter in a completely different action.

**From `tasks/node/agent-usage/issues.md`, Issue #5 (suggested shape):**
```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "Action 'snap' (snapshot_ui) has invalid parameter 'format'",
  "details": {
    "actionId": "snap",
    "actionType": "snapshot_ui",
    "invalidParam": "format",
    "suggestion": "Remove 'format' parameter. snapshot_ui does not support this option."
  }
}
```

**From `tasks/node/agent-usage/issues.md`, Issue #6:**
> 30 seconds pass. Is it working? Should I wait? Cancel? Check the device? I have no idea.
> On timeout, return: "Timeout during action 'open-energy-tab' after 4000ms"

**From `tasks/agent-ui-loop/docs-audit.md`:**
ISSUE-10 notes `UNSUPPORTED_RUNTIME_CLOSE` is missing from the error codes table. There are likely other undocumented or poorly-described error codes.

---

## Current Behavior

### `EXECUTION_VALIDATION_FAILED`

The current error envelope for a validation failure looks approximately like:

```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_VALIDATION_FAILED",
    "message": "Unrecognized key(s) in object: 'format'"
  }
}
```

The message is the raw Zod schema error string. It identifies the invalid key but not:
- Which action in the payload contained it
- What the action type was
- What valid alternatives exist

An execution payload with 10 actions and 1 invalid parameter requires the agent to scan the entire payload to find the offending action.

### `RESULT_ENVELOPE_TIMEOUT`

The current timeout envelope:

```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "message": "Timed out waiting for result envelope"
  }
}
```

No information about which action was dispatched, how long had elapsed, or what device state was last known.

---

## Proposed Change

### 1. Enrich `EXECUTION_VALIDATION_FAILED`

When payload validation fails, include in the error response:
- `details.actionId`: the `id` field of the offending action (string)
- `details.actionType`: the `type` field of the offending action (string)
- `details.invalidKeys`: array of unrecognized or invalid parameter names
- `details.hint`: a short suggestion string when the invalid key is a known removed or renamed parameter (e.g., `"format" was removed from snapshot_ui in v0.3.x. Remove this parameter.`)

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
      "hint": "'format' was removed from snapshot_ui. Remove this parameter."
    }
  }
}
```

The `hint` field should be populated for a short list of known removed/renamed parameters (e.g., `snapshot_ui.format`) and omitted otherwise. It should not attempt to enumerate all valid parameters - that is the job of `--help` and the docs.

### 2. Enrich `RESULT_ENVELOPE_TIMEOUT`

When a timeout fires, include in the error response:
- `details.lastActionId`: the `id` field of the last action that was dispatched before the timeout
- `details.lastActionType`: the `type` of that action
- `details.elapsedMs`: milliseconds elapsed since the execution started
- `details.timeoutMs`: the timeout value that was configured

Example enriched response:

```json
{
  "ok": false,
  "error": {
    "code": "RESULT_ENVELOPE_TIMEOUT",
    "message": "Timed out waiting for result envelope after 30000ms (last action: 'open-energy-tab' / open_app)",
    "details": {
      "lastActionId": "open-energy-tab",
      "lastActionType": "open_app",
      "elapsedMs": 30021,
      "timeoutMs": 30000
    }
  }
}
```

### 3. Documentation updates

- `docs/reference/error-handling.md`: Add `details` field descriptions for `EXECUTION_VALIDATION_FAILED` and `RESULT_ENVELOPE_TIMEOUT`.
- `docs/node-api-for-agents.md`: Update the error section to document the new `details` fields.
- `docs/reference/error-codes.md` (if it exists): Add `UNSUPPORTED_RUNTIME_CLOSE` and any other undocumented codes identified during implementation.

---

## Why This Matters for Agent Success

An agent that sees `"Action 'snap' (snapshot_ui): unrecognized key 'format'"` can fix its payload in the next step without any user intervention. An agent that sees `"Timed out ... last action: 'open-energy-tab' / open_app"` knows the app failed to open (or opened too slowly) and can adjust its retry strategy or ask the user to check the device. Both cases go from "guess and ask" to "observe and act."

The GloBird incident would have been a 10-second fix ("remove `format` from the snapshot action") instead of a multi-minute debugging session if the first error had included the action context.

---

## Scope Boundaries

In scope:
- `EXECUTION_VALIDATION_FAILED` enrichment (action context in error envelope)
- `RESULT_ENVELOPE_TIMEOUT` enrichment (last-action context in error envelope)
- Documentation updates for both error codes
- Known-hint list for a small set of removed/renamed parameters

Out of scope:
- Enumerating all valid parameters in the error (use `--help` for that)
- Per-step error enrichment for `stepResults[n]` (separate concern)
- Streaming action events (WS-6, separate)
- Any Android-side error enrichment (requires APK changes)

---

## Dependencies

None. This change is independent of WS-1. Can be developed in parallel.

---

## Risks and Tradeoffs

**Risk: envelope shape change**
The `error` object gains a `details` field. This is additive and backward-compatible. Agents parsing `error.code` and `error.message` are unaffected. Agents parsing `error.details` will see new fields. Document the change in the API contract.

**Risk: hint list maintenance**
The known-hint list for removed parameters will become stale if not updated on each API change. Keep it short (5-10 entries max) and tie it to the parameter deprecation process. When a parameter is removed, add its hint at the same time.

**Tradeoff: "last action" for timeout is best-effort**
The Node runtime dispatches the payload to Android and then polls for the result envelope. It knows which actions were in the payload and in what order, but it does not receive per-action acknowledgments from Android. The "last action" in the timeout context is the last action in the payload, not necessarily the action that Android was executing when the timeout fired. Document this limitation explicitly.

---

## Validation Plan

1. Unit test: `EXECUTION_VALIDATION_FAILED` response includes `details.actionId` and `details.actionType` for a payload with a known-invalid parameter.
2. Unit test: `EXECUTION_VALIDATION_FAILED` response includes the correct `hint` string for `snapshot_ui.format`.
3. Unit test: `RESULT_ENVELOPE_TIMEOUT` response includes `details.lastActionId`, `details.elapsedMs`, and `details.timeoutMs`.
4. Contract test: existing `error.code` and `error.message` fields are present and unchanged for both error types.
5. Manual verification: run a payload with `format: "ascii"` in a `snapshot_ui` action, observe enriched error response.

---

## Acceptance Criteria

- `EXECUTION_VALIDATION_FAILED` response includes `details.actionId`, `details.actionType`, and `details.invalidKeys` (array).
- When the invalid key is a known removed parameter, `details.hint` is populated with a human-readable suggestion.
- `RESULT_ENVELOPE_TIMEOUT` response includes `details.lastActionId`, `details.lastActionType`, `details.elapsedMs`, and `details.timeoutMs`.
- `error.code` and `error.message` fields are unchanged (additive only).
- `docs/reference/error-handling.md` documents both sets of new `details` fields.
- `docs/node-api-for-agents.md` error section reflects the updated shapes.
