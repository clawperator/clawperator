# Clawperator Node API - Agent Guide

Clawperator provides a deterministic execution layer for LLM agents to control Android devices. This guide covers the CLI and HTTP API contracts.

## Concepts

- **Execution**: A payload of one or more actions dispatched to the device. Every execution produces exactly one `[Clawperator-Result]` envelope.
- **Action**: A single step (`open_app`, `click`, `read_text`, etc.) within an execution.
- **Snapshot**: A captured UI hierarchy dump (`hierarchy_xml`) for observing device state.
- **Skill**: A packaged recipe from the skills repo, compiled into an execution payload.

## CLI Reference

| Command | Description |
| :--- | :--- |
| `operator setup --apk <path>` | Install the Operator APK and grant required device permissions (canonical setup command, with `operator install` kept as an alias) |
| `devices` | List connected Android serials and states |
| `emulator list` | List configured Android Virtual Devices with compatibility metadata |
| `emulator inspect <name>` | Show normalized metadata for one Android Virtual Device |
| `emulator create [--name <name>]` | Create the default supported Android emulator |
| `emulator start <name>` | Start an existing Android Virtual Device and wait until boot completes |
| `emulator stop <name>` | Stop a running Android emulator by AVD name |
| `emulator delete <name>` | Delete an Android Virtual Device by name |
| `emulator status` | List running Android emulators and boot state |
| `emulator provision` | Reuse or create a supported Android emulator and return its ADB serial |
| `provision emulator` | Alias of `emulator provision` |
| `execute --execution <json\|file>` | Run a full execution payload |
| `observe snapshot` | Capture UI hierarchy dump (`hierarchy_xml`) |
| `observe screenshot` | Capture device screen as PNG |
| `action open-app --app <id>` | Open an application |
| `action click --selector <json>` | Click a UI element |
| `action read --selector <json>` | Read text from element |
| `action type --selector <json> --text <value>` | Type text |
| `action wait --selector <json>` | Wait for element |
| `skills list` | List available skills |
| `skills get <skill_id>` | Show skill metadata |
| `skills search [--app <pkg>] [--intent <i>] [--keyword <k>]` | Search skills by app, intent, or keyword (at least one filter required) |
| `skills compile-artifact <id> --artifact <name>` | Compile skill to execution payload |
| `skills run <skill_id> [--device-id <id>]` | Invoke a skill script (convenience wrapper) |
| `skills install` | Clone skills repo to `~/.clawperator/skills/` |
| `skills update [--ref <git-ref>]` | Pull latest skills (optionally pin to a ref) |
| `grant-device-permissions` | Re-grant Operator permissions only after an Operator APK crash causes Android to revoke them |
| `serve` | Start HTTP/SSE server |
| `doctor` | Run environment diagnostics |
| `version` | Print the CLI version or check CLI / Clawperator Operator Android app compatibility |

**Global options:** `--device-id <id>`, `--receiver-package <pkg>`, `--output <json|pretty>`, `--format <json|pretty>` (alias for `--output`), `--timeout-ms <n>`, `--verbose`

For agent callers, `--output json` is the canonical output mode. `pretty` is for human inspection.

Default receiver package:

- release app package: `com.clawperator.operator`
- local debug app package: pass `--receiver-package com.clawperator.operator.dev`

Use subcommand help when the docs and the current CLI differ:

```bash
clawperator observe snapshot --help
clawperator skills sync --help
clawperator doctor --help
```

Use `clawperator version --check-compat` before automation batches when the agent needs to verify that the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) matches the CLI's supported `major.minor` version:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

