# Google Play Skill Build Log

This is a lab notebook. Raw, chronological, honest. Failures and surprises included.

## Setup

**Date:** 2026-03-11
**Device:** `<device_serial>` (physical Android device, user logged in to Google account)
**CLI version reported:** 0.2.1 (but see critical bug below)
**APK version:** 0.2.1
**Compatible:** yes

**Goal:** Perform zero-shot exploratory UI automation against the Google Play Store to build
two skills from scratch:
1. `com.android.vending.search-app` - find an app in the Play Store
2. `com.android.vending.install-app` - install an app from its details page

**Approach:** Single action, then re-observe. No pre-written flow. Live UI is the source
of truth.

---

## Critical discovery before exploration: global CLI snapshot extraction is broken

### What I tried first

Started by running the globally installed `clawperator` binary:
```
clawperator exec --execution snap.json --device <device_serial>
```

Ran snapshot_ui. Got back:
```json
{ "success": true, "actual_format": "hierarchy_xml", "text": "" }
```

`text` was always empty. `success: true` but no data. Very confusing.

### Investigation

Verified the hierarchy XML was actually in logcat by running adb directly:
```
adb logcat -d -v tag | grep "TaskScope"
```
Output contained `D/E       : [TaskScope] UI Hierarchy:` followed by hundreds of XML lines.
So the Android app IS emitting the snapshot correctly.

Ran the local Node.js `extractSnapshotsFromLogs` function against the raw logcat data.
It worked correctly and returned a 33,000+ char XML snapshot.

So the problem was in the CLI, not the Android app.

Traced the binary: `which clawperator` → `/opt/homebrew/bin/clawperator` → symlink to
`/opt/homebrew/lib/node_modules/clawperator/dist/cli/index.js`.

Found the bug in the global install's `snapshotHelper.js`:
```js
// INSTALLED (broken):
const snapshotLines = lines
  .filter((l) => l.includes("TaskScopeDefault:"))  // <- WRONG marker
  .map(...)
```

The Android app emits `[TaskScope] UI Hierarchy:` but the global install filters for
`TaskScopeDefault:`. These never match. Result: `extractSnapshotFromLogs` always returns
null, `data.text` is never populated.

The local source (`apps/node/src/domain/executions/snapshotHelper.ts`) has the correct
implementation searching for `[TaskScope] UI Hierarchy:`.

### Resolution

Used the local build instead of the global binary for all subsequent commands:
```
node <clawperator_repo>/apps/node/dist/cli/index.js execute ...
```

**API contract note:** The snapshot result returns `success: true` even when `data.text`
is empty. There is no error code distinguishing "snapshot succeeded but was empty" from
"snapshot succeeded and has data." An agent using the global CLI would see `success: true`
and have no indication that the snapshot was broken.

---

## Step 1: Open Play Store

### Why

Needed to confirm `open_app` works and what the initial Play Store state looks like.

### Action

```json
{
  "commandId": "play-open-001",
  "taskId": "play-open-001",
  "source": "agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "close", "type": "close_app", "params": { "applicationId": "com.android.vending" } },
    { "id": "sleep1", "type": "sleep", "params": { "durationMs": 1500 } },
    { "id": "open", "type": "open_app", "params": { "applicationId": "com.android.vending" } },
    { "id": "sleep2", "type": "sleep", "params": { "durationMs": 4000 } },
    { "id": "snap", "type": "snapshot_ui" }
  ]
}
```

### Observations

Result status: `success`. `close_app` step reported `success: false` with no `error` field
visible on the step. This is expected - see docs: `close_app` Android step always returns
`success: false` (it uses `am force-stop` which does not report success back). The node
layer force-stops before launch as part of the pre-flight, not the step result.

The Play Store opened to the home screen. Snapshot showed:
- Bottom navigation tabs: "For you", "Top charts", "Games", "Apps", "Search", "Books"
- No resource-ids on any tab element
- Tabs matched via `text=` attribute: "For you", "Top charts", "Games", "Apps", "Search"

