# API Overview

Clawperator exposes a Node-based interface for agent-driven device automation. The agent (brain) calls this API to dispatch actions to an Android device (hand). The API handles device resolution, payload validation, broadcast dispatch, and result collection.

---

## Interaction Model

1. Agent constructs an `Execution` payload.
2. Agent calls `execute` (CLI) or `POST /execute` (HTTP).
3. Clawperator validates the payload, resolves the device, dispatches via ADB broadcast, and waits for a `[Clawperator-Result]` envelope from logcat.
4. The result envelope is returned to the agent.

Single-flight enforcement: only one execution per device runs at a time. Concurrent calls return `EXECUTION_CONFLICT_IN_FLIGHT`.

Clawperator can also provision and manage Android emulators through the Node layer. That gives agents a deterministic alternative runtime to a physical Android device.

---

## Execution Payload

The core unit dispatched to the device.

```json
{
  "commandId": "my-cmd-001",
  "taskId": "my-task-001",
  "source": "my-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "step1",
      "type": "click",
      "params": {
        "matcher": { "resourceId": "com.example:id/submit" }
      }
    }
  ]
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `commandId` | string | yes | Unique command identifier (max 128 chars) |
| `taskId` | string | yes | Task correlation ID (max 128 chars) |
| `source` | string | yes | Caller identifier (max 64 chars) |
| `expectedFormat` | string | yes | Must be `"android-ui-automator"` |
| `timeoutMs` | number | yes | Timeout in ms (1000-120000) |
| `actions` | array | yes | 1-50 actions |
| `mode` | string | no | `"artifact_compiled"` or `"direct"` |

### Limits

| Limit | Value |
|-------|-------|
| Max actions per execution | 50 |
| Min timeout | 1,000 ms |
| Max timeout | 120,000 ms |
| Max payload size | 64,000 bytes |
| Max ID length | 128 chars |
| Max source length | 64 chars |
| Max matcher value length | 512 chars |

---

## Action Types

For full params and result shapes, see [Action Types Reference](action-types.md).

### Canonical Types

| Type | Required params | Description |
|------|----------------|-------------|
| `open_uri` | `uri` | Open a URI via the system default handler |
| `open_app` | `applicationId` | Launch an app |
| `close_app` | `applicationId` | Force-stop an app |
| `click` | `matcher` | Tap a UI node |
| `scroll_and_click` | `matcher` | Scroll to and tap a node |
| `scroll` | - | Single scroll gesture with outcome reporting |
| `scroll_until` | - | Bounded scroll loop with machine-readable termination reason |
| `wait_for_navigation` | `timeoutMs` | Wait for package or node after navigation |
| `read_key_value_pair` | `labelMatcher` | Read Settings-style label + value pair |
| `read_text` | `matcher` | Read text from a UI node |
| `enter_text` | `matcher`, `text` | Type text into a UI node |
| `wait_for_node` | `matcher` | Wait for a node to appear |
| `snapshot_ui` | - | Capture the canonical `hierarchy_xml` UI tree |
| `take_screenshot` | - | Capture screen as PNG |
| `sleep` | `durationMs` | Pause execution |
| `start_recording` | - | Start a recording session in the operator app (`sessionId` optional) |
| `stop_recording` | - | Stop the active recording session in the operator app (`sessionId` optional) |
| `press_key` | `key` | Issue a system navigation key via accessibility |

### Aliases (normalized at input)

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

## NodeMatcher (Selector)

Used to identify a UI node. At least one field is required.

```json
{
  "resourceId": "com.example.app:id/button_ok",
  "role": "android.widget.Button",
  "textEquals": "OK",
  "textContains": "Submit",
  "contentDescEquals": "Submit button",
  "contentDescContains": "submit"
}
```

All fields are optional but at least one must be non-empty. Values are ORed internally by the device runtime.

---

## Action Params Reference

| Param | Type | Used by |
|-------|------|---------|
| `uri` | string | `open_uri` |
| `applicationId` | string | `open_app`, `close_app` |
| `matcher` | NodeMatcher | `click`, `read_text`, `enter_text`, `wait_for_node` |
| `text` | string | `enter_text` |
| `submit` | boolean | `enter_text` - press enter after typing |
| `clear` | boolean | `enter_text` - clear field before typing, but do not rely on Android to honor it yet |
| `clickType` | string | `click` - `default`, `long_click`, or `focus` |
| `matcher` | NodeMatcher | `scroll_and_click`, `scroll_until` (optional) |
| `container` | NodeMatcher | `scroll_and_click`, `scroll`, `scroll_until` |
| `direction` | string | `scroll_and_click`, `scroll`, `scroll_until` |
| `maxSwipes` | number | `scroll_and_click` |
| `clickAfter` | boolean | `scroll_and_click` - when `false`, scroll to target without clicking |
| `maxScrolls` | number | `scroll_until` - maximum scroll iterations (default: 20) |
| `maxDurationMs` | number | `scroll_until` - wall-clock cap in ms (default: 10000) |
| `noPositionChangeThreshold` | number | `scroll_until` - consecutive no-movement scrolls before stopping (default: 3) |
| `durationMs` | number | `sleep` |
| `key` | `"back"\|"home"\|"recents"` | `press_key` |
| `path` | string | `take_screenshot` - output file path |
| `distanceRatio` | number | `scroll_and_click`, `scroll`, `scroll_until` |
| `settleDelayMs` | number | `scroll_and_click`, `scroll`, `scroll_until` |
| `findFirstScrollableChild` | boolean | `scroll_and_click`, `scroll`, `scroll_until` - auto-use first scrollable descendant (default: `true`) |
| `retry` | object | per-step retry config |

For `scroll` and `scroll_until`, omitting `container` uses the first visible `scrollable="true"` node. That is convenient on simple screens, but on nested-scroll layouts agents should prefer an explicit `container.resourceId` taken from `snapshot_ui`.

---

## Result Envelope

All executions return a `ResultEnvelope` via the `[Clawperator-Result]` terminal signal.

```json
{
  "commandId": "my-cmd-001",
  "taskId": "my-task-001",
  "status": "success",
  "stepResults": [
    {
      "id": "step1",
      "actionType": "click",
      "success": true,
      "data": {}
    }
  ],
  "error": null
}
```

### ResultEnvelope Fields

| Field | Type | Description |
|-------|------|-------------|
| `commandId` | string | Correlates to the dispatched command |
| `taskId` | string | Correlates to the task |
| `status` | `"success"\|"failed"` | Overall execution status |
| `stepResults` | array | Per-action results |
| `error` | string or null | Top-level error message if failed |

### StepResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Action ID from the execution |
| `actionType` | string | Canonical action type |
| `success` | boolean | Whether the step succeeded |
| `data` | object | Action-specific output data |
| `error` | string | Step-level error message |

For `snapshot_ui`, `data.text` contains the UI tree string.
For `take_screenshot`, `data.path` contains the local file path of the PNG.
For `press_key`, `data.key` contains the normalized lowercase key name. If Android rejects the global action, the step returns `success: false` with `data.error: "GLOBAL_ACTION_FAILED"`.

---

## HTTP API (serve mode)

Start with `clawperator serve [--port 3000] [--host 127.0.0.1]`.

### `GET /android/emulators`

Return configured Android Virtual Devices with normalized compatibility metadata.

**Response:**
```json
{
  "avds": [
    {
      "name": "clawperator-pixel",
      "exists": true,
      "running": false,
      "supported": true,
      "apiLevel": 35,
      "abi": "arm64-v8a",
      "playStore": true,
      "deviceProfile": "pixel_7",
      "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
      "unsupportedReasons": []
    }
  ]
}
```

### `GET /android/emulators/:name`

Return the normalized view of one AVD. This is the emulator diagnosis endpoint.

### `GET /android/emulators/running`

Return running emulator devices and boot state.

**Response:**
```json
{
  "devices": [
    {
      "type": "emulator",
      "avdName": "clawperator-pixel",
      "serial": "emulator-5554",
      "booted": true
    }
  ]
}
```

### `POST /android/emulators/create`

Create a new supported AVD. The request body may include:

- `name`
- `apiLevel`
- `deviceProfile`
- `abi`
- `playStore`

### `POST /android/emulators/:name/start`

Start an existing AVD and return a booted emulator device:

```json
{
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true
}
```

### `POST /android/emulators/:name/stop`

Stop a running emulator by AVD name.

### `DELETE /android/emulators/:name`

Delete an AVD by name.

### `POST /android/provision/emulator`

Provision a supported emulator using deterministic reuse-first orchestration:

1. reuse a running supported emulator
2. start a stopped supported AVD
3. create a new supported AVD

The default profile is Android API `35`, Google Play, ABI `arm64-v8a`, device profile `pixel_7`, and AVD name `clawperator-pixel`.

### `GET /devices`

Returns connected devices.

**Response:**
```json
{ "ok": true, "devices": [{ "serial": "<device_serial>", "state": "device" }] }
```

### `POST /execute`

Run an execution payload.

**Request body:**
```json
{
  "execution": { /* Execution object */ },
  "deviceId": "<device_serial>",
  "receiverPackage": "com.clawperator.operator"
}
```

**Response (success):**
```json
{ "ok": true, "envelope": { /* ResultEnvelope */ }, "deviceId": "<device_serial>" }
```

**Response (error):**
```json
{ "ok": false, "error": { "code": "ERROR_CODE", "message": "..." } }
```

**HTTP status codes:**

| Code | Condition |
|------|-----------|
| 200 | Success |
| 400 | Validation error, missing fields, ambiguous device |
| 404 | Device not found or no devices |
| 413 | Payload too large |
| 423 | Execution conflict (in-flight) |
| 504 | Result envelope timeout |

### `POST /observe/snapshot`

Capture UI snapshot. Body: `{ "deviceId"?, "receiverPackage"? }`.

Same response shape as `/execute`.

### `POST /observe/screenshot`

Capture screenshot. Body: `{ "deviceId"?, "receiverPackage"? }`.

Same response shape as `/execute`. The PNG path is in `envelope.stepResults[0].data.path`.

### `GET /skills`

List or search skills. Use query parameters to filter.

**Query parameters:** `?app=<package_id>&intent=<intent>&keyword=<text>` (all optional).

**Response:**
```json
{ "ok": true, "skills": [{ "id": "...", "applicationId": "...", "intent": "...", "summary": "..." }], "count": 2 }
```

### `GET /skills/:skillId`

Get metadata for a specific skill.

**Response (success):**
```json
{ "ok": true, "skill": { "id": "...", "applicationId": "...", "intent": "...", "summary": "...", "scripts": [...], "artifacts": [...] } }
```

**Response (not found):** HTTP 404
```json
{ "ok": false, "error": { "code": "SKILL_NOT_FOUND", "message": "..." } }
```

### `POST /skills/:skillId/run`

Run a skill script (convenience wrapper).

**Request body:**
```json
{
  "deviceId": "<device_serial>",
  "args": ["extra", "args"]
}
```

Both fields are optional.

**Response (success):**
```json
{ "ok": true, "skillId": "...", "output": "...", "exitCode": 0, "durationMs": 8500 }
```

**Response (error):**
```json
{ "ok": false, "error": { "code": "SKILL_EXECUTION_FAILED", "message": "...", "skillId": "...", "exitCode": 1, "stderr": "..." } }
```

### `GET /events` (SSE)

Server-Sent Events stream. Emits two event types:

- `clawperator:result` - fired when an execution completes: `{ deviceId, envelope }`
- `clawperator:execution` - fired for every execution attempt: `{ deviceId, input, result }`
- `heartbeat` - initial connection confirmation

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADB_PATH` | Override path to `adb` binary |
| `CLAWPERATOR_RECEIVER_PACKAGE` | Default receiver package (fallback if not passed as option) |
| `CLAWPERATOR_SKILLS_REGISTRY` | Path to `skills-registry.json`. If unset, defaults to `./skills/skills-registry.json` relative to the working directory. After `skills install`, set to `~/.clawperator/skills/skills/skills-registry.json`. |

---

## Receiver Packages

| Variant | Package ID |
|---------|-----------|
| Release | `com.clawperator.operator` |
| Debug / Local | `com.clawperator.operator.dev` |
