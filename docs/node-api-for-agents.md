# Clawperator Node API - Agent Guide

Clawperator provides a deterministic execution layer for LLM agents to control Android devices. This guide covers the CLI and HTTP API contracts.

If you are starting cold, begin with [Agent Quickstart](agent-quickstart.md).
For the exact `snapshot_ui` structure, use
[Clawperator Snapshot Format](../reference/snapshot-format.md).

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
| `execute --execution <json\|file>` | Run a full execution payload (see `--validate-only` and `--dry-run` below) |
| `observe snapshot` | Capture UI hierarchy dump (`hierarchy_xml`) |
| `observe screenshot` | Capture device screen as PNG and return the local file path |
| `action open-app --app <id>` | Open an application |
| `action click --selector <json>` | Click a UI element |
| `action read --selector <json>` | Read text from element |
| `action type --selector <json> --text <value>` | Type text |
| `action wait --selector <json>` | Wait for element |
| `skills list` | List available skills |
| `skills get <skill_id>` | Show skill metadata |
| `skills search [--app <pkg>] [--intent <i>] [--keyword <k>]` | Search skills by app, intent, or keyword (at least one filter required) |
| `skills new <skill_id>` | Scaffold a new local skill folder and registry entry |
| `skills validate <skill_id>` | Verify one local skill's metadata and required files before runtime testing |
| `skills validate --all` | Validate the entire configured skills registry in one pass |
| `skills compile-artifact <id> --artifact <name>` | Compile skill to execution payload |
| `skills run <skill_id> [--device-id <id>] [--timeout-ms <n>] [--expect-contains <text>]` | Invoke a skill script (convenience wrapper) |
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
clawperator observe screenshot --help
clawperator skills compile-artifact --help
clawperator skills run --help
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
| `POST /skills/:skillId/run` | Run skill. Body: `{"deviceId": "...", "args": [...], "timeoutMs": 90000, "expectContains": "TEXT_BEGIN"}` |
| `GET /events` | SSE stream: `clawperator:result`, `clawperator:execution`, `heartbeat` |

See `apps/node/examples/basic-api-usage.js` for a complete SSE + REST example.

For `POST /skills/:skillId/run`, error responses may include partial `stdout`
and `stderr` when the wrapped script already emitted useful output before
failing or timing out.

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

For practical timeout sizing guidance by workflow type, see
[Clawperator Timeout Budgeting](../reference/timeout-budgeting.md).

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
| `read_text` | `matcher: NodeMatcher` | `validator: "temperature" \| "version" \| "regex"`, `validatorPattern: string` (required when `validator` is `"regex"`), `retry: object` |
| `wait_for_node` | `matcher: NodeMatcher` | `retry: object` - controls polling attempts and backoff delays (see `retry` object shape below). There is no per-action `timeoutMs`; the outer execution `timeoutMs` is the only wall-clock limit. |
| `snapshot_ui` | - | `retry: object` |
| `take_screenshot` | - | `path: string`, `retry: object` |
| `sleep` | `durationMs: number` | - |
| `scroll_and_click` | `matcher: NodeMatcher` | `container: NodeMatcher`, `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `maxSwipes: number` (default: `10`, range: 1-50), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `clickAfter: boolean` (default: `true`), `scrollRetry: object` (default preset: `maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`), `clickRetry: object` (default preset: `maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`) |
| `scroll_until` | - | `matcher: NodeMatcher` (optional, emits `TARGET_FOUND` when the target becomes visible), `container: NodeMatcher` (default: auto-detect), `clickType: "default" \| "long_click" \| "focus"` (used only when `clickAfter: true`), `clickAfter: boolean` (default: `false`, requires `matcher`), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `maxScrolls: number` (default: `20`, range: 1-200), `maxDurationMs: number` (default: `10000`, range: 0-120000), `noPositionChangeThreshold: number` (default: `3`, range: 1-20), `findFirstScrollableChild: boolean` (default: `true`) |
| `scroll` | - | `container: NodeMatcher` (default: auto-detect first scrollable), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"` - reveals content further down, finger swipes up), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `retry: object` (default: no retry - see scroll behavior note) |