The Play Store home screen has 122 nodes in the UI tree.

**Surprising:** `close_app` step `success: false` even when the app successfully closes.
Known gap in the API contract (Gap B from plan.md). Not an error - just confusing naming.

---

## Step 2: Navigate to Search tab

### Why

Play Store home screen has a search bar at the top and a "Search" tab in the bottom
navigation. I expected the Search tab to open a dedicated search UI.

### Matcher strategy

No resource-ids on nav bar tabs. Text approach: `textEquals: "Search"`.

### Action

```json
{ "id": "click-search-tab", "type": "click", "params": { "matcher": { "textEquals": "Search" } } }
```

### Result

Click succeeded. Snapshot after showed a search screen with:
- A search bar at the top (not yet focused/active)
- Recent searches visible: `life360`, `woolworths`, `coles`, `globird`
- Content-desc of search bar: `"Search Google Play"`

**Finding:** The `textEquals: "Search"` matched the label text of the tab, not the tab
container. The matched node had `clickable=false`, but the click at the node's coordinates
landed on the clickable parent container. The click worked correctly. Clawperator clicks
the center of the matched node's bounding box regardless of whether the node itself is
marked clickable.

---

## Step 3: Activate the search input

### Why

The search bar was visible but not focused. Need to tap it to get the keyboard/text entry
mode active.

### Matcher strategy

Content-desc on the search bar was `"Search Google Play"`. Used `contentDescEquals`.

### Action

```json
{ "id": "click-bar", "type": "click", "params": { "matcher": { "contentDescEquals": "Search Google Play" } } }
```

### Result

Click succeeded. Snapshot showed an `android.widget.EditText` element appeared:
- No resource-id (empty string)
- class `android.widget.EditText`
- bounds `[168,93][912,237]`
- No text yet, no content-desc

This is the text input field. No resource-id means I need `role: "textfield"` to target it.

---

## Step 4: Type search query

### Why

EditText is now active. Need to type the search term. `role: "textfield"` should target
any `android.widget.EditText` class node.

### Action

```json
{
  "id": "type-query",
  "type": "enter_text",
  "params": {
    "matcher": { "role": "textfield" },
    "text": "VLC",
    "submit": true
  }
}
```

### Result

Enter text succeeded. Snapshot after showed search suggestions appeared:
- Content-desc of first suggestion: `"Search for &apos;vlc&apos;"` (HTML entity encoding)

The `&apos;` in content-desc is the HTML-encoded apostrophe character. This is significant
for matchers (see step 5).

**Tried first (failed):** Using `contentDescContains: "Search for \u2019vlc\u2019"`
(Unicode right single quote U+2019). Got `RESULT_ENVELOPE_TIMEOUT`. The content-desc in
the XML uses `&apos;` which decodes to the standard ASCII apostrophe `'`, not the Unicode
typographic quote. The wrong character caused zero matches, which caused the action to
wait until timeout.

---

## Step 5: Click search suggestion

### Why

After typing "VLC", suggestions appeared. I needed to select the "Search for vlc"
suggestion to execute the search.

### Matcher strategy (after failure)

Fell back from exact content-desc to `contentDescContains: "Search for"` - simple
substring that avoids the apostrophe encoding entirely.

### Action

```json
{ "id": "click-suggest", "type": "click", "params": { "matcher": { "contentDescContains": "Search for" } } }
```

### Result

Succeeded. Snapshot after 3s wait showed VLC search results list:
- Multiple app entries
- Each entry has: Install button, rating, download count, screenshots
- VLC for Android description text visible
- No resource-ids on any element

**Key finding on HTML entity encoding:** Play Store wraps app names in `&apos;` in
content-desc attributes. Always use substring matching (`contentDescContains`) to avoid
encoding issues. Exact matching with `contentDescEquals` would require knowing the exact
encoded value.

---

