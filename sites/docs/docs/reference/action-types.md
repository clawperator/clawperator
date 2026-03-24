# Action Types Reference

This page is the single canonical reference for all Clawperator action types, their parameters, result shapes, and usage examples.

For the execution envelope structure, timeout policy, and result semantics, see [Execution Model](execution-model.md). For practical navigation patterns, see [Navigation Patterns for Agents](../ai-agents/navigation-patterns.md).

---

## Quick Reference

| Type | Purpose | Key params |
|------|---------|------------|
| [`click`](#click) | Tap a UI node | `matcher` |
| [`scroll_and_click`](#scroll_and_click) | Scroll to and tap a node | `matcher`, `container`, `direction` |
| [`scroll_until`](#scroll_until) | Bounded scroll loop | `matcher` (optional), `maxScrolls`, `maxDurationMs` |
| [`scroll`](#scroll) | Single scroll gesture | `container` (optional), `direction` |
| [`read_text`](#read_text) | Read text from UI node(s) | `matcher`, `all` (optional), `validator` (optional) |
| [`enter_text`](#enter_text) | Type text into a UI node | `matcher`, `text` |
| [`wait_for_node`](#wait_for_node) | Wait for a node to appear | `matcher`, `retry` (optional), `timeoutMs` (optional) |
| [`wait_for_navigation`](#wait_for_navigation) | Wait for screen transition | `expectedPackage` or `expectedNode` |
| [`read_key_value_pair`](#read_key_value_pair) | Read Settings-style label + value | `labelMatcher` |
| [`open_uri`](#open_uri) | Open a URI | `uri` |
| [`open_app`](#open_app) | Launch an app | `applicationId` |
| [`close_app`](#close_app) | Force-stop an app | `applicationId` |
| [`snapshot_ui`](#snapshot_ui) | Capture UI hierarchy | - |
| [`take_screenshot`](#take_screenshot) | Capture screen as PNG | `path` (optional) |
| [`sleep`](#sleep) | Pause execution | `durationMs` |
| [`start_recording`](#start_recording) | Start an on-device recording session | `sessionId` (optional) |
| [`stop_recording`](#stop_recording) | Stop the active recording session | `sessionId` (optional) |
| [`press_key`](#press_key) | System navigation key | `key` |

---

## NodeMatcher Reference

A NodeMatcher identifies a single UI element for action targeting. Used in `click`, `enter_text`, `read_text`, `wait_for_node`, `scroll_and_click`, `scroll_until`, `wait_for_navigation`, and `read_key_value_pair`.

All specified fields are combined with AND semantics: every specified field must match the target element. At least one field is required per matcher.

| Field | Type | Description |
|-------|------|-------------|
| `resourceId` | `string` | Developer-assigned element ID (format: `com.example.app:id/element_name`). Most stable - prefer over all others. |
| `contentDescEquals` | `string` | Exact match on accessibility content description. Use for icon buttons. |
| `textEquals` | `string` | Exact match on visible text label. |
| `textContains` | `string` | Substring match on visible text. |
| `contentDescContains` | `string` | Substring match on accessibility label. |
| `role` | `string` | Matches by semantic role (`button`, `textfield`, `text`, `switch`, `checkbox`, `image`, `listitem`, `toolbar`, `tab`). |

**Selector priority (most to least stable):** `resourceId` > `contentDescEquals` > `textEquals` > `textContains` > `contentDescContains` > `role`

Example:
```json
{
  "resourceId": "com.example.app:id/submit_btn",
  "textEquals": "Submit"
}
```

---

## Action Aliases

These aliases are normalized to their canonical types at input:

| Alias | Canonical type |
|-------|---------------|
| `tap`, `press` | `click` |
| `wait_for`, `find`, `find_node` | `wait_for_node` |
| `read` | `read_text` |
| `snapshot` | `snapshot_ui` |
| `screenshot`, `capture_screenshot` | `take_screenshot` |
| `type_text`, `text_entry`, `input_text` | `enter_text` |
| `open_url` | `open_uri` |
| `key_press` | `press_key` |

---

## Action Types (Detailed)

### `click`

Finds the node matching `matcher` and performs the specified click.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | yes | Selector for the target node |
| `clickType` | `string` | no | `"default"`, `"long_click"`, or `"focus"` (default: `"default"`) |

**Result data on success:**

| Key | Value |
|-----|-------|
| `click_types` | The click type performed |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Selector matched no UI element |
| `NODE_NOT_CLICKABLE` | Element found but not interactable |
| `SECURITY_BLOCK_DETECTED` | Security overlay or lock screen blocked the action |

**Example:**

```json
{
  "id": "click1",
  "type": "click",
  "params": {
    "matcher": { "resourceId": "com.example.app:id/submit_button" },
    "clickType": "default"
  }
}
```

---

### `scroll_and_click`

Scrolls to find a target node, then clicks it. Uses separate retry presets for scrolling and clicking.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | yes | Selector for the target node |
| `container` | NodeMatcher | no | Explicit scroll container (default: auto-detect) |
| `direction` | `string` | no | `"down"`, `"up"`, `"left"`, `"right"` (default: `"down"`) |
| `maxSwipes` | `number` | no | Maximum scroll attempts (default: `10`, range: 1-50) |
| `clickAfter` | `boolean` | no | Whether to click after scrolling (default: `true`) |
| `distanceRatio` | `number` | no | Scroll distance as ratio of container (default: `0.7`, range: 0-1) |
| `settleDelayMs` | `number` | no | Delay after scroll before checking (default: `250`, range: 0-10000) |
| `findFirstScrollableChild` | `boolean` | no | Auto-use first scrollable descendant (default: `true`) |
| `scrollRetry` | `object` | no | Retry config for scroll loop |
| `clickRetry` | `object` | no | Retry config for final click |

**Result data on success:**

| Key | Value |
|-----|-------|
| `max_swipes` | Maximum swipes allowed |
| `direction` | Direction scrolled |
| `click_types` | Click type performed |
| `click_after` | Whether click was performed |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Target not found after max swipes |
| `CONTAINER_NOT_FOUND` | Could not locate a scrollable container |
| `CONTAINER_NOT_SCROLLABLE` | Container found but not scrollable |

**Example:**

```json
{
  "id": "sac1",
  "type": "scroll_and_click",
  "params": {
    "matcher": { "textContains": "About phone" },
    "container": { "resourceId": "com.android.settings:id/recycler_view" },
    "direction": "down",
    "maxSwipes": 15
  }
}
```

---

### `scroll_until`

Bounded scroll loop with machine-readable termination reason. Scrolls repeatedly until a termination condition fires.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | no | Target to find (emits `TARGET_FOUND` when visible) |
| `container` | NodeMatcher | no | Explicit scroll container (default: auto-detect) |
| `direction` | `string` | no | `"down"`, `"up"`, `"left"`, `"right"` (default: `"down"`) |
| `clickAfter` | `boolean` | no | Click when target found (default: `false`, requires `matcher`) |
| `clickType` | `string` | no | `"default"`, `"long_click"`, `"focus"` (used only if `clickAfter: true`) |
| `maxScrolls` | `number` | no | Maximum scroll iterations (default: `20`, range: 1-200) |
| `maxDurationMs` | `number` | no | Wall-clock cap in ms (default: `10000`, range: 0-120000) |
| `noPositionChangeThreshold` | `number` | no | Consecutive no-movement scrolls before stopping (default: `3`, range: 1-20) |
| `distanceRatio` | `number` | no | Scroll distance ratio (default: `0.7`, range: 0-1) |
| `settleDelayMs` | `number` | no | Delay after scroll before checking (default: `250`, range: 0-10000) |
| `findFirstScrollableChild` | `boolean` | no | Auto-use first scrollable descendant (default: `true`) |

**Termination reasons (`data.termination_reason`):**

| Reason | Meaning |
|--------|---------|
| `TARGET_FOUND` | Target matcher became visible (`success: true`) |
| `EDGE_REACHED` | No further movement detected (`success: true`) |
| `MAX_SCROLLS_REACHED` | Hit `maxScrolls` cap (`success: true`) |
| `MAX_DURATION_REACHED` | Hit `maxDurationMs` cap (`success: true`) |
| `NO_POSITION_CHANGE` | No movement across threshold consecutive scrolls (`success: true`) |
| `CONTAINER_NOT_FOUND` | Container resolution failed (`success: false`) |
| `CONTAINER_NOT_SCROLLABLE` | Container not scrollable (`success: false`) |
| `CONTAINER_LOST` | Container disappeared mid-loop (`success: false`) |

**Note on `clickAfter`:** The click fires when `termination_reason` is `TARGET_FOUND`. When the loop would otherwise terminate with `EDGE_REACHED`, `MAX_SCROLLS_REACHED`, `MAX_DURATION_REACHED`, or `NO_POSITION_CHANGE`, the runtime re-queries the accessibility tree for `matcher`. If the target is visible at that point, `termination_reason` is promoted to `TARGET_FOUND` and the click fires normally.

**Result data on success:**

| Key | Value |
|-----|-------|
| `termination_reason` | Why the loop stopped |
| `scrolls_executed` | Number of scrolls performed |
| `direction` | Direction scrolled |
| `click_after` | Whether click was requested |
| `click_types` | Click type performed (if clicked) |
| `resolved_container` | Resource ID of container used |

**Example:**

```json
{
  "id": "su1",
  "type": "scroll_until",
  "params": {
    "matcher": { "textContains": "About phone" },
    "container": { "resourceId": "com.android.settings:id/recycler_view" },
    "clickAfter": true,
    "direction": "down",
    "maxScrolls": 25
  }
}
```

---

### `scroll`

Single scroll gesture with outcome reporting. No target element, does not click.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `container` | NodeMatcher | no | Explicit scroll container (default: auto-detect first scrollable) |
| `direction` | `string` | no | `"down"`, `"up"`, `"left"`, `"right"` (default: `"down"`) |
| `distanceRatio` | `number` | no | Scroll distance ratio (default: `0.7`, range: 0-1) |
| `settleDelayMs` | `number` | no | Delay after scroll (default: `250`, range: 0-10000) |
| `findFirstScrollableChild` | `boolean` | no | Auto-use first scrollable descendant (default: `true`) |
| `retry` | `object` | no | Retry config (default: no retry) |

**Scroll outcomes (`data.scroll_outcome`):**

| Outcome | Meaning |
|---------|---------|
| `moved` | Gesture dispatched and position changed |
| `edge_reached` | Gesture dispatched but container at limit |
| `gesture_failed` | OS rejected the gesture dispatch |

**Result data on success:**

| Key | Value |
|-----|-------|
| `scroll_outcome` | `moved` or `edge_reached` |
| `direction` | Direction scrolled |
| `distance_ratio` | Distance ratio used |
| `settle_delay_ms` | Settle delay used |
| `resolved_container` | Resource ID of container used |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `CONTAINER_NOT_FOUND` | No scrollable container found |
| `CONTAINER_NOT_SCROLLABLE` | Container not scrollable |
| `GESTURE_FAILED` | OS rejected gesture dispatch |

**Example:**

```json
{
  "id": "scr1",
  "type": "scroll",
  "params": {
    "direction": "down",
    "container": { "resourceId": "com.android.settings:id/recycler_view" }
  }
}
```

---

### `read_text`

Reads text from matching UI nodes, with optional validation in single-match mode.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | yes | Selector for the target node(s) |
| `all` | `boolean` | no | When `true`, return every on-screen match (see result shape below). Default `false`. |
| `container` | NodeMatcher | no | When provided, restricts search to elements within the matched container's subtree |
| `validator` | `string` | no | `"temperature"`, `"version"`, or `"regex"` (ignored when `all` is `true` on Android) |
| `validatorPattern` | `string` | conditional | Required when `validator` is `"regex"` |

**Supported validators:**

| Validator | Pattern | Example valid |
|-----------|---------|---------------|
| `temperature` | Parsed as temperature value | `"20.7°C"`, `"75°F"`, `"23.7"` |
| `version` | `/^\d+(\.\d+)*$/` | `"16"`, `"14.1.2"`, `"1.0.0.0"` |
| `regex` | Custom pattern via `validatorPattern` | Depends on pattern |

**Result data on success:**

| Key | Value |
|-----|-------|
| `text` | Single match: the extracted text. `all: true`: a string containing a JSON array literal of labels, for example `["A","B"]` (parse as JSON). |
| `validator` | `"none"` or the validator used |
| `all`, `count` | Present when `all` is `true`: `"true"` and match count as decimal strings |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Selector matched no UI element |
| `CONTAINER_NOT_FOUND` | Container selector (if provided) matched no UI element |
| `VALIDATOR_MISMATCH` | Extracted text failed validation |

**Validator mismatch response:**

```json
{
  "id": "read1",
  "actionType": "read_text",
  "success": false,
  "data": {
    "error": "VALIDATOR_MISMATCH",
    "raw_text": "Settings"
  }
}
```

**Examples:**

```json
// Basic read
{ "id": "read1", "type": "read_text", "params": { "matcher": { "resourceId": "com.example:id/temp" } } }

// Version validator
{ "id": "version_check", "type": "read_text", "params": { "matcher": { "textContains": "Android version" }, "validator": "version" } }

// Regex validator
{ "id": "regex_check", "type": "read_text", "params": { "matcher": { "resourceId": "com.example:id/order_id" }, "validator": "regex", "validatorPattern": "^ORD-[0-9]{6}$" } }

// All matching labels (CLI: read ... --all --json)
{ "id": "read_all", "type": "read_text", "params": { "matcher": { "role": "text" }, "all": true } }

// Container-scoped read (CLI: read ... --container-role list)
{ "id": "read_container", "type": "read_text", "params": { "matcher": { "textEquals": "Price" }, "container": { "role": "list" } } }
```

---

### `enter_text`

Types text into a UI node.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | yes | Selector for the target input node |
| `text` | `string` | yes | Text to type |
| `submit` | `boolean` | no | Press Enter after typing (default: `false`) |
| `clear` | `boolean` | no | Clear field before typing (Node accepts this; Android ignores currently) |

**Result data on success:**

| Key | Value |
|-----|-------|
| `text` | Text that was typed |
| `submit` | `"true"` or `"false"` |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Input element not found |

**Example:**

```json
{
  "id": "type1",
  "type": "enter_text",
  "params": {
    "matcher": { "resourceId": "com.example.app:id/search_input" },
    "text": "hello world",
    "submit": true
  }
}
```

---

### `wait_for_node`

Polls until a node matching the matcher appears in the UI tree.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `matcher` | NodeMatcher | yes | Selector for the target node |
| `retry` | `object` | no | Retry config (default: `maxAttempts=5`, `initialDelayMs=500`) |
| `timeoutMs` | `number` | no | Wall-clock cap in ms for the wait on device (Operator accepts 1-120000). Wraps the retry loop with a coroutine timeout. |

**Result data on success:**

| Key | Value |
|-----|-------|
| `resource_id` | Matched node resource ID |
| `label` | Matched node text/label |
| `timeout_ms` | When `timeoutMs` was set, echo of the configured cap (string) |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Node did not appear during retry period |
| (execution / step failure) | Wall-clock `timeoutMs` exceeded: failure message describes timeout and matcher |

**Example:**

```json
{
  "id": "wait1",
  "type": "wait_for_node",
  "params": {
    "matcher": { "textEquals": "Loading complete" }
  }
}
```

**Example with per-action timeout (CLI: `wait ... --timeout <ms>`):**

```json
{
  "id": "wait2",
  "type": "wait_for_node",
  "params": {
    "matcher": { "textEquals": "Done" },
    "timeoutMs": 15000
  }
}
```

---

### `wait_for_navigation`

Polls until the expected package or node is detected after a screen transition. Use after a click that triggers navigation instead of a fixed sleep.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `timeoutMs` | `number` | yes | Maximum time to wait in ms (max: 30000) |
| `expectedPackage` | `string` | conditional | Package name to wait for (at least one of `expectedPackage` or `expectedNode` required) |
| `expectedNode` | NodeMatcher | conditional | Node to wait for (at least one required) |

**Validation:** At least one of `expectedPackage` or `expectedNode` must be provided. If both are absent, returns `EXECUTION_VALIDATION_FAILED`.

**Result data on success:**

| Key | Value |
|-----|-------|
| `resolved_package` | The package that was detected |
| `elapsed_ms` | Time waited in milliseconds |

**Result data on timeout:**

| Key | Value |
|-----|-------|
| `error` | `"NAVIGATION_TIMEOUT"` |
| `last_package` | Last detected package before timeout |

**Example:**

```json
{
  "id": "wait",
  "type": "wait_for_navigation",
  "params": {
    "expectedPackage": "com.android.settings",
    "timeoutMs": 5000
  }
}
```

---

### `read_key_value_pair`

Reads a Settings-style label and its adjacent value. Finds the node matching `labelMatcher`, then searches for the nearest sibling with a `/summary` resource ID suffix.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `labelMatcher` | NodeMatcher | yes | Selector for the label node |

**Result data on success:**

| Key | Value |
|-----|-------|
| `label` | The label text |
| `value` | The adjacent value text |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `NODE_NOT_FOUND` | Label node not found |
| `VALUE_NODE_NOT_FOUND` | Label found but no adjacent summary value node detected |

**Limitation:** The sibling traversal only searches nodes that appear *after* the label in the parent's children list. If a value node appears before its label in the hierarchy, it will not be found.

**Example:**

```json
{
  "id": "read_version",
  "type": "read_key_value_pair",
  "params": {
    "labelMatcher": { "textEquals": "Android version" }
  }
}
```

Success response:

```json
{
  "id": "read_version",
  "actionType": "read_key_value_pair",
  "success": true,
  "data": {
    "label": "Android version",
    "value": "16"
  }
}
```

---

### `open_uri`

Opens a URI using the Clawperator Android app's implicit `ACTION_VIEW` intent.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `uri` | `string` | yes | URI to open |
| `retry` | `object` | no | Retry config |

**Supported URI schemes:**

- `https://...` - Standard web URLs
- `market://...` - Play Store deep links
- App-specific deep-link URIs

**Result data on success:**

| Key | Value |
|-----|-------|
| `uri` | The URI that was opened |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `URI_NOT_HANDLED` | No application registered for this URI scheme |

**Note:** This is an `ACTION_VIEW` URI launcher, not a general-purpose Android intent builder. It does not support bare intent action strings like `android.settings.DEVICE_INFO_SETTINGS`.

**Example:**

```json
{
  "id": "open1",
  "type": "open_uri",
  "params": {
    "uri": "https://example.com"
  }
}
```

---

### `open_app`

Opens the app's default launch activity by `applicationId`.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `applicationId` | `string` | yes | Android package name |

**Result data on success:**

| Key | Value |
|-----|-------|
| `application_id` | The package that was opened |

**Example:**

```json
{
  "id": "open_settings",
  "type": "open_app",
  "params": {
    "applicationId": "com.android.settings"
  }
}
```

---

### `close_app`

Force-stops an app. The Node layer runs `adb shell am force-stop` before dispatching to Android. When an agent is converting a recording into a reusable skill, `close_app` is the deliberate reset primitive for flows that need a fresh baseline, but it should not be injected automatically for every recording.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `applicationId` | `string` | yes | Android package name |

**Result data on success:**

| Key | Value |
|-----|-------|
| `application_id` | The package that was closed |

**Result data on failure:**

The step may return `success: false` if the force-stop command failed.

**Example:**

```json
{
  "id": "close1",
  "type": "close_app",
  "params": {
    "applicationId": "com.example.app"
  }
}
```

---

### `snapshot_ui`

Captures the canonical `hierarchy_xml` UI tree.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `retry` | `object` | no | Retry config |

**Result data on success:**

| Key | Value |
|-----|-------|
| `actual_format` | Always `"hierarchy_xml"` |
| `text` | The XML hierarchy string |
| `foreground_package` | Best-effort foreground package (optional) |
| `has_overlay` | `"true"` or `"false"` - whether overlay detected |
| `overlay_package` | Overlay package if detected (optional) |
| `window_count` | Number of accessibility windows |
| `warn` | Warning if snapshot taken too soon after click |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `SNAPSHOT_EXTRACTION_FAILED` | UI hierarchy could not be extracted from logcat |

**Example:**

```json
{
  "id": "snap1",
  "type": "snapshot_ui"
}
```

---

### `take_screenshot`

Captures the device screen as PNG.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | `string` | no | Output file path (default: auto-generated temp path) |
| `retry` | `object` | no | Retry config |

**Result data on success:**

| Key | Value |
|-----|-------|
| `path` | Local file path of the PNG |

**Example:**

```json
{
  "id": "screenshot1",
  "type": "take_screenshot",
  "params": {
    "path": "/tmp/screenshot.png"
  }
}
```

---

### `sleep`

Pauses execution for the specified duration.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `durationMs` | `number` | yes | Duration in milliseconds (0-120000) |

**Result data on success:**

| Key | Value |
|-----|-------|
| `duration_ms` | Duration slept |

**Notes:**
- The duration also consumes from the outer execution `timeoutMs` budget.
- Values above 120000 are rejected with `EXECUTION_VALIDATION_FAILED`.

**Example:**

```json
{
  "id": "settle",
  "type": "sleep",
  "params": {
    "durationMs": 1000
  }
}
```

---

### `start_recording`

Starts an on-device recording session and writes NDJSON to app storage.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | no | Optional session identifier. When omitted, the runtime generates one. |

**Result data on success:**

| Key | Value |
|-----|-------|
| `sessionId` | The resolved recording session identifier |
| `filePath` | Local file path for the on-device recording |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `RECORDING_ALREADY_IN_PROGRESS` | A recording session is already active |
| `RECORDING_STORAGE_UNAVAILABLE` | The operator could not resolve or create the recordings directory |
| `RECORDING_START_FAILED` | The runtime could not open or initialize the recording session |

**Notes:**
- Session IDs must use only letters, numbers, hyphens, or underscores.
- Host-side pull and parse commands live in the Node API agent guide.

**Example:**

```json
{
  "id": "record-start",
  "type": "start_recording",
  "params": {
    "sessionId": "demo-001"
  }
}
```

---

### `stop_recording`

Stops the active recording session and finalizes the NDJSON file.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `sessionId` | `string` | no | Optional session identifier for correlation only. |

**Result data on success:**

| Key | Value |
|-----|-------|
| `sessionId` | The finalized recording session identifier |
| `filePath` | Local file path for the on-device recording |
| `eventCount` | Number of captured events written to the file |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `RECORDING_NOT_IN_PROGRESS` | No recording session is active |
| `RECORDING_STOP_FAILED` | The runtime could not finalize or flush the recording file |

**Notes:**
- Host-side pull and parse commands live in the Node API agent guide.

**Example:**

```json
{
  "id": "record-stop",
  "type": "stop_recording"
}
```

---

### `press_key`

Issues a system-level navigation key event via the Android Accessibility Service.

**Parameters:**

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `key` | `string` | yes | `"back"`, `"home"`, or `"recents"` |

**Supported keys:**

- `back` - Android back button
- `home` - Android home button
- `recents` - Android recents/apps overview button

**Result data on success:**

| Key | Value |
|-----|-------|
| `key` | The key that was pressed |

**Result data on failure:**

| Error | Meaning |
|-------|---------|
| `GLOBAL_ACTION_FAILED` | OS reported the global action could not be performed |

**Notes:**
- No retry by design - this action is single-attempt.
- Requires the Clawperator Operator accessibility service to be running.
- Non-global keys (enter, search, volume_up, volume_down, escape, raw keycodes) are not supported. Use `adb shell input keyevent` for those.

**Example:**

```json
{
  "id": "home1",
  "type": "press_key",
  "params": {
    "key": "home"
  }
}
```

---

## Retry Object Schema

Actions that accept a `retry` param use this object schema:

```json
{
  "maxAttempts": 3,
  "initialDelayMs": 500,
  "maxDelayMs": 3000,
  "backoffMultiplier": 2.0,
  "jitterRatio": 0.15
}
```

- `maxAttempts`: Capped at 10
- `initialDelayMs`: Capped at 30,000 ms
- `maxDelayMs`: Capped at 60,000 ms

Omit the `retry` field to use the action's default preset.

---

## See Also

- [Execution Model](execution-model.md) - Execution payload structure, timeout policy, error surfaces
- [API Overview](api-overview.md) - High-level API overview with HTTP endpoints
- [Navigation Patterns for Agents](../ai-agents/navigation-patterns.md) - Practical scroll, overlay, and OEM patterns
- [Clawperator Snapshot Format](snapshot-format.md) - Full snapshot output format reference
- [Error Codes](error-codes.md) - Complete error code reference