| `press_key` | `key: "back" \| "home" \| "recents"` | - |
| `wait_for_navigation` | `timeoutMs: number` | `expectedPackage: string`, `expectedNode: NodeMatcher` - at least one of `expectedPackage` or `expectedNode` is required |
| `read_key_value_pair` | `labelMatcher: NodeMatcher` | - |

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

Documented and tested inputs include:

- `https://...`
- `market://...`
- app-specific deep-link URIs handled by a device app

What this action does not promise:

- support for bare Android intent action strings such as `android.settings.DEVICE_INFO_SETTINGS`
- support for pseudo-formats such as `ACTION:android.settings.DEVICE_INFO_SETTINGS`

Treat `open_uri` as an `ACTION_VIEW` URI launcher, not a general-purpose
Android intent builder.

**`close_app`:** The Node layer intercepts `close_app` actions and runs `adb shell am force-stop <applicationId>` before dispatching to Android. When that pre-flight close succeeds, the Node layer normalizes the resulting `close_app` step into a successful step result so the envelope reflects the real observed outcome. If the pre-flight `force-stop` fails, the execution now fails with a structured error instead of pretending the app was closed. In practice, treat `close_app` as a supported force-stop action through the Node interface.

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

**`read_text`:** Validates extracted text using optional validators.

Supported validators:

| Validator | Pattern | Example valid text |
| :--- | :--- | :--- |
| `temperature` | Parsed as temperature value | `"20.7°C"`, `"25°C"`, `"75°F"`, `"23.7"` |
| `version` | `/^\d+(\.\d+)*$/` | `"16"`, `"14.1.2"`, `"1.0.0.0"` |
| `regex` | Custom pattern via `validatorPattern` | Depends on pattern |

For `regex` validator, `validatorPattern` is required and must be a valid regex pattern. Invalid patterns are rejected at parse time with `EXECUTION_VALIDATION_FAILED`.

On validator mismatch, the step returns `success: false` with `data.error: "VALIDATOR_MISMATCH"` and `data.raw_text` containing the extracted value.

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

**`read_text` with version validator example:**
```json
{ "id": "version_check", "type": "read_text", "params": { "matcher": { "textContains": "Android version" }, "validator": "version" } }
```

**`read_text` with regex validator example:**
```json
{ "id": "regex_check", "type": "read_text", "params": { "matcher": { "resourceId": "com.example:id/order_id" }, "validator": "regex", "validatorPattern": "^ORD-[0-9]{6}$" } }
```

**`read_text` validator mismatch response:**
```json
{ "id": "version_check", "actionType": "read_text", "success": false, "data": { "error": "VALIDATOR_MISMATCH", "raw_text": "Settings" } }
```

**`snapshot_ui`:** Clawperator returns a single canonical snapshot format: `hierarchy_xml`. The Android runtime writes the hierarchy dump to device logcat, and the Node layer injects that raw XML into `data.text` after execution. `data.actual_format` is always `"hierarchy_xml"` for successful snapshot steps.

Successful snapshot steps may also include best-effort accessibility-window
metadata:

- `data.foreground_package`
- `data.has_overlay`
- `data.overlay_package`
- `data.window_count`

Treat those fields as operational hints, not as a strict modal-dialog
guarantee. `has_overlay: "true"` means Clawperator detected another meaningful
accessibility window above the foreground app. It does not prove the screen is
unusable, and `window_count > 1` alone is normal on some Android builds.

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
          "foreground_package": "com.android.settings",
          "has_overlay": "false",
          "window_count": "2",
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

**`take_screenshot`:** `observe screenshot` uses the same execution contract under the hood. Android reports `UNSUPPORTED_RUNTIME_SCREENSHOT`, then the Node layer captures the screenshot via `adb exec-out screencap -p`, writes it to `data.path`, and normalizes the step result to `success: true` when capture succeeds. Pass `observe screenshot --path <file>` when you want a deterministic local filename instead of the default temp path.

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

