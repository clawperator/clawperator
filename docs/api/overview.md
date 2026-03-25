# API Overview

## Purpose

Define the smallest end-to-end contract an agent needs to use Clawperator correctly: the execution payload, the CLI success wrapper, the `[Clawperator-Result]` envelope, and the exact fields to branch on.

## What Clawperator Is

Clawperator is a deterministic Android actuator. The agent is the planner. Clawperator accepts an explicit execution payload, validates it, resolves one target device and Operator package, dispatches the actions, and returns a structured result.

This page is intentionally narrow:

- Use [Actions](actions.md) for action-by-action parameter semantics
- Use [Selectors](selectors.md) for `NodeMatcher` and selector flags
- Use [Errors](errors.md) for exact error codes and recovery
- Use [Devices](devices.md) for target selection rules

## Execution Payload

Authoritative source: `apps/node/src/contracts/execution.ts`

Top-level execution fields:

| Field | Type | Meaning |
| --- | --- | --- |
| `commandId` | `string` | Caller-generated correlation id for the whole run. |
| `taskId` | `string` | Caller-generated task id. |
| `source` | `string` | Caller label, such as `serve-api` or `clawperator-action`. |
| `expectedFormat` | `"android-ui-automator"` | Required constant. |
| `timeoutMs` | `number` | Execution-level timeout for the whole payload. |
| `actions` | `ExecutionAction[]` | Ordered action list. |
| `mode` | `"artifact_compiled" | "direct"` | Optional runtime mode marker. |

Each action has:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | `string` | Step correlation id. |
| `type` | `string` | Canonical action type such as `click` or `snapshot_ui`. |
| `params` | `ActionParams` | Optional action-specific parameters. |

Minimum valid payload example:

```json
{
  "commandId": "cmd-001",
  "taskId": "task-001",
  "source": "agent-loop",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "snap-1",
      "type": "snapshot_ui"
    }
  ],
  "mode": "direct"
}
```

Success conditions for a valid payload before dispatch:

- `expectedFormat` is exactly `"android-ui-automator"`
- `timeoutMs` is within the execution timeout limits
- `actions` is non-empty
- every `actions[i].type` is a supported canonical action type after alias normalization

## Result Envelope

Authoritative source: `apps/node/src/contracts/result.ts`

The Android runtime emits a `[Clawperator-Result]` envelope. The Node CLI wraps that envelope in a top-level success object for most device commands:

```json
{
  "envelope": {
    "commandId": "cmd-001",
    "taskId": "task-001",
    "status": "success",
    "stepResults": [
      {
        "id": "snap-1",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy/>"
        }
      }
    ],
    "error": null
  },
  "deviceId": "<device_serial>",
  "terminalSource": "clawperator_result",
  "isCanonicalTerminal": true
}
```

Inside that wrapper, the canonical envelope shape is:

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
| `stepResults[].data` | Action-specific string map. Keys and values are strings after parsing and post-processing. |
| `error` | Human-readable top-level failure summary. |
| `errorCode` | Stable top-level code when available. Prefer this over matching `error`. |
| `hint` | Optional recovery hint injected by Node. |

Failure wrapper example from the CLI:

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "wait_for_navigation requires params.timeoutMs > 0",
  "details": {
    "path": "actions.0.params.timeoutMs",
    "actionId": "wait-1",
    "actionType": "wait_for_navigation"
  }
}
```

## How To Branch On Results

Branch in this order:

1. If the CLI returned a top-level object with `code` and no `envelope`, treat it as a host-side failure. Do not retry unchanged.
2. If `envelope.status == "failed"` and `envelope.errorCode` is present, branch on `envelope.errorCode`.
3. If `envelope.status == "failed"` and `envelope.stepResults` contains a failed step, branch on the first `stepResults[i].success == false` and inspect `stepResults[i].data.error`.
4. If `envelope.status == "success"` and every `stepResults[i].success == true`, treat the command as successful.

Exact machine-checkable success condition for most CLI device commands:

- process exit code `0`
- top-level JSON contains `envelope`
- `envelope.status == "success"`
- every `envelope.stepResults[i].success == true`
- `terminalSource == "clawperator_result"`
- `isCanonicalTerminal == true`

## How `status` and `stepResults` Relate

- If any `stepResults[].success` is `false`, Node reconciles `status` to `"failed"` and sets `error` from the first failed step.
- If all steps succeed, Node reconciles `status` to `"success"`, clears top-level error state, and removes `hint`.
- A top-level failure can also arrive with zero steps, for example when dispatch fails, the result envelope times out, or parsing fails before a normal step list exists.
- Node may modify step data after the runtime returns. Examples:
  - `snapshot_ui` success steps get `data.text` attached from extracted log output
  - missing snapshot text is converted into `SNAPSHOT_EXTRACTION_FAILED`
  - successful `take_screenshot` steps get `data.path`
  - successful pre-flight `close_app` steps are normalized to `data.application_id`

## Execution Flow

1. Agent constructs an execution payload with stable `commandId`, `taskId`, and ordered `actions`.
2. Node validates the payload size and action schema before any adb dispatch.
3. Node resolves one target device and one Operator package.
4. Node sends the payload to Android and waits for a `[Clawperator-Result]` envelope.
5. Node post-processes known cases such as snapshot extraction, screenshot capture, settle warnings, and `close_app` normalization.
6. CLI commands return a JSON wrapper containing the envelope, `deviceId`, `terminalSource`, and `isCanonicalTerminal`.

## Worked Example

Command:

```bash
clawperator snapshot --json --device <device_serial>
```

Success output shape:

```json
{
  "envelope": {
    "commandId": "snapshot-1700000000000-abcd123",
    "taskId": "snapshot-1700000000000-abcd123",
    "status": "success",
    "stepResults": [
      {
        "id": "snap",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  },
  "deviceId": "<device_serial>",
  "terminalSource": "clawperator_result",
  "isCanonicalTerminal": true
}
```

Agent-side success test:

- `envelope.status == "success"`
- `envelope.stepResults[0].actionType == "snapshot_ui"`
- `envelope.stepResults[0].success == true`
- `"text" in envelope.stepResults[0].data`

## Related Pages

- [Actions](actions.md)
- [Selectors](selectors.md)
- [Errors](errors.md)
- [Devices](devices.md)
- [Doctor](doctor.md)
- [Serve API](serve.md)
- [Setup](../setup.md)
