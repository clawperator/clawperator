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

**Global options:** `--device-id <id>`, `--receiver-package <pkg>`, `--output <json|pretty>`, `--timeout-ms <n>`, `--verbose`

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
| `POST /execute` | Body: `{"execution": <payload>, "deviceId": "...", "receiverPackage": "..."}` |
| `POST /observe/snapshot` | Capture UI tree |
| `POST /observe/screenshot` | Capture screenshot |
| `GET /skills` | List skills. Query params: `?app=<pkg>&intent=<i>&keyword=<k>` |
| `GET /skills/:skillId` | Get skill metadata |
| `POST /skills/:skillId/run` | Run skill. Body: `{"deviceId": "...", "args": [...]}` |
| `GET /events` | SSE stream: `clawperator:result`, `clawperator:execution`, `heartbeat` |

See `apps/node/examples/basic-api-usage.js` for a complete SSE + REST example.

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
- **Device targeting:** Specify `--device-id` when multiple devices are connected. Omit for single-device setups.
- **Validation before dispatch:** Every payload is schema-validated before any ADB command is issued.

## Skills

Skills are packaged Android automation scripts maintained in the [clawperator-skills](https://github.com/clawpilled/clawperator-skills) repository. The Node API provides discovery and metadata - skills are standalone and can be invoked directly by agents without the Node API.

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

**How should agents handle sensitive text in results?**
Default behavior is full-fidelity results for agent reasoning. PII redaction (`--safe-logs`) is a planned feature.