**`wait_for_navigation`:** Polls until the expected package or node is detected, or the timeout is reached. Use this after a click that triggers a screen transition to confirm navigation completed without using a fixed sleep.

Requires at least one of:
- `expectedPackage: string` - polls until `foreground_package` matches this value
- `expectedNode: NodeMatcher` - polls until this node is present in the UI tree

Polls at ~200ms intervals. Returns `success: true` with `data.resolved_package` and `data.elapsed_ms` on success. Returns `success: false` with `data.error: "NAVIGATION_TIMEOUT"` and `data.last_package` on timeout.

**Before (using sleep):**
```json
[
  { "id": "click", "type": "click", "params": { "matcher": { "textContains": "About phone" } } },
  { "id": "sleep", "type": "sleep", "params": { "durationMs": 1500 } },
  { "id": "snap", "type": "snapshot_ui" }
]
```

**After (using wait_for_navigation):**
```json
[
  { "id": "click", "type": "click", "params": { "matcher": { "textContains": "About phone" } } },
  { "id": "wait", "type": "wait_for_navigation", "params": { "expectedPackage": "com.android.settings", "timeoutMs": 5000 } }
]
```

**`wait_for_navigation` success response:**
```json
{ "id": "wait", "actionType": "wait_for_navigation", "success": true, "data": { "resolved_package": "com.android.settings", "elapsed_ms": "245" } }
```

**`wait_for_navigation` timeout response:**
```json
{ "id": "wait", "actionType": "wait_for_navigation", "success": false, "data": { "error": "NAVIGATION_TIMEOUT", "last_package": "com.example.app" } }
```

**`read_key_value_pair`:** Reads a Settings-style label and its adjacent value. Finds the node matching `labelMatcher`, then searches for the nearest sibling with a `/summary` resource ID suffix and non-empty text.

Returns `success: true` with `data.label` and `data.value` on success.

Error codes:
- `NODE_NOT_FOUND` - the label node matching `labelMatcher` was not found
- `VALUE_NODE_NOT_FOUND` - the label was found but no adjacent summary value node was detected

**Limitation:** The sibling traversal only searches nodes that appear *after* the label in the parent's children list. If a value node appears before its label in the hierarchy, it will not be found. This matches Samsung Settings layout but may not work for all OEM layouts.

**`read_key_value_pair` example request:**
```json
{ "id": "read_version", "type": "read_key_value_pair", "params": { "labelMatcher": { "textEquals": "Android version" } } }
```

**`read_key_value_pair` success response:**
```json
{ "id": "read_version", "actionType": "read_key_value_pair", "success": true, "data": { "label": "Android version", "value": "16" } }
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

If `params.matcher` is provided, the runtime checks for that matcher before the
first scroll and after each successful movement. When the target becomes
visible in Clawperator's on-screen filtered UI tree, the step returns
`termination_reason: "TARGET_FOUND"`. This removes the extra "scroll, then
snapshot to verify" round-trip for many navigation tasks.

If `clickAfter: true`, `scroll_until` clicks the target immediately after it
becomes visible. This gives agents a one-step "scroll top-level list until
visible, then click" path without switching to `scroll_and_click`.
*Note on `clickAfter` firing:* The click only fires if the loop terminates with `TARGET_FOUND`.

**Termination reasons (`data.termination_reason`):**
- `TARGET_FOUND` - the provided `target` matcher became visible in the current UI tree. `success: true`.
- `EDGE_REACHED` - scrolling stopped because no further movement was detected. `success: true`.
- `MAX_SCROLLS_REACHED` - hit `maxScrolls` cap. `success: true`. Normal for infinite feeds.
- `MAX_DURATION_REACHED` - hit `maxDurationMs` cap. `success: true`. Normal for infinite feeds.
- `NO_POSITION_CHANGE` - no content movement across `noPositionChangeThreshold` consecutive scrolls. `success: true`.
- `CONTAINER_NOT_FOUND` - container resolution failed. `success: false`.
- `CONTAINER_NOT_SCROLLABLE` - container is not scrollable. `success: false`.
- `CONTAINER_LOST` - container disappeared mid-loop (e.g., app navigated away). `success: false`.

`MAX_SCROLLS_REACHED`, `MAX_DURATION_REACHED`, and `NO_POSITION_CHANGE` are clean terminal states, not errors. Agents scrolling infinite feeds should expect these and handle them without treating the action as failed.

When no `target` matcher is provided, `scroll_until` behaves as a pure bounded
pagination loop and returns one of the non-target terminal reasons above.

**Current runtime caveats:**
- Some Android screens expose off-screen descendants in the raw `snapshot_ui` XML. `scroll_until.target` does not use raw XML presence alone; it checks Clawperator's on-screen filtered tree. On heavily clipped or nested layouts, a target may appear in the raw snapshot near the bottom edge but still finish as `EDGE_REACHED` until it is more fully on-screen.

When a scroll loop might trigger navigation, heavy UI re-layout, or clipped list rows near the viewport edge, follow it with `snapshot_ui` or `wait_for_node` before assuming the list truly ended.

**`scroll_until` example request:**
```json
{
    "commandId": "cmd-su-1",
    "taskId": "task-paginate",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
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
    ]
}
```

**`scroll_until` example step result (target became visible and clicked):**
```json
{ "id": "su1", "actionType": "scroll_until", "success": true, "data": { "termination_reason": "TARGET_FOUND", "scrolls_executed": "5", "direction": "down", "click_after": "true", "click_types": "default", "resolved_container": "com.android.settings:id/recycler_view" } }
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

