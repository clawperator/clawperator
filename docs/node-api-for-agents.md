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
| `operator install --apk <path>` | Install the Operator APK and grant required device permissions (canonical setup command) |
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
| `grant-device-permissions` | Re-grant Operator permissions after permission drift (remediation only - use `operator install` for initial setup) |
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
| `scroll_and_click` | `target: NodeMatcher` | `container: NodeMatcher`, `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `maxSwipes: number` (default: `10`, range: 1-50), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `false`), `scrollRetry: object` (default preset: `maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`), `clickRetry: object` (default preset: `maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`) |

### CLI-to-action-type mapping

| CLI command | Payload action type |
| :--- | :--- |
| `action type --selector <json> --text <value>` | `enter_text` |
| `action click --selector <json>` | `click` |
| `action read --selector <json>` | `read_text` |
| `action wait --selector <json>` | `wait_for_node` |
| `action open-app --app <id>` | `open_app` |
| `action open-uri --uri <value>` | `open_uri` |
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

**`enter_text`:** The CLI command is `action type` but the execution payload action type is `enter_text`. The `submit` param triggers a keyboard Enter/submit after typing - use this for search fields and single-field forms where pressing Enter submits. The Node contract still accepts `clear`, but the Android runtime does not implement it yet, so it currently has no effect.

**`read_text`:** `validator` is not an open-ended string in practice. The Android runtime currently supports only `"temperature"` and rejects any other value.

**`snapshot_ui`:** Clawperator returns a single canonical snapshot format: `hierarchy_xml`. The Android runtime writes the hierarchy dump to device logcat, and the Node layer injects that raw XML into `data.text` after execution. `data.actual_format` is always `"hierarchy_xml"` for successful snapshot steps.

`observe snapshot` (CLI subcommand) and `snapshot_ui` (execution action type) use the same internal pipeline and produce identical output. `observe snapshot` builds a single-action execution internally and calls `runExecution`. Use `observe snapshot` for ad-hoc inspection from the command line. Use `snapshot_ui` as a step within a multi-action execution payload.

**Failure case - extraction error:** If snapshot post-processing finishes without attaching UI hierarchy text to the step (`data.text` remains absent), the step returns `success: false` with `data.error: "SNAPSHOT_EXTRACTION_FAILED"`. A common cause is that logcat does not contain a matching `[TaskScope] UI Hierarchy:` marker for the step, but partial extraction or other logcat mismatches can also trigger this error. This typically means the installed clawperator binary is out of date with the Android Operator APK. Run `clawperator version --check-compat` and `clawperator doctor` to diagnose. See Troubleshooting for resolution steps.

**`take_screenshot`:** `observe screenshot` uses the same execution contract under the hood. Android reports `UNSUPPORTED_RUNTIME_SCREENSHOT`, then the Node layer captures the screenshot via `adb exec-out screencap -p`, writes it to `data.path`, and normalizes the step result to `success: true` when capture succeeds.

**`scroll_and_click`:** This action has two separate retry knobs. `scrollRetry` controls the scroll/search loop and defaults to the `UiScroll` preset (`maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`). `clickRetry` controls the final click attempt and defaults to the `UiReadiness` preset (`maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`).

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
  "error": "ERROR_CODE" | null
}
```

- `status` is `"success"` when the execution completes (including partial step failures like `close_app`). `status` is `"failed"` only on total execution failure (dispatch error, timeout, validation failure).
- `error` (top-level) contains an error code on total failure.
- `data.error` on a step result contains the per-step error code when `success` is `false`.
- All `data` values are strings. `data` is always an object (never `null`), but may be empty.

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
| `scroll_and_click` | `max_swipes`, `direction`, `click_types` |
| `sleep` | `duration_ms` |

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
| `scrollable` | - | `"true"` marks a scroll container. Use as `container` in `scroll_and_click`. |
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
        <!-- Scrollable list - use as 'container' in scroll_and_click -->
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
- **Scroll containers** have `scrollable="true"`. Pass their `resource-id` as the `container` matcher in `scroll_and_click`.
- **Disabled elements** have `enabled="false"`. They cannot be interacted with - scrolling or waiting for a state change is required first.

