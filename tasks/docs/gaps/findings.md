# Docs Gaps Phase 1 Findings

## Snapshot Session

- Device: Samsung Galaxy (physical), serial redacted
- Operator package: `com.clawperator.operator.dev`
- App: Android Settings (foreground)
- Command: `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --json`

## Opportunistic Runtime Metadata

The `stepResults[0].data` object includes additional fields beyond `text` that
the Node contract does not guarantee but which were present in this run:

| Field | Value | Note |
| --- | --- | --- |
| `actual_format` | `"hierarchy_xml"` | Always `hierarchy_xml` in practice |
| `foreground_package` | `"com.android.settings"` | Package currently in foreground |
| `has_overlay` | `"true"` | Launcher overlay was active |
| `overlay_package` | `"com.sec.android.app.launcher"` | Samsung launcher |
| `window_count` | `"3"` | Number of windows visible |

Docs note: these are documented as runtime-detail fields, not Node-guaranteed
fields. The doc table in `snapshot.md` already calls this out. The annotated
example shows the full envelope so readers see the real output.

## XML Structure Observations

Samsung Settings hierarchy is 10+ levels deep before reaching actionable content.
Key nodes for navigation:

1. `com.android.settings:id/action_bar` - contains the screen title and search
   button; search button uses `content-desc="Search settings"` rather than
   `resource-id`
2. `com.android.settings:id/recycler_view` - the scrollable list container;
   `scrollable="true"` marks it as the scroll target
3. Settings list rows are `clickable="true"` `LinearLayout` containers wrapping:
   - `android:id/title` (TextView) - the item name
   - `android:id/summary` (TextView) - the subtitle / current value
4. The row container itself has no `resource-id`; targeting by child
   `android:id/title` text value is the reliable approach

## Bounds Interpretation

Format: `[x1,y1][x2,y2]` - top-left and bottom-right pixel coordinates.
Device resolution: 1080x2340.

Example "Connections" row: `bounds="[30,1290][1050,1499]"` - spans full width,
209 pixels tall. Tap center: `(540, 1394)`.

## Fragment Selection

Selected two Settings rows for the annotated example:
- "Connections" row (with icon, title, summary) - shows typical interactive item
- "Connected devices" row - second item to show the repeating pattern

Omit deep container wrappers in the fragment. Show the scrollable container as
context, then jump to actionable items. Full hierarchy depth is documented in the
"How Snapshot Data Flows" section.
