# Clawperator Snapshot Format

This is the canonical reference for the structure returned by Clawperator
snapshot surfaces.

Use this page as the source of truth for:

- `snapshot_ui` result payloads
- `clawperator observe snapshot`
- the `hierarchy_xml` UI tree format
- how snapshot fields relate to `NodeMatcher`

## Contract summary

`snapshot_ui` and `clawperator observe snapshot` use the same internal
pipeline and return the same canonical snapshot format: `hierarchy_xml`.

On success:

- `data.actual_format` is always `"hierarchy_xml"`
- `data.text` contains the XML hierarchy as a string

The Android runtime emits the hierarchy dump, and the Node layer attaches that
raw XML into the result envelope after execution.

Important: raw snapshot presence does not always mean the node is currently
fully on-screen. Some Android views include clipped or off-screen descendants
in the hierarchy dump, especially inside large scroll containers.

## Relationship to Android UI Automator

Clawperator's snapshot structure is modeled after Android UI Automator output,
so the overall shape should feel familiar to agents and developers who have
used UI Automator dumps before.

It is not a byte-for-byte copy.

Agents should assume:

- the high-level hierarchy and common node attributes are intentionally similar
- Clawperator wraps the snapshot inside its own execution result envelope
- Clawperator may normalize surrounding metadata and matching guidance
- Clawperator-specific semantics such as `NodeMatcher.role` are not direct
  copies of raw UI Automator fields

Use UI Automator knowledge as a mental model, not as an exact parser contract.

## Envelope placement

Example request:

```json
{
  "deviceId": "<device_id>",
  "execution": {
    "commandId": "cmd-snap-1",
    "taskId": "task-snap-1",
    "source": "local-test",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "snap1", "type": "snapshot_ui" }
    ]
  }
}
```

Example success response:

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

Failure case:

- if post-processing completes without attached hierarchy text, the step returns
  `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"`

Troubleshooting for that case lives in
[Troubleshooting the Operator App](../troubleshooting/troubleshooting.md).

## hierarchy_xml

Each `<node>` represents one UI element.

The XML is close to Android UI Automator hierarchy output, but Clawperator docs
define how agents should interpret the fields for this product.

| XML attribute | NodeMatcher field | Notes |
| :--- | :--- | :--- |
| `resource-id` | `resourceId` | `"com.example.app:id/name"`. Empty string when not set by developer. |
| `text` | `textEquals` / `textContains` | Visible text content. Empty string if none. |
| `content-desc` | `contentDescEquals` / `contentDescContains` | Accessibility label. Empty string if none. |
| `class` | - | Java widget class name. Informational only. `NodeMatcher.role` uses Clawperator semantic role names, not the raw `class` string. |
| `clickable` | - | `"true"` if the element accepts tap events. |
| `scrollable` | - | `"true"` marks a scroll container. |
| `bounds` | - | `"[x1,y1][x2,y2]"` pixel rectangle. Useful for spatial layout. |
| `enabled` | - | `"false"` means visible but not interactable. |
| `long-clickable` | - | `"true"` if the element accepts long-press. |

## Parsing guidance

### What to rely on most

When building selectors, prefer:

1. `resource-id`
2. `content-desc`
3. exact `text`
4. substring matching
5. semantic `role`

### Important differences from raw UI Automator assumptions

- `NodeMatcher.role` is a Clawperator semantic layer, not the raw `class`
  attribute.
- Snapshot content is carried in `data.text` inside the result envelope, not as
  a standalone dump file.
- Agents should reason over both the XML tree and the execution envelope, not
  just the XML alone.
- Some screens include descendants that are technically present in the raw XML
  but are still clipped outside the current viewport. Treat `bounds`,
  clickability, and follow-up actions such as `wait_for_node` or
  `scroll_until` as the operational truth for what is actually reachable.

### XML escaping

Snapshot output is XML, so special characters in attribute values are escaped.
For example:

- apostrophe becomes `&apos;`
- ampersand becomes `&amp;`

These escaped sequences are returned as-is in `data.text`.

For a node with `content-desc="Search for &apos;vlc&apos;"`:

- `contentDescContains: "Search for"` works
- `contentDescEquals: "Search for 'vlc'"` fails because the apostrophe is not
  decoded after extraction

## Annotated live-device example

The example below is preserved from a real Android Settings capture and should
remain the canonical example unless replaced with a better real-device sample.

```xml
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout"
        package="com.android.settings" content-desc=""
        clickable="false" enabled="true" scrollable="false"
        bounds="[0,0][1080,2340]">
    ...
        <!-- Scrollable list. Use as 'container' in scroll_and_click, scroll, or scroll_until -->
        <node index="0" text="" resource-id="com.android.settings:id/recycler_view"
              class="androidx.recyclerview.widget.RecyclerView"
              package="com.android.settings" content-desc=""
              clickable="false" enabled="true" focusable="true" scrollable="true"
              bounds="[0,884][1080,2196]">

          <!-- Icon-only button. No text, so target via content-desc -->
          <node index="0" text="" resource-id="" class="android.widget.Button"
                package="com.android.settings" content-desc="Search settings"
                clickable="true" enabled="true" focusable="true"
                bounds="[912,692][1080,884]" />

          <!-- Clickable row. The LinearLayout is the tap target -->
          <node index="2" text="" resource-id="" class="android.widget.LinearLayout"
                package="com.android.settings" content-desc=""
                clickable="true" enabled="true" scrollable="false"
                bounds="[30,1252][1050,1461]">
            <!-- Title label with stable resource-id -->
            <node index="0" text="Connections" resource-id="android:id/title"
                  class="android.widget.TextView" package="com.android.settings"
                  content-desc="" clickable="false" enabled="true"
                  bounds="[216,1294][507,1364]" />
            <!-- Subtitle label -->
            <node index="1" text="Wi-Fi  •  Bluetooth  •  SIM manager"
                  resource-id="android:id/summary" class="android.widget.TextView"
                  package="com.android.settings" content-desc=""
                  clickable="false" enabled="true"
                  bounds="[216,1364][816,1419]" />
          </node>

          <node index="3" text="" resource-id="" class="android.widget.LinearLayout"
                package="com.android.settings" content-desc=""
                clickable="true" enabled="true" scrollable="false"
                bounds="[30,1461][1050,1721]">
            <node index="0" text="Connected devices" resource-id="android:id/title"
                  class="android.widget.TextView" package="com.android.settings"
                  content-desc="" clickable="false" enabled="true"
                  bounds="[216,1503][661,1573]" />
            <node index="1" text="Quick Share  •  Samsung DeX  •  Android Auto"
                  resource-id="android:id/summary" class="android.widget.TextView"
                  package="com.android.settings" content-desc=""
                  clickable="false" enabled="true"
                  bounds="[216,1573][996,1679]" />
          </node>

        </node>
    ...
  </node>
</hierarchy>
```

## Reading patterns

- Tap targets are often `clickable="true"` container nodes whose child labels
  hold the visible text.
- Icon-only buttons often have empty `text` and rely on `content-desc`.
- Scroll containers expose `scrollable="true"`.
- Disabled elements have `enabled="false"` and usually require state change
  before interaction.

## Apps with weak or missing resource IDs

Many production apps leave `resource-id=""` on most nodes. In those cases,
fallback priority is:

1. `contentDescEquals`
2. `textEquals`
3. `contentDescContains` or `textContains`
4. `role: "textfield"` for text inputs without stable IDs

When labels contain dynamic values, counts, or escaped characters, prefer
substring matching over exact equality.