- `status` is `"success"` when the execution completes. `status` is `"failed"` only on total execution failure (dispatch error, timeout, validation failure).
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
| `close_app` | `application_id` |
| `click` | `click_types` |
| `enter_text` | `text` (text typed), `submit` (`"true"` or `"false"`) |
| `read_text` | `text` (extracted text value), `validator` (`"none"` or validator type) |
| `snapshot_ui` | `actual_format`, `foreground_package` (when available), `has_overlay`, `overlay_package` (when available), `window_count`, `text` (snapshot content - see note below) |
| `take_screenshot` | `path` (local screenshot file path after Node capture) |
| `wait_for_node` | `resource_id`, `label` (matched node details) |
| `scroll_and_click` | `max_swipes`, `direction`, `click_types`, `click_after` (`"true"` or `"false"`) |
| `scroll` | `scroll_outcome` (`"moved"`, `"edge_reached"`, or `"gesture_failed"`), `direction`, `distance_ratio`, `settle_delay_ms`, `resolved_container` (resourceId of auto-detected container, when present) |
| `scroll_until` | `termination_reason` (see behavior note), `scrolls_executed`, `direction`, `click_after`, `click_types`, `resolved_container` (when present) |
| `sleep` | `duration_ms` |
| `press_key` | `key` (`"back"`, `"home"`, or `"recents"`) |
| `wait_for_navigation` | `resolved_package` (on success), `elapsed_ms` (on success), `error`, `last_package` (on timeout) |
| `read_key_value_pair` | `label`, `value` (on success), `error` (on failure: `NODE_NOT_FOUND` or `VALUE_NODE_NOT_FOUND`) |

For any failed step: `success: false` and `data.error` contains the error code string.

**Snapshot content delivery:** The UI hierarchy is produced by the Android runtime and written to device logcat. The Node layer reads logcat after execution and injects the raw XML into `data.text`. `data.actual_format` is `"hierarchy_xml"` on successful snapshot steps. Snapshot steps may also include best-effort accessibility-window metadata such as `foreground_package`, `has_overlay`, `overlay_package`, and `window_count`.

**`read_text` value:** The extracted text value is in `data.text`.

## Snapshot Output Format

`snapshot_ui` and `clawperator observe snapshot` produce the canonical
`hierarchy_xml` format. `data.actual_format` reports `"hierarchy_xml"` on
success.

Use [Clawperator Snapshot Format](../reference/snapshot-format.md) as the
dedicated reference for:

- the exact snapshot envelope placement
- the relationship to Android UI Automator output
- XML attribute meanings and escaping
- real-device annotated examples
- parsing guidance for agents

