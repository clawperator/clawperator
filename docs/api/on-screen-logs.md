# On-screen Logs

## Purpose

`set_on_screen_log` and `clear_on_screen_log` are raw execution actions for a
small Operator-owned diagnostic panel. The panel is useful for showing a static
execution label while an action list works in another app.

The panel belongs to the connected Operator accessibility service, not to the
foreground app and not to a host process. It is one visible panel per Operator
service.

This feature requires Android API 22 or later. On Android API 21,
`set_on_screen_log` fails closed with `ON_SCREEN_LOG_RENDER_FAILED` before it
attempts to attach a window.

## Sources

- Node validation: `apps/node/src/domain/executions/validateExecution.ts`
- Node screenshot finalization: `apps/node/src/domain/executions/runExecution.ts`
- Android action parsing: `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- Panel controller: `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/onscreenlog/OnScreenLogPanelController.kt`
- Result mapping: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt`
- Snapshot metadata: `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt`

## Raw Actions

Use canonical lower-case action names in stored execution payloads. There is no
separate CLI convenience command, HTTP endpoint, or MCP tool for this feature.
Existing generic execution transports carry the same raw action list.

| Canonical action | Exact Node input alias | Purpose | Parameters |
| --- | --- | --- | --- |
| `set_on_screen_log` | `on_screen_log_set` | Show or replace the current panel. | `text` is required. All other fields are optional. |
| `clear_on_screen_log` | `on_screen_log_clear` | Remove the current panel. | Omit `params` or use exactly `{}`. |

At the Node execution boundary, the two aliases above normalize to their
canonical types before validation and dispatch. Result `actionType` values stay
canonical. Do not change case or add surrounding whitespace to either a
canonical type or an alias. Their parameter objects are strict and do not
translate generic keys such as `value` to `text`.

