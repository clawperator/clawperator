# Actions

## Purpose

Define the canonical `ExecutionAction.type` values, the exact parameters each action accepts, which values are validated by Node, and what success and failure data an agent can rely on.

## Sources

- Canonical action types: `apps/node/src/contracts/aliases.ts`
- Shared parameter shape: `apps/node/src/contracts/execution.ts`
- Validation rules: `apps/node/src/domain/executions/validateExecution.ts`
- CLI-built payload defaults: `apps/node/src/domain/actions/` and `apps/node/src/domain/observe/`
- Android payload parsing: `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- Android action/result behavior: `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` and `UiActionEngine.kt`
- Android text-entry runtime behavior: `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`

## General Rules

| Rule | Meaning |
| --- | --- |
| Canonical action names only | Stored payloads should use canonical types such as `open_uri`, `wait_for_node`, and `take_screenshot`. Input aliases are normalized before validation. |
| Canonical payload keys still win | Node accepts common input aliases such as snake_case top-level keys, `package` for `applicationId`, `url` for `uri`, `selector` for `matcher`, and `value` for `text`, but the normalized payload always uses the canonical field names. |
| `params` is optional at the schema level | Action-specific validation then decides whether it is actually required. |
| Selectors live on a separate page | `matcher`, `container`, `expectedNode`, and `labelMatcher` all use the [Selectors](selectors.md) `NodeMatcher` contract. |
| `StepResult.data` is a string map | Node may attach known keys such as `text`, `path`, `warn`, `application_id`, `error`, or `message`, but most actions do not have a richer static success schema. |
| CLI coverage is narrower than raw JSON | Some advanced fields in `ActionParams` are accepted only through `clawperator exec` JSON, not through flat CLI flags. |
| Runtime details are not always Node guarantees | When this page calls out Android-returned success keys, treat them as current runtime behavior verified from Android code, not as a stricter Node-side schema guarantee. |

## Retry Object Shape

Several actions accept `retry`, `scrollRetry`, or `clickRetry` objects in raw `clawperator exec` JSON. Node accepts these fields as part of `ActionParams`, and Android parses them into a retry policy with these keys:

```json
{
  "maxAttempts": 4,
  "initialDelayMs": 400,
  "maxDelayMs": 2000,
  "backoffMultiplier": 2,
  "jitterRatio": 0.15
}
```

Meaning:

- `maxAttempts` counts the initial attempt, so `1` means no retry.
- `initialDelayMs` is the delay before the first retry.
- `maxDelayMs` caps exponential backoff growth.
- `backoffMultiplier` must be `>= 1.0`.
- `jitterRatio` must be in `[0.0, 1.0]`.
- Android clamps `maxAttempts` to `1..10`.
- Android clamps `initialDelayMs` to `0..30000`.
- Android clamps `maxDelayMs` to `initialDelayMs..60000`.
- Android clamps `backoffMultiplier` to `1.0..5.0`.
- Android clamps `jitterRatio` to `0.0..1.0`.
- if you omit a retry object, Android applies an action-specific default such as `UiReadiness`, `UiScroll`, `AppLaunch`, `AppClose`, or `None`.

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
snapshot
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
| `snapshot_ui` | `snapshot` |
| `screenshot`, `capture_screenshot` | `take_screenshot` |
| `type_text`, `text_entry`, `input_text` | `enter_text` |
| `key_press` | `press_key` |

Common payload-key aliases also accepted on input:

- top-level execution keys: `command_id`, `task_id`, `expected_format`, `timeout_ms`
- app/package fields: `package`, `package_id`, `application_id`, `app`, `app_id` -> `applicationId`
- URI field: `url` -> `uri`
- matcher fields: `selector`, `node`, `element` -> `matcher`
- raw matcher-object fields: `id`, `resource_id`, `text`, `text_contains`, `content_desc`, `content_desc_contains`, `description`, `description_contains`, `accessibility_label`, `accessibility_label_contains`
- text-entry field: `value` -> `text`
- screenshot path fields: `file`, `filePath`, `output_path` -> `path`
- navigation fields: `expected_package`, `expected_node`, `timeout_ms`
- open_app fields: `skip_navigation_wait`, `navigation_timeout_ms`
- label selector fields: `label_matcher`, `label_selector`

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
      "type": "snapshot"
    }
  ],
  "mode": "direct"
}
```

Success condition for that payload:

