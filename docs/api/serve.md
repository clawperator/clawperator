# Serve API

## Purpose

Define the local HTTP and SSE contract exposed by `clawperator serve`, including request bodies, success responses, status-code mapping, and how the serve layer wraps `runExecution`, skill, and emulator operations.

## Sources

- HTTP server and handlers: `apps/node/src/cli/commands/serve.ts`
- Execution result contract: `apps/node/src/domain/executions/runExecution.ts`
- Result envelope: `apps/node/src/contracts/result.ts`
- Skills registry contract: `apps/node/src/contracts/skills.ts`
- SSE event names: `apps/node/src/domain/observe/events.ts`
- Emulator response types: `apps/node/src/domain/android-emulators/types.ts`

## Start The Server

```bash
clawperator serve [--host <string>] [--port <number>]
```

Defaults:

| Field | Value |
| --- | --- |
| host | `127.0.0.1` |
| port | `3000` |
| JSON request body limit | `100kb` |

When the server starts successfully, it listens until the process exits. There is no structured JSON startup response because this is a long-running command.

## Response Shapes

Most REST endpoints return one of these shapes.

### Success wrapper

```json
{
  "ok": true
}
```

and then endpoint-specific fields such as `devices`, `skills`, `avds`, `output`, or emulator state.

### Execution result passthrough

`/execute`, `/snapshot`, and `/screenshot` return the `runExecution()` result object directly:

Successful shape:

```json
{
  "ok": true,
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "envelope": {
    "commandId": "serve-snap-1710000000000",
    "taskId": "serve-snap-1710000000000",
    "status": "success",
    "stepResults": [
      {
        "id": "snap",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  }
}
```

Failure shape:

```json
{
  "ok": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device emulator-9999 not found or not in device state",
    "details": {
      "connected": ["emulator-5554"]
    }
  }
}
```

Success conditions for execution endpoints:

- HTTP status is `200`
- response body has `"ok": true`
- `envelope.status == "success"`
- every `envelope.stepResults[i].success == true`

