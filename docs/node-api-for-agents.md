# Clawperator Node API - Agent Guide

Clawperator provides a deterministic execution layer for LLM agents to control Android devices. This guide covers the CLI and HTTP API contracts.

If you are starting cold, begin with [Agent Quickstart](agent-quickstart.md).
For the exact `snapshot_ui` structure, use
[Clawperator Snapshot Format](../reference/snapshot-format.md).
For raw on-device recording files and the `recording pull` / `recording parse`
workflow (also available as `record` alias), use [Android Recording Format for Agents](android-recording.md).

## Concepts

- **Execution**: A payload of one or more actions dispatched to the device as a single atomic unit. Every execution produces exactly one `[Clawperator-Result]` envelope. Clawperator executes the action list sequentially and returns the result - it does not observe state between steps or adapt based on intermediate outcomes. The agent inspects the result and decides the next execution.
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
| `exec --execution <json\|file>` | Run a full execution payload (see `--validate-only` and `--dry-run` below). `execute` is a supported synonym. |
| `snapshot` | Capture UI hierarchy dump (`hierarchy_xml`) |
| `screenshot [--path <file>]` | Capture device screen as PNG |
| `open <package-id\|url\|uri>` | Open an app, URL, or URI (auto-detects target type) |
| `click --text <text>` | Tap the first element with exact visible text |
| `click --text-contains <sub>` | Tap the first element whose visible text contains the substring |
| `click --id <resource-id>` | Tap the first element with the given Android resource ID |
| `click --desc <text>` | Tap the first element with the given content description |
| `click --desc-contains <sub>` | Tap the first element whose content description contains the substring |
| `click --role <role>` | Tap the first element with the given role |
| `click --selector <json>` | Tap using raw `NodeMatcher` JSON (advanced only; mutually exclusive with simple flags) |
| `click --text <text> --long` | Long press the matching element |
| `click --text <text> --focus` | Set input focus without clicking (mutually exclusive with `--long`) |
| `type <text> --role <role>` | Type into the first element with the given role |
| `type <text> --id <resource-id>` | Type into the first element with the given resource ID |
| `type <text> --desc <text>` | Type into the first element with the given content description |
| `type <text> --desc-contains <sub>` | Type into the first element whose content description contains the substring |
| `type <text> --text-contains <sub>` | Type into the first element whose visible text contains the substring |
| `type <text> --selector <json>` | Type using raw `NodeMatcher` JSON (advanced only; mutually exclusive with simple flags) |
| `read --text <text>` | Read text from the first element with exact visible text |
| `read --text-contains <sub>` | Read from the first element whose visible text contains the substring |
| `read --id <resource-id>` | Read from the first element with the given resource ID |
| `read --desc <text>` | Read from the first element with the given content description |
| `read --desc-contains <sub>` | Read from the first element whose content description contains the substring |
| `read --role <role>` | Read from the first element with the given role |
| `read --selector <json>` | Read using raw `NodeMatcher` JSON (advanced only; mutually exclusive with simple flags) |
| `read ... --all --json` | Read every on-screen match: step `data.text` is a string containing a JSON array of quoted labels (see `read_text` behavior note). Requires `--json`. |
| `read ... --container-text <text>` | Restrict search to elements within a container with exact visible text |
| `read ... --container-text-contains <sub>` | Restrict search to elements within a container with partial text match |
| `read ... --container-id <id>` | Restrict search to elements within a container with the given resource ID |
| `read ... --container-desc <text>` | Restrict search to elements within a container with exact content description |
| `read ... --container-desc-contains <sub>` | Restrict search to elements within a container with partial content description |
| `read ... --container-role <role>` | Restrict search to elements within a container with the given role |
| `read ... --container-selector '<json>'` | Restrict search to elements within a container matched by raw JSON (mutually exclusive with other `--container-*` flags) |
| `wait --text <text>` | Wait until an element with exact visible text appears |
| `wait --text-contains <sub>` | Wait until an element whose visible text contains the substring appears |
| `wait --id <resource-id>` | Wait until an element with the given resource ID appears |
| `wait --desc <text>` | Wait until an element with the given content description appears |
| `wait --desc-contains <sub>` | Wait until an element whose content description contains the substring appears |
| `wait --role <role>` | Wait until an element with the given role appears |
| `wait --selector <json>` | Wait using raw `NodeMatcher` JSON (advanced only; mutually exclusive with simple flags) |
| `press <back\|home\|recents>` | Press a hardware key |
| `back` | Press the Android back key (shorthand for `press back`) |
| `scroll <down\|up\|left\|right>` | Scroll the screen in a direction |
| `scroll <dir> --container-text <text>` | Scroll within a container matched by exact visible text |
| `scroll <dir> --container-text-contains <sub>` | Scroll within a container matched by partial text |
| `scroll <dir> --container-id <id>` | Scroll within a container matched by resource ID |
| `scroll <dir> --container-desc <text>` | Scroll within a container matched by exact content description |
| `scroll <dir> --container-desc-contains <sub>` | Scroll within a container matched by partial content description |
| `scroll <dir> --container-role <role>` | Scroll within a container matched by role |
| `scroll <dir> --container-selector <json>` | Scroll within a container using raw `NodeMatcher` JSON (advanced only) |
| `scroll-until [<dir>] --text <text>` | Scroll until target element is visible (direction defaults to `down`; uses `scroll_until` on the wire) |
| `scroll-until [<dir>] --text <text> --click` | Scroll until visible, then click (action type: `scroll_and_click`, not `scroll_until` with `clickAfter`) |
| `scroll-and-click [<dir>] --text <text>` | Synonym for `scroll-until --click` |
| `close <package>` | Force-stop an Android application |
| `close --app <package>` | Same as `close <package>` |
| `close-app <package>` | Synonym for `close` |
| `sleep <ms>` | Pause execution for a duration in milliseconds |
| `skills list` | List available skills |
| `skills get <skill_id>` | Show skill metadata |
| `skills search [--app <pkg>] [--intent <i>] [--keyword <k>]` | Search skills by app, intent, or keyword (at least one filter required) |
| `skills new <skill_id>` | Scaffold a new local skill folder and registry entry |
| `skills validate <skill_id>` | Verify one local skill's metadata and required files before runtime testing |
| `skills validate --all` | Validate the entire configured skills registry in one pass |
| `skills compile-artifact <id> --artifact <name>` | Compile skill to execution payload |
| `skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>]` | Invoke a skill script (convenience wrapper; pretty mode streams output live and prints a pre-run banner) |
| `skills install` | Clone skills repo to `~/.clawperator/skills/` |
| `skills update [--ref <git-ref>]` | Pull latest skills (optionally pin to a ref) |
| `grant-device-permissions` | Re-grant Operator permissions only after an Operator APK crash causes Android to revoke them |
| `recording start [--session-id <id>] [--device <serial>] [--operator-package <pkg>]` | Start a recording session on the operator app and write NDJSON on device (`record` is an alias) |
| `recording stop [--session-id <id>] [--device <serial>] [--operator-package <pkg>]` | Stop the active recording session and finalize the recording file (`record` is an alias) |
| `recording pull [--session-id <id>] [--out <dir>] [--device <serial>]` | Pull the on-device NDJSON recording to host storage (`record` is an alias) |
| `recording parse --input <file> [--out <file>]` | Parse a raw NDJSON recording into a step log JSON (`record` is an alias) |
| `serve` | Start HTTP/SSE server |
| `doctor` | Run environment diagnostics |
| `version` | Print the CLI version or check CLI / Clawperator Operator Android app compatibility |

