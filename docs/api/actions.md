# Actions

## Purpose

Define the canonical `ExecutionAction.type` values, the exact parameters each action accepts, which values are validated by Node, and what success and failure data an agent can rely on.

## Sources

- Canonical action types: `apps/node/src/contracts/aliases.ts`
- Shared parameter shape: `apps/node/src/contracts/execution.ts`
- Validation rules: `apps/node/src/domain/executions/validateExecution.ts`
- CLI-built payload defaults: `apps/node/src/domain/actions/` and `apps/node/src/domain/observe/`

## General Rules

| Rule | Meaning |
| --- | --- |
| Canonical action names only | Stored payloads should use canonical types such as `open_uri`, `wait_for_node`, and `take_screenshot`. Input aliases are normalized before validation. |
| `params` is optional at the schema level | Action-specific validation then decides whether it is actually required. |
| Selectors live on a separate page | `matcher`, `container`, `expectedNode`, and `labelMatcher` all use the [Selectors](selectors.md) `NodeMatcher` contract. |
| `StepResult.data` is a string map | Node may attach known keys such as `text`, `path`, `warn`, `application_id`, `error`, or `message`, but most actions do not have a richer static success schema. |
| CLI coverage is narrower than raw JSON | Some advanced fields in `ActionParams` are accepted only through `clawperator exec` JSON, not through flat CLI flags. |

## Canonical Types And Input Aliases

Canonical public action types:

```text
open_app
open_uri
close_app
start_recording
stop_recording
wait_for_node
click
scroll_and_click
scroll
scroll_until
read_text
enter_text
snapshot_ui
take_screenshot
sleep
press_key
wait_for_navigation
read_key_value_pair
```

Input aliases normalized by Node before validation:

| Alias | Canonical type |
| --- | --- |
| `open_url` | `open_uri` |
| `tap` | `click` |
| `press` | `click` |
| `wait_for`, `find`, `find_node` | `wait_for_node` |
| `read` | `read_text` |
| `snapshot` | `snapshot_ui` |
| `screenshot`, `capture_screenshot` | `take_screenshot` |
| `type_text`, `text_entry`, `input_text` | `enter_text` |
| `key_press` | `press_key` |

## Full Payload Example

```json
{
  "commandId": "open-settings-and-snapshot",
  "taskId": "open-settings-and-snapshot",
  "source": "agent-loop",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    {
      "id": "open-1",
      "type": "open_app",
      "params": {
        "applicationId": "com.android.settings"
      }
    },
    {
      "id": "wait-1",
      "type": "wait_for_navigation",
      "params": {
        "expectedPackage": "com.android.settings",
        "timeoutMs": 5000
      }
    },
    {
      "id": "snap-1",
      "type": "snapshot_ui"
    }
  ],
  "mode": "direct"
}
```

Success condition for that payload:

- `envelope.status == "success"`
- every `envelope.stepResults[i].success == true`
- `envelope.stepResults[2].actionType == "snapshot_ui"`
- `"text" in envelope.stepResults[2].data`

## Action Reference

### `click`

| Field | Valid values |
| --- | --- |
| Required | exactly one of `params.matcher` or `params.coordinate` |
| `matcher` | any non-empty `NodeMatcher` |
| `coordinate` | `{ "x": <int >= 0>, "y": <int >= 0> }` |
| `clickType` | optional string; CLI builders use `"default"`, `"long_click"`, or `"focus"` |

Rules:

- `matcher` and `coordinate` are mutually exclusive.
- `clickType = "focus"` is invalid with `coordinate`.
- CLI defaults to `"default"` and omits the field from the payload.

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing selector, dual selector modes, invalid coordinates, or unsupported `clickType` combinations
- runtime step failures such as `NODE_NOT_FOUND`, `NODE_NOT_CLICKABLE`, `GESTURE_FAILED`

Example:

```json
{
  "id": "click-1",
  "type": "click",
  "params": {
    "matcher": { "textEquals": "Settings" },
    "clickType": "long_click"
  }
}
```

### `scroll`

