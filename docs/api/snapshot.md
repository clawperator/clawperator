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

## Annotated Live-Device Example

Full `clawperator snapshot --json` output from a physical Samsung Galaxy device
with Android Settings open. Device serial redacted to `<device_serial>`.

### Envelope

```json
{
  "envelope": {
    "commandId": "snapshot-1774924560470-bj129yk",
    "taskId": "snapshot-1774924560470-bj129yk",
    "status": "success",
    "stepResults": [
      {
        "id": "snap",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "actual_format": "hierarchy_xml",
          "foreground_package": "com.android.settings",
          "has_overlay": "true",
          "overlay_package": "com.sec.android.app.launcher",
          "window_count": "3",
          "text": "<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n<hierarchy rotation=\"0\">...</hierarchy>"
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

Fields to note:

- `actual_format`, `foreground_package`, `has_overlay`, `overlay_package`, and
  `window_count` appear in the `data` object alongside `text`. They are
  runtime-detail fields emitted by the Android side and are not part of the
  Node-guaranteed contract. An agent may read them opportunistically (for
  example, confirming `foreground_package` before proceeding), but must not
  depend on them being present in all environments or versions.
- `terminalSource: "clawperator_result"` and `isCanonicalTerminal: true`
  are outer-envelope fields added by the terminal output layer; they are not
  part of the `envelope` sub-object.

### Annotated XML Fragment

The full hierarchy is trimmed to show the structurally important layers.
Omitted attributes (checkable, checked, focused, long-clickable, password,
selected) are present in real output but rarely useful for targeting.

```xml
<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
<!--
  rotation="0" - device is portrait. Bounds coordinates use portrait dimensions.
  On this device: 1080 x 2340 pixels.
-->
<hierarchy rotation="0">

  <!-- ... several wrapper containers ... -->

  <!--
    action_bar: contains the screen title text node and the search button.
    Not scrollable; always visible at the top of the screen.
  -->
  <node
    resource-id="com.android.settings:id/action_bar"
    class="android.view.ViewGroup"
    package="com.android.settings"
    clickable="false"
    scrollable="false"
    bounds="[0,706][1080,922]">

    <!--
      The visible screen title. Use text="Settings" to confirm the active screen.
      clickable="false" - this is a label, not a tap target.
    -->
    <node
      text="Settings"
      resource-id=""
      class="android.widget.TextView"
      package="com.android.settings"
      clickable="false"
      enabled="true"
      bounds="[84,782][331,869]" />

    <!--
      Search button. No resource-id, but content-desc="Search settings" is stable.
      clickable="true" - this is a tap target.
      To tap: use contentDescEquals selector with value "Search settings".
    -->
    <node
      text=""
      resource-id=""
      class="android.widget.Button"
      package="com.android.settings"
      content-desc="Search settings"
      clickable="true"
      enabled="true"
      focusable="true"
      bounds="[912,730][1080,922]" />
  </node>

  <!--
    recycler_view: the scrollable list container.
    scrollable="true" - this is the node to target for scroll actions.
    Use resourceId selector with value "com.android.settings:id/recycler_view".
    bounds spans the full list area below the action bar.
  -->
  <node
    resource-id="com.android.settings:id/recycler_view"
    class="androidx.recyclerview.widget.RecyclerView"
    package="com.android.settings"
    clickable="false"
    enabled="true"
    scrollable="true"
    bounds="[0,922][1080,2295]">

    <!--
      A settings list row. The row container is clickable, not the child text nodes.
      No resource-id on the row itself - target by the child title text instead.
      bounds="[30,1290][1050,1499]" - tap center is approximately (540, 1394).
    -->
    <node
      text=""
      resource-id=""
      class="android.widget.LinearLayout"
      package="com.android.settings"
      clickable="true"
      enabled="true"
      focusable="true"
      bounds="[30,1290][1050,1499]">

      <!--
        Icon container. Not useful for targeting.
      -->
      <node
        resource-id="com.android.settings:id/icon_frame"
        class="android.widget.FrameLayout"
        clickable="false"
        bounds="[84,1352][216,1436]" />

      <node
        resource-id=""
        class="android.widget.RelativeLayout"
        clickable="false"
        bounds="[216,1290][816,1499]">

        <!--
          Title text node.
          resource-id="android:id/title" is consistent across Settings rows.
          Use textEquals selector with this resource-id to locate a specific row.
          clickable="false" - click the parent LinearLayout, not this node.
        -->
        <node
          text="Connections"
          resource-id="android:id/title"
          class="android.widget.TextView"
          package="com.android.settings"
          clickable="false"
          enabled="true"
          bounds="[216,1332][507,1402]" />

        <!--
          Summary text node.
          resource-id="android:id/summary" shows current state or sub-items.
          Useful for reading current values without navigating into the screen.
        -->
        <node
          text="Wi-Fi  •  Bluetooth  •  SIM manager"
          resource-id="android:id/summary"
          class="android.widget.TextView"
          package="com.android.settings"
          clickable="false"
          enabled="true"
          bounds="[216,1402][816,1457]" />
      </node>
    </node>

    <!-- Second row follows the same pattern -->
    <node
      text=""
      resource-id=""
      class="android.widget.LinearLayout"
      package="com.android.settings"
      clickable="true"
      enabled="true"
      focusable="true"
      bounds="[30,1499][1050,1759]">

      <node
        resource-id="com.android.settings:id/icon_frame"
        class="android.widget.FrameLayout"
        clickable="false"
        bounds="[84,1587][216,1671]" />

      <node
        resource-id=""
        class="android.widget.RelativeLayout"
        clickable="false"
        bounds="[216,1499][996,1759]">

        <node
          text="Connected devices"
          resource-id="android:id/title"
          class="android.widget.TextView"
          package="com.android.settings"
          clickable="false"
          enabled="true"
          bounds="[216,1587][578,1657]" />

        <node
          text="Quick Share  •  Samsung DeX  •  Android Auto"
          resource-id="android:id/summary"
          class="android.widget.TextView"
          package="com.android.settings"
          clickable="false"
          enabled="true"
          bounds="[216,1657][996,1712]" />
      </node>
    </node>

    <!-- ... more rows below ... -->

  </node>
</hierarchy>
```

### Targeting Patterns from This Example

| Goal | Selector approach |
| --- | --- |
| Confirm Settings is open | `textEquals: "Settings"` on a TextView |
| Tap a named settings row | `resourceId: "android:id/title"` + `textEquals: "Connections"` to locate, then click parent row |
| Read current state of a row | `resourceId: "android:id/summary"` + nearby `textEquals` for the row title |
| Tap the search button | `contentDescEquals: "Search settings"` |
| Scroll the list | `resourceId: "com.android.settings:id/recycler_view"` as scroll target |

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

This constant is defined in `apps/node/src/contracts/limits.ts`, but the current Node extraction path in `snapshotHelper.ts` does not actively clamp snapshots to 2000 lines. Treat it as a documented size-limit constant, not as a currently enforced truncation rule in extraction.

The same limits file also defines:

- `MAX_SNAPSHOT_BYTES = 262144`

Operationally:

- do not assume Node will truncate at 2000 lines today
- do assume very large hierarchies are higher risk across extraction, payload handling, and downstream consumers
- keep large XML payloads within the documented size constants when possible

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