**Global options:** `--device <id>` (canonical; `--device-id` accepted), `--operator-package <pkg>`, `--json` (canonical; `--output json` accepted), `--timeout <ms>` (canonical; `--timeout-ms` accepted), `--log-level <debug|info|warn|error>`, `--verbose`

For agent callers, `--json` is the canonical output flag. `--output pretty` is for human inspection.

**`--json` exit codes:** Plain validation errors return JSON with a top-level `code` and exit `1`. When the CLI prints a device wrapper object that includes `envelope`, it exits `1` if `envelope.status` is `failed` or if any `envelope.stepResults` entry has `success: false` (after Node post-processing such as `close_app` preflight reconciliation). Otherwise it exits `0`. Shell scripts should not rely on `$?` alone without checking `envelope` and each step.

**`wait` and global `--timeout`:** On the `wait` command only, `--timeout <ms>` sets how long the device may poll for a matching node. When provided, it must be a **positive** number of milliseconds (the CLI rejects `--timeout 0`; omit `--timeout` to use the default wait cap). It is written to `wait_for_node.params.timeoutMs` and the Node layer raises execution `timeoutMs` to at least `max(waitTimeoutMs + 5000, 30000)` so the outer envelope does not expire before the wait finishes. On other commands, `--timeout` still sets the execution envelope timeout as usual.

### Selector Flags (click, type, read, wait)

All element-targeting commands accept these flags instead of raw JSON:

| Flag | NodeMatcher field | Description |
| :--- | :--- | :--- |
| `--text <value>` | `textEquals` | Exact visible text match |
| `--text-contains <value>` | `textContains` | Partial text match |
| `--id <value>` | `resourceId` | Android resource ID (e.g. `com.pkg:id/name`) |
| `--desc <value>` | `contentDescEquals` | Exact content description |
| `--desc-contains <value>` | `contentDescContains` | Partial content description |
| `--role <value>` | `role` | Element role (`button`, `textfield`, `text`, `switch`, `checkbox`, `image`, `listitem`, `toolbar`, `tab`) |
| `--selector <json>` | (all fields) | Raw JSON NodeMatcher object; mutually exclusive with the flags above |

Multiple simple flags combine with AND semantics: `--text "Login" --role button` matches elements with both properties.

For `type`, `--text` is reserved for the text to type. Identify the target with `--id`, `--role`, `--desc`, `--text-contains`, `--desc-contains`, or `--selector` (advanced).

