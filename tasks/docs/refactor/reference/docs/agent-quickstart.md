# Agent Quickstart

This is the fastest path for a cold-start agent to go from "Clawperator is
installed" to "I ran a real command and know how to inspect the result."

Use this page first, then branch into:

- [Clawperator Snapshot Format](../reference/snapshot-format.md) for the exact
  `snapshot_ui` output structure
- [Clawperator Node API - Agent Guide](node-api-for-agents.md) for the full
  contract
- [API Overview](../reference/api-overview.md) for a shorter reference path
- [Multi-Device Workflows for Agents](multi-device-workflows.md) if more than
  one Android target is connected

## What Clawperator is

Clawperator is the hand. Your external agent is the brain.

- the brain decides what to do on the user's behalf
- Clawperator executes validated Android UI actions deterministically
- Clawperator returns structured results that the brain can reason over

Clawperator is not a planner or a policy engine. It does not decide which user
inputs are appropriate. It just provides the interaction primitives.

## Before you start

Make sure the runtime is ready:

```bash
clawperator doctor --json
clawperator devices --json
```

If multiple devices are connected, always pass `--device <device_id>` so
targeting stays explicit.

If the current CLI behavior and a narrative doc ever seem to disagree, prefer
subcommand help for the exact shipped flags and usage:

```bash
clawperator snapshot --help
clawperator screenshot --help
clawperator click --help
clawperator open --help
clawperator type --help
clawperator skills compile-artifact --help
clawperator skills run --help
clawperator doctor --help
```

## Step 1 - Take a snapshot

The quickest way to inspect the current UI is:

```bash
clawperator snapshot --device <device_id> --json
```

Successful snapshot output includes:

- one result envelope
- `stepResults[0].actionType = "snapshot_ui"`
- `stepResults[0].data.actual_format = "hierarchy_xml"`
- optional snapshot metadata such as `foreground_package`, `has_overlay`, and
  `window_count`
- `stepResults[0].data.text` containing the XML hierarchy

Example response shape:

```json
{
  "ok": true,
  "envelope": {
    "commandId": "cmd-snap-1",
    "taskId": "task-snap-1",
    "status": "success",
    "stepResults": [
      {
        "id": "snap1",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "actual_format": "hierarchy_xml",
          "foreground_package": "com.android.settings",
          "has_overlay": "false",
          "window_count": "2",
          "text": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

Read the XML in `data.text` to identify:

- stable `resource-id` values
- visible labels in `text`
- icon labels in `content-desc`
- scroll containers via `scrollable="true"`

The full parsing contract lives in
[Clawperator Snapshot Format](../reference/snapshot-format.md).

## Step 2 - Run a first execution payload

The smallest useful first execution usually opens an app, gives it a moment to
settle, then snapshots the result.

Example payload:

```json
{
  "commandId": "quickstart-001",
  "taskId": "quickstart-001",
  "source": "cold-start-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 15000,
  "actions": [
    {
      "id": "open-settings",
      "type": "open_app",
      "params": { "applicationId": "com.android.settings" }
    },
    {
      "id": "settle",
      "type": "sleep",
      "params": { "durationMs": 1000 }
    },
    {
      "id": "snap-settings",
      "type": "snapshot_ui"
    }
  ]
}
```

Run it with:

```bash
clawperator exec --device <device_id> --execution /path/to/execution.json --json
```

## Step 3 - Read the result envelope correctly

Always check both:

1. `envelope.status`
2. each `stepResults[n].success`

Those mean different things:

- `envelope.status = "failed"` means the execution as a whole failed
- `stepResults[n].success = false` means one step failed, even if the overall
  execution still completed

That distinction matters for actions like `close_app`, where the overall
execution may complete even though the step reports a per-step failure.

If a command fails unexpectedly, check the persistent log file at
`~/.clawperator/logs/clawperator-YYYY-MM-DD.log` or use `RESULT_ENVELOPE_TIMEOUT.details.logPath`
when the timeout error includes one. Filter by `commandId` to see the preflight,
broadcast, and envelope events that led up to the failure.

## Step 4 - Use the default agent loop

For unknown apps, use a single-action plus re-observe loop:

1. snapshot
2. decide what to press or read
3. execute one action or one tight sequence
4. snapshot again
5. repeat

This is the safe default for cold-start usage. Use larger multi-action payloads
only after the UI path is already known.

## What to read next

- [Action Types Reference](../reference/action-types.md) - Complete reference for all action params and result shapes
- [Clawperator Snapshot Format](../reference/snapshot-format.md)
- [Execution Model](../reference/execution-model.md)
- [Error Handling Guide](../reference/error-handling.md)
- [Device and Package Model](../reference/device-and-package-model.md)
- [Multi-Device Workflows for Agents](multi-device-workflows.md)
- [Skill Development Workflow](../skills/skill-development-workflow.md)
- [Clawperator Node API - Agent Guide](node-api-for-agents.md)
- [API Overview](../reference/api-overview.md)
- [CLI Reference](../reference/cli-reference.md)