## Execution Model

Use [Clawperator Execution Model](../reference/execution-model.md) for the
current reference explanation of:

- required execution payload fields
- `status` vs `stepResults[].success`
- timeout policy and single-flight behavior
- stable error-code surfaces

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
| `SNAPSHOT_EXTRACTION_FAILED` | `data.error` | `snapshot_ui` step completed but the Node layer did not attach any snapshot text to the step during post-processing. The most common cause is a Node binary packaging mismatch or other logcat extraction issue. Rebuild or reinstall the npm package and check version compatibility. |
| `GLOBAL_ACTION_FAILED` | `data.error` | `press_key` step result when the OS reports `performGlobalAction` returned false. Rare soft failure - the accessibility service was running but Android declined to execute the action. |
| `CONTAINER_NOT_FOUND` | `data.error` | `scroll` step could not locate a scrollable container. Either no scrollable node is present on screen, or the provided `container` matcher matched nothing. |
| `CONTAINER_NOT_SCROLLABLE` | `data.error` | `scroll` step found the matched container but it is not scrollable and no scrollable descendant was found. With the default `findFirstScrollableChild: true`, the runtime already walks one level down before raising this error. |
| `GESTURE_FAILED` | `data.error` | `scroll` step: the OS rejected the gesture dispatch. The accessibility service was running but Android declined to execute the swipe gesture. Step returns `success: false`. |

Primary top-level error taxonomy: `apps/node/src/contracts/errors.ts`. This table also includes runtime-only step error strings where they are still surfaced directly by callers.

For agent-side recovery strategy, use
[Error Handling Guide](../reference/error-handling.md).

## Key Behaviors

- **Single-flight:** One execution per device at a time. Concurrent requests return `EXECUTION_CONFLICT_IN_FLIGHT`.
- **No hidden retries:** If an action fails, the error is returned immediately. Retry logic belongs in the agent.
- **Deterministic results:** Exactly one terminal envelope per `commandId`. Timeouts return `RESULT_ENVELOPE_TIMEOUT` with diagnostics.
- **Timeout override:** `--timeout-ms <n>` overrides the execution timeout for `execute`, `observe snapshot`, and `observe screenshot` within policy limits.
- **Screenshot output path:** `observe screenshot --path <file>` writes the PNG to the requested local path and still returns the final `data.path` in the result envelope. `<file>` must be a non-empty local filesystem path.
- **Device targeting:** Specify `--device-id` when multiple devices are connected. Omit for single-device setups.
- **Emulator reuse over creation:** Provisioning never creates duplicate AVDs when a supported running or stopped emulator already exists.
- **Deterministic emulator boots:** Emulator starts use `-no-snapshot-load` and wait for both `sys.boot_completed` and `dev.bootcomplete`.
- **Validation before dispatch:** Every payload is schema-validated before any ADB command is issued.

## Validation and current non-features

- Payload validation happens automatically at execution time. Invalid payloads
  fail fast with `EXECUTION_VALIDATION_FAILED` before any device action runs.
- `clawperator execute --execution <json-or-file> --validate-only` validates
  and normalizes a payload without dispatching it to any device.
- `clawperator execute --execution <json-or-file> --dry-run` validates the
  payload and prints a plan summary without requiring a device connection.
  This is useful for local payload development and CI checks.
- If you want the lowest-risk contract check on a live device, use a minimal
  payload such as a single `sleep` or `snapshot_ui` action.

### `--dry-run` output format

```bash
clawperator execute --execution '{"commandId":"test","taskId":"task","source":"cli","expectedFormat":"android-ui-automator","timeoutMs":10000,"actions":[{"id":"s1","type":"sleep","params":{"durationMs":500}}]}' --dry-run
```

**Success response:**
```json
{
  "ok": true,
  "dryRun": true,
  "plan": {
    "commandId": "test",
    "timeoutMs": 10000,
    "actionCount": 1,
    "actions": [
      { "id": "s1", "type": "sleep", "params": { "durationMs": 500 } }
    ]
  }
}
```