| Field | Valid values |
| --- | --- |
| Required | none |
| `direction` | optional string in `down`, `up`, `left`, `right` |
| `container` | optional `NodeMatcher` |
| `distanceRatio` | optional number in `[0.0, 1.0]` |
| `settleDelayMs` | optional number in `[0, 10000]` |
| `maxSwipes` | accepted by `ActionParams`, but not validated or populated by the built-in CLI builders in this repo |
| `findFirstScrollableChild` | accepted by `ActionParams`, but not validated or populated by the built-in CLI builders in this repo |
| `retry`, `scrollRetry`, `clickRetry` | accepted as arbitrary JSON objects; Node does not currently validate their inner shape |

Semantics:

- if `direction` is omitted in raw JSON, Node validation allows omission
- the flat CLI always sets a direction
- `container` scopes the scroll to a matched scrollable container
- `distanceRatio` and `settleDelayMs` are advanced tuning fields for raw JSON execution

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for invalid `direction`, `distanceRatio`, or `settleDelayMs`
- runtime step failures such as `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED`

Example:

```json
{
  "id": "scroll-1",
  "type": "scroll",
  "params": {
    "direction": "down",
    "container": { "resourceId": "android:id/list" },
    "distanceRatio": 0.7,
    "settleDelayMs": 250
  }
}
```

### `scroll_until`

| Field | Valid values |
| --- | --- |
| Required | none at schema level; `matcher` becomes required when `clickAfter == true` |
| `direction` | optional string in `down`, `up`, `left`, `right` |
| `matcher` | optional `NodeMatcher` |
| `container` | optional `NodeMatcher` |
| `clickAfter` | optional boolean |
| `distanceRatio` | optional number in `[0.0, 1.0]` |
| `settleDelayMs` | optional number in `[0, 10000]` |
| `maxScrolls` | optional integer in `[1, 200]` |
| `maxDurationMs` | optional number in `[0, 120000]` |
| `noPositionChangeThreshold` | optional integer in `[1, 20]` |
| `findFirstScrollableChild` | accepted by `ActionParams`, but not constrained by current Node validation |
| `maxSwipes`, `retry`, `scrollRetry`, `clickRetry` | accepted by `ActionParams`, but not constrained by current Node validation for this action |

Semantics:

- without `clickAfter`, the action scrolls until the target becomes visible or the loop terminates
- with `clickAfter: true`, the same action requires `matcher` and turns into “scroll then click”
- the flat CLI exposes only the core controls; advanced tuning requires raw JSON via `clawperator exec`

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for invalid direction or out-of-range tuning fields
- runtime step failures such as `NODE_NOT_FOUND`, `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`

Example:

```json
{
  "id": "scroll-until-1",
  "type": "scroll_until",
  "params": {
    "direction": "down",
    "matcher": { "textEquals": "About phone" },
    "maxScrolls": 25,
    "maxDurationMs": 10000,
    "noPositionChangeThreshold": 3
  }
}
```

### `scroll_and_click`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `direction` | optional string in `down`, `up`, `left`, `right` |
| `matcher` | required `NodeMatcher` |
| `container` | optional `NodeMatcher` |
| `clickAfter` | optional boolean; CLI-built payloads set it to `true`, but the action type itself already implies click-after semantics |
| `distanceRatio`, `settleDelayMs`, `maxSwipes`, `retry`, `scrollRetry`, `clickRetry` | accepted through `ActionParams`; current Node validation enforces only the required `matcher` |

Semantics:

- this is the canonical action type produced by `scroll-until --click` and `scroll-and-click`
- unlike raw `scroll_until`, it always represents “find target, then click target”

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` if `matcher` is absent
- runtime scroll or click failures, including `NODE_NOT_FOUND`

Example:

```json
{
  "id": "scroll-click-1",
  "type": "scroll_and_click",
  "params": {
    "matcher": { "textEquals": "Submit" },
    "direction": "down"
  }
}
```

### `read_text`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `matcher` | required `NodeMatcher` |
| `all` | optional boolean; when `true`, request all matches instead of the first match |
| `container` | optional `NodeMatcher` |
| `validator` | optional string; current validation adds special behavior only for `"regex"` |
| `validatorPattern` | required non-empty valid regex string when `validator == "regex"` |
| `retry`, `scrollRetry`, `clickRetry` | accepted as arbitrary JSON objects with no Node-side shape validation |

Semantics:

- if `validator` is omitted, no validator-specific Node rule runs
- if `validator == "regex"`, `validatorPattern` must exist and compile as a regex
- other validator strings are accepted by the current Node schema, but this repo does not add extra Node-side validation semantics for them

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing `matcher` or invalid regex configuration
- runtime failures such as `NODE_NOT_FOUND`

Example:

```json
{
  "id": "read-1",
  "type": "read_text",
  "params": {
    "matcher": { "textContains": "Order" },
    "validator": "regex",
    "validatorPattern": "^ORD-[0-9]{6}$",
    "all": false
  }
}
```

### `read_key_value_pair`

| Field | Valid values |
| --- | --- |
| Required | `labelMatcher` |
| `labelMatcher` | required `NodeMatcher` |
| `all` | optional boolean |

Semantics:

- built by the flat `read-value` CLI command
- uses a label matcher rather than a generic element matcher

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` when `labelMatcher` is absent