**`read`:** `--all` returns every on-screen node that matches the selector. It requires `--json` (CLI rejects pretty mode). The matching labels are in `stepResults[].data.text` as a **string** that contains JSON array syntax (for example `["Wi-Fi","Wi-Fi Direct"]`); parse it with `JSON.parse` in your agent. An empty match set is `"[]"`. Do not combine `all: true` with `validator` in raw executions: the Android runtime uses the multi-match path only when `all` is false or omitted for validator flows.

**`wait`:** Optional `--timeout <ms>` (positive; omit for default) caps wall-clock wait time on the device (see global options note above).

### Container Flags (scroll)

The `scroll` command accepts `--container-*` flags to restrict scrolling to a specific container:

| Flag | Description |
| :--- | :--- |
| `--container-text <value>` | Container with exact visible text |
| `--container-text-contains <value>` | Container with partial text match |
| `--container-id <value>` | Container by Android resource ID |
| `--container-desc <value>` | Container by exact content description |
| `--container-desc-contains <value>` | Container by partial content description |
| `--container-role <value>` | Container by element role |
| `--container-selector <json>` | Container by raw JSON NodeMatcher; mutually exclusive with `--container-*` flags |

### Container Flags (read)

The `read` command accepts `--container-*` flags to restrict the search to elements within a specific container's subtree. When a container is specified, only elements that are descendants of the matched container are considered.

| Flag | Description |
| :--- | :--- |
| `--container-text <value>` | Container with exact visible text |
| `--container-text-contains <value>` | Container with partial text match |
| `--container-id <value>` | Container by Android resource ID |
| `--container-desc <value>` | Container by exact content description |
| `--container-desc-contains <value>` | Container by partial content description |
| `--container-role <value>` | Container by element role |
| `--container-selector <json>` | Container by raw JSON NodeMatcher; mutually exclusive with `--container-*` flags |

**Error handling:** If the container matcher finds no element, the step fails with `CONTAINER_NOT_FOUND`. If the container matches but the element selector matches nothing inside that subtree, the step fails with `NODE_NOT_FOUND`.

### Quick Examples

```bash
# Click by text
clawperator click --text "Wi-Fi" --device <device_id> --json

# Click by resource ID
clawperator click --id "com.android.settings:id/switch_widget" --device <device_id> --json

# Click by role + text (AND match)
clawperator click --role button --text-contains "Submit" --device <device_id> --json

# Type into a text field by role
clawperator type "hello world" --role textfield --device <device_id> --json

# Type and submit
clawperator type "search query" --id "com.example:id/search_box" --submit --device <device_id> --json

# Read a value by resource ID
clawperator read --id "com.solaxcloud.starter:id/tv_pb_title" --device <device_id> --json

# Wait for element by text
clawperator wait --text "Done" --timeout 15000 --device <device_id> --json

# Read all matching labels (JSON array string in step data.text)
clawperator read --role text --all --json --device <device_id>

# Read within a specific container (scope search to container subtree)
clawperator read --text "Price" --container-role list --device <device_id> --json

# Scroll within a specific container
clawperator scroll down --container-id "com.example:id/recycler_view" --device <device_id> --json

# Use raw JSON selector (advanced/fallback)
clawperator click --selector '{"textEquals":"Wi-Fi"}' --device <device_id> --json
```

## Persistent Logging

Clawperator can write persistent NDJSON logs for device-touching commands. By default, logs go to:

```text
~/.clawperator/logs/clawperator-YYYY-MM-DD.log
```

Configure logging with:

- `CLAWPERATOR_LOG_DIR` to override the log directory
- `CLAWPERATOR_LOG_LEVEL` to set the minimum level
- `--log-level <debug|info|warn|error>` to override the env var for one command

When both `--log-level` and `CLAWPERATOR_LOG_LEVEL` are set, the flag takes precedence. If logging cannot initialize, Clawperator warns once to stderr and keeps running.

Use `debug` sparingly: it can include adb command lines plus stdout and stderr for many calls, so logs can grow quickly during long sessions and may contain more device metadata than the default lifecycle events.
Prefer `info` for normal automation and switch to `debug` only when you need the extra diagnostics.

Each log line is one JSON object with these fields:

- `ts`
- `level`
- `event`
- `commandId`
- `taskId`
- `deviceId`
- `message`

The timeout error `details.logPath` value is the resolved absolute path, so agents can pass it directly to `fs.readFile` or `cat`.

Common events include:

- `preflight.apk.pass`
- `preflight.apk.missing`
- `broadcast.dispatched`
- `envelope.received`
- `timeout.fired`
- `doctor.check`
- `skills.run.failed`
- `skills.run.start`
- `skills.run.complete`
- `skills.run.timeout`

`doctor.check` uses `info` for pass, `warn` for warnings, and `error` for failures so the log severity mirrors the check outcome.
`skills.run.failed` is emitted for non-zero skill exits, while `skills.run.complete` remains the terminal marker for every skill run.

Default Operator package:

- release app package: `com.clawperator.operator`
- local debug app package: pass `--operator-package com.clawperator.operator.dev`

Use subcommand help when the docs and the current CLI differ:

