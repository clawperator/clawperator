# Node API Overview

Clawperator exposes a Node-based interface for agent-driven device automation. The agent (brain) calls this API to dispatch actions to an Android device (hand). The API handles device resolution, payload validation, broadcast dispatch, and result collection.

---

## Interaction Model

1. Agent constructs an `Execution` payload.
2. Agent calls `execute` (CLI) or `POST /execute` (HTTP).
3. Clawperator validates the payload, resolves the device, dispatches via ADB broadcast, and waits for a `[Clawperator-Result]` envelope from logcat.
4. The result envelope is returned to the agent.

Single-flight enforcement: only one execution per device runs at a time. Concurrent calls return `EXECUTION_CONFLICT_IN_FLIGHT`.

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

### Canonical Types

| Type | Required params | Description |
|------|----------------|-------------|
| `open_app` | `applicationId` | Launch an app |
| `close_app` | `applicationId` | Force-stop an app |
| `click` | `matcher` | Tap a UI node |
| `scroll_and_click` | `target` | Scroll to and tap a node |
| `read_text` | `matcher` | Read text from a UI node |
| `enter_text` | `matcher`, `text` | Type text into a UI node |
| `wait_for_node` | `matcher` | Wait for a node to appear |
| `snapshot_ui` | - | Capture UI tree as ASCII or JSON |
| `take_screenshot` | - | Capture screen as PNG |
| `sleep` | `durationMs` | Pause execution |

### Aliases (normalized at input)

| Alias | Canonical type |
|-------|---------------|
| `tap`, `press` | `click` |
| `wait_for`, `find`, `find_node` | `wait_for_node` |
| `read` | `read_text` |
| `snapshot` | `snapshot_ui` |
| `screenshot`, `capture_screenshot` | `take_screenshot` |
| `type_text`, `text_entry`, `input_text` | `enter_text` |

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
| `applicationId` | string | `open_app`, `close_app` |
| `matcher` | NodeMatcher | `click`, `read_text`, `enter_text`, `wait_for_node` |
| `text` | string | `enter_text` |
| `submit` | boolean | `enter_text` - press enter after typing |
| `clear` | boolean | `enter_text` - clear field before typing |
| `clickType` | string | `click` - `default`, `long_click`, or `focus` |
| `target` | NodeMatcher | `scroll_and_click` |
| `container` | NodeMatcher | `scroll_and_click` |
| `direction` | string | `scroll_and_click` |
| `maxSwipes` | number | `scroll_and_click` |
| `durationMs` | number | `sleep` |
| `format` | `"ascii"\|"json"` | `snapshot_ui` |
| `path` | string | `take_screenshot` - output file path |
| `distanceRatio` | number | `scroll_and_click` |
| `settleDelayMs` | number | `scroll_and_click` |
| `retry` | object | per-step retry config |

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

---

## HTTP API (serve mode)

Start with `clawperator serve [--port 3000] [--host 127.0.0.1]`.

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

### `GET /events` (SSE)

Server-Sent Events stream. Emits two event types:

- `result` - fired when an execution completes: `{ deviceId, envelope }`
- `execution` - fired for every execution attempt: `{ deviceId, input, result }`
- `heartbeat` - initial connection confirmation

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ADB_PATH` | Override path to `adb` binary |
| `CLAWPERATOR_RECEIVER_PACKAGE` | Default receiver package (fallback if not passed as option) |

---

## Receiver Packages

| Variant | Package ID |
|---------|-----------|
| Release | `com.clawperator.operator` |
| Debug / Local | `com.clawperator.operator.dev` |