**Apps with obfuscated or missing resource-ids:** Many production apps (Google Play Store, social media apps, banking apps) set `resource-id=""` on all or most nodes. In this case, fall back to content-desc and text matchers. The fallback priority for these apps is:

1. `contentDescEquals` - for elements with stable accessibility labels (icon buttons, tabs)
2. `textEquals` - for elements with stable visible text (button labels, section headers)
3. `contentDescContains` / `textContains` - when the value may include dynamic content, counts, or special characters (including HTML entities - see note above)
4. `role: "textfield"` - for text inputs when no `resource-id` is present

Note: `content-desc` values sometimes contain newlines when an element's label spans multiple pieces of information (for example, an app name followed by developer name in Play Store results). Use `contentDescContains` with a known stable substring rather than a full exact match.

## Error Codes

Branch agent logic on codes from `envelope.error` or `stepResults[].data.error`:

| Code | Meaning |
| :--- | :--- |
| `EXECUTION_CONFLICT_IN_FLIGHT` | Device is busy with another execution |
| `ANDROID_SDK_TOOL_MISSING` | A required Android SDK tool such as `adb`, `emulator`, `sdkmanager`, or `avdmanager` is not available |
| `EMULATOR_NOT_FOUND` | Requested AVD does not exist |
| `EMULATOR_NOT_RUNNING` | Requested AVD is not currently running |
| `EMULATOR_ALREADY_RUNNING` | Requested operation requires the AVD to be stopped first |
| `EMULATOR_UNSUPPORTED` | The AVD exists but does not satisfy Clawperator compatibility rules |
| `EMULATOR_START_FAILED` | Emulator process failed to register with adb in time |
| `EMULATOR_BOOT_TIMEOUT` | Emulator registered with adb but Android did not finish booting in time |
| `ANDROID_AVD_CREATE_FAILED` | AVD creation failed |
| `ANDROID_SYSTEM_IMAGE_INSTALL_FAILED` | System image install or SDK license acceptance failed |
| `EMULATOR_STOP_FAILED` | Emulator stop request failed |
| `EMULATOR_DELETE_FAILED` | Emulator deletion failed |
| `NODE_NOT_FOUND` | Selector matched no UI element |
| `RESULT_ENVELOPE_TIMEOUT` | Command dispatched but no result received |
| `RECEIVER_NOT_INSTALLED` | [Clawperator Operator Android app](../getting-started/android-operator-apk.md) not found on device |
| `DEVICE_UNAUTHORIZED` | Device not authorized for ADB |
| `VERSION_INCOMPATIBLE` | CLI and installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) versions do not share the same `major.minor` |
| `APK_VERSION_UNREADABLE` | The device package dump did not expose a readable [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version |
| `EXECUTION_VALIDATION_FAILED` | Payload failed schema validation |
| `SECURITY_BLOCK_DETECTED` | Android blocked the action (e.g., secure keyboard) |
| `NODE_NOT_CLICKABLE` | Reserved error code. Intended for "element found but not interactable", but not currently emitted consistently by the Android and Node runtimes. |
| `UNSUPPORTED_RUNTIME_CLOSE` | Expected per-step result for all `close_app` steps. The Android runtime does not support a force-stop action response - the Node layer handles the close via `adb shell am force-stop` before dispatch. The overall execution `status` remains `"success"`. Treat as non-fatal. |
| `SNAPSHOT_EXTRACTION_FAILED` | `snapshot_ui` step completed but the Node layer did not attach any snapshot text to the step during post-processing. The most common cause is a Node binary packaging mismatch or other logcat extraction issue. Rebuild or reinstall the npm package and check version compatibility. |

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

Skills are packaged Android automation scripts distributed via the clawperator-skills bundle at `https://clawperator.com/install/clawperator-skills.bundle`. The Node API provides discovery and metadata - skills are standalone and can be invoked directly by agents without the Node API.

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