```bash
clawperator snapshot --help
clawperator screenshot --help
clawperator click --help
clawperator open --help
clawperator skills compile-artifact --help
clawperator skills run --help
clawperator skills sync --help
clawperator doctor --help
```

Use `clawperator version --check-compat` before automation batches when the agent needs to verify that the installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) matches the CLI's exact normalized version:

```bash
clawperator version --check-compat --operator-package com.clawperator.operator
```

The response includes the CLI version, detected [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version, app `versionCode`, Operator package, compatibility verdict, and remediation guidance on mismatch.

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
| `POST /execute` | Body: `{"execution": <payload>, "deviceId": "...", "operatorPackage": "..."}` |
| `POST /snapshot` | Capture UI tree |
| `POST /screenshot` | Capture screenshot |
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

If both a physical device and an emulator are connected, continue to pass `--device <serial>` to execution and device commands so targeting stays explicit.

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
| `enter_text` | `matcher: NodeMatcher`, `text: string` | `submit: boolean` (default: `false`), `clear: boolean` (accepted by Node contract but currently ignored by Android runtime, so do not rely on it to clear existing text) |
| `read_text` | `matcher: NodeMatcher` | `container: NodeMatcher` (scopes search to container subtree), `all: boolean` (default `false`; when `true`, returns all matches - see behavior note), `validator: "temperature" \| "version" \| "regex"`, `validatorPattern: string` (required when `validator` is `"regex"`), `retry: object` |
| `wait_for_node` | `matcher: NodeMatcher` | `retry: object` (see `retry` object shape below), optional `timeoutMs: number` (1-120000 on the Operator wire) - wall-clock cap for the wait loop on device, in addition to the outer execution `timeoutMs` |
| `snapshot_ui` | - | `retry: object` |
| `take_screenshot` | - | `path: string`, `retry: object` |
| `sleep` | `durationMs: number` | - |
| `scroll_and_click` | `matcher: NodeMatcher` | `container: NodeMatcher`, `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `maxSwipes: number` (default: `10`, range: 1-50), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `clickAfter: boolean` (default: `true`), `scrollRetry: object` (default preset: `maxAttempts=4`, `initialDelayMs=400`, `maxDelayMs=2000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`), `clickRetry: object` (default preset: `maxAttempts=5`, `initialDelayMs=500`, `maxDelayMs=3000`, `backoffMultiplier=2.0`, `jitterRatio=0.15`) |
| `start_recording` | - | `sessionId: string` (optional; see the recording pull/parse commands below) |
| `stop_recording` | - | `sessionId: string` (optional; see the recording pull/parse commands below) |
| `scroll_until` | - | `matcher: NodeMatcher` (optional, emits `TARGET_FOUND` when the target becomes visible), `container: NodeMatcher` (default: auto-detect), `clickType: "default" \| "long_click" \| "focus"` (used only when `clickAfter: true`), `clickAfter: boolean` (default: `false`, requires `matcher`), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"`), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `maxScrolls: number` (default: `20`, range: 1-200), `maxDurationMs: number` (default: `10000`, range: 0-120000), `noPositionChangeThreshold: number` (default: `3`, range: 1-20), `findFirstScrollableChild: boolean` (default: `true`) |
| `scroll` | - | `container: NodeMatcher` (default: auto-detect first scrollable), `direction: "down" \| "up" \| "left" \| "right"` (default: `"down"` - reveals content further down, finger swipes up), `distanceRatio: number` (default: `0.7`, range: 0-1), `settleDelayMs: number` (default: `250`, range: 0-10000), `findFirstScrollableChild: boolean` (default: `true`), `retry: object` (default: no retry - see scroll behavior note) |

| `press_key` | `key: "back" \| "home" \| "recents"` | - |
| `wait_for_navigation` | `timeoutMs: number` | `expectedPackage: string`, `expectedNode: NodeMatcher` - at least one of `expectedPackage` or `expectedNode` is required |
| `read_key_value_pair` | `labelMatcher: NodeMatcher` | - |

### CLI-to-action-type mapping

| CLI command | Payload action type |
| :--- | :--- |
| `snapshot` | `snapshot_ui` |
| `screenshot` | `take_screenshot` |
| `click` (any Phase 3 selector flag or `--selector <json>`) | `click` |
| `type` (element selector flags or `--selector <json>`; typed text is positional or `--text`) | `enter_text` |
| `read` (any Phase 3 selector flag or `--selector <json>`) | `read_text` (`--all` sets `params.all`) |
| `wait` (any Phase 3 selector flag or `--selector <json>`) | `wait_for_node` (`--timeout` sets `params.timeoutMs`) |
| `open <package-id>` | `open_app` |
| `open <url\|uri>` | `open_uri` |
| `press <back\|home\|recents>` | `press_key` |
| `back` | `press_key` (key: `back`) |
| `scroll <direction>` | `scroll` |
| `scroll-until [<direction>] --text <text>` | `scroll_until` |
| `scroll-until [<direction>] --text <text> --click` | `scroll_and_click` |
| `scroll-and-click [<direction>] --text <text>` | `scroll_and_click` |
| `close <package>` | `close_app` |
| `sleep <ms>` | `sleep` |

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