Example:

```json
{
  "id": "read-value-1",
  "type": "read_key_value_pair",
  "params": {
    "labelMatcher": { "textEquals": "Battery" },
    "all": false
  }
}
```

### `enter_text`

| Field | Valid values |
| --- | --- |
| Required | `matcher`, `text` |
| `matcher` | required `NodeMatcher` |
| `text` | required non-empty string |
| `submit` | optional boolean |
| `clear` | optional boolean |

Semantics:

- `submit` defaults to `false` in the built-in CLI builders
- `clear` defaults to `false` in the built-in CLI builders

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing matcher or blank text
- runtime failures such as `NODE_NOT_FOUND`

Example:

```json
{
  "id": "type-1",
  "type": "enter_text",
  "params": {
    "matcher": { "resourceId": "com.example:id/search" },
    "text": "hello world",
    "clear": true,
    "submit": false
  }
}
```

### `press_key`

| Field | Valid values |
| --- | --- |
| Required | `key` |
| `key` | case-insensitive string in `back`, `home`, `recents` |

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing or unsupported key

Example:

```json
{
  "id": "press-1",
  "type": "press_key",
  "params": {
    "key": "back"
  }
}
```

### `wait_for_node`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `matcher` | required `NodeMatcher` |
| `timeoutMs` | optional positive number; when built by the CLI, it comes from `--timeout` |

Semantics:

