# Snapshot Format

## Purpose

Define what `snapshot_ui` returns, where the XML hierarchy is attached in the result envelope, what extraction failures look like, and what parts of the snapshot contract an agent can rely on.

## Sources

- Snapshot extraction: `apps/node/src/domain/executions/snapshotHelper.ts`
- Snapshot post-processing: `apps/node/src/domain/executions/runExecution.ts`
- Hard limits: `apps/node/src/contracts/limits.ts`
- Snapshot builder: `apps/node/src/domain/observe/snapshot.ts`
- Action contract summary: `docs/api/actions.md`

## What `snapshot_ui` Returns

`snapshot_ui` is the canonical read-only UI observation action. The Android runtime writes the hierarchy dump to logcat, then the Node layer extracts the XML and attaches it to the successful step result as `data.text`.

The built-in `clawperator snapshot` command constructs a one-step execution with these exact defaults:

- `source: "clawperator-observe"`
- `expectedFormat: "android-ui-automator"`
- `timeoutMs: 30000` when `buildSnapshotExecution()` is called without an override
- one action with `id: "snap"` and `type: "snapshot_ui"`
- `mode: "direct"`
- `commandId` is generated as `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
- `taskId` equals the generated `commandId`

For CLI `snapshot --json`, machine-checkable success means:

- exit code `0`
- top-level JSON has `envelope`
- `envelope.status == "success"`
- `envelope.stepResults[0].actionType == "snapshot_ui"`
- `envelope.stepResults[0].success == true`
- `envelope.stepResults[0].data.text` is present

Example one-step payload from the `clawperator snapshot` builder:

```json
{
  "commandId": "snapshot-1700000000000-abcd123",
  "taskId": "snapshot-1700000000000-abcd123",
  "source": "clawperator-observe",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "snap",
      "type": "snapshot_ui"
    }
  ],
  "mode": "direct"
}
```

## How Snapshot Data Flows

The current flow is:

1. Android executes `snapshot_ui`.
2. Android writes the hierarchy dump into logcat lines that include the marker `[TaskScope] UI Hierarchy:`.
3. Node reads those logcat lines after execution.
4. `extractSnapshotsFromLogs()` reconstructs one or more XML documents from the log stream.
5. `attachSnapshotsToStepResults()` walks backward through successful `snapshot_ui` steps and attaches the extracted XML as `stepResults[i].data.text`.
6. `markExtractionFailedSnapshotSteps()` converts any still-successful snapshot step with missing `data.text` into a failed step with `data.error = "SNAPSHOT_EXTRACTION_FAILED"`.
7. `addSettleWarnings()` may attach `data.warn` if the snapshot action immediately follows `click` or `scroll_and_click`.

Debugging details that matter when extraction goes wrong:

- `runExecution()` clears logcat before dispatch with `adb logcat -c`
- after the execution finishes, Node dumps logcat with `adb logcat -d -v tag`
- `snapshotHelper.ts` only extracts blocks from lines containing `[TaskScope] UI Hierarchy:`

Important boundaries:

- Node does not parse the XML into a typed object. It treats the hierarchy as opaque text.
- When multiple snapshots exist in one execution, Node attaches the most recent extracted snapshot to the most recent successful `snapshot_ui` step, walking backward through both lists.
- If no successful `snapshot_ui` steps exist, extraction output is ignored.
- Node only reads logcat for snapshot extraction when the result envelope already contains at least one `snapshot_ui` step.
- for direct snapshot executions like `clawperator snapshot`, the step `id` matches the action `id` (`"snap"`)

## Envelope Placement

Successful `snapshot_ui` data lives inside the step result, not in a separate top-level field:

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
          "text": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><hierarchy rotation=\"0\">...</hierarchy>"
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

Verification pattern - confirm the snapshot contract is active:

```bash
clawperator snapshot --json --device <device_serial>
```

Check these exact fields:

```json
{
  "envelope": {
    "status": "success",
    "stepResults": [
      {
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ]
  }
}
```

## The XML Format

Node's contract is that `data.text` contains the raw XML hierarchy string. Node does not validate individual XML attributes, but the extracted content follows Android UI Automator style hierarchy dumps with a `<hierarchy>` root and nested `<node>` elements.

Typical node attributes visible in current snapshots include:

| XML attribute | Meaning | Related selector field |
| --- | --- | --- |
| `resource-id` | Android resource id, often `package:id/name` | `resourceId` |
| `text` | visible text | `textEquals`, `textContains` |
| `content-desc` | accessibility label | `contentDescEquals`, `contentDescContains` |
| `class` | widget class name such as `android.widget.TextView` | none |
| `bounds` | screen rectangle in `"[x1,y1][x2,y2]"` form | none |
| `package` | package name for the node | none |
| `clickable` | `"true"` or `"false"` | none |
| `enabled` | `"true"` or `"false"` | none |
| `scrollable` | `"true"` or `"false"` | none |

Important limits on what to infer:

- `data.text` is the only Node-guaranteed snapshot success field today.
- `NodeMatcher.role` is a Clawperator selector concept documented in [Selectors](selectors.md), not a direct XML attribute.
- A node appearing in the XML does not guarantee it is currently reachable on screen. Use `bounds`, scrolling, and follow-up actions to confirm reachability.

Current runtime note:

- Android-side code currently also emits keys such as `actual_format`, `foreground_package`, `has_overlay`, `overlay_package`, and `window_count`
- those keys are not documented as Node-guaranteed success fields in the current Node contract
- agents should rely on `data.text` first and treat other snapshot metadata as opportunistic runtime data

## Realistic XML Fragment

```xml
<?xml version="1.0" encoding="UTF-8"?>
<hierarchy rotation="0">
  <node
    index="0"
    text=""
    resource-id="com.android.settings:id/recycler_view"
    class="androidx.recyclerview.widget.RecyclerView"
    package="com.android.settings"
    content-desc=""
    clickable="false"
    enabled="true"
    scrollable="true"
    bounds="[0,884][1080,2196]">
    <node
      index="0"
      text="Connected devices"
      resource-id="android:id/title"
      class="android.widget.TextView"
      package="com.android.settings"
      content-desc=""
      clickable="false"
      enabled="true"
      bounds="[216,1503][661,1573]" />
  </node>
</hierarchy>
```

## Extraction Failure

If a `snapshot_ui` step initially succeeds but Node cannot attach `data.text`, Node rewrites that step into a failure:

```json
{
  "id": "snap",
  "actionType": "snapshot_ui",
  "success": false,
  "data": {
    "error": "SNAPSHOT_EXTRACTION_FAILED",
    "message": "UI hierarchy extraction produced no output for this step. Check clawperator version compatibility and logcat extraction health."
  }
}
```

This is not just a warning. It changes the step to `success: false`, and later envelope reconciliation can change the whole execution to `status: "failed"`.

Typical recovery:

1. Run `clawperator version --check-compat`.
2. Run `clawperator doctor --json`.
3. Re-run the snapshot with `--verbose` if you need to inspect log correlation and the `[TaskScope] UI Hierarchy:` marker.

Verification pattern - confirm extraction failure handling:

```bash
clawperator snapshot --json --device <device_serial>
```

If extraction failed, branch on:

```json
{
  "envelope": {
    "status": "failed",
    "stepResults": [
      {
        "actionType": "snapshot_ui",
        "success": false,
        "data": {
          "error": "SNAPSHOT_EXTRACTION_FAILED"
        }
      }
    ]
  }
}
```

Related error case:

- if the command never returns an envelope at all, the caller gets a top-level `RESULT_ENVELOPE_TIMEOUT` error instead of a snapshot step result

## Settle Warning

Node also adds a best-effort warning to successful snapshots when the immediately preceding action was `click` or `scroll_and_click`:

```json
{
  "warn": "snapshot captured without a preceding sleep step; UI may not have settled - consider adding a sleep step between click and snapshot_ui"
}
```

This warning appears only when:

- the snapshot step is successful
- Node can map the step id back to the original action order
- the previous action in that execution was `click` or `scroll_and_click`

Any intervening action such as `sleep`, `wait_for_node`, or `read_text` suppresses this warning because it may already provide settling time.

## Snapshot Line Limit

`LIMITS.MAX_SNAPSHOT_LINES` is `2000`.

This is the current hard limit documented in `apps/node/src/contracts/limits.ts`. Treat it as the upper bound for snapshot extraction and downstream handling. If you depend on very large hierarchies, do not assume more than 2000 lines of XML will remain safe across versions.

The same limits file also defines:

- `MAX_SNAPSHOT_BYTES = 262144`

This page's primary hard gate is the line limit because that is the explicit snapshot-specific limit called out in the Phase 3 task, but large XML payloads should stay within both limits.

## Successful Step Example

```json
{
  "id": "snap",
  "actionType": "snapshot_ui",
  "success": true,
  "data": {
    "text": "<?xml version=\"1.0\" encoding=\"UTF-8\"?><hierarchy rotation=\"0\"><node index=\"0\" text=\"Settings\" resource-id=\"com.android.settings:id/action_bar\" class=\"android.widget.TextView\" package=\"com.android.settings\" content-desc=\"\" clickable=\"false\" enabled=\"true\" bounds=\"[0,0][1080,176]\" /></hierarchy>"
  }
}
```

## What To Rely On

- rely on `stepResults[i].data.text` as the canonical snapshot payload
- rely on `SNAPSHOT_EXTRACTION_FAILED` when text extraction failed after execution
- rely on `RESULT_ENVELOPE_TIMEOUT` when no usable result envelope returned at all
- treat `data.warn` as advisory only
- treat Android-emitted metadata fields beyond `text` as runtime details, not as Node-guaranteed contract fields
- use [Selectors](selectors.md) to map XML attributes into actionable selector objects

## Related Pages

- [API Overview](overview.md)
- [Actions](actions.md)
- [Selectors](selectors.md)
- [Errors](errors.md)
- [Navigation Patterns](navigation.md)
