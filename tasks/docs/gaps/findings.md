# Docs Gaps Phase 1 Findings

## Snapshot Session

- Device: Android Emulator (emulator-5554)
- OS: Android 15 (API 35)
- Operator package: `com.clawperator.operator.dev`
- App: Android Settings (foreground)
- Command: `node apps/node/dist/cli/index.js snapshot --device emulator-5554 --operator-package com.clawperator.operator.dev --json`

## Opportunistic Runtime Metadata

The `stepResults[0].data` object includes additional fields beyond `text` that
the Node contract does not guarantee but which were present in this run:

| Field | Value | Note |
| --- | --- | --- |
| `actual_format` | `"hierarchy_xml"` | Always `hierarchy_xml` in practice |
| `foreground_package` | `"com.android.settings"` | Package currently in foreground |
| `has_overlay` | `"false"` | No launcher overlay on emulator |
| `window_count` | `"2"` | Number of windows visible |

Docs note: these are documented as runtime-detail fields, not Node-guaranteed
fields. The doc table in `snapshot.md` already calls this out. The annotated
example shows the full envelope so readers see the real output.

## XML Structure Observations

AOSP Settings hierarchy (Android 15) uses a modern Material Design layout:

1. `com.android.settings:id/settings_homepage_container` - main scrollable container
2. `com.android.settings:id/homepage_title` - the "Settings" title text
3. `com.android.settings:id/search_action_bar` - search bar container with
   `search_action_bar_title` showing "Search settings"
4. `com.android.settings:id/recycler_view` - the scrollable list container
5. `com.android.settings:id/main_content_scrollable_container` - secondary scroll view

Settings list rows are `clickable="true"` `LinearLayout` containers wrapping:
- `com.android.settings:id/icon_frame` - icon container
- `com.android.settings:id/text_frame` - text container with:
  - `android:id/title` (TextView) - the item name (e.g., "Network & internet")
  - `android:id/summary` (TextView) - the subtitle / current value

The row container itself has no `resource-id`; targeting by child
`android:id/title` text value is the reliable approach.

## Bounds Interpretation

Format: `[x1,y1][x2,y2]` - top-left and bottom-right pixel coordinates.
Emulator resolution: 1080x2400.

Example "Network & internet" row: `bounds="[0,778][1080,1009]"` - spans full width,
231 pixels tall. Tap center: approximately `(540, 893)`.

## Fragment Selection

Selected two Settings rows for the annotated example:
- "Network & internet" row (with icon, title, summary) - shows typical interactive item
- "Connected devices" row - second item to show the repeating pattern

Omit deep container wrappers in the fragment. Show the scrollable container as
context, then jump to actionable items. Full hierarchy depth is documented in the
"How Snapshot Data Flows" section.

## Emulator vs Physical Device Differences

The emulator (AOSP) Settings layout differs from Samsung One UI:

| Aspect | Emulator (AOSP) | Samsung One UI |
| --- | --- | --- |
| Title resource | `homepage_title` | `action_bar` |
| Search element | `search_action_bar` (ViewGroup) | `content-desc` based |
| Scroll container | `settings_homepage_container` | `recycler_view` |
| Row structure | `text_frame` + `icon_frame` | Direct children |
| Overlay | None (`has_overlay: false`) | Samsung launcher (`has_overlay: true`) |
| Window count | 2 | 3 |

Using the emulator for documentation examples ensures reproducibility across
any development environment.