## Endpoint Summary

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/devices` | list adb-visible devices |
| `POST` | `/execute` | run a caller-supplied execution payload |
| `POST` | `/snapshot` | run a synthetic one-step `snapshot_ui` execution |
| `POST` | `/screenshot` | run a synthetic one-step `take_screenshot` execution |
| `GET` | `/skills` | list all skills or search by query |
| `GET` | `/skills/:skillId` | fetch one skill registry entry |
| `POST` | `/skills/:skillId/run` | run one skill script |
| `GET` | `/android/emulators` | list configured AVDs |
| `GET` | `/android/emulators/running` | list running emulators |
| `GET` | `/android/emulators/:name` | inspect one configured AVD |
| `POST` | `/android/emulators/create` | create an AVD |
| `POST` | `/android/emulators/:name/start` | start an AVD and wait for boot |
| `POST` | `/android/emulators/:name/stop` | stop a running AVD |
| `DELETE` | `/android/emulators/:name` | delete an AVD |
| `POST` | `/android/provision/emulator` | create or reuse a supported emulator and boot it |
| `GET` | `/events` | subscribe to SSE execution events |

## `GET /devices`

Returns the same parsed adb listing used by [Devices](devices.md).

Success response:

```json
{
  "ok": true,
  "devices": [
    {
      "serial": "emulator-5554",
      "state": "device"
    },
    {
      "serial": "R58N12345AB",
      "state": "unauthorized"
    }
  ]
}
```

Meaning:

- this is observational output only
- it does not apply the execution-time `resolveDevice()` filtering rules

Failure behavior:

- server-side listing failures return HTTP `500`
- this route does not use the `errors.ts` status mapping table

## `POST /execute`

### Request body

```json
{
  "execution": {
    "commandId": "open-settings",
    "taskId": "open-settings",
    "source": "agent-http",
    "expectedFormat": "android-ui-automator",
    "timeoutMs": 30000,
    "actions": [
      {
        "id": "a1",
        "type": "open_app",
        "params": {
          "applicationId": "com.android.settings"
        }
      },
      {
        "id": "a2",
        "type": "snapshot_ui"
      }
    ]
  },
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev"
}
```

Valid body rules enforced by the route:

- request body must be a JSON object
- `execution` is required
- `deviceId`, when present, must be a string
- `operatorPackage`, when present, must be a non-empty string

Operator package resolution:

- if `operatorPackage` is present in the request, the server uses it verbatim
- otherwise it falls back to `process.env.CLAWPERATOR_OPERATOR_PACKAGE` when that env var is non-empty
- otherwise it uses `com.clawperator.operator`

Then `runExecution()` applies full execution validation. See [Actions](actions.md), [Selectors](selectors.md), and [API Overview](overview.md).

### Success response

```json
{
  "ok": true,
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "envelope": {
    "commandId": "open-settings",
    "taskId": "open-settings",
    "status": "success",
    "stepResults": [
      {
        "id": "a1",
        "actionType": "open_app",
        "success": true,
        "data": {}
      },
      {
        "id": "a2",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  }
}
```

### Failure response

Validation failure example:

```json
{
  "ok": false,
  "error": {
    "code": "EXECUTION_VALIDATION_FAILED",
    "message": "press_key requires params.key",
    "details": {
      "path": "actions.0.params.key",
      "actionId": "k1",
      "actionType": "press_key"
    }
  }
}
```

Device-resolution failure example:

```json
{
  "ok": false,
  "error": {
    "code": "DEVICE_NOT_FOUND",
    "message": "Device non-existent not found or not in device state",
    "details": {
      "connected": ["emulator-5554"]
    }
  }
}
```

## `POST /snapshot`

This route builds a synthetic execution with:

- `source: "serve-api"`
- `expectedFormat: "android-ui-automator"`
- `timeoutMs: 30000`
- one action: `{ "id": "snap", "type": "snapshot_ui" }`

### Request body

```json
{
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev"
}
```

Notes:

- body must still be a JSON object, but `{}` is valid
- omitted `operatorPackage` follows the same fallback chain as `/execute`

### Success response

```json
{
  "ok": true,
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "envelope": {
    "commandId": "serve-snap-1710000000000",
    "taskId": "serve-snap-1710000000000",
    "status": "success",
    "stepResults": [
      {
        "id": "snap",
        "actionType": "snapshot_ui",
        "success": true,
        "data": {
          "text": "<hierarchy rotation=\"0\">...</hierarchy>"
        }
      }
    ],
    "error": null
  }
}
```

## `POST /screenshot`

This route builds a synthetic execution with:

- `source: "serve-api"`
- `expectedFormat: "android-ui-automator"`
- `timeoutMs: 30000`
- one action: `{ "id": "shot", "type": "take_screenshot" }`
- optional `params.path` when `path` was supplied

### Request body

```json
{
  "deviceId": "emulator-5554",
  "operatorPackage": "com.clawperator.operator.dev",
  "path": "/tmp/settings.png"
}
```

Route validation:

- request body must be a JSON object
- `path`, when present, must be a non-empty string
- omitted `operatorPackage` follows the same fallback chain as `/execute`

### Success response

```json
{
  "ok": true,
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "envelope": {
    "commandId": "serve-shot-1710000000000",
    "taskId": "serve-shot-1710000000000",
    "status": "success",
    "stepResults": [
      {
        "id": "shot",
        "actionType": "take_screenshot",
        "success": true,
        "data": {
          "path": "/tmp/settings.png"
        }
      }
    ],
    "error": null
  }
}
```

## `GET /skills`

Without query parameters, returns every registry entry:

```json
{
  "ok": true,
  "skills": [
    {
      "id": "com.test.echo",
      "applicationId": "com.example",
      "intent": "echo text",
      "summary": "Echo test skill",
      "path": "skills/com.test.echo",
      "skillFile": "skills/com.test.echo/SKILL.md",
      "scripts": ["skills/com.test.echo/run.js"],
      "artifacts": []
    }
  ],
  "count": 1
}
```

Optional query parameters:

| Query key | Type | Match behavior |
| --- | --- | --- |
| `app` | string | exact `applicationId` match |
| `intent` | string | exact `intent` match |
| `keyword` | string | case-insensitive substring match across `id`, `summary`, and `applicationId` |

## `GET /skills/:skillId`

Success response:

```json
{
  "ok": true,
  "skill": {
    "id": "com.test.echo",
    "applicationId": "com.example",
    "intent": "echo text",
    "summary": "Echo test skill",
    "path": "skills/com.test.echo",
    "skillFile": "skills/com.test.echo/SKILL.md",
    "scripts": ["skills/com.test.echo/run.js"],
    "artifacts": []
  }
}
```

## `POST /skills/:skillId/run`

### Request body

```json
{
  "deviceId": "emulator-5554",
  "args": ["hello", "api"],
  "timeoutMs": 4321,
  "expectContains": "TEST_OUTPUT:hello"
}
```

Validation rules:

- body must be a JSON object
- `deviceId`, when present, must be a string
- `args`, when present, must be an array
- `timeoutMs`, when present, must be a positive integer
- `expectContains`, when present, must be a string

Argument mapping:

- if `deviceId` is a non-empty string, it is prepended to the script argument list
- `args[]` are appended after that, stringified with `String()`
- if `timeoutMs` is omitted, `runSkill()` uses its default timeout of `120000ms`

### Success response

```json
{
  "ok": true,
  "skillId": "com.test.echo",
  "output": "TEST_OUTPUT:hello\nTEST_OUTPUT:api\n",
  "exitCode": 0,
  "durationMs": 18,
  "timeoutMs": 4321,
  "expectedSubstring": "TEST_OUTPUT:hello"
}
```

Behavior:

- if `expectContains` is provided and `output` does not contain that substring, the route returns HTTP `400`
- if the skill exits non-zero, the route returns HTTP `400` for most failures or `404` when the skill ID does not exist
- successful responses always include `exitCode: 0`

## Emulator Endpoints

### `GET /android/emulators`

Lists configured AVDs, merged with running-state information:

```json
{
  "ok": true,
  "avds": [
    {
      "name": "clawperator-pixel",
      "exists": true,
      "running": false,
      "apiLevel": 35,
      "abi": "arm64-v8a",
      "playStore": true,
      "deviceProfile": "pixel_8",
      "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
      "supported": true,
      "unsupportedReasons": []
    }
  ]
}
```

### `GET /android/emulators/running`

```json
{
  "ok": true,
  "devices": [
    {
      "type": "emulator",
      "avdName": "clawperator-pixel",
      "serial": "emulator-5554",
      "booted": true,
      "supported": true,
      "unsupportedReasons": []
    }
  ]
}
```

### `GET /android/emulators/:name`

Returns one `ConfiguredAvd` object merged into the success wrapper:

```json
{
  "ok": true,
  "name": "clawperator-pixel",
  "exists": true,
  "running": false,
  "apiLevel": 35,
  "abi": "arm64-v8a",
  "playStore": true,
  "deviceProfile": "pixel_8",
  "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
  "supported": true,
  "unsupportedReasons": []
}
```

### `POST /android/emulators/create`

Request body:

```json
{
  "name": "clawperator-pixel",
  "apiLevel": 35,
  "abi": "arm64-v8a",
  "deviceProfile": "pixel_8",
  "playStore": true
}
```

Defaults when omitted:

| Field | Default |
| --- | --- |
| `name` | `DEFAULT_EMULATOR_AVD_NAME` |
| `apiLevel` | `SUPPORTED_EMULATOR_API_LEVEL` |
| `abi` | `arm64-v8a` |
| `deviceProfile` | `DEFAULT_EMULATOR_DEVICE_PROFILE` |
| `playStore` | `true` unless explicitly `false` |

Success response:

```json
{
  "ok": true,
  "name": "clawperator-pixel",
  "exists": true,
  "running": false,
  "apiLevel": 35,
  "abi": "arm64-v8a",
  "playStore": true,
  "deviceProfile": "pixel_8",
  "systemImage": "system-images;android-35;google_apis_playstore;arm64-v8a",
  "supported": true,
  "unsupportedReasons": []
}
```

### `POST /android/emulators/:name/start`

Success response:

```json
{
  "ok": true,
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true
}
```

Behavior:

- verifies the AVD exists
- rejects already-running AVDs
- starts the emulator, waits for adb registration, waits for boot completion, then enables developer settings

### `POST /android/emulators/:name/stop`

```json
{
  "ok": true,
  "avdName": "clawperator-pixel",
  "stopped": true
}
```

### `DELETE /android/emulators/:name`

```json
{
  "ok": true,
  "avdName": "clawperator-pixel",
  "deleted": true
}
```

### `POST /android/provision/emulator`

This route calls `provisionEmulator()` and may reuse a supported running emulator, start an existing supported AVD, or create and start a new one.

Success response:

```json
{
  "ok": true,
  "type": "emulator",
  "avdName": "clawperator-pixel",
  "serial": "emulator-5554",
  "booted": true,
  "created": false,
  "started": true,
  "reused": true
}
```

Meaning of flags:

- `created`: a new AVD had to be created
- `started`: the emulator process was started during this request
- `reused`: an existing supported emulator or AVD was reused

## `GET /events` SSE Stream

The server responds with:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

Initial heartbeat event:

```text
event: heartbeat
data: {"code":"CONNECTED","message":"Clawperator SSE stream active"}
```

Execution-related events:

| Event name | Data shape |
| --- | --- |
| `clawperator:result` | `{ "deviceId": "<serial>", "envelope": <ResultEnvelope> }` |
| `clawperator:execution` | `{ "deviceId": "<serial>", "input": <unknown>, "result": <RunExecutionResult> }` |

Use `/events` when:

- you want push-style result observation instead of polling
- you need both raw execution outcomes and envelope-only results

## HTTP Status Mapping

When a handler returns an enum-backed error from `errors.ts`, `serve.ts` maps it to HTTP status like this:

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

Machine-checkable rule:

- for execution endpoints, use both HTTP status and `error.code`
- branch primarily on `error.code`, not only on the HTTP status

## Error Handling Notes

Two classes of failures exist:

1. Stable enum-backed failures from `apps/node/src/contracts/errors.ts`
2. Route-local HTTP validation failures for malformed or missing request bodies

For long-term agent logic, prefer branching on the enum-backed errors above. Route-local validation failures should be treated as “fix the request body and retry” rather than as durable cross-surface contract codes.

Examples of route-local validation failures:

- malformed JSON body -> HTTP `400`
- body is missing or not a JSON object on POST routes -> HTTP `400`
- `/execute` without `execution` -> HTTP `400`
- `/screenshot` with blank `path` -> HTTP `400`

## Related Pages

- [API Overview](overview.md)
- [Actions](actions.md)
- [Selectors](selectors.md)
- [Devices](devices.md)
- [Errors](errors.md)