## Step 6: Navigate to app details page

### Why

From search results, I needed to tap the VLC entry to open its full details page (not
just click Install from the list).

### Snapshot analysis

The VLC entry in results had this structure:
- Container node: `clickable=true`, `content-desc=""`, bounds `[0,776][1080,1874]`
  - Thumbnail/info node: `clickable=false`, `content-desc="VLC for Android\nVideolabs\n"`
  - Install button container: `clickable=true`

The info node's content-desc spans two lines: `"VLC for Android\nVideolabs\n"`.

### Matcher strategy

Used `contentDescContains: "VLC for Android"` to match the info node, even though it is
`clickable=false`. Clawperator clicks the center of the matched node's bounding box. That
center falls within the clickable parent container.

### Action

```json
{ "id": "click-vlc", "type": "click", "params": { "matcher": { "contentDescContains": "VLC for Android" } } }
```

### Result

Succeeded. Snapshot after showed the VLC app details page (full page, not bottom sheet):
- `T='VLC for Android'`
- `T='Videolabs'`
- `C='Average rating 3.8 stars in 1 million reviews'`
- `C='Install'` / `T='Install'` - install button visible
- `T='About this app'` section

This is the "ready to install" state. Key signal: `contentDescEquals: "Install"` or
`textEquals: "Install"` present, and no `textEquals: "Open"` / `textEquals: "Uninstall"`.

---

## Step 7: Test direct-entry path via package name

### Why

The task requires testing whether a known package ID can be used to reach the app
details page directly, without going through search.

### Hypothesis

Android deep link `market://details?id=org.videolan.vlc` should open Play Store directly
on VLC's page.

### Discovery: Clawperator has no deep link action

Checked `open_app` parameters - only supports `applicationId`. No `url`, `deepLink`, or
`intent` parameters exist. No `shell_command` action type exists either.

The `open_app` action with `applicationId: "com.android.vending"` opens the Play Store
home screen, not a specific app page.

**Finding:** Clawperator's Node API does not natively support deep link navigation. The
only way to trigger a market:// URI is via `adb shell am start` outside the Clawperator
execution flow.

### Tested via adb directly

```
adb shell am start -a android.intent.action.VIEW -d "market://details?id=org.videolan.vlc"
```

### Result

`market://` deep link triggered an "Open with" dialog because both Galaxy Store and
Google Play Store handle this URI scheme on the test device. Snapshot showed:
- `T='Open with'`
- `T='Galaxy Store'`
- `T='Google Play Store'`
- `T='Just once'` / `T='Always'` buttons

Tapping "Google Play Store" dismissed the dialog. Play Store then opened a BOTTOM SHEET
showing VLC details. Snapshot showed:
- `C='Close sheet'` (top dismiss button - different from full-page `C='Navigate up'`)
- Same VLC info as full page: title, developer, rating, Install button
- `C='Close'` (secondary close, bottom nav area)

**Finding:** The `market://` deep link works but:
1. May trigger an "Open with" picker if multiple stores are installed
2. Opens a bottom sheet, not the full app page (different navigation chrome)
3. The content and Install button are the same in both formats

**For the search skill:** The direct-entry path via `market://` requires handling the
picker dialog as a blocking state. A skill must detect and dismiss the picker.

**API gap:** There is no `open_uri` or `intent` action type. Direct deep link navigation
requires an adb call outside the execution payload. This is a significant capability gap
for skills that need to open content-addressed pages.

---

## Step 8: Install the app

### Why

From the VLC details page (bottom sheet via deep link), I clicked Install to observe the
full install flow.

### Matcher strategy

The Install button structure in the XML:
- `C='Install'` node: `clickable=false`, inside a clickable container
- The clickable parent has `content-desc=""`

Used `contentDescEquals: "Install"` to find the node. Even though `clickable=false`, the
click coordinates land on the clickable parent.

### Action