- the action-level `timeoutMs` is distinct from the execution-level `timeoutMs`
- the builder inflates the execution timeout to `max(actionTimeout + 5000, 30000)` so the envelope does not expire before the wait finishes

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` when `matcher` is missing
- runtime failure when the target never appears

Example:

```json
{
  "id": "wait-1",
  "type": "wait_for_node",
  "params": {
    "matcher": { "textEquals": "Settings" },
    "timeoutMs": 5000
  }
}
```

### `wait_for_navigation`

| Field | Valid values |
| --- | --- |
| Required | at least one of `expectedPackage` or `expectedNode`, plus `timeoutMs` |
| `expectedPackage` | optional non-empty string up to matcher-length limits |
| `expectedNode` | optional `NodeMatcher` |
| `timeoutMs` | required number in `(0, 30000]` |

Semantics:

- at least one navigation target must be present
- the CLI builder inflates execution timeout to `max(timeoutMs + 5000, 30000)`

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing target, missing timeout, or timeout above `30000`

Example:

```json
{
  "id": "wait-nav-1",
  "type": "wait_for_navigation",
  "params": {
    "expectedPackage": "com.android.settings",
    "timeoutMs": 5000
  }
}
```

### `snapshot_ui`

| Field | Valid values |
| --- | --- |
| Required | none |
| Optional | none in the current public contract |

Semantics:

- the old `format` parameter is explicitly rejected as removed
- built-in builders set execution timeout to `30000` unless overridden

Success data:

- `data.text` contains the extracted XML hierarchy
- `data.warn` may be added when a snapshot immediately follows `click` or `scroll_and_click` without an intervening sleep

Common failures:

- `SNAPSHOT_EXTRACTION_FAILED`
- `RESULT_ENVELOPE_TIMEOUT`

Example:

```json
{
  "id": "snap-1",
  "type": "snapshot_ui"
}
```

### `take_screenshot`

| Field | Valid values |
| --- | --- |
| Required | none |
| `path` | optional non-empty string |

Semantics:

- if `path` is present, it must not be blank
- built-in builders set execution timeout to `30000` unless overridden

Success data:

- `data.path` after Node finalizes the screenshot capture

Common failures:

- `EXECUTION_VALIDATION_FAILED` for blank path
- timeout or runtime screenshot capture failures

Example:

```json
{
  "id": "shot-1",
  "type": "take_screenshot",
  "params": {
    "path": "/tmp/settings.png"
  }
}
```

### `close_app`

| Field | Valid values |
| --- | --- |
| Required | `applicationId` |
| `applicationId` | required non-empty package id string |

Semantics:

- built-in builders default execution timeout to `30000`
- Node runs a pre-flight adb force-stop and may normalize an Android-side unsupported close into success

Success data:

- `data.application_id` when pre-flight close succeeded

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing `applicationId`
- adb force-stop failure or package/runtime failures

Example:

```json
{
  "id": "close-1",
  "type": "close_app",
  "params": {
    "applicationId": "com.android.settings"
  }
}
```

### `sleep`

| Field | Valid values |
| --- | --- |
| Required | `durationMs` |
| `durationMs` | required number `>= 0` and `<= MAX_EXECUTION_TIMEOUT_MS` |

Semantics:

- builder sets execution timeout to `max(durationMs + 5000, globalTimeout, 30000)`

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for negative or oversized duration

Example:

```json
{
  "id": "sleep-1",
  "type": "sleep",
  "params": {
    "durationMs": 1500
  }
}
```

### `open_app`

| Field | Valid values |
| --- | --- |
| Required | `applicationId` |
| `applicationId` | required non-empty package id string |

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing `applicationId`

Example:

```json
{
  "id": "open-1",
  "type": "open_app",
  "params": {
    "applicationId": "com.android.settings"
  }
}
```

### `open_uri`

| Field | Valid values |
| --- | --- |
| Required | `uri` |
| `uri` | required non-empty string, max length enforced by `MAX_URI_LENGTH` |

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing or blank `uri`

Example:

```json
{
  "id": "open-uri-1",
  "type": "open_uri",
  "params": {
    "uri": "https://clawperator.com"
  }
}
```

### `start_recording`

| Field | Valid values |
| --- | --- |
| Required | none |
| `sessionId` | optional non-blank string |

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for blank `sessionId`
- recording-state runtime errors such as `RECORDING_ALREADY_IN_PROGRESS`

Example:

```json
{
  "id": "record-start-1",
  "type": "start_recording",
  "params": {
    "sessionId": "session-001"
  }
}
```

### `stop_recording`

| Field | Valid values |
| --- | --- |
| Required | none |
| `sessionId` | optional non-blank string |

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for blank `sessionId`
- recording-state runtime errors such as `RECORDING_NOT_IN_PROGRESS`

Example:

```json
{
  "id": "record-stop-1",
  "type": "stop_recording",
  "params": {
    "sessionId": "session-001"
  }
}
```

## CLI To Action Mapping

| CLI command | Canonical action type | Notes |
| --- | --- | --- |
| `click` | `click` | `tap` is a CLI synonym |
| `type` | `enter_text` | built from selector + text |
| `read` | `read_text` | supports optional container matcher |
| `read-value` | `read_key_value_pair` | built from label selector flags |
| `wait` | `wait_for_node` | action timeout comes from `--timeout` |
| `wait-for-nav` | `wait_for_navigation` | requires `--timeout` |
| `snapshot` | `snapshot_ui` | no action params |
| `screenshot` | `take_screenshot` | optional `path` |
| `close` | `close_app` | `close-app` is a CLI synonym |
| `sleep` | `sleep` | duration is positional |
| `open` | `open_app` or `open_uri` | dispatch depends on target string |
| `press`, `back` | `press_key` | `back` hardcodes `key = "back"` |
| `scroll` | `scroll` | container flags optional |
| `scroll-until` | `scroll_until` or `scroll_and_click` | `--click` switches to `scroll_and_click` |
| `scroll-and-click` | `scroll_and_click` | alias that implies click-after |

## Result Data You Can Rely On

| Action type | Success keys Node guarantees |
| --- | --- |
| `snapshot_ui` | `data.text`; optional `data.warn` |
| `take_screenshot` | `data.path` |
| `close_app` | `data.application_id` when Node pre-flight succeeded |
| all others | no fixed success keys guaranteed by Node |

For failures, inspect:

- `envelope.status`
- first failed `stepResults[i].success == false`
- `stepResults[i].data.error`
- `stepResults[i].data.message`

## Related Pages

- [Selectors](selectors.md)
- [Errors](errors.md)
- [API Overview](overview.md)
- [Snapshot Format](snapshot.md)