See [Actions](actions.md#action-set-on-screen-log) for the complete parameter
table and validation limits.

### Set example

```json
{
  "commandId": "on-screen-log-example",
  "taskId": "on-screen-log-example",
  "source": "agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "show-label",
      "type": "set_on_screen_log",
      "params": {
        "text": "FLOW-001: Observe settings",
        "anchor": "right",
        "textAlign": "left",
        "topOffsetDp": 8,
        "edgeOffsetDp": 12,
        "widthDp": 320,
        "fontSizeSp": 16,
        "textColor": "#FFFFFFFF",
        "backgroundColor": "#B3000000",
        "ttlMs": 12000
      }
    },
    {
      "id": "observe-label",
      "type": "snapshot"
    },
    {
      "id": "clear-label",
      "type": "clear_on_screen_log"
    }
  ]
}
```

## Replacement and Lifetime

Each successful `set_on_screen_log` replaces the entire current panel. It does
not patch omitted fields from a prior panel. Defaults apply again for every
omitted optional field.

Node and Android validate the complete new payload before it can change an
existing panel. A malformed payload therefore cannot alter the visible panel.

After Android acknowledges that the requested panel generation has drawn, the
service schedules one local expiry for `ttlMs`. Expiry removes that same
generation only. A replacement or `clear_on_screen_log` cancels the older
expiry. The panel does not show a countdown, tick, or receive host-driven
elapsed-time updates.

Calling `clear_on_screen_log` while no panel is visible succeeds and returns
the same cleared result.

## Placement, Geometry, and Text

`anchor` selects the physical left or right side of the usable display. The
controller first excludes system-bar and display-cutout insets, then applies
`topOffsetDp` from the usable top edge and `edgeOffsetDp` inward from the
selected usable side.

`widthDp` is the full panel width, including its fixed 8 dp inner padding.
`fontSizeSp` follows Android font scale. The result `bounds` is the actual
physical-pixel rectangle in `[left,top][right,bottom]` form after those
conversions.

On Android 10 (API 29), the controller reads the default display's public
cutout safe insets. On Android 9 (API 28), a service cannot obtain those
insets from a public display-level API before an overlay is attached. If the
framework declares a built-in cutout on API 28, `set_on_screen_log` fails with
`ON_SCREEN_LOG_LAYOUT_INVALID` rather than attach with unknown unsafe geometry.

The panel accepts multiline text. If it cannot fit in the remaining usable
vertical area, Android truncates the text when at least one complete line fits
and returns `truncated: "true"`. If even one complete line plus padding cannot
fit, the action fails with `ON_SCREEN_LOG_LAYOUT_INVALID`.

When Android configuration changes, the service recomputes the panel using its
stored logical dp and sp values. If the new usable area cannot contain it, the
service removes the panel rather than leaving stale geometry on screen.

## Successful Result Data

On a successful `set_on_screen_log`, the step has these exact string-valued
data keys:

| Key | Meaning |
| --- | --- |
| `visible` | Always `"true"`. |
| `rendered` | Always `"true"` after Android acknowledges the generation's draw. |
| `truncated` | `"true"` when text was shortened to fit, otherwise `"false"`. |
| `anchor` | Resolved `left` or `right`. |
| `text_align` | Resolved `left` or `right`. |
| `top_offset_dp` | Resolved integer input as a string. |
| `edge_offset_dp` | Resolved integer input as a string. |
| `width_dp` | Resolved integer input as a string. |
| `font_size_sp` | Resolved integer input as a string. |
| `text_color` | Uppercase normalized `#AARRGGBB` value. |
| `background_color` | Uppercase normalized `#AARRGGBB` value. |
| `ttl_ms` | Resolved integer input as a string. |
| `bounds` | Actual pixel rectangle in `[left,top][right,bottom]` form. |

The result never echoes the caller's `text`.

On a successful `clear_on_screen_log`, step data is exactly:

```json
{
  "visible": "false"
}
```

It does not include `rendered`.

## Rendering, Interaction, and Capture Limits

The panel uses an accessibility-overlay window that is not touchable or
focusable. It does not become an accessibility text node, so its label cannot
be selected by normal UI-tree matching or `read_text`. Underlying app input can
continue through the panel.

`rendered: "true"` is a draw acknowledgement from the Android panel view. It
confirms that the requested generation drew before the controller deadline. It
does not guarantee that a later compositor capture, screenshot, or external
screen recorder includes the panel. Treat screenshots as separate observations
and verify them independently when their pixels matter.

The panel is not a secure window. Capture inclusion remains dependent on the
device and capture path.

### Current raw screenshot ordering

For `take_screenshot`, the current Node runtime captures host pixels after the
Android action list has returned its result envelope. A single action list that
orders `set_on_screen_log`, `take_screenshot`, and `clear_on_screen_log` can
therefore write a screenshot after the clear has already removed the panel.

To capture a visible panel with the raw CLI or Serve transport, use separate
executions in this order:

1. `set_on_screen_log`
2. `take_screenshot` with the caller-selected absolute path
3. `clear_on_screen_log`

The MCP `execute` tool rejects caller-controlled `take_screenshot` paths. For
MCP, omit `params.path` and use the runtime-managed `data.path` returned in the
result envelope if that path is useful to the MCP client. The same ordering
limit still applies to separate executions.

This is a capture-ordering limit of the existing screenshot pipeline, not a
stronger rendering acknowledgement. The panel's `rendered: "true"` result still
means only that Android drew the requested generation.

## Verification

Save the JSON action list from the example above to an absolute path and first
validate it without a device:

```bash
clawperator exec --payload <absolute_path_to_execution.json> --validate-only
```

Success has exit code `0`, `ok: true`, and `validated: true`. Validation rejects
bad panel parameters with `EXECUTION_VALIDATION_FAILED` before dispatch.

For a live check, run a raw execution that orders `set_on_screen_log`,
`snapshot`, and `clear_on_screen_log` with an explicit target:

```bash
clawperator exec --payload <absolute_path_to_execution.json> --device <device_serial> --operator-package <package_name> --no-daemon
```

On a successful run, check all of these exact result paths:

- `envelope.status == "success"`
- the set step has `success == true`, `data.visible == "true"`, and `data.rendered == "true"`
- the snapshot step has `success == true` and `data.operator_overlay_visible == "true"`
- the clear step has `success == true` and `data.visible == "false"`

If capture pixels matter, run a separate raw `take_screenshot` execution while
the panel remains visible. The raw CLI and Serve transports can use a
caller-selected output file; MCP must omit `params.path` and returns its
runtime-managed path in step data. Do not use a successful draw acknowledgement
as proof of screenshot inclusion.

## Failure Modes

| Surface | Code | Meaning and recovery |
| --- | --- | --- |
| Input validation | `EXECUTION_VALIDATION_FAILED` | The action name, parameter type, range, color, or strict object shape is invalid. Correct the payload and rerun it. The current panel is unchanged. |
| Service | `ON_SCREEN_LOG_SERVICE_UNAVAILABLE` | The Operator accessibility service or its window host is unavailable. Repair the service, then rerun the raw action. |
| Layout | `ON_SCREEN_LOG_LAYOUT_INVALID` | The usable display cannot contain the requested panel or one complete line. Adjust the supplied geometry or text and retry. |
| Rendering | `ON_SCREEN_LOG_RENDER_FAILED` | Android could not attach or update the panel. Verify service health, then issue a replacement action. |
| Draw acknowledgement | `ON_SCREEN_LOG_RENDER_TIMEOUT` | Android did not acknowledge a draw before the 2000 ms controller limit. Treat visibility as unconfirmed, inspect a new snapshot, and retry only if needed. |

See [Errors](errors.md#on-screen-log-panel-failures) for the exact structured
failure contract.

## Snapshot Metadata

A successful Android `snapshot` includes the string field
`operator_overlay_visible`:

| Value | Meaning |
| --- | --- |
| `"true"` | The current Operator-owned on-screen log panel is visible. |
| `"false"` | No current Operator-owned on-screen log panel is visible. |

This field deliberately has narrower meaning than `has_overlay`,
`overlay_package`, and `window_count`. Those existing fields preserve their raw
runtime metadata and are not changed or filtered by this feature. See
[Snapshot Format](snapshot.md) for the normal snapshot result contract.

## Generic Transports

Use the same JSON action objects with these existing execution surfaces:

- `clawperator exec` using a raw execution payload
- `POST /execute` in the [Serve API](serve.md#endpoint-post-execute)
- the MCP [`execute`](mcp.md#mcp-tool-execute) tool

After a transport accepts an action object, canonical action validation happens
before Android dispatch. Invalid action names, parameter types, ranges, colors,
and strict object shapes return `EXECUTION_VALIDATION_FAILED`; they cannot
change an existing panel. MCP can instead return transport `InvalidParams` for
malformed tool shape, such as missing `actions` or blank action `id` or `type`.
Runtime failures are described in [Errors](errors.md#on-screen-log-panel-failures).

## Related Pages

- [Actions](actions.md)
- [Snapshot Format](snapshot.md)
- [Errors](errors.md)
- [Serve API](serve.md)
- [MCP Server](mcp.md)
