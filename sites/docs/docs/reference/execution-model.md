# Clawperator Execution Model

This page explains how to read and construct Clawperator executions without
guessing from validation errors.

Use it when you need to understand:

- what fields are required in an execution payload
- how `envelope.status` differs from `stepResults[].success`
- where to branch on error codes
- how timeout and single-flight behavior affect agent loops

## Required execution fields

Every execution payload must include:

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `commandId` | string | Correlation ID for the whole execution. Must remain stable end to end. |
| `taskId` | string | Task-level correlation ID. Often matches a larger agent task or subtask. |
| `source` | string | Caller identifier such as the agent, skill, or workflow name. |
| `expectedFormat` | string | Must be `"android-ui-automator"` today. |
| `timeoutMs` | number | Execution-wide timeout budget in milliseconds. |
| `actions` | array | Ordered list of action steps to run. |

Minimal example:

```json
{
  "commandId": "quickstart-001",
  "taskId": "quickstart-001",
  "source": "my-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 15000,
  "actions": [
    { "id": "snap1", "type": "snapshot_ui" }
  ]
}
```

## Result envelope model

Clawperator returns one terminal result envelope per execution.

Successful example shape:

```json
{
  "ok": true,
  "envelope": {
    "commandId": "quickstart-001",
    "taskId": "quickstart-001",
    "status": "success",
    "stepResults": [
      {
        "id": "snap1",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "actual_format": "hierarchy_xml",
          "text": "<hierarchy ... />"
        }
      }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

## `status` vs `stepResults[].success`

These mean different things and agents must check both.

| Field | What it means |
| :--- | :--- |
| `envelope.status = "success"` | The execution completed and returned a terminal result envelope. |
| `envelope.status = "failed"` | The execution failed as a whole, for example dispatch failure, timeout, or another top-level runtime failure. |
| `stepResults[n].success = true` | That individual step succeeded. |
| `stepResults[n].success = false` | That individual step failed, even if the overall execution still completed. |

Important consequences:

- A step can fail while the overall execution still has `status: "success"`.
- Top-level failures usually return no useful later steps because the runtime
  could not continue cleanly.
- A reliable agent loop checks `envelope.status` first, then inspects each step.

## Error surfaces

Clawperator exposes stable codes from more than one place:

| Location | Typical use |
| :--- | :--- |
| `error.code` | Node CLI or API structured errors such as validation, device resolution, or timeout failures |
| `envelope.errorCode` | Android-side top-level envelope failures when present |
| `stepResults[n].data.error` | Per-step runtime failures such as `NODE_NOT_FOUND` |

Do not branch on `envelope.error` text alone. That text is descriptive, not the
stable machine contract.

## Timeout semantics

`timeoutMs` is an execution-wide budget, not a per-step budget.

For practical starting values by workflow type, see
[Clawperator Timeout Budgeting](timeout-budgeting.md).

Current validation policy:

- minimum: `1000`
- maximum: `120000`

Practical guidance:

- simple one-step observe or click flows often fit in `5000` to `15000`
- multi-scroll discovery flows usually need more headroom
- `sleep.durationMs` also consumes from the same outer timeout budget

When the timeout is exceeded, the Node layer returns
`RESULT_ENVELOPE_TIMEOUT`.

## Single-flight behavior

Clawperator allows only one execution in flight per device at a time.

If a second execution targets the same device while one is still running, the
caller gets `EXECUTION_CONFLICT_IN_FLIGHT`.

This is why agents should:

- serialize work per device
- avoid overlapping retries on the same target
- keep multi-action payloads tight and intentional

## Validation behavior

Payloads are schema-validated before any device action is dispatched.

Current behavior:

- invalid payloads fail fast with `EXECUTION_VALIDATION_FAILED`
- `clawperator execute --execution <json-or-file> --validate-only` validates and
  normalizes the payload without dispatching to any device

Example:

```bash
clawperator execute --execution /path/to/execution.json --validate-only --output json
```

Use a live-device smoke payload only when you want to validate both the
contract and the target environment.

## Recommended agent loop

For any flow involving state-dependent decisions:

1. Capture `snapshot_ui`.
2. Decide the next action (or a short, atomic sequence - see below).
3. Execute it.
4. Read the envelope and step results.
5. Snapshot again before making the next decision.

Clawperator does not observe state or make decisions between actions in a
multi-step execution. It dispatches the action list sequentially and returns one
result envelope. If the agent needs to inspect state, branch on what it sees, or
handle unexpected UI between any two steps, those steps must be separate
executions with the agent in the loop between them.

## Execution granularity

Group multiple actions in one execution only when they are **atomic** - meaning
the agent does not need to inspect device state or make a decision between them.

**Appropriate as a single execution:**

- `close_app` + `open_app` + `sleep` - deterministic state reset; no decision
  needed between steps
- `click` + `wait_for_node` - click a button and wait for a specific element;
  the target is specified in advance
- `enter_text` + `click` - type in a field and submit; both succeed or fail as a
  unit

**Should be separate executions with agent observation between them:**

- Any sequence where the agent needs to read the screen after one step to decide
  the next
- Navigation flows where the app may show an interstitial, dialog, or update
  prompt that was not present when the flow was designed
- Flows where the correct next step depends on current app state

The rule of thumb: if you would naturally want to call `observe snapshot`
between two steps, they belong in separate executions.

## `sleep` vs `wait_for_node` vs separate snapshot

Use the right primitive for each situation:

| Situation | Correct tool |
| :--- | :--- |
| App needs a moment to settle after launch or a heavy transition | `sleep` with a conservative fixed value |
| Waiting for a specific element to appear before proceeding | `wait_for_node` with appropriate retry config |
| Checking whether the expected screen is showing | Separate `snapshot_ui` execution - agent inspects and decides |
| Deciding what to do based on what the screen currently shows | Separate `snapshot_ui` execution - agent inspects and acts |

`sleep` is for predictable, hardware-level timing. `wait_for_node` is for UI
element readiness within a known, stable flow. A separate `snapshot_ui` followed
by agent reasoning is for anything involving uncertainty, branching, or dynamic
app behavior.

Avoid using `sleep` as a substitute for observation. A long sleep that happens
to let the UI settle is not the same as the agent verifying that the expected
state was reached.

For action-specific params, result shapes, and examples, use
[Action Types Reference](action-types.md). For the full agent API contract,
see [Clawperator Node API - Agent Guide](../ai-agents/node-api-for-agents.md).