The response includes the CLI version, detected [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version, app `versionCode`, receiver package, compatibility verdict, and remediation guidance on mismatch.

## HTTP API (`clawperator serve`)

Start with `clawperator serve [--port <n>] [--host <ip>]`. Default: `127.0.0.1:3000`.

> **Security:** The API is unauthenticated. Binds to localhost by default. Only use `--host 0.0.0.0` on trusted networks.

| Endpoint | Description |
| :--- | :--- |
| `GET /devices` | Returns `{ ok: true, devices: [...] }` |
| `GET /android/emulators` | Returns configured AVDs with compatibility metadata |
| `GET /android/emulators/:name` | Returns normalized metadata for one AVD |
| `GET /android/emulators/running` | Returns running emulator devices and boot state |
| `POST /android/emulators/create` | Ensure the system image exists and create an AVD |
| `POST /android/emulators/:name/start` | Start an AVD and return a booted emulator device |
| `POST /android/emulators/:name/stop` | Stop a running emulator by AVD name |
| `DELETE /android/emulators/:name` | Delete an AVD by name |
| `POST /android/provision/emulator` | Reuse or create a supported emulator and return a booted device |
| `POST /execute` | Body: `{"execution": <payload>, "deviceId": "...", "receiverPackage": "..."}` |
| `POST /observe/snapshot` | Capture UI tree |
| `POST /observe/screenshot` | Capture screenshot |
| `GET /skills` | List skills. Query params: `?app=<pkg>&intent=<i>&keyword=<k>` |
| `GET /skills/:skillId` | Get skill metadata |
| `POST /skills/:skillId/run` | Run skill. Body: `{"deviceId": "...", "args": [...]}` |
| `GET /events` | SSE stream: `clawperator:result`, `clawperator:execution`, `heartbeat` |

See `apps/node/examples/basic-api-usage.js` for a complete SSE + REST example.

## Android Emulator Support

Note: Clawperator does not configure accounts, install the Android apps the user wants Clawperator to operate, or complete first-run app setup inside the emulator.
Agents should assume the emulator already contains the logged-in Android apps required for automation.

Clawperator supports Android emulator provisioning as an alternative runtime to a physical Android device. Emulator lifecycle management lives in the Node CLI and HTTP API, not in `install.sh`.

Provisioning policy is deterministic:

1. Reuse a running supported emulator.
2. Start a stopped supported AVD.
3. Create a new supported AVD if none exist.

The default supported emulator profile is:

- Android API level `35`
- Google Play system image
- ABI `arm64-v8a`
- device profile `pixel_7`
- default AVD name `clawperator-pixel`

Compatibility is determined from AVD metadata under:

- `~/.android/avd/<name>.avd/config.ini`
- `~/.android/avd/<name>.ini`

The implementation normalizes and evaluates these fields:

- `PlayStore.enabled`
- `abi.type`
- `image.sysdir.1`
- `hw.device.name`

Inspect one AVD:

```bash
clawperator emulator inspect clawperator-pixel --output json
```

Provision a ready emulator:

```bash
clawperator provision emulator --output json
```

Typical provisioning result (CLI output):

```json
{
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true,
  "created": false,
  "started": false,
  "reused": true
}
```

HTTP response from `POST /android/provision/emulator` wraps the same payload with `"ok": true`.

If both a physical device and an emulator are connected, continue to pass `--device-id <serial>` to execution and observe commands so targeting stays explicit.

## Execution Payload

Every execution requires `expectedFormat: "android-ui-automator"`.

```json
{
  "commandId": "unique-id-123",
  "taskId": "task-456",
  "source": "my-agent",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 60000,
  "actions": [
    { "id": "step1", "type": "open_app", "params": { "applicationId": "com.example.app" } },
    { "id": "step2", "type": "enter_text", "params": { "matcher": { "resourceId": "com.example.app:id/search_input" }, "text": "hello", "submit": true } },
    { "id": "step3", "type": "click", "params": { "matcher": { "textEquals": "Login" }, "clickType": "default" } },
    { "id": "step4", "type": "snapshot_ui" }
  ]
}
```

**Execution timeout limit:** `timeoutMs` is schema-validated. The allowed range is 1,000-120,000 ms (1 second to 2 minutes). Submitting a value outside this range causes `EXECUTION_VALIDATION_FAILED` - the execution is rejected before any action runs. Operations that require longer running time must be split across multiple execution payloads. For install or download flows, use `wait_for_node` polling within the 120-second window rather than a single long sleep.

**Result envelope:** Exactly one `[Clawperator-Result]` JSON block is emitted to logcat on completion. Node reads and returns it. See the Result Envelope section for the full shape and per-action `data` contents.

## NodeMatcher Reference

A NodeMatcher identifies a single UI element for action targeting. Used as a required param in `click`, `enter_text`, `read_text`, `wait_for_node`, and `scroll_and_click`.

All specified fields are combined with AND semantics: every specified field must match the target element. At least one field is required per matcher.

| Field | Type | Description |
| :--- | :--- | :--- |
| `resourceId` | `string` | Developer-assigned element ID. Format: `"com.example.app:id/element_name"`. Most stable - prefer over all others when present. |
| `contentDescEquals` | `string` | Exact match on accessibility content description. Use for icon buttons with no visible text. |
| `textEquals` | `string` | Exact match on visible text label. Fragile for server-driven or localized content. |
| `textContains` | `string` | Substring match on visible text. Use when full text is dynamic or may be truncated. |
| `contentDescContains` | `string` | Substring match on accessibility label. Fallback for partial or dynamic accessibility labels. |
| `role` | `string` | Matches by Clawperator semantic role name (`button`, `textfield`, `text`, `switch`, `checkbox`, `image`, `listitem`, `toolbar`, `tab`). Derived from runtime role inference, not the raw UIAutomator `class` string. Generally low selectivity - many elements share a role. Use as a secondary constraint for most roles. **Exception:** `role: "textfield"` targets the inferred text-input role, which is derived from common Android text-input widgets (for example class names containing `EditText`, `TextInputEditText`, or `AutoCompleteTextView`). It is the correct primary selector for text input fields in apps that do not assign `resource-id` to their inputs (which includes many production apps such as Google Play Store). In those apps `role: "textfield"` may be the only reliable way to target the active text input. |

**Selector priority (most to least stable):** `resourceId` > `contentDescEquals` > `textEquals` > `textContains` > `contentDescContains` > `role`

Combine fields to increase specificity when a single field is ambiguous:

```json
{ "resourceId": "com.example.app:id/submit_btn", "textEquals": "Submit" }
```

## Action Reference

### Action types and params

| Action | Required params | Optional params |
| :--- | :--- | :--- |
| `open_app` | `applicationId: string` | - |
| `open_uri` | `uri: string` | `retry: object` |
| `close_app` | `applicationId: string` | - |
| `click` | `matcher: NodeMatcher` | `clickType: "default" \| "long_click" \| "focus"` (default: `"default"`) |
| `enter_text` | `matcher: NodeMatcher`, `text: string` | `submit: boolean` (default: `false`), `clear: boolean` (accepted by Node contract, currently ignored by Android runtime) |
| `read_text` | `matcher: NodeMatcher` | `validator: "temperature"` (only supported validator today), `retry: object` |
| `wait_for_node` | `matcher: NodeMatcher` | `retry: object` - controls polling attempts and backoff delays (see `retry` object shape below). There is no per-action `timeoutMs`; the outer execution `timeoutMs` is the only wall-clock limit. |
| `snapshot_ui` | - | `retry: object` |
| `take_screenshot` | - | `path: string`, `retry: object` |
| `sleep` | `durationMs: number` | - |
| `scroll_and_click` | `target: NodeMatcher` | `container: NodeMatcher`, `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `maxSwipes: number` (default: `10`, range: 1-50), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `clickAfter: boolean` (default: `true`), `scrollRetry: object` (default preset: `maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`), `clickRetry: object` (default preset: `maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`) |
| `scroll` | - | `container: NodeMatcher` (default: auto-detect first scrollable), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"` - reveals content further down, finger swipes up), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `retry: object` (default: no retry - see scroll behavior note) |
| `scroll_until` | - | `container: NodeMatcher` (default: auto-detect), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `maxScrolls: number` (default: `20`, range: 1-200), `maxDurationMs: number` (default: `10000`, range: 0-120000), `noPositionChangeThreshold: number` (default: `3`, range: 1-20), `findFirstScrollableChild: boolean` (default: `true`) |
| `press_key` | `key: "back" \| "home" \| "recents"` | - |