**`wait_for_node` and `timeoutMs`:** When `params.timeoutMs` is present, the Operator applies a wall-clock limit around the wait loop (Kotlin `withTimeout` around the existing retry-driven poll). If the node is not found in time, the step fails with a timeout error message that includes the matcher and `timeoutMs`. The device parser coerces `timeoutMs` into the range 1-120000 ms (a wire value of `0` becomes 1 ms on the Operator). The CLI `wait` command rejects `--timeout 0` instead of sending that edge case. On success, step `data` may include `timeout_ms` (string) echoing the configured cap when `timeoutMs` was set. The outer execution `timeoutMs` must still be large enough for the wait to finish (the CLI `wait` command extends the envelope when you pass `--timeout`).

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

**`close_app`:** The Node layer intercepts `close_app` actions and runs `adb shell am force-stop <applicationId>` before dispatching to Android. When that pre-flight close succeeds, the Node layer normalizes the resulting `close_app` step into a successful step result so the envelope reflects the real observed outcome. If the pre-flight `force-stop` fails, the execution now fails with a structured error instead of pretending the app was closed. In practice, treat `close_app` as a supported force-stop action through the Node interface. When an agent is turning a recording into a reusable skill, `close_app` is the deliberate reset primitive for flows that need a fresh app baseline, but it should not be injected automatically for every recording.

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

**`enter_text`:** From the CLI, use `type <text>` with element selector flags (for example `--role textfield` or `--id <resource-id>`). Raw `--selector <json>` remains for complex `NodeMatcher` shapes. The execution payload action type is `enter_text`. The `submit` param triggers a keyboard Enter/submit after typing - use this for search fields and single-field forms where pressing Enter submits. The Node contract still accepts `clear`, but the Android runtime does not implement it yet, so it currently has no effect.

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

**`read_text`:** Reads visible text from nodes matching `matcher`. Optional validators apply only when `all` is false or omitted. When `container` is set, the runtime still runs single-match validators against the text read from the node found inside that subtree.

**`read_text` with `all: true`:** The Operator collects every on-screen node that matches `matcher`, takes each node's visible label (blank labels are skipped), and returns them in one step. Step `data.text` is still a string (envelope `data` values are strings), but its content is a JSON array literal, for example `["Price A","Price B"]`. Agents should parse that string as JSON to obtain the list. Step `data` also includes `all: "true"` and `count: "<n>"` as strings. Newlines or rare characters in labels are escaped for JSON; if you need full node metadata, use `snapshot_ui` and filter locally.

**`read_text` validators** (single-match mode only): Validates extracted text using optional validators.

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

`snapshot` (CLI command) and `snapshot_ui` (execution action type) use the same internal pipeline and produce identical output. `snapshot` builds a single-action execution internally and calls `runExecution`. Use `snapshot` for ad-hoc inspection from the command line. Use `snapshot_ui` as a step within a multi-action execution payload.

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

**`take_screenshot`:** `screenshot` uses the same execution contract under the hood. Android reports `UNSUPPORTED_RUNTIME_SCREENSHOT`, then the Node layer captures the screenshot via `adb exec-out screencap -p`, writes it to `data.path`, and normalizes the step result to `success: true` when capture succeeds. Pass `screenshot --path <file>` when you want a deterministic local filename instead of the default temp path.

**`press_key`:** Issues a system-level key event via the Android Accessibility Service (`performGlobalAction`). Supported keys: `"back"`, `"home"`, `"recents"`. The alias `key_press` is normalized to `press_key`. No retry - this action is single-attempt by design. Requires the Clawperator Operator accessibility service to be running on the device. If the service is unavailable, the execution returns a top-level failed envelope with `status: "failed"` and no `stepResults`. Use `clawperator doctor` to diagnose accessibility service availability before running executions that include `press_key`. When testing local/debug builds, pass the matching `operatorPackage` (`com.clawperator.operator.dev`) instead of relying on the default release package. Returns `success: false` with `data.error: "GLOBAL_ACTION_FAILED"` if the OS reports the global action could not be performed (rare soft OS failure - accessibility service was running but Android declined the action).

**`press_key` key scope:** This action covers only Android accessibility global actions. Non-global keys - `enter`, `search`, `volume_up`, `volume_down`, `escape`, and raw keycodes - are not supported by `press_key`. They use a different Android mechanism (`input keyevent`) that is not routed through the Operator accessibility service. Use `adb shell input keyevent <keycode>` outside the execution payload for those keys until a dedicated raw-key primitive is added.