```json
{ "id": "click-install", "type": "click", "params": { "matcher": { "contentDescEquals": "Install" } } }
```

### State at 3 seconds after click

Install completed very quickly (VLC may have been cached or was a fast download):
- `C='100%'` (progress at completion, or post-completion signal)
- `T='Verified by Play Protect'`
- `C='Cancel'` / `T='Cancel'`
- `T='Open'` - install complete signal appeared

### Final state (2 seconds later)

- `C='Uninstall'` / `T='Uninstall'`
- `C='Open'` / `T='Open'`

This is the confirmed installed state.

### State signals documented

| State | Key signals | Notes |
|-------|-------------|-------|
| Ready to install | `C='Install'`, `T='Install'` | No `Open` or `Uninstall` present |
| In progress | Progress indicator, `C='Cancel'` | May be very brief for cached apps |
| Installed (just done) | `T='Open'`, `C='Cancel'` still visible, `C='100%'` | Transition state |
| Installed (settled) | `C='Open'`, `T='Open'`, `C='Uninstall'`, `T='Uninstall'` | Stable installed state |
| Already installed | Same as installed (settled) | Arriving at page shows Open/Uninstall |
| Login required | Would show Google account picker or login prompt | Not encountered here |
| Paid app | Would show price instead of "Install" | Not encountered here |

---

## Summary of execution format issues discovered

### Issue 1: `steps` vs `actions` key

First attempt used `steps` key in execution JSON. Got:
```json
{ "code": "EXECUTION_VALIDATION_FAILED", "keys": ["steps"], "message": "Unrecognized key(s) in object: 'steps'" }
```
Correct key is `actions`.

### Issue 2: Each action requires `id` field

First execution attempt omitted `id` in action objects. Got:
```json
{ "code": "EXECUTION_VALIDATION_FAILED", "path": "actions.0.id", "message": "Required" }
```
Every action needs an `id` string field.

### Issue 3: Snapshot via CLI vs `execute` + `snapshot_ui`

During this workstream, ad-hoc snapshot via the old nested `observe snapshot` spelling
was unreliable with the then-current CLI. The stable path was `execute` with a
`snapshot_ui` action. The shipped surface is now flat: use `clawperator snapshot` for
the same pipeline as `snapshot_ui`, or keep using `execute` for multi-step payloads.

### Issue 4: No `StepResult.error` field at top level

The `error` field on a step result lives at `data.error`, not directly on the step. An
agent looking for `stepResult.error` would always see undefined/null even on failures.
The actual failure information is in `data.error` or in the top-level `envelope.error`.

---

## Selector strategy findings

| Situation | Strategy that worked | Strategy that failed/was unavailable |
|-----------|---------------------|--------------------------------------|
| Bottom nav tab | `textEquals: "Search"` | No resource-id |
| Search bar (inactive) | `contentDescEquals: "Search Google Play"` | No resource-id |
| Search input (active) | `role: "textfield"` | No resource-id, no content-desc when empty |
| Search suggestion | `contentDescContains: "Search for"` | Exact content-desc fails (HTML entities) |
| App entry in results | `contentDescContains: "VLC for Android"` | No resource-id |
| Install button | `contentDescEquals: "Install"` | No resource-id |
| Open button (post-install) | `textEquals: "Open"` or `contentDescEquals: "Open"` | No resource-id |

**Overall pattern:** The Play Store has NO resource-ids on interactive elements. Every
matcher must use text, content-desc, or role. The `role: "textfield"` matcher is
essential for targeting the search input field.

---

## Timing observations

- Play Store home → visible: need at least 3-4 second sleep
- Search results → visible: 3 second sleep sufficient
- App detail page load from search result tap: 3 second sleep sufficient
- Market:// deep link → bottom sheet visible: 3 second sleep sufficient
- Install completion (VLC): essentially instant (likely cached/OTA)

For a fresh install of a larger app, `wait_for_node` polling for `textEquals: "Open"`
would be more robust than a fixed sleep.
