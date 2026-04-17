# MCP Server

## Purpose

Describe the first-party stdio MCP server exposed by `clawperator mcp serve`: how to launch it, how to configure long-running MCP clients, which tools ship today, and what behavior to expect when device state changes under a running client.

## Sources

- CLI command registration: `apps/node/src/cli/registry.ts`
- MCP bootstrap: `apps/node/src/cli/commands/mcp.ts`, `apps/node/src/mcp/server.ts`
- Shared MCP tool helpers: `apps/node/src/mcp/tools/common.ts`, `apps/node/src/mcp/selectors.ts`
- Core tools: `apps/node/src/mcp/tools/core.ts`
- Named tools: `apps/node/src/mcp/tools/named.ts`
- MCP session defaults: `apps/node/src/mcp/session.ts`
- Installer-generated MCP snippet: [`install.sh`](https://github.com/clawperator/clawperator/blob/main/sites/landing/public/install.sh)
- Execution contract: `apps/node/src/contracts/execution.ts`
- Error codes: `apps/node/src/contracts/errors.ts`
- Selector contract: `apps/node/src/contracts/selectors.ts`
- Result envelope: `apps/node/src/contracts/result.ts`
- Package Node requirement: `apps/node/package.json`

## What It Is

`clawperator mcp serve` starts a local stdio MCP server for MCP clients such as Claude Desktop. The server is transport-only:

- it speaks MCP over stdin/stdout
- it does not expose HTTP or SSE
- it uses the same canonical execution engine as the CLI and `serve`
- it starts even when no Android device is connected

If no device is connected at startup, the process still boots normally. Tool calls that need a device then return structured Clawperator errors such as `NO_DEVICES` or `ADB_NOT_FOUND`.

## Start The Server

Installed package command:

```bash
clawperator mcp serve
```

Branch-local development command:

```bash
npm --prefix apps/node run build
node apps/node/dist/cli/index.js mcp serve
```

Notes:

- `mcp serve` is a long-running stdio transport. Do not wrap it in another CLI command that also writes to stdout.
- The MCP path is detected before the normal CLI formatter runs, so stdout is reserved for MCP protocol messages only.
- Global CLI flags such as `--device`, `--device-id`, and `--operator-package` are not accepted on the `mcp serve` argv line. Pass `deviceId` and `operatorPackage` per MCP tool call instead, or store them for the current MCP session with `configure`.
- Node.js `24+` is required.

## Installer-Generated Snippet

`install.sh` writes a host-specific MCP snippet to:

- `~/.clawperator/mcp-config-snippet.json`

That file is generated from the installer's current binary path, detected `adb`
path, `DEFAULT_OPERATOR_PACKAGE` (`com.clawperator.operator`), and
`~/.clawperator/logs`. It includes:

- `claudeDesktop.entry.clawperator`
- `codex.entryToml`
- `genericStdioConsumer.server`

When the installer can resolve the packaged CLI JS entrypoint, the generated
snippet uses the installer's current absolute Node executable path instead of a
bare `node` command so GUI MCP clients do not depend on shell `PATH`.

The installer does not auto-register the MCP server with any client. The file
is a paste-ready bridge, not an automatic configuration mutation.

## Claude Desktop Example

Example `mcpServers` entry:

```json
{
  "mcpServers": {
    "clawperator": {
      "command": "node",
      "args": [
        "<installed_clawperator_path>/dist/cli/index.js",
        "mcp",
        "serve"
      ],
      "env": {
        "ADB_PATH": "<adb_path>",
        "CLAWPERATOR_OPERATOR_PACKAGE": "com.clawperator.operator.dev",
        "CLAWPERATOR_LOG_DIR": "<log_dir>",
        "CLAWPERATOR_LOG_LEVEL": "info"
      }
    }
  }
}
```

Why `node` is the command:

- the npm package ships `dist/cli/index.js`
- MCP desktop clients usually want an explicit executable plus argument list
- using `node` plus the installed CLI entrypoint avoids relying on shell wrappers

## When To Use MCP Versus `clawperator skills`

Use `clawperator skills` when:

- your host can shell out to the CLI directly
- you want to discover installed runtime skills by app, keyword, or id
- you want the runtime-skill wrapper semantics from `skills get` and `skills run`

Use MCP when:

- your host already supports stdio MCP
- you want a long-running registered tool surface instead of repeated CLI process launches
- you need general device tools such as `devices`, `snapshot`, `execute`, and `configure`, not only runtime-skill discovery

These surfaces are complementary:

- `clawperator skills` is the primary runtime-skill discovery and wrapper surface
- `clawperator mcp serve` is the primary tool-registration surface for MCP-capable hosts

## Environment For Long-Running MCP Clients

These environment variables matter most for MCP use:

| Variable | Default | Why MCP users care |
| --- | --- | --- |
| `ADB_PATH` | `adb` from `PATH` | MCP clients like Claude Desktop usually do not inherit your interactive shell `PATH`. Set this explicitly in the MCP client config. |
| `CLAWPERATOR_OPERATOR_PACKAGE` | `com.clawperator.operator` | Use `com.clawperator.operator.dev` for local branch testing against the debug APK. |
| `CLAWPERATOR_LOG_DIR` | `~/.clawperator/logs` | Primary diagnostics path for MCP users because Claude Desktop does not surface stderr. |
| `CLAWPERATOR_LOG_LEVEL` | `info` | Raise to `debug` when diagnosing tool failures. |

Important diagnostics rule:

- stderr is not visible in Claude Desktop
- when an MCP session fails, check the log file under `CLAWPERATOR_LOG_DIR`
- `CLAWPERATOR_LOG_LEVEL=debug` is the main way to get more runtime detail from a GUI MCP client

For the full environment-variable contract, see [Environment Variables](environment.md).

## Selector Shape

Selector-taking MCP tools accept this object shape:

| Field | Maps to `NodeMatcher` | Meaning |
| --- | --- | --- |
| `id` | `resourceId` | Exact Android resource id |
| `role` | `role` | Exact node role |
| `text` | `textEquals` | Exact visible text |
| `textContains` | `textContains` | Substring match on visible text |
| `desc` | `contentDescEquals` | Exact content description |
| `descContains` | `contentDescContains` | Substring match on content description |

Rules:

- at least one selector field must be present and non-empty
- an all-empty selector is rejected at the MCP boundary
- selector objects are used by `click`, `type`, `read`, `wait`, and `scroll_until`

For the underlying selector contract, see [Selectors](selectors.md).

## Tool Summary

<!-- CODE-DERIVED: mcp-tool-summary -->

## Tool Details

All execution-backed tools accept these common options unless noted otherwise:

| Field | Required | Meaning |
| --- | --- | --- |
| `deviceId` | no | Explicit adb device serial. Strongly recommended when multiple devices are connected. |
| `operatorPackage` | no | Operator package override. Blank string is rejected. |
| `timeoutMs` | no | Execution timeout override. Values must stay within the normal execution timeout bounds or the MCP boundary rejects them with `InvalidParams`. For `wait`, this is the wait duration and the execution timeout is derived from it. |

You can also store `deviceId`, `operatorPackage`, and `timeoutMs` once per MCP server process with `configure`. When both are present, per-call values win over session defaults for each field independently.

### `devices`

List adb-visible devices.

Input:

```json
{}
```

Success payload shape:

```json
{
  "devices": [
    {
      "serial": "emulator-5554",
      "state": "device"
    }
  ]
}
```

Notes:

- this is observational output only
- it does not apply execution-time device resolution rules

### `snapshot`

Capture the current UI hierarchy XML.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout; defaults to `30000` |
| `maxChars` | no | Truncate the returned XML to this many characters. Minimum `1`. |

Example call:

```json
{
  "deviceId": "<device_serial>",
  "operatorPackage": "com.clawperator.operator.dev",
  "maxChars": 2000
}
```

Success payload includes:

- `snapshot`: XML string from `snapshot_ui`
- `truncated`: present as `true` only when `maxChars` shortened the XML
- `deviceId`
- `terminalSource`
- `envelope`

When `maxChars` is applied, the returned `envelope` is truncated consistently with the top-level `snapshot` field, so MCP clients do not receive a second full-copy XML payload through `content` or `structuredContent`.

### `execute`

Run a caller-supplied action list through the canonical execution validator and runtime.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `actions` | yes | Array of action objects. Each action must include `id` and `type`; `params` is optional passthrough data. |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package. Blank string is rejected before runtime dispatch. |
| `timeoutMs` | no | Top-level execution timeout. Defaults to `30000`. |

Example call:

```json
{
  "deviceId": "<device_serial>",
  "operatorPackage": "com.clawperator.operator.dev",
  "actions": [
    {
      "id": "sleep-1",
      "type": "sleep",
      "params": {
        "durationMs": 1000
      }
    }
  ]
}
```

Validation boundary:

- MCP only enforces `actions` presence plus `id` and `type` on each element
- the full action contract is enforced later by `validateExecution()`
- MCP rejects caller-controlled `take_screenshot` `path` values so an MCP client cannot choose arbitrary host write locations

Use [Actions](actions.md) for canonical action types and params.

### `configure`

Store per-session defaults for execution-backed MCP tools.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `deviceId` | no | Session default adb device serial |
| `operatorPackage` | no | Session default operator package |
| `timeoutMs` | no | Session default execution timeout. Must stay within the normal execution timeout bounds or `configure` rejects it with `InvalidParams`. |

Rules:

- all fields are optional
- blank or whitespace-only `deviceId` and `operatorPackage` are rejected with `InvalidParams`
- `timeoutMs` must stay within the normal execution timeout bounds before it is stored
- the stored state is scoped to the current `createMcpServer()` instance only
- the response shape is always `{ "session": { ...currentValues } }`
- unset fields are omitted from `session`
- per-call tool arguments override session defaults field-by-field

Example call:

```json
{
  "deviceId": "<device_serial>",
  "operatorPackage": "com.clawperator.operator.dev",
  "timeoutMs": 15000
}
```

Example success payload:

```json
{
  "session": {
    "deviceId": "<device_serial>",
    "operatorPackage": "com.clawperator.operator.dev",
    "timeoutMs": 15000
  }
}
```

### `open`

Open an app or URI.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `appId` | conditional | Android package id |
| `uri` | conditional | URI to open |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `15000`. |

Rule:

- provide exactly one of `appId` or `uri`

Example app launch:

```json
{
  "appId": "com.android.settings",
  "deviceId": "<device_serial>"
}
```

Example URI launch:

```json
{
  "uri": "https://clawperator.com",
  "deviceId": "<device_serial>"
}
```

### `click`

Click a node or an absolute coordinate.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `selector` | conditional | Selector object |
| `coordinate` | conditional | `{ "x": <int>, "y": <int> }` |
| `clickType` | no | One of `default`, `long_click`, `focus` |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `30000`. |

Rule:

- provide exactly one of `selector` or `coordinate`

Example selector click:

```json
{
  "selector": {
    "text": "Network & internet"
  },
  "deviceId": "<device_serial>"
}
```

Example coordinate click:

```json
{
  "coordinate": {
    "x": 540,
    "y": 1180
  },
  "deviceId": "<device_serial>"
}
```

### `type`

Type text into a matching field.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `selector` | yes | Target field selector |
| `text` | yes | Text to enter |
| `submit` | no | When `true`, submit after entry |
| `clear` | no | When `true`, clear first |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `30000`. |

Example call:

```json
{
  "selector": {
    "id": "com.android.settings:id/search_src_text"
  },
  "text": "battery",
  "clear": true,
  "deviceId": "<device_serial>"
}
```

### `read`

Read text from one node or all matches. Supports regex validation to filter results at the runtime boundary.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `selector` | yes | Target selector |
| `all` | no | When `true`, returns a JSON array payload instead of a single string |
| `container` | no | Optional container selector |
| `validator` | no | Validation mode. Currently only `"regex"` is supported. |
| `validatorPattern` | no | Required when `validator` is `"regex"`. A valid regex pattern the matched text must satisfy. |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `30000`. |

Example single-value read:

```json
{
  "selector": {
    "text": "Network & internet"
  },
  "deviceId": "<device_serial>"
}
```

Example all-values read:

```json
{
  "selector": {
    "textContains": "Wi"
  },
  "all": true,
  "deviceId": "<device_serial>"
}
```

Example regex-validated read:

```json
{
  "selector": {
    "id": "com.example:id/version_text"
  },
  "validator": "regex",
  "validatorPattern": "^\\d+\\.\\d+\\.\\d+$",
  "deviceId": "<device_serial>"
}
```

### `press`

Press a supported Android navigation key.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `key` | yes | One of `back`, `home`, `recents` |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `10000`. |

Example call:

```json
{
  "key": "back",
  "deviceId": "<device_serial>"
}
```

### `wait`

Wait until a matching node appears.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `selector` | yes | Target selector |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Wait duration in milliseconds. The execution timeout becomes `max(timeoutMs + 5000, 30000)`. |

Example call:

```json
{
  "selector": {
    "text": "Settings"
  },
  "timeoutMs": 8000,
  "deviceId": "<device_serial>"
}
```

### `scroll_until`

Scroll in the given direction until a matching node appears, optionally clicking it afterward.

Parameters:

| Field | Required | Notes |
| --- | --- | --- |
| `selector` | yes | Target selector |
| `direction` | yes | Scroll direction: `"down"`, `"up"`, `"left"`, or `"right"` |
| `container` | no | Optional container selector |
| `clickAfter` | no | When `true`, the runtime uses action type `scroll_and_click` |
| `deviceId` | no | Explicit target device |
| `operatorPackage` | no | Explicit operator package |
| `timeoutMs` | no | Execution timeout. Defaults to `30000`. |

Example scroll only:

```json
{
  "selector": {
    "text": "About phone"
  },
  "direction": "down",
  "deviceId": "<device_serial>"
}
```

Example scroll then click:

```json
{
  "selector": {
    "text": "About phone"
  },
  "direction": "up",
  "clickAfter": true,
  "deviceId": "<device_serial>"
}
```

## Result And Error Behavior

Tool responses use normal MCP `tools/call` results:

- success responses serialize JSON in the text content and, for object payloads, also expose `structuredContent`
- execution failures return `isError: true`
- unknown exceptions are caught and returned as MCP tool errors instead of crashing the server

Common failure cases:

- `NO_DEVICES`: no usable Android target is connected
- `ADB_NOT_FOUND`: `adb` could not be resolved or executed
- `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`: more than one device is connected and no `deviceId` was supplied
- `EXECUTION_CONFLICT_IN_FLIGHT`: another execution-backed tool is already running on the same device and operator package
- `EXECUTION_VALIDATION_FAILED`: invalid MCP arguments or invalid action payload

For the full error-code catalog, see [Errors](errors.md).

## Device And Concurrency Caveats

Device targeting rules:

- if one device is connected, omitting `deviceId` is usually fine
- if multiple devices are connected, pass `deviceId`
- for local branch testing, prefer `com.clawperator.operator.dev`

Concurrency rules:

- `devices` is observational and does not use the execution lock
- execution-backed tools share the same in-flight protection as the CLI
- concurrent calls against the same device and operator package may return `EXECUTION_CONFLICT_IN_FLIGHT`
- this is expected behavior, not a transport bug

## Smoke-Test Flow

One reproducible terminal smoke path:

```bash
npm --prefix apps/node run build
node validation/test_mcp_stdio_smoke.mjs
```

What the smoke script proves:

1. it starts `node apps/node/dist/cli/index.js mcp serve`
2. it completes the MCP initialize handshake over stdio
3. it verifies `devices`
4. it opens Android Settings on a real device or emulator
5. it captures a snapshot and confirms the XML contains node elements
6. it performs a selector-driven read using text discovered from the live snapshot

The smoke script prefers a physical device when both a physical device and an emulator are connected. Override with `CLAWPERATOR_SMOKE_DEVICE=<device_serial>` if needed.