**Validation error response:**
```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "...",
  "details": { "path": "actions.0.params.matcher" }
}
```

The `--dry-run` flag does not require `--device-id` and performs no ADB activity.

## Skills

Skills are packaged Android automation scripts distributed via the public GitHub repository at `https://github.com/clawperator/clawperator-skills`. The Node API provides discovery and metadata - skills are standalone and can be invoked directly by agents without the Node API.

## Environment Variables and Device Targeting

Use these dedicated references when you need the focused contract instead of
the summary below:

- [Device and Package Model](../reference/device-and-package-model.md)
- [Environment Variables](../reference/environment-variables.md)

The most important environment variables surfaced by the current CLI and
installer are:

| Variable | Where used | Current meaning |
| :--- | :--- | :--- |
| `CLAWPERATOR_SKILLS_REGISTRY` | CLI and installer | Overrides the path to the local skills registry JSON |
| `CLAWPERATOR_INSTALL_APK` | installer | Pre-seeds the installer's "install APK now?" decision for non-interactive runs |
| `CLAWPERATOR_RECEIVER_PACKAGE` | installer | Overrides the default receiver package used during installer setup |

### `CLAWPERATOR_INSTALL_APK`

`scripts/install.sh` reads `CLAWPERATOR_INSTALL_APK` before prompting whether to
install the Operator APK on the connected device.

Useful values:

- `Y`, `y`, `yes`, `YES` - proceed with APK install
- any other non-empty value - skip APK install

Example:

```bash
CLAWPERATOR_INSTALL_APK=Y curl -fsSL https://clawperator.com/install.sh | bash
```

### `CLAWPERATOR_SKILLS_REGISTRY`

This points the CLI at a specific skills registry path.

Example:

```bash
export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
```

### Multiple devices

If more than one device is connected, pass `--device-id <id>` on execute,
observe, action, doctor, version, operator setup, and skills-run commands.

When multiple devices are present:

- the installer skips automatic APK install rather than guessing
- it prints the manual recovery command
- later automation should keep using explicit `--device-id`

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
   clawperator skills run com.android.settings.capture-overview --device-id <device_id> --timeout-ms 90000
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

When `skills run` fails or times out, the CLI preserves partial script
`stdout` and `stderr` in the structured error output when available. Inspect
those fields before assuming the run produced no useful result.

Current skills model:

- discovery is registry-driven, not folder-scan-driven
- `CLAWPERATOR_SKILLS_REGISTRY` points at one local registry JSON
- a private skill becomes visible only after it is added to that registry
- `skills new <skill_id>` scaffolds the starter folder and updates that local registry automatically
- `skills validate <skill_id>` checks that one registry entry, its
  `skill.json`, `SKILL.md`, script paths, and artifact paths line up before you
  spend time on a live device run
- `skills validate --all` runs the same integrity checks across every entry in
  the configured registry and returns a failure summary if any skills are
  broken
- `skills run --timeout-ms <n>` overrides the wrapper timeout for one run when
  the default `120000` ms budget is not the right fit for the current flow
- `skills run --expect-contains <text>` turns the wrapper into a lightweight
  smoke check by failing if the script output does not contain the expected
  substring

For the concrete `skill.json` contract and private-skill authoring model, see
[Skill Authoring Guidelines](../skills/skill-authoring-guidelines.md),
[Skill Development Workflow](../skills/skill-development-workflow.md), and
[Usage Model](../skills/usage-model.md).

**Does Clawperator configure accounts or app settings?**
Clawperator is a neutral actuator. It does not decide whether entering a
username, password, email address, or other user-provided input is appropriate.
That decision belongs to the external brain agent and the user workflow it is
carrying out.

In practice, the device still needs to be in a usable state for the automation
the agent is attempting. Many setups prepare account state and app
configuration before automation begins. When an agent chooses to enter login or
credential fields through the normal UI, Clawperator can provide the same
interaction primitives it uses for any other text entry or click flow.

**How should agents handle sensitive text in results?**
Default behavior is full-fidelity results for agent reasoning. PII redaction (`--safe-logs`) is a planned feature.