- `envelope.status == "success"`
- every `envelope.stepResults[i].success == true`
- `envelope.stepResults[2].actionType == "snapshot"`
- `"text" in envelope.stepResults[2].data`

## Action Reference

<a id="action-click"></a>
### `click`

| Field | Valid values |
| --- | --- |
| Required | exactly one of `params.matcher` or `params.coordinate` |
| `matcher` | any non-empty `NodeMatcher` |
| `coordinate` | `{ "x": <int >= 0>, "y": <int >= 0> }` |
| `clickType` | optional string; CLI builders use `"default"`, `"long_click"`, or `"focus"` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

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

<a id="action-scroll"></a>
### `scroll`

| Field | Valid values |
| --- | --- |
| Required | none |
| `direction` | optional string in `down`, `up`, `left`, `right` |
| `container` | optional `NodeMatcher` |
| `distanceRatio` | optional number in `[0.0, 1.0]` |
| `settleDelayMs` | optional number in `[0, 10000]` |
| `findFirstScrollableChild` | optional boolean in raw `exec` JSON; Android defaults to `true` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` for plain scroll |

Semantics:

- if `direction` is omitted in raw JSON, Node validation allows omission
- Android defaults omitted `direction` to `down`
- the flat CLI always sets a direction explicitly
- `container` scopes the scroll to a matched scrollable container
- `distanceRatio` and `settleDelayMs` are advanced tuning fields for raw JSON execution
- if `findFirstScrollableChild == true` and the matched container is not itself scrollable, Android walks down to the first scrollable descendant
- `retry` covers container resolution and repeated UI-tree fetches during the scroll operation

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

<a id="action-scroll-until"></a>
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
| `findFirstScrollableChild` | optional boolean in raw `exec` JSON; Android defaults to `true` |
| `clickType` | optional string in raw `exec` JSON; Android parses the same click types used by `click` |

Semantics:

- without `clickAfter`, the action scrolls until the target becomes visible or the loop terminates
- with `clickAfter: true`, the same action requires `matcher` and turns into “scroll then click”
- the flat CLI exposes only the core controls; advanced tuning requires raw JSON via `clawperator exec`
- Android defaults omitted `direction` to `down`, `distanceRatio` to `0.7`, `settleDelayMs` to `250`, `maxScrolls` to `20`, `maxDurationMs` to `10000`, `noPositionChangeThreshold` to `3`, and `findFirstScrollableChild` to `true`
- `maxScrolls` is the hard cap on how many scroll steps Android will attempt
- `maxDurationMs` is the wall-clock cap for the full loop
- `noPositionChangeThreshold` stops the loop after that many consecutive non-moving scrolls

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

<a id="action-scroll-and-click"></a>
### `scroll_and_click`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `direction` | optional string in `down`, `up`, `left`, `right` |
| `matcher` | required `NodeMatcher` |
| `container` | optional `NodeMatcher` |
| `clickAfter` | optional boolean in raw `exec` JSON; Android defaults it to `true` |
| `maxSwipes` | optional integer in raw `exec` JSON; Android defaults it to `10` and clamps it to `[1, 50]` |
| `distanceRatio` | optional number in raw `exec` JSON; Android defaults it to `0.7` and clamps it to `[0.0, 1.0]` |
| `settleDelayMs` | optional number in raw `exec` JSON; Android defaults it to `250` and clamps it to `[0, 10000]` |
| `findFirstScrollableChild` | optional boolean in raw `exec` JSON; Android defaults it to `true` |
| `clickType` | optional string in raw `exec` JSON; Android parses the same click types used by `click` |
| `scrollRetry` | optional retry object in raw `exec` JSON; Android defaults to `UiScroll` |
| `clickRetry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

Semantics:

- this is the canonical action type produced by `scroll-until --click` and `scroll-and-click`
- unlike raw `scroll_until`, this action is optimized for “scroll to target, then click target”
- `maxSwipes` is the safety cap on how many swipes Android performs before failing
- `scrollRetry` applies to scrolling and view refresh between swipes
- `clickRetry` applies only to the final click after the target is visible
- setting `clickAfter: false` is accepted in raw `exec` JSON and makes Android stop after revealing the target, but the flat CLI does not emit that variant for `scroll_and_click`

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