**`press_key` example request (`/execute`):**
```json
{
  "deviceId": "<device_id>",
  "operatorPackage": "com.clawperator.operator.dev",
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

**CLI `scroll-until --click` vs raw `scroll_until`:** The CLI maps `--click` to a `scroll_and_click` action (default `maxSwipes` 10 and the scroll-and-click engine), not to `scroll_until` with `clickAfter: true`. Raw `scroll_until` uses different defaults (`maxScrolls` 20, bounded scroll-until loop). Prefer raw `scroll_until` with `clickAfter: true` when you need scroll-until caps and semantics.

**Termination reasons (`data.termination_reason`):**
- `TARGET_FOUND` - the provided `matcher` became visible in the on-screen filtered UI tree. Step `success: true`.
- When **`params.matcher` is set**, any other terminal reason means the target was not found in time. The step is `success: false`, `data.error` is `TARGET_NOT_FOUND`, and the top-level envelope is `failed` after Node reconciliation. Treat this as a hard miss, not a successful scroll.
- When **no `matcher`** is provided, the loop is exploratory pagination only. Then `EDGE_REACHED`, `MAX_SCROLLS_REACHED`, `MAX_DURATION_REACHED`, and `NO_POSITION_CHANGE` are normal terminal states with step `success: true` (not errors). Agents scrolling infinite feeds should expect capped terminals and handle them without treating the action as failed.
- `CONTAINER_NOT_FOUND` - container resolution failed. `success: false`.
- `CONTAINER_NOT_SCROLLABLE` - container is not scrollable. `success: false`.
- `CONTAINER_LOST` - container disappeared mid-loop (e.g., app navigated away). `success: false`.

When no `matcher` is provided, `scroll_until` behaves as a pure bounded
pagination loop and returns one of the non-target terminal reasons above with `success: true`.

**Current runtime caveats:**
- Some Android screens expose off-screen descendants in the raw `snapshot_ui` XML. `scroll_until.matcher` does not use raw XML presence alone; it checks Clawperator's on-screen filtered tree. On heavily clipped or nested layouts, a target may appear in the raw snapshot near the bottom edge but still finish as `EDGE_REACHED` until it is more fully on-screen.

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

**`scroll_until` example step result (finite list, reached bottom, no matcher):**
```json
{ "id": "su1", "actionType": "scroll_until", "success": true, "data": { "termination_reason": "EDGE_REACHED", "scrolls_executed": "12", "direction": "down" } }
```

**`scroll_until` example step result (matcher set, target never found):**
```json
{ "id": "su1", "actionType": "scroll_until", "success": false, "data": { "termination_reason": "EDGE_REACHED", "error": "TARGET_NOT_FOUND", "scrolls_executed": "3", "direction": "down" } }
```

**`scroll_until` example step result (infinite feed, hit cap, no matcher):**
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
| `read_text` | `text` (single value, or JSON array literal string when `all` was true), `validator`, and when `all` is true also `all`, `count` |
| `snapshot_ui` | `actual_format`, `foreground_package` (when available), `has_overlay`, `overlay_package` (when available), `window_count`, `text` (snapshot content - see note below) |
| `take_screenshot` | `path` (local screenshot file path after Node capture) |
| `wait_for_node` | `resource_id`, `label` (matched node details), `timeout_ms` (when a per-action timeout was configured) |
| `scroll_and_click` | `max_swipes`, `direction`, `click_types`, `click_after` (`"true"` or `"false"`) |
| `scroll` | `scroll_outcome` (`"moved"`, `"edge_reached"`, or `"gesture_failed"`), `direction`, `distance_ratio`, `settle_delay_ms`, `resolved_container` (resourceId of auto-detected container, when present) |
| `scroll_until` | `termination_reason` (see behavior note), `scrolls_executed`, `direction`, `click_after`, `click_types`, `resolved_container` (when present) |
| `sleep` | `duration_ms` |
| `press_key` | `key` (`"back"`, `"home"`, or `"recents"`) |
| `wait_for_navigation` | `resolved_package` (on success), `elapsed_ms` (on success), `error`, `last_package` (on timeout) |
| `read_key_value_pair` | `label`, `value` (on success), `error` (on failure: `NODE_NOT_FOUND` or `VALUE_NODE_NOT_FOUND`) |

For any failed step: `success: false` and `data.error` contains the error code string.

**Snapshot content delivery:** The UI hierarchy is produced by the Android runtime and written to device logcat. The Node layer reads logcat after execution and injects the raw XML into `data.text`. `data.actual_format` is `"hierarchy_xml"` on successful snapshot steps. Snapshot steps may also include best-effort accessibility-window metadata such as `foreground_package`, `has_overlay`, `overlay_package`, and `window_count`.

**`read_text` value:** The extracted text value is in `data.text`. For `all: true`, parse `data.text` as JSON to recover the string array.

## Snapshot Output Format

`snapshot_ui` and `clawperator snapshot` produce the canonical
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
| `NODE_NOT_FOUND` | `data.error` | Selector matched no UI element. For `read_text` with `container`, this also applies when the container matched but `matcher` matched no node inside that subtree. |
| `RESULT_ENVELOPE_TIMEOUT` | `error.code` | Command dispatched but no result received; `details` includes command/task correlation plus last payload action context, elapsed timing, and `logPath` when persistent logging is enabled |
| `OPERATOR_NOT_INSTALLED` | `error.code` | Requested [Clawperator Operator Android app](../getting-started/android-operator-apk.md) package is missing on the device; `exec` and `doctor` fail fast instead of timing out |
| `OPERATOR_VARIANT_MISMATCH` | `error.code` | Installed release vs debug Operator APK variant does not match `--operator-package` (for example `.dev` installed while the CLI targets release, or the reverse) |
| `DEVICE_UNAUTHORIZED` | `error.code` | Device not authorized for ADB |
| `VERSION_INCOMPATIBLE` | `error.code` | CLI and installed [Clawperator Operator Android app](../getting-started/android-operator-apk.md) versions do not match exactly after ignoring the trailing debug suffix |
| `APK_VERSION_UNREADABLE` | `error.code` | The device package dump did not expose a readable [Clawperator Operator Android app](../getting-started/android-operator-apk.md) version |
| `EXECUTION_VALIDATION_FAILED` | `error.code` | Payload failed schema validation; `details` may include the offending action id/type, invalid keys, a hint, plus `path` and `reason` |
| `SECURITY_BLOCK_DETECTED` | `data.error` | Android blocked the action (e.g., secure keyboard) |
| `NODE_NOT_CLICKABLE` | `data.error` | Reserved error code. Intended for "element found but not interactable", but not currently emitted consistently by the Android and Node runtimes. |
| `SNAPSHOT_EXTRACTION_FAILED` | `data.error` | `snapshot_ui` step completed but the Node layer did not attach any snapshot text to the step during post-processing. The most common cause is a Node binary packaging mismatch or other logcat extraction issue. Rebuild or reinstall the npm package and check version compatibility. |
| `GLOBAL_ACTION_FAILED` | `data.error` | `press_key` step result when the OS reports `performGlobalAction` returned false. Rare soft failure - the accessibility service was running but Android declined to execute the action. |
| `CONTAINER_NOT_FOUND` | `data.error` | `scroll` step could not locate a scrollable container. Either no scrollable node is present on screen, or the provided `container` matcher matched nothing. For `read_text` with `container`, the step fails with this code when the container matcher matched no UI element. |
| `CONTAINER_NOT_SCROLLABLE` | `data.error` | `scroll` step found the matched container but it is not scrollable and no scrollable descendant was found. With the default `findFirstScrollableChild: true`, the runtime already walks one level down before raising this error. |
| `GESTURE_FAILED` | `data.error` | `scroll` step: the OS rejected the gesture dispatch. The accessibility service was running but Android declined to execute the swipe gesture. Step returns `success: false`. |

Primary top-level error taxonomy: `apps/node/src/contracts/errors.ts`. This table also includes runtime-only step error strings where they are still surfaced directly by callers.

Breaking rename: integrations that matched `RECEIVER_VARIANT_MISMATCH` must switch to `OPERATOR_VARIANT_MISMATCH` (same meaning: release vs debug Operator APK mismatch for `--operator-package`).

For agent-side recovery strategy, use
[Error Handling Guide](../reference/error-handling.md).

## Key Behaviors

- **Single-flight:** One execution per device at a time. Concurrent requests return `EXECUTION_CONFLICT_IN_FLIGHT`.
- **No hidden retries:** If an action fails, the error is returned immediately. Retry logic belongs in the agent.
- **Deterministic results:** Exactly one terminal envelope per `commandId`. Timeouts return `RESULT_ENVELOPE_TIMEOUT` with diagnostics, payload-side action context, and `logPath` when persistent logging is enabled.
- **Execution granularity:** Group multiple actions in one execution only when they are atomic - when the agent does not need to observe state or make a decision between them. For flows where intermediate state matters, use separate executions with `snapshot` between each. See [Execution Model](../reference/execution-model.md) for the full guidance.
- **Timeout override:** `--timeout <ms>` overrides the execution timeout for `exec`, `snapshot`, and `screenshot` within policy limits.
- **Screenshot output path:** `screenshot --path <file>` writes the PNG to the requested local path and still returns the final `data.path` in the result envelope. `<file>` must be a non-empty local filesystem path.
- **Device targeting:** Specify `--device <id>` when multiple devices are connected. Omit for single-device setups.
- **Emulator reuse over creation:** Provisioning never creates duplicate AVDs when a supported running or stopped emulator already exists.
- **Deterministic emulator boots:** Emulator starts use `-no-snapshot-load` and wait for both `sys.boot_completed` and `dev.bootcomplete`.
- **Validation before dispatch:** Every payload is schema-validated before any ADB command is issued.

## Validation and current non-features

- Payload validation happens automatically at execution time. Invalid payloads
  fail fast with `EXECUTION_VALIDATION_FAILED` before any device action runs.
- `clawperator exec --execution <json-or-file> --validate-only` validates
  and normalizes a payload without dispatching it to any device.
- `clawperator exec --execution <json-or-file> --dry-run` validates the
  payload and prints a plan summary without requiring a device connection.
  This is useful for local payload development and CI checks.
- If you want the lowest-risk contract check on a live device, use a minimal
  payload such as a single `sleep` or `snapshot_ui` action.

### `--dry-run` output format

```bash
clawperator exec --execution '{"commandId":"test","taskId":"task","source":"cli","expectedFormat":"android-ui-automator","timeoutMs":10000,"actions":[{"id":"s1","type":"sleep","params":{"durationMs":500}}]}' --dry-run
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

