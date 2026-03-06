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
| `skills compile-artifact <id> --artifact <name>` | Compile skill to execution payload |
| `serve` | Start HTTP/SSE server |
| `doctor` | Run environment diagnostics |

**Global options:** `--device-id <id>`, `--receiver-package <pkg>`, `--output <json|pretty>`, `--timeout-ms <n>`, `--verbose`

## HTTP API (`clawperator serve`)

Start with `clawperator serve [--port <n>] [--host <ip>]`. Default: `127.0.0.1:3000`.

> **Security:** The API is unauthenticated. Binds to localhost by default. Only use `--host 0.0.0.0` on trusted networks.

| Endpoint | Description |
| :--- | :--- |
| `GET /devices` | Returns `{ ok: true, devices: [...] }` |
| `POST /execute` | Body: `{"execution": <payload>, "deviceId": "...", "receiverPackage": "..."}` |
| `POST /observe/snapshot` | Capture UI tree |
| `POST /observe/screenshot` | Capture screenshot |
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
It compiles skill artifacts into execution payloads and runs them. It has no runtime awareness of skill semantics.

**How should agents handle sensitive text in results?**
Default behavior is full-fidelity results for agent reasoning. PII redaction (`--safe-logs`) is a planned feature.