<a id="action-read-text"></a>
### `read_text`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `matcher` | required `NodeMatcher` |
| `all` | optional boolean; when `true`, request all matches instead of the first match |
| `container` | optional `NodeMatcher` |
| `validator` | optional string; current validation adds special behavior only for `"regex"` |
| `validatorPattern` | required non-empty valid regex string when `validator == "regex"` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

Semantics:

- if `validator` is omitted, no validator-specific Node rule runs
- if `validator == "regex"`, `validatorPattern` must exist and compile as a regex
- other validator strings are accepted by the current Node schema, but this repo does not add extra Node-side validation semantics for them
- current Android parser accepts only `temperature`, `version`, and `regex`; any other validator string is rejected at runtime
- `all: true` asks Android to return all matching text values instead of only the first match

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

<a id="action-read-key-value-pair"></a>
### `read_key_value_pair`

| Field | Valid values |
| --- | --- |
| Required | `labelMatcher` |
| `labelMatcher` | required `NodeMatcher` |
| `all` | optional boolean |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

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

<a id="action-enter-text"></a>
### `enter_text`

| Field | Valid values |
| --- | --- |
| Required | `matcher`, `text` |
| `matcher` | required `NodeMatcher` |
| `text` | required non-empty string |
| `clear` | optional boolean |
| `submit` | optional boolean |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

Semantics:

- `submit` defaults to `false` in the built-in CLI builders
- `clear` defaults to `false` in the built-in CLI builders
- Android uses an internal first-match-wins text-entry ladder while keeping the public `enter_text` shape unchanged
- Android prefers the editable node `ACTION_SET_TEXT` route when it is available because that path already matches current replace-text semantics
- on that `ACTION_SET_TEXT` route, `clear == true` first dispatches `ACTION_SET_TEXT("")`, then dispatches `ACTION_SET_TEXT` with the requested `text`
- on that same `ACTION_SET_TEXT` route, `clear == false` or omitted keeps the existing single `ACTION_SET_TEXT` behavior
- if the requested clear step fails on the `ACTION_SET_TEXT` route, Android stops before the real text set for that legacy strategy; on Android 13+ it can still continue to the accessibility input-connection fallback when that route is available, otherwise the action fails
- on Android 13+ (`Build.VERSION_CODES.TIRAMISU`) when the legacy `ACTION_SET_TEXT` route is unavailable or does not complete successfully, Android can fall back to the accessibility input-connection path for custom editors
- that API 33 fallback still preserves replace-style behavior by moving the cursor to the end, deleting preceding text, then committing the replacement text
- that API 33 replace sequence also preserves `clear == true` semantics even though there is no separate public strategy flag
- `submit == true` is best effort after successful text entry
- on the legacy route, Android prefers `ACTION_IME_ENTER` when the node exposes it and falls back to a click when it does not
- on the API 33 input-connection route, Android prefers `performEditorAction(...)`
- if text entry succeeds but no truthful submit action is available, the step still succeeds and `submit` does not become a new hard-failure condition

Success data:

- Node does not declare a richer static schema here
- current Android runtime behavior returns `data.text`, `data.clear`, and `data.submit`

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing matcher or blank text
- runtime failures such as `NODE_NOT_FOUND`
- Android task-status failure payloads use `failure_point = set_text_failed` when the clear or text-set step cannot be completed

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

Verification pattern:

```bash
clawperator type "battery" --id "com.android.settings:id/search_src_text" --clear
```

Success conditions:

- exit code `0`
- `envelope.status == "success"`
- `envelope.stepResults[0].actionType == "enter_text"`
- `envelope.stepResults[0].success == true`
- `envelope.stepResults[0].data.clear == "true"`

Android live-route verification:

- when validating against the debug operator on device, operator logs include
  `enter_text strategy=<strategy_name> submit_method=<submit_method>`
- on the API 33 route, warning-level logs can also include
  `enter_text strategy=api33_input_connection partial_failure reason=<reason>`
  when the fallback delete step succeeds but the final `commitText(...)` does
  not
- current shipped strategy names are `legacy_action_set_text` and
  `api33_input_connection`

<a id="action-press-key"></a>
### `press_key`