### CLI-to-action-type mapping

| CLI command | Payload action type |
| :--- | :--- |
| `action type --selector <json> --text <value>` | `enter_text` |
| `action click --selector <json>` | `click` |
| `action read --selector <json>` | `read_text` |
| `action wait --selector <json>` | `wait_for_node` |
| `action open-app --app <id>` | `open_app` |
| `action open-uri --uri <value>` | `open_uri` |
| `action press-key --key <back\|home\|recents>` | `press_key` |
| `observe snapshot` | `snapshot_ui` |

### Action behavior notes

- `sleep.durationMs` must be in the range `0`-`120000` ms. Values above the cap are rejected with `EXECUTION_VALIDATION_FAILED` before dispatch (consistent with the execution `timeoutMs` validation). It also consumes from the outer execution `timeoutMs` budget.

**`retry` object shape:** All action types that accept a `retry` param use the same object schema:
```json
{
  "maxAttempts": 3,
  "initialDelayMs": 500,
  "maxDelayMs": 3000,
  "backoffMultiplier": 2.0,
  "jitterRatio": 0.15
}
```
`maxAttempts` is capped at 10. `initialDelayMs` and `maxDelayMs` are capped at 30,000 and 60,000 ms respectively. Omit the `retry` field to use the action's default preset. For `wait_for_node`, the default is `UiReadiness` (`maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`).

**`open_app`:** Opens the app's default launch activity by `applicationId`.

**`open_uri`:** Opens a URI using the Clawperator Android app's implicit `ACTION_VIEW` intent - no adb shortcut is used. The Android device's registered handler for the URI scheme is invoked directly. Any URI scheme is supported: deep links (`market://details?id=com.actionlauncher.playstore`), standard URLs (`https://example.com`), and custom app schemes. If no application is registered for the URI scheme, the action fails with `URI_NOT_HANDLED`. A chooser dialog may appear on devices with multiple handlers for a scheme; follow the `open_uri` step with a `snapshot_ui` to verify the expected app is in the foreground. The alias `open_url` is also accepted and normalized to `open_uri`.

**`close_app`:** The Node layer intercepts `close_app` actions and runs `adb shell am force-stop <applicationId>` before dispatching to Android. The Android step always returns `success: false` with `data.error: "UNSUPPORTED_RUNTIME_CLOSE"` - this is expected. The overall execution `status` remains `"success"` and the app is force-stopped. Do not treat this step result as a recoverable failure.

**`click`:** Finds the node matching `matcher` and performs the specified `clickType`. The default click type is `"default"` (standard accessibility click with gesture fallback). Use `"long_click"` for long-press targets and `"focus"` to focus without activating.

**`click` example request (`/execute`):**
```json
{
  "deviceId": "<device_id>",
  "execution": {
    "commandId": "cmd-click-1",
    "taskId": "task-click-1",
    "source": "local-test",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "click1", "type": "click", "params": { "matcher": { "resourceId": "com.example.app:id/submit_button" }, "clickType": "default" } }
    ]
  }
}
```

