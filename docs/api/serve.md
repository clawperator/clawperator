# Serve API

## Purpose

Expose the local Clawperator runtime over HTTP and SSE for remote agent control.

## Starting The Server

```bash
clawperator serve [--port <number>] [--host <string>]
```

Defaults from `apps/node/src/cli/commands/serve.ts`:

- `host`: `127.0.0.1`
- `port`: `3000`
- JSON body limit: `100kb`

## Endpoints

| Method | Path | Request body | Success response |
| --- | --- | --- | --- |
| `GET` | `/devices` | none | `{ ok: true, devices }` |
| `POST` | `/execute` | `{ execution, deviceId?, operatorPackage? }` | `runExecution(...)` result object |
| `POST` | `/snapshot` | `{ deviceId?, operatorPackage? }` | `runExecution(...)` result for one `snapshot_ui` step |
| `POST` | `/screenshot` | `{ deviceId?, operatorPackage?, path? }` | `runExecution(...)` result for one `take_screenshot` step |
| `GET` | `/skills` | none, or query `app`, `intent`, `keyword` | `{ ok: true, skills, count }` |
| `GET` | `/skills/:skillId` | none | `{ ok: true, skill }` |
| `POST` | `/skills/:skillId/run` | `{ deviceId?, args?, timeoutMs?, expectContains? }` | `{ ok: true, skillId, output, exitCode, durationMs, timeoutMs?, expectedSubstring? }` |
| `GET` | `/android/emulators` | none | `{ ok: true, avds }` |
| `GET` | `/android/emulators/running` | none | `{ ok: true, devices }` |
| `GET` | `/android/emulators/:name` | none | `{ ok: true, ...avd }` |
| `POST` | `/android/emulators/create` | optional `{ name?, apiLevel?, abi?, deviceProfile?, playStore? }` | `{ ok: true, ...avd }` |
| `POST` | `/android/emulators/:name/start` | none | `{ ok: true, type: "emulator", avdName, serial, booted: true }` |
| `POST` | `/android/emulators/:name/stop` | none | `{ ok: true, avdName, stopped: true }` |
| `DELETE` | `/android/emulators/:name` | none | `{ ok: true, avdName, deleted: true }` |
| `POST` | `/android/provision/emulator` | none | `{ ok: true, ...result }` |
| `GET` | `/events` | none | SSE stream |

## Request Rules

### `/execute`

Body shape:

```json
{
  "execution": {
    "commandId": "<id>",
    "taskId": "<id>",
    "source": "<source>",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": []
  },
  "deviceId": "<optional_serial>",
  "operatorPackage": "com.clawperator.operator"
}
```

Validation:

- `execution` is required
- `deviceId`, when present, must be a string
- `operatorPackage`, when present, must be a non-empty string

### `/snapshot`

Creates a synthetic execution with one `snapshot_ui` action and a `30000ms` timeout.

### `/screenshot`

Creates a synthetic execution with one `take_screenshot` action and a `30000ms` timeout. `path`, when present, must be a non-empty string.

### `/skills/:skillId/run`

Validation:

- `deviceId`, when present, must be a string
- `args`, when present, must be an array
- `timeoutMs`, when present, must be a positive integer
- `expectContains`, when present, must be a string

Behavior:

- If `expectContains` is set and the skill output does not include that substring, the server returns `400` with `SKILL_OUTPUT_ASSERTION_FAILED`.

## SSE Stream

`GET /events` returns `text/event-stream`.

Events currently emitted:

| Event name | Data shape |
| --- | --- |
| `heartbeat` | `{ code: "CONNECTED", message: "Clawperator SSE stream active" }` |
| `clawperator:result` | `{ deviceId, envelope }` |
| `clawperator:execution` | `{ deviceId, input, result }` |

## Error Responses

Body shape:

```json
{
  "ok": false,
  "error": {
    "code": "<code>",
    "message": "<message>"
  }
}
```

Status mapping used by the server:

| Error code | HTTP status |
| --- | --- |
| `EXECUTION_CONFLICT_IN_FLIGHT` | `423` |
| `DEVICE_NOT_FOUND` | `404` |
| `NO_DEVICES` | `404` |
| `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | `400` |
| `EXECUTION_VALIDATION_FAILED` | `400` |
| `PAYLOAD_TOO_LARGE` | `413` |
| `RESULT_ENVELOPE_TIMEOUT` | `504` |
| `EMULATOR_NOT_FOUND` | `404` |
| `EMULATOR_NOT_RUNNING` | `404` |
| `EMULATOR_UNSUPPORTED` | `409` |
| `EMULATOR_ALREADY_RUNNING` | `409` |
| anything else | `500` |

Additional handler-level errors:

- malformed JSON body -> `400 INVALID_JSON`
- missing or non-object body on most POST endpoints -> `400 INVALID_BODY`
- missing `execution` on `/execute` -> `400 MISSING_EXECUTION`
- invalid `path` on `/screenshot` -> `400 INVALID_PATH`

## Related Pages

- [API Overview](overview.md)
- [Devices](devices.md)
- [Actions](actions.md)
- [Errors](errors.md)
