# API Overview

## Purpose

Define the execution contract that agents send to Clawperator and the result envelope they receive back.

## What Clawperator Is

Clawperator is a deterministic actuator for Android automation. The agent is the planner. Clawperator executes explicit actions against a target device and returns a structured result envelope.

## Execution Payload

Execution payload fields from `apps/node/src/contracts/execution.ts`:

| Field | Type | Meaning |
| --- | --- | --- |
| `commandId` | `string` | Caller-generated correlation id for the whole run. |
| `taskId` | `string` | Caller-generated task id. |
| `source` | `string` | Caller label, such as `serve-api` or `clawperator-action`. |
| `expectedFormat` | `"android-ui-automator"` | Required constant. |
| `timeoutMs` | `number` | Execution-level timeout for the whole payload. |
| `actions` | `ExecutionAction[]` | Ordered action list. |
| `mode` | `"artifact_compiled" | "direct"` | Optional runtime mode marker. |

Each `ExecutionAction` has:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Step correlation id. |
| `type` | `string` | Canonical action type such as `click` or `snapshot_ui`. |
| `params` | `ActionParams` | Optional action-specific parameters. |

## Result Envelope

The canonical terminal envelope from `apps/node/src/contracts/result.ts` is:

```json
{
  "commandId": "<command_id>",
  "taskId": "<task_id>",
  "status": "success",
  "stepResults": [
    {
      "id": "<step_id>",
      "actionType": "<action_type>",
      "success": true,
      "data": {}
    }
  ],
  "error": null,
  "errorCode": null,
  "hint": "<optional_hint>"
}
```

Field meanings:

| Field | Meaning |
| --- | --- |
| `status` | Top-level outcome after Node post-processing. `"failed"` means at least one step failed or the runtime returned a top-level failure. |
| `stepResults[].success` | Per-step success bit. |
| `stepResults[].data` | Action-specific string map. |
| `error` | Human-readable top-level failure summary. |
| `errorCode` | Stable top-level code when available. |
| `hint` | Optional recovery hint injected by Node. |

## How `status` And `stepResults` Relate

- If any `stepResults[].success` is `false`, Node reconciles `status` to `"failed"`.
- If all steps succeed, Node reconciles `status` to `"success"` and clears top-level error state.
- A top-level failure may also arrive with zero steps, for example when dispatch or envelope parsing fails before Android returns a normal step list.

## Execution Flow

1. Agent constructs an execution payload.
2. Node validates action types and parameters before adb dispatch.
3. Node resolves the target device and Operator package.
4. Android executes the actions and emits a `[Clawperator-Result]` envelope.
5. Node post-processes known cases such as snapshot extraction, screenshot capture, and `close_app` normalization.
6. Caller branches on `status`, `errorCode`, and `stepResults`.

## Related Pages

- [Actions](actions.md)
- [Selectors](selectors.md)
- [Errors](errors.md)
- [Devices](devices.md)
- [Doctor](doctor.md)
- [Serve API](serve.md)
- [Setup](../setup.md)