| Field | Valid values |
| --- | --- |
| Required | `key` |
| `key` | case-insensitive string in `back`, `home`, `recents` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` |

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

<a id="action-wait-for-node"></a>
### `wait_for_node`

| Field | Valid values |
| --- | --- |
| Required | `matcher` |
| `matcher` | required `NodeMatcher` |
| `timeoutMs` | optional number; the current Android parser clamps a provided value to `1..120000`; when built by the CLI, it comes from `--timeout` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

Semantics:

- the action-level `timeoutMs` is distinct from the execution-level `timeoutMs`
- current Node validation does not add a stricter positivity check for this field
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

<a id="action-wait-for-navigation"></a>
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

<a id="action-snapshot"></a>
### `snapshot`

| Field | Valid values |
| --- | --- |
| Required | none |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `UiReadiness` |

Semantics:

- the old `format` parameter is explicitly rejected as removed
- built-in builders set execution timeout to `30000` unless overridden
- snapshot extraction requires the `[TaskScope] UI Hierarchy [commandId=<command_id>]:` marker; see [Snapshot Format](snapshot.md)

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
  "type": "snapshot"
}
```

<a id="action-take-screenshot"></a>
### `take_screenshot`

| Field | Valid values |
| --- | --- |
| Required | none |
| `path` | optional non-empty string |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` |

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

<a id="action-close-app"></a>
### `close_app`

| Field | Valid values |
| --- | --- |
| Required | `applicationId` |
| `applicationId` | required non-empty package id string |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `AppClose` |

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

<a id="action-sleep"></a>
### `sleep`

| Field | Valid values |
| --- | --- |
| Required | `durationMs` |
| `durationMs` | required number `>= 0` and `<=` the maximum execution timeout constant |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` |

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

<a id="action-open-app"></a>
### `open_app`

| Field | Valid values |
| --- | --- |
| Required | `applicationId` |
| `applicationId` | required non-empty package id string |
| `skipNavigationWait` | optional boolean, defaults to `false` |
| `navigationTimeoutMs` | optional integer in `[1000, 120000]`, defaults to `15000` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `AppLaunch` |

Semantics:

- `open_app` dispatches the launch intent, then waits until the launched package is the active foreground accessibility package before returning success.
- set `skipNavigationWait: true` only when you intentionally want the older fire-and-forget behavior.
- `navigationTimeoutMs` controls the readiness wait only. It does not change the execution-level timeout.
- already-foreground launches succeed without a package-transition race.
- callers that need content to be present after the package is foreground should follow with `wait_for_node`.
- the `clawperator open` CLI exposes `--skip-navigation-wait` and `--navigation-timeout-ms` for package targets only; URI targets reject both flags with `EXECUTION_VALIDATION_FAILED`.

Success data:

- no Node-guaranteed success keys

Common failures:

- `EXECUTION_VALIDATION_FAILED` for missing `applicationId`
- runtime step failures such as `NAVIGATION_TIMEOUT` when the launched package does not reach the foreground within the wait budget

Example:

```json
{
  "id": "open-1",
  "type": "open_app",
  "params": {
    "applicationId": "com.android.settings",
    "skipNavigationWait": false,
    "navigationTimeoutMs": 15000
  }
}
```

<a id="action-open-uri"></a>
### `open_uri`

| Field | Valid values |
| --- | --- |
| Required | `uri` |
| `uri` | required non-empty string, max length enforced by `MAX_URI_LENGTH` |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `AppLaunch` |

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

<a id="action-start-recording"></a>
### `start_recording`

| Field | Valid values |
| --- | --- |
| Required | none |
| `sessionId` | optional non-blank string |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` |

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

<a id="action-stop-recording"></a>
### `stop_recording`

| Field | Valid values |
| --- | --- |
| Required | none |
| `sessionId` | optional non-blank string |
| `retry` | optional retry object in raw `exec` JSON; Android defaults to `None` |

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
| `snapshot` | `snapshot` | no action params |
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
| `snapshot` | `data.text`; optional `data.warn` |
| `take_screenshot` | `data.path` |
| `close_app` | `data.application_id` when Node pre-flight succeeded |
| all others | no fixed success keys guaranteed by Node |

Concrete success example for `take_screenshot`:

```json
{
  "id": "shot-1",
  "actionType": "take_screenshot",
  "success": true,
  "data": {
    "path": "/tmp/settings.png"
  }
}
```

Concrete success example for `snapshot`:

```json
{
  "id": "snap-1",
  "actionType": "snapshot",
  "success": true,
  "data": {
    "text": "<hierarchy rotation=\"0\">...</hierarchy>",
    "warn": "snapshot captured without a preceding sleep step; UI may not have settled - consider adding a sleep step between click and snapshot"
  }
}
```

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
