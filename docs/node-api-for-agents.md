# Clawperator Node API - Agent Guide

Clawperator provides a deterministic execution layer for LLM agents to control Android devices. This guide covers the CLI and HTTP API contracts.

## Concepts

- **Execution**: A payload of one or more actions dispatched to the device. Every execution produces exactly one `[Clawperator-Result]` envelope.
- **Action**: A single step (`open_app`, `click`, `read_text`, etc.) within an execution.
- **Snapshot**: A captured UI tree (JSON or ASCII) for observing device state.
- **Skill**: A packaged recipe from the skills repo, compiled into an execution payload.

## CLI Reference

| Command | Description |
| :--- | :--- |
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
| `observe snapshot` | Capture UI tree as JSON or ASCII |
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
| `grant-device-permissions` | Enable accessibility and notification permissions on the connected device via adb |
| `serve` | Start HTTP/SSE server |
| `doctor` | Run environment diagnostics |
| `version` | Print the CLI version or check CLI/APK compatibility |

**Global options:** `--device-id <id>`, `--receiver-package <pkg>`, `--output <json|pretty>`, `--format <json|pretty>` (alias for `--output`), `--timeout-ms <n>`, `--verbose`

For agent callers, `--output json` is the canonical output mode. `pretty` is for human inspection.

Default receiver package:

- release APK: `com.clawperator.operator`
- local debug APK: pass `--receiver-package com.clawperator.operator.dev`

Use subcommand help when the docs and the current CLI differ:

```bash
clawperator observe snapshot --help
clawperator skills sync --help
clawperator doctor --help
```

Use `clawperator version --check-compat` before automation batches when the agent needs to verify that the installed APK matches the CLI's supported `major.minor` version:

```bash
clawperator version --check-compat --receiver-package com.clawperator.operator
```

The response includes the CLI version, detected APK version, APK `versionCode`, receiver package, compatibility verdict, and remediation guidance on mismatch.

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
    { "id": "step2", "type": "click", "params": { "matcher": { "textEquals": "Login" } } },
    { "id": "step3", "type": "snapshot_ui" }
  ]
}
```

**Result envelope:** Exactly one `[Clawperator-Result]` JSON block is emitted to logcat on completion. Node reads and returns it.

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
| `RECEIVER_NOT_INSTALLED` | Clawperator APK not found on device |
| `DEVICE_UNAUTHORIZED` | Device not authorized for ADB |
| `VERSION_INCOMPATIBLE` | CLI and installed APK versions do not share the same `major.minor` |
| `APK_VERSION_UNREADABLE` | The device package dump did not expose a readable APK version |
| `EXECUTION_VALIDATION_FAILED` | Payload failed schema validation |
| `SECURITY_BLOCK_DETECTED` | Android blocked the action (e.g., secure keyboard) |
| `NODE_NOT_CLICKABLE` | Element found but not interactable |

Full error taxonomy: `apps/node/src/contracts/errors.ts`

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

# Search by target app
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
Only for diagnostics or gaps not covered by the API. For routine automation, use Clawperator so result/error semantics stay consistent.

**Does Clawperator run skills?**
Skills are standalone programs that agents can invoke directly. The Node API provides discovery (`skills list`, `skills search`), metadata (`skills get`), and a convenience `skills run` wrapper. Skills do not need the Node API to execute - agents can call skill scripts directly.

**Does Clawperator configure accounts or app settings?**
No. Clawperator automates the UI on whatever apps are already installed and signed in on the device. It does not log in to apps, create accounts, or configure device settings on behalf of the user. If an automation targets an app that requires authentication, the user must sign in to that app manually on the device before the agent runs. For emulators using a Google Play system image, the user must also sign in to a Google account before Play Store-gated apps are accessible.

**How should agents handle sensitive text in results?**
Default behavior is full-fidelity results for agent reasoning. PII redaction (`--safe-logs`) is a planned feature.