The `--dry-run` flag does not require `--device` and performs no ADB activity.

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
| `CLAWPERATOR_OPERATOR_PACKAGE` | CLI, installer, skills | Default Android Operator package when `--operator-package` is omitted (also passed to skill scripts) |

### `CLAWPERATOR_INSTALL_APK`

`sites/landing/public/install.sh` reads `CLAWPERATOR_INSTALL_APK` before prompting whether to
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

If more than one device is connected, pass `--device <id>` on exec,
snapshot, action, doctor, version, operator setup, and skills-run commands.

When multiple devices are present:

- the installer skips automatic APK install rather than guessing
- it prints the manual recovery command
- later automation should keep using explicit `--device`

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
   clawperator skills run com.android.settings.capture-overview --device <device_id> --timeout 90000
   ```

3. **Artifact compile + exec** (for skills with `.recipe.json` artifacts):
   ```bash
   clawperator skills compile-artifact <skill_id> --artifact <name> --vars '{"KEY":"value"}'
   clawperator exec --execution <compiled_output>
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
No. Clawperator executes a command and reports what happened. All reasoning and planning stay in the agent. Specifically:

- Clawperator does not retry a failed action automatically - a failure is returned for the agent to handle.
- Clawperator does not observe state between actions in a multi-step execution and adapt - it executes the list sequentially and returns one result.
- Clawperator does not know whether a flow succeeded in any business sense - it knows whether each action completed without a runtime error.

