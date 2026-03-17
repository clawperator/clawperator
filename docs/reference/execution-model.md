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

For unknown apps or UI drift:

1. Capture `snapshot_ui`.
2. Decide one action or one short action sequence.
3. Execute it.
4. Re-read the envelope and step results.
5. Snapshot again before making the next major decision.

For action-specific caveats, use
[Clawperator Node API - Agent Guide](../ai-agents/node-api-for-agents.md) and
[Clawperator Snapshot Format](snapshot-format.md).