**`click` example success response:**
```json
{
  "ok": true,
  "envelope": {
    "commandId": "cmd-click-1",
    "taskId": "task-click-1",
    "status": "success",
    "stepResults": [
      { "id": "click1", "actionType": "click", "success": true, "data": { "click_types": "click" } }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

**`enter_text`:** The CLI command is `action type` but the execution payload action type is `enter_text`. The `submit` param triggers a keyboard Enter/submit after typing - use this for search fields and single-field forms where pressing Enter submits. The Node contract still accepts `clear`, but the Android runtime does not implement it yet, so it currently has no effect.

**`enter_text` example request (`/execute`):**
```json
{
  "deviceId": "<device_id>",
  "execution": {
    "commandId": "cmd-type-1",
    "taskId": "task-type-1",
    "source": "local-test",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "type1", "type": "enter_text", "params": { "matcher": { "resourceId": "com.example.app:id/search_input" }, "text": "hello world", "submit": true } }
    ]
  }
}
```

**`enter_text` example success response:**
```json
{
  "ok": true,
  "envelope": {
    "commandId": "cmd-type-1",
    "taskId": "task-type-1",
    "status": "success",
    "stepResults": [
      { "id": "type1", "actionType": "enter_text", "success": true, "data": { "text": "hello world", "submit": "true" } }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

**`read_text`:** `validator` is not an open-ended string in practice. The Android runtime currently supports only `"temperature"` and rejects any other value.

**`read_text` example request (`/execute`):**
```json
{
  "deviceId": "<device_id>",
  "execution": {
    "commandId": "cmd-read-1",
    "taskId": "task-read-1",
    "source": "local-test",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "read1", "type": "read_text", "params": { "matcher": { "resourceId": "com.example.app:id/temperature_label" } } }
    ]
  }
}
```

**`read_text` example success response:**
```json
{
  "ok": true,
  "envelope": {
    "commandId": "cmd-read-1",
    "taskId": "task-read-1",
    "status": "success",
    "stepResults": [
      { "id": "read1", "actionType": "read_text", "success": true, "data": { "text": "22.5 C", "validator": "none" } }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

**`snapshot_ui`:** Clawperator returns a single canonical snapshot format: `hierarchy_xml`. The Android runtime writes the hierarchy dump to device logcat, and the Node layer injects that raw XML into `data.text` after execution. `data.actual_format` is always `"hierarchy_xml"` for successful snapshot steps.

`observe snapshot` (CLI subcommand) and `snapshot_ui` (execution action type) use the same internal pipeline and produce identical output. `observe snapshot` builds a single-action execution internally and calls `runExecution`. Use `observe snapshot` for ad-hoc inspection from the command line. Use `snapshot_ui` as a step within a multi-action execution payload.

**Failure case - extraction error:** If snapshot post-processing finishes without attaching UI hierarchy text to the step (`data.text` remains absent), the step returns `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"`. A common cause is that logcat does not contain a matching `[TaskScope] UI Hierarchy:` marker for the step, but partial extraction or other logcat mismatches can also trigger this error. This typically means the installed clawperator binary is out of date with the Android Operator APK. Run `clawperator version --check-compat` and `clawperator doctor` to diagnose. See Troubleshooting for resolution steps.

**`snapshot_ui` example request (`/execute`):**
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

**`snapshot_ui` example success response:**
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

**`take_screenshot`:** `observe screenshot` uses the same execution contract under the hood. Android reports `UNSUPPORTED_RUNTIME_SCREENSHOT`, then the Node layer captures the screenshot via `adb exec-out screencap -p`, writes it to `data.path`, and normalizes the step result to `success: true` when capture succeeds.

**`press_key`:** Issues a system-level key event via the Android Accessibility Service (`performGlobalAction`). Supported keys: `"back"`, `"home"`, `"recents"`. The alias `key_press` is normalized to `press_key`. No retry - this action is single-attempt by design. Requires the Clawperator Operator accessibility service to be running on the device. If the service is unavailable, the execution returns a top-level failed envelope with `status: "failed"` and no `stepResults`. Use `clawperator doctor` to diagnose accessibility service availability before running executions that include `press_key`. When testing local/debug builds, pass the matching `receiverPackage` (`com.clawperator.operator.dev`) instead of relying on the default release package. Returns `success: false` with `data.error: "GLOBAL_ACTION_FAILED"` if the OS reports the global action could not be performed (rare soft OS failure - accessibility service was running but Android declined the action).

**`press_key` key scope:** This action covers only Android accessibility global actions. Non-global keys - `enter`, `search`, `volume_up`, `volume_down`, `escape`, and raw keycodes - are not supported by `press_key`. They use a different Android mechanism (`input keyevent`) that is not routed through the Operator accessibility service. Use `adb shell input keyevent <keycode>` outside the execution payload for those keys until a dedicated raw-key primitive is added.

**`press_key` example request (`/execute`):**
```json
{
  "deviceId": "<device_id>",
  "receiverPackage": "com.clawperator.operator.dev",
  "execution": {
    "commandId": "cmd-press-home",
    "taskId": "task-press-home",
    "source": "local-test",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "open1", "type": "open_app", "params": { "applicationId": "com.android.settings" } },
      { "id": "home1", "type": "press_key", "params": { "key": "home" } },
      { "id": "snap1", "type": "snapshot_ui" }
    ]
  }
}
```

**`press_key` example success response:**
```json
{
  "ok": true,
  "envelope": {
    "commandId": "cmd-press-home",
    "taskId": "task-press-home",
    "status": "success",
    "stepResults": [
      { "id": "open1", "actionType": "open_app", "success": true, "data": { "application_id": "com.android.settings" } },
      { "id": "home1", "actionType": "press_key", "success": true, "data": { "key": "home" } },
      { "id": "snap1", "actionType": "snapshot_ui", "success": true, "data": { "actual_format": "hierarchy_xml", "text": "<hierarchy ... />" } }
    ],
    "error": null
  },
  "deviceId": "<device_id>",
  "terminalSource": "clawperator_result"
}
```

**`press_key` example validation failure:**
```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_VALIDATION_FAILED",
    "message": "press_key params.key must be one of: back, home, recents",
    "details": {
      "path": "actions.0.params.key"
    }
  }
}
```

**`scroll_and_click`:** This action has two separate retry knobs. `scrollRetry` controls the scroll/search loop and defaults to the `UiScroll` preset (`maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`). `clickRetry` controls the final click attempt and defaults to the `UiReadiness` preset (`maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`).

**`clickAfter` flag:** When `clickAfter: false`, the action scrolls until the target is visible but does not click it. This is useful when you need to bring an element into view before a separate `snapshot_ui` or `read_text` action, or when you want to confirm presence before committing a click.

**`scroll`:** Performs a single scroll gesture and reports whether content actually moved. Unlike `scroll_and_click`, this action has no target element and does not click. It is designed for exploratory navigation - panning through a list to observe content before deciding what to do next.

**Direction semantics (content direction, not finger direction):**
- `"down"` - reveals content further down the list. Finger swipes up. Default.
- `"up"` - reveals content further up the list. Finger swipes down.
- `"left"` / `"right"` - horizontal carousel navigation. Direction refers to the content movement, not the swipe direction.

The action always reports one of three outcomes in `data.scroll_outcome`:
- `"moved"` - gesture was dispatched and the list position changed.
- `"edge_reached"` - gesture was dispatched but the container was already at its limit. This is `success: true`, not an error. It is the expected terminal state when paginating a finite list.
- `"gesture_failed"` - the OS rejected the gesture dispatch (`success: false`).

**Retry behavior:** `scroll` defaults to no retry (`retry` param defaults to a single attempt). This differs from most UI actions, which default to `UiReadiness` retry (3 attempts with backoff). The reason: retrying a scroll that returned `edge_reached` is wasteful. If the container may not have loaded yet, pass an explicit `retry` object or send a `wait_for_node` first.

`container` targeting and the `findFirstScrollableChild` flag work the same way as `scroll_and_click`. If no `container` is provided, the first `scrollable="true"` node on screen is used. `findFirstScrollableChild` defaults to `true` - when the matched container itself is not scrollable, the runtime automatically uses its first scrollable descendant. Set to `false` only if you need strict container matching.

**Auto-detect caveat:** On nested-scroll layouts, the first visible `scrollable="true"` node may be an outer wrapper rather than the content list you actually want. When the screen contains more than one plausible scroll surface, prefer an explicit `container` matcher using the list's `resource-id` from `snapshot_ui` rather than relying on auto-detect.

Typical observe-decide-act loop using `scroll`:
```json
[
  { "id": "snap1", "type": "snapshot_ui" },
  { "id": "scr1", "type": "scroll", "params": { "direction": "down" } },
  { "id": "snap2", "type": "snapshot_ui" }
]
```
After receiving `snap2`, the agent compares it to `snap1`. If `scr1.data.scroll_outcome` is `"edge_reached"`, no further scrolling is possible in that direction.

**`scroll` example request:**
```json
{
  "deviceId": "<device_id>",
  "execution": {
    "commandId": "cmd-scroll-1",
    "taskId": "task-explore",
    "source": "agent",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      { "id": "snap1", "type": "snapshot_ui" },
      { "id": "scr1", "type": "scroll", "params": { "direction": "down" } },
      { "id": "snap2", "type": "snapshot_ui" }
    ]
  }
}
```

**`scroll` example step result (content moved):**
```json
{ "id": "scr1", "actionType": "scroll", "success": true, "data": { "scroll_outcome": "moved", "direction": "down", "distance_ratio": "0.7" } }
```

**`scroll` example step result (at bottom of list):**
```json
{ "id": "scr1", "actionType": "scroll", "success": true, "data": { "scroll_outcome": "edge_reached", "direction": "down", "distance_ratio": "0.7" } }
```

**`scroll_until`:** Bounded scroll loop. Scrolls repeatedly until a termination condition fires and returns `termination_reason` so the agent knows why it stopped. Always applies caps even when not specified.

Direction semantics are the same as `scroll`. `container`, `distanceRatio`, `settleDelayMs`, and `findFirstScrollableChild` behave identically to `scroll`.

**Termination reasons (`data.termination_reason`):**
- `EDGE_REACHED` - content ended naturally (finite list). `success: true`.
- `MAX_SCROLLS_REACHED` - hit `maxScrolls` cap. `success: true`. Normal for infinite feeds.
- `MAX_DURATION_REACHED` - hit `maxDurationMs` cap. `success: true`. Normal for infinite feeds.
- `NO_POSITION_CHANGE` - no content movement across `noPositionChangeThreshold` consecutive scrolls. `success: true`.
- `CONTAINER_NOT_FOUND` - container resolution failed. `success: false`.
- `CONTAINER_NOT_SCROLLABLE` - container is not scrollable. `success: false`.

`MAX_SCROLLS_REACHED`, `MAX_DURATION_REACHED`, and `NO_POSITION_CHANGE` are clean terminal states, not errors. Agents scrolling infinite feeds should expect these and handle them without treating the action as failed.

**Current runtime caveat:** If the resolved container disappears mid-loop because the app navigated away or rebuilt the view tree unexpectedly, the current Android runtime can collapse that case into `EDGE_REACHED`. When a scroll loop might trigger navigation or heavy UI re-layout, follow it with `snapshot_ui` or `wait_for_node` before assuming the list truly ended.

**`scroll_until` example request:**
```json
{
  "commandId": "cmd-su-1",
  "taskId": "task-paginate",
  "expectedFormat": "android-ui-automator",
  "timeoutMs": 30000,
  "actions": [
    { "id": "su1", "type": "scroll_until", "params": { "direction": "down", "maxScrolls": 25 } }
  ]
}
```

**`scroll_until` example step result (finite list, reached bottom):**
```json
{ "id": "su1", "actionType": "scroll_until", "success": true, "data": { "termination_reason": "EDGE_REACHED", "scrolls_executed": "12", "direction": "down" } }
```

**`scroll_until` example step result (infinite feed, hit cap):**
```json
{ "id": "su1", "actionType": "scroll_until", "success": true, "data": { "termination_reason": "MAX_SCROLLS_REACHED", "scrolls_executed": "20", "direction": "down" } }
```

## Pagination Recipe

When an agent needs to read all content from a scrollable list, the correct approach depends on whether the list is finite or infinite.

### Finite lists (settings screens, contact lists, search results)

Use a manual scroll loop: issue `scroll` actions one at a time, snapshot after each, and stop when `scroll_outcome` is `"edge_reached"`. This gives full control over when to stop and what to extract.

```
while true:
  snapshot_ui  -> extract visible items
  scroll down  -> if edge_reached: break
```

`maxScrolls` is not required here because the agent controls the loop and `edge_reached` is the natural termination condition.

### Infinite feeds (social media, Play Store, news feeds)

Use `scroll_until` with an explicit `maxScrolls` cap. There is no true "bottom" on infinite-scroll lists - lazy loading means the edge is never definitively reached. `scroll_until` is designed for this case: it scrolls as far as the agent wants and returns a machine-readable `termination_reason`.

```json
{ "id": "feed1", "type": "scroll_until", "params": { "direction": "down", "maxScrolls": 30 } }
```

After this action, `termination_reason` will be one of:
- `MAX_SCROLLS_REACHED` - agent hit its own cap (normal for infinite feeds)
- `EDGE_REACHED` - list actually ended (finite list reached bottom)
- `NO_POSITION_CHANGE` - content stopped moving (stale list or true bottom)

Both `MAX_SCROLLS_REACHED` and `NO_POSITION_CHANGE` are clean terminal states. Do not treat them as errors.

**Required: always set `maxScrolls`.** Without an explicit cap, the default is 20 scrolls. For feeds where you want more coverage, pass a larger value. Never omit `maxScrolls` or rely on `NO_POSITION_CHANGE` alone as the termination condition for infinite feeds - a slow network load can pause position change temporarily and cause early exit.

### Returning to top

After scrolling down a feed, use `scroll_until` with `direction: "up"` to return to the top. On finite lists, `EDGE_REACHED` signals the top. On infinite feeds, `NO_POSITION_CHANGE` or `MAX_SCROLLS_REACHED` signals that position has stabilized near the top.

```json
{ "id": "top1", "type": "scroll_until", "params": { "direction": "up", "maxScrolls": 50, "noPositionChangeThreshold": 3 } }
```

## Result Envelope

Every execution emits exactly one `[Clawperator-Result]` envelope:

```json
{
  "commandId": "...",
  "taskId": "...",
  "status": "success" | "failed",
  "stepResults": [
    {
      "id": "...",
      "actionType": "...",
      "success": true | false,
      "data": { "key": "value" }
    }
  ],
  "error": "human-readable reason" | null,
  "errorCode": "STABLE_CODE" | null
}
```

- `status` is `"success"` when the execution completes (including partial step failures like `close_app`). `status` is `"failed"` only on total execution failure (dispatch error, timeout, validation failure).
- `error` (top-level) contains a human-readable description of the failure. Do not branch agent logic on this string - it is not a stable contract.
- `errorCode` (top-level) contains a stable, enumerated code when the failure has a known cause. Branch agent logic on this field. May be absent in envelopes from older APK versions or for unclassified failures.
- `data.error` on a step result contains the per-step error code when `success` is `false`.
- All `data` values are strings. `data` is always an object (never `null`), but may be empty.
- Only one execution may be in flight per device. Concurrent requests for the same device return `EXECUTION_CONFLICT_IN_FLIGHT`.

### Per-action result data

Typical `data` keys by action type:

| Action | Typical `data` keys |
| :--- | :--- |
| `open_app` | `application_id` |
| `open_uri` | `uri` |
| `close_app` | `application_id`, `error` (`"UNSUPPORTED_RUNTIME_CLOSE"`), `message` |
| `click` | `click_types` |
| `enter_text` | `text` (text typed), `submit` (`"true"` or `"false"`) |
| `read_text` | `text` (extracted text value), `validator` (`"none"` or validator type) |
| `snapshot_ui` | `actual_format`, `text` (snapshot content - see note below) |
| `take_screenshot` | `path` (local screenshot file path after Node capture) |
| `wait_for_node` | `resource_id`, `label` (matched node details) |
| `scroll_and_click` | `max_swipes`, `direction`, `click_types`, `click_after` (`"true"` or `"false"`) |
| `scroll` | `scroll_outcome` (`"moved"`, `"edge_reached"`, or `"gesture_failed"`), `direction`, `distance_ratio`, `settle_delay_ms`, `resolved_container` (resourceId of auto-detected container, when present) |
| `scroll_until` | `termination_reason` (see behavior note), `scrolls_executed`, `direction`, `resolved_container` (when present) |
| `sleep` | `duration_ms` |
| `press_key` | `key` (`"back"`, `"home"`, or `"recents"`) |

For any failed step: `success: false` and `data.error` contains the error code string.

**Snapshot content delivery:** The UI hierarchy is produced by the Android runtime and written to device logcat. The Node layer reads logcat after execution and injects the raw XML into `data.text`. `data.actual_format` is `"hierarchy_xml"` on successful snapshot steps.

**`read_text` value:** The extracted text value is in `data.text`.

## Snapshot Output Format

`snapshot_ui` and `clawperator observe snapshot` produce the canonical `hierarchy_xml` format. `data.actual_format` reports `"hierarchy_xml"` on success.

### `hierarchy_xml`

Structured XML produced by UIAutomator. Each `<node>` represents one UI element. Attributes map directly to NodeMatcher fields:

| XML attribute | NodeMatcher field | Notes |
| :--- | :--- | :--- |
| `resource-id` | `resourceId` | `"com.example.app:id/name"`. Empty string when not set by developer. |
| `text` | `textEquals` / `textContains` | Visible text content. Empty string if none. |
| `content-desc` | `contentDescEquals` / `contentDescContains` | Accessibility label. Empty string if none. |
| `class` | - | Java widget class name, e.g., `"android.widget.Button"`. Informational only - `NodeMatcher.role` uses Clawperator semantic role names such as `button`, `textfield`, `text`, or `switch`, not the raw `class` attribute. |
| `clickable` | - | `"true"` if the element accepts tap events. |
| `scrollable` | - | `"true"` marks a scroll container. Use as `container` in `scroll_and_click`, `scroll`, or `scroll_until`. |
| `bounds` | - | `"[x1,y1][x2,y2]"` pixel rectangle. Useful for understanding spatial layout. |
| `enabled` | - | `"false"` means the element is visible but not interactable. |
| `long-clickable` | - | `"true"` if the element accepts long-press. Use `clickType: "long_click"`. |

**XML attribute escaping:** Snapshot output is XML, so special characters in attribute values are escaped when the hierarchy is serialized. For example, an apostrophe appears as `&apos;`, an ampersand as `&amp;`. These escaped sequences are returned as-is in `data.text` - they are not decoded after extraction. When targeting elements with special characters in their labels, use `contentDescContains` or `textContains` with a substring that avoids the escaped characters rather than an exact match requiring the full escaped form.

Example: for a node with `content-desc="Search for &apos;vlc&apos;"`:
- `contentDescContains: "Search for"` -- works
- `contentDescEquals: "Search for 'vlc'"` -- fails (apostrophe is not decoded)

**Annotated example from Android Settings main screen (live device capture):**

```xml
<hierarchy rotation="0">
  <node index="0" text="" resource-id="" class="android.widget.FrameLayout"
        package="com.android.settings" content-desc=""
        clickable="false" enabled="true" scrollable="false"
        bounds="[0,0][1080,2340]">
    ...
        <!-- Scrollable list - use as 'container' in scroll_and_click, scroll, or scroll_until -->
        <node index="0" text="" resource-id="com.android.settings:id/recycler_view"
              class="androidx.recyclerview.widget.RecyclerView"
              package="com.android.settings" content-desc=""
              clickable="false" enabled="true" focusable="true" scrollable="true"
              bounds="[0,884][1080,2196]">

          <!-- Icon-only button: no text, target via content-desc -->
          <node index="0" text="" resource-id="" class="android.widget.Button"
                package="com.android.settings" content-desc="Search settings"
                clickable="true" enabled="true" focusable="true"
                bounds="[912,692][1080,884]" />

          <!-- Clickable row: the LinearLayout is the tap target -->
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

**Reading patterns:**

- **Tap targets** are `clickable="true"` nodes. In list UIs these are often container (`LinearLayout`) nodes whose text-bearing children hold the visible label while the container itself has `text=""`. When you match any node, Clawperator first attempts `ACTION_CLICK` on the first `clickable="true"` ancestor it finds while walking up the tree from the matched node. If that accessibility click does not succeed, Clawperator falls back to a gesture tap at the center of the matched node's bounding box. This means matching a non-clickable label node (for example, `textEquals: "Connections"`) works correctly as long as it is visually inside a clickable parent tap target. If both mechanisms fail, the execution currently terminates with a failed envelope and empty `stepResults` rather than a per-step `NODE_NOT_CLICKABLE` code.
- **Icon-only buttons** (no `text`) use `content-desc` for their label. Target with `contentDescEquals`.
- **Scroll containers** have `scrollable="true"`. Pass their `resource-id` as the `container` matcher in `scroll_and_click` or `scroll`. If `container` is omitted from `scroll`, the first `scrollable="true"` node on screen is used automatically.
- **Disabled elements** have `enabled="false"`. They cannot be interacted with - scrolling or waiting for a state change is required first.

**Apps with obfuscated or missing resource-ids:** Many production apps (Google Play Store, social media apps, banking apps) set `resource-id=""` on all or most nodes. In this case, fall back to content-desc and text matchers. The fallback priority for these apps is:

1. `contentDescEquals` - for elements with stable accessibility labels (icon buttons, tabs)
2. `textEquals` - for elements with stable visible text (button labels, section headers)
3. `contentDescContains` / `textContains` - when the value may include dynamic content, counts, or special characters (including HTML entities - see note above)
4. `role: "textfield"` - for text inputs when no `resource-id` is present

Note: `content-desc` values sometimes contain newlines when an element's label spans multiple pieces of information (for example, an app name followed by developer name in Play Store results). Use `contentDescContains` with a known stable substring rather than a full exact match.

## Error Codes

Branch agent logic on codes from `envelope.errorCode` (top-level Android result envelopes), `error.code` (Node API / CLI structured errors), or `stepResults[].data.error` (per-step failures). The `envelope.error` field contains a human-readable description and is not a stable contract.

| Code | Source | Meaning |
| :--- | :--- | :--- |
| `SERVICE_UNAVAILABLE` | `envelope.errorCode` | Clawperator Operator accessibility service is not running on the device. Use `clawperator doctor` to diagnose. |
| `EXECUTION_CONFLICT_IN_FLIGHT` | `error.code` | Device is busy with another execution |
| `ANDROID_SDK_TOOL_MISSING` | `error.code` | A required Android SDK tool such as `adb`, `emulator`, `sdkmanager`, or `avdmanager` is not available |
| `EMULATOR_NOT_FOUND` | `error.code` | Requested AVD does not exist |
| `EMULATOR_NOT_RUNNING` | `error.code` | Requested AVD is not currently running |
| `EMULATOR_ALREADY_RUNNING` | `error.code` | Requested operation requires the AVD to be stopped first |
| `EMULATOR_UNSUPPORTED` | `error.code` | The AVD exists but does not satisfy Clawperator compatibility rules |
| `EMULATOR_START_FAILED` | `error.code` | Emulator process failed to register with adb in time |
| `EMULATOR_BOOT_TIMEOUT` | `error.code` | Emulator registered with adb but Android did not finish booting in time |
| `ANDROID_AVD_CREATE_FAILED` | `error.code` | AVD creation failed |
| `ANDROID_SYSTEM_IMAGE_INSTALL_FAILED` | `error.code` | System image install or SDK license acceptance failed |
| `EMULATOR_STOP_FAILED` | `error.code` | Emulator stop request failed |
| `EMULATOR_DELETE_FAILED` | `error.code` | Emulator deletion failed |
| `NODE_NOT_FOUND` | `data.error` | Selector matched no UI element |
| `RESULT_ENVELOPE_TIMEOUT` | `error.code` | Command dispatched but no result received |
| `RECEIVER_NOT_INSTALLED` | `error.code` | [Clawperator Operator Android app](../getting-started/android-operator-apk.md) not found on device |
| `DEVICE_UNAUTHORIZED` | `error.code` | Device not authorized for ADB |
| `VERSION_INCOMPATIBLE` | `error.code` | CLI and installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) versions do not share the same `major.minor` |
| `APK_VERSION_UNREADABLE` | `error.code` | The device package dump did not expose a readable [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version |
| `EXECUTION_VALIDATION_FAILED` | `error.code` | Payload failed schema validation |
| `SECURITY_BLOCK_DETECTED` | `data.error` | Android blocked the action (e.g., secure keyboard) |
| `NODE_NOT_CLICKABLE` | `data.error` | Reserved error code. Intended for "element found but not interactable", but not currently emitted consistently by the Android and Node runtimes. |
| `UNSUPPORTED_RUNTIME_CLOSE` | `data.error` | Expected per-step result for all `close_app` steps. The Android runtime does not support a force-stop action response - the Node layer handles the close via `adb shell am force-stop` before dispatch. The overall execution `status` remains `"success"`. Treat as non-fatal. |
| `SNAPSHOT_EXTRACTION_FAILED` | `data.error` | `snapshot_ui` step completed but the Node layer did not attach any snapshot text to the step during post-processing. The most common cause is a Node binary packaging mismatch or other logcat extraction issue. Rebuild or reinstall the npm package and check version compatibility. |
| `GLOBAL_ACTION_FAILED` | `data.error` | `press_key` step result when the OS reports `performGlobalAction` returned false. Rare soft failure - the accessibility service was running but Android declined to execute the action. |
| `CONTAINER_NOT_FOUND` | `data.error` | `scroll` step could not locate a scrollable container. Either no scrollable node is present on screen, or the provided `container` matcher matched nothing. |
| `CONTAINER_NOT_SCROLLABLE` | `data.error` | `scroll` step found the matched container but it is not scrollable and no scrollable descendant was found. With the default `findFirstScrollableChild: true`, the runtime already walks one level down before raising this error. |
| `GESTURE_FAILED` | `data.error` | `scroll` step: the OS rejected the gesture dispatch. The accessibility service was running but Android declined to execute the swipe gesture. Step returns `success: false`. |

Primary top-level error taxonomy: `apps/node/src/contracts/errors.ts`. This table also includes runtime-only step error strings such as `UNSUPPORTED_RUNTIME_CLOSE`.

## Key Behaviors

- **Single-flight:** One execution per device at a time. Concurrent requests return `EXECUTION_CONFLICT_IN_FLIGHT`.
- **No hidden retries:** If an action fails, the error is returned immediately. Retry logic belongs in the agent.
- **Deterministic results:** Exactly one terminal envelope per `commandId`. Timeouts return `RESULT_ENVELOPE_TIMEOUT` with diagnostics.
- **Timeout override:** `--timeout-ms <n>` overrides the execution timeout for `execute`, `observe snapshot`, and `observe screenshot` within policy limits.
- **Device targeting:** Specify `--device-id` when multiple devices are connected. Omit for single-device setups.
- **Emulator reuse over creation:** Provisioning never creates duplicate AVDs when a supported running or stopped emulator already exists.
- **Deterministic emulator boots:** Emulator starts use `-no-snapshot-load` and wait for both `sys.boot_completed` and `dev.bootcomplete`.
- **Validation before dispatch:** Every payload is schema-validated before any ADB command is issued.

## Skills

Skills are packaged Android automation scripts distributed via the public GitHub repository at `https://github.com/clawperator/clawperator-skills`. The Node API provides discovery and metadata - skills are standalone and can be invoked directly by agents without the Node API.

### Setup

```bash
clawperator skills install
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

### Discovery

```bash
# List all skills
clawperator skills list

# Search by Android application ID
clawperator skills search --app com.android.settings

# Get skill metadata
clawperator skills get com.android.settings.capture-overview
```

### Invocation

Skills can be invoked three ways:

1. **Direct script invocation** (standalone - no Node API required):
   ```bash
   node ~/.clawperator/skills/skills/com.android.settings.capture-overview/scripts/capture_settings_overview.js <device_id>
   ```

2. **Convenience wrapper** via Node API:
   ```bash
   clawperator skills run com.android.settings.capture-overview --device-id <device_id>
   ```

3. **Artifact compile + execute** (for skills with `.recipe.json` artifacts):
   ```bash
   clawperator skills compile-artifact <skill_id> --artifact <name> --vars '{"KEY":"value"}'
   clawperator execute --execution <compiled_output>
   ```

### Skills Run Response

```json
{
  "ok": true,
  "skillId": "com.android.settings.capture-overview",
  "output": "Settings Overview captured\nTEXT_BEGIN\n...\nTEXT_END",
  "exitCode": 0,
  "durationMs": 8500
}
```

## Use Cases

- **Price comparison:** Open shopping apps, search, capture prices via `read_text`, return structured comparison.
- **Location check:** Open a tracking app, capture current location data via snapshot or screenshot.
- **Cross-app automation:** Read state from one app, act in another, report results.

## FAQ

**Does Clawperator do autonomous planning?**
No. It executes commands and reports structured results. Reasoning and planning stay in the agent.

**How are concurrent executions handled?**
Single-flight per device. A second overlapping execution returns `EXECUTION_CONFLICT_IN_FLIGHT`.

**When should I use direct `adb` instead?**
Use `adb` directly for operations not covered by the execution payload API:

- **Diagnostics** when you need to inspect raw device state (logcat, package list, window focus).
- **Pre-flight setup** outside the automation loop (granting permissions, installing APKs, checking installed packages).

For routine UI automation, use Clawperator so result/error semantics stay consistent.

**Can Clawperator open a specific URL or deep link?**
Yes. Use the `open_uri` action with any URI scheme - `market://`, `https://`, or a custom app deep link. The Clawperator Android app issues an `ACTION_VIEW` intent directly on the device; no adb command is needed. Example:

```json
{ "id": "nav1", "type": "open_uri", "params": { "uri": "market://details?id=com.actionlauncher.playstore" } }
```

If multiple apps are registered for the URI scheme, a system chooser may appear. Follow the `open_uri` step with `snapshot_ui` to confirm the expected app opened.

**Does Clawperator run skills?**
Skills are standalone programs that agents can invoke directly. The Node API provides discovery (`skills list`, `skills search`), metadata (`skills get`), and a convenience `skills run` wrapper. Skills do not need the Node API to execute - agents can call skill scripts directly.

**Does Clawperator configure accounts or app settings?**
No. Clawperator automates the UI on whatever user-installed Android apps are already installed and signed in on the device. It does not log in to apps, create accounts, or configure device settings on behalf of the user. If an automation targets an app that requires authentication, the user must sign in to that app manually on the device before the agent runs. For emulators using a Google Play system image, the user must also sign in to a Google account before Play Store-gated apps are accessible.

**How should agents handle sensitive text in results?**
Default behavior is full-fidelity results for agent reasoning. PII redaction (`--safe-logs`) is a planned feature.