The practical implication: for unfamiliar apps, exploratory flows, or any sequence where the agent needs to verify state between steps, prefer single-action executions with `snapshot` calls between them. For mature skills and stable, pre-validated atomic sequences, multi-action executions are the right choice - they reduce round trips and are appropriate whenever the agent does not need to observe or adapt mid-flow. Skills are authored with the latter in mind.

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
- `skills validate <skill_id> --dry-run` keeps the integrity checks and also
  validates each compiled artifact payload against Clawperator's execution
  schema before any device interaction. Artifact-backed skills fail fast with
  the offending artifact name, action id, action type, invalid keys, and hint
  when available. Script-only skills skip payload validation because their
  payload is generated at runtime by the skill script, and the command reports
  that reason in the structured result
- `skills validate --all` runs the same integrity checks across every entry in
  the configured registry and returns a failure summary if any skills are
  broken. Add `--dry-run` to extend that validation to artifact payloads
- `skills run --timeout <ms>` overrides the wrapper timeout for one run when
  the default `120000` ms budget is not the right fit for the current flow
- `skills run --expect-contains <text>` turns the wrapper into a lightweight
  smoke check by failing if the script output does not contain the expected
  substring
- `skills run --operator-package <pkg>` sets the Operator package for this run
  (default: `com.clawperator.operator`). Use `com.clawperator.operator.dev` for
  local debug APKs.
- In pretty mode, `skills run` prints a one-line banner before validation and
  streams skill stdout and stderr in real time:

  ```text
  [Clawperator] v<version>  APK: <OK|MISSING>  Logs: <absolute-path>  Docs: https://docs.clawperator.com/llms.txt
  ```

  If the APK is present, the banner shows `OK (<operator-package>)`. If the
  APK check does not pass, it shows `MISSING - run \`clawperator operator setup --apk <path>\``.
  The banner is suppressed entirely in JSON mode so the final output remains a
  single parseable JSON envelope.
- `skills run` performs the dry-run validation gate by default before it starts
  the skill script. That gate covers the compiled artifact payloads for
  artifact-backed skills and skips payload validation for script-only skills
  with a logged reason.
- `skills run --skip-validate` bypasses that pre-run gate. Use it only as a CI
  or development escape hatch when you intentionally want to skip the payload
  check.
- Arguments after a bare `--` are forwarded to the skill script unchanged. Global
  option scanning stops at `--`, and top-level `--help` / `--version` apply only
  to tokens before that separator so scripts can receive those flags.

**Environment configuration for skills**

When `clawperator skills run` spawns a skill script, it automatically injects
two environment variables:

| Variable | Description | Default |
| :--- | :--- | :--- |
| `CLAWPERATOR_BIN` | Path to the CLI binary the skill should use | Auto-resolved: sibling build if present, else global `clawperator` |
| `CLAWPERATOR_OPERATOR_PACKAGE` | Operator package for the skill to target | `com.clawperator.operator` |

These can be set explicitly to override the defaults:

```bash
# Use a local branch build
export CLAWPERATOR_BIN=/path/to/clawperator/apps/node/dist/cli/index.js

# Target the dev APK
export CLAWPERATOR_OPERATOR_PACKAGE=com.clawperator.operator.dev

# Now all skills will use these values
clawperator skills run <skill_id>
```

CLI flags take precedence over environment variables. Use `--operator-package`
for one-off overrides without changing your shell environment.

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
