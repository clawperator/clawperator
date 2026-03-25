# Recording Format

## Purpose

Document the current recording workflow, the raw NDJSON schema written by the Operator app, and the parsed step-log format produced by `clawperator record parse`.

## Sources

- Raw event schema: `apps/node/src/domain/recording/recordingEventTypes.ts`
- Parser behavior: `apps/node/src/domain/recording/parseRecording.ts`
- Pull behavior: `apps/node/src/domain/recording/pullRecording.ts`
- CLI commands: `apps/node/src/cli/commands/record.ts`, `apps/node/src/cli/registry.ts`
- Public error codes: `apps/node/src/contracts/errors.ts`

## Recording Lifecycle

The current flow is:

1. `clawperator record start [--session-id <id>]`
2. interact with the device
3. `clawperator record stop [--session-id <id>]`
4. `clawperator record pull [--session-id <id>] [--out <dir>]`
5. `clawperator record parse --input <file> [--out <file>]`

Notes:

- `record` is a top-level alias for `recording`
- `pull` defaults to `./recordings/` when `--out` is omitted
- `parse` writes `<input>.steps.json` when `--out` is omitted

## CLI Commands

### Start

```bash
clawperator record start [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
```

Current builder payload:

```json
{
  "commandId": "start_recording_1700000000000",
  "taskId": "cli-record-start",
  "source": "clawperator-cli",
  "timeoutMs": 10000,
  "expectedFormat": "android-ui-automator",
  "actions": [
    {
      "id": "a1",
      "type": "start_recording",
      "params": {
        "sessionId": "optional-session-id"
      }
    }
  ]
}
```

### Stop

```bash
clawperator record stop [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
```

Current builder payload:

```json
{
  "commandId": "stop_recording_1700000000000",
  "taskId": "cli-record-stop",
  "source": "clawperator-cli",
  "timeoutMs": 15000,
  "expectedFormat": "android-ui-automator",
  "actions": [
    {
      "id": "a1",
      "type": "stop_recording",
      "params": {
        "sessionId": "optional-session-id"
      }
    }
  ]
}
```

### Pull

```bash
clawperator record pull [--session-id <id>] [--out <dir>] [--device <serial>] [--operator-package <pkg>]
```

Successful response shape:

```json
{
  "ok": true,
  "localPath": "./recordings/demo-session.ndjson",
  "sessionId": "demo-session"
}
```

### Parse

```bash
clawperator record parse --input <file> [--out <file>]
```

Successful response shape:

```json
{
  "ok": true,
  "outputFile": "./recordings/demo-session.steps.json",
  "stepCount": 2,
  "warnings": [
    "seq 3: scroll event dropped (not extracted in v1)"
  ]
}
```

## NDJSON Format

A recording file is newline-delimited JSON with:

1. one header line
2. zero or more event lines

The first non-empty line must be a `recording_header`.

### Header Line

Current header schema:

| Field | Type | Meaning |
| --- | --- | --- |
| `type` | `"recording_header"` | fixed discriminator |
| `schemaVersion` | `number` | current parser supports only `1` |
| `sessionId` | `string` | recording id |
| `startedAt` | `number` | epoch milliseconds |
| `operatorPackage` | `string` | Operator package that produced the recording |

Example:

```json
{"type":"recording_header","schemaVersion":1,"sessionId":"demo-session","startedAt":1710000000000,"operatorPackage":"com.clawperator.operator.dev"}
```

### Event Types

Current raw event union:

- `window_change`
- `click`
- `scroll`
- `press_key`
- `text_change`

Every event must include:

- `ts`
- `seq`
- `type`

### `window_change`

| Field | Type |
| --- | --- |
| `ts` | `number` |
| `seq` | `number` |
| `type` | `"window_change"` |
| `packageName` | `string` |
| `className` | `string \| null` |
| `title` | `string \| null` |
| `snapshot` | `string \| null \| undefined` |

Example:

```json
{"ts":1710000000000,"seq":0,"type":"window_change","packageName":"com.android.settings","className":"com.android.settings.Settings","title":"Settings","snapshot":"<hierarchy .../>"}
```

### `click`

| Field | Type |
| --- | --- |
| `ts` | `number` |
| `seq` | `number` |
| `type` | `"click"` |
| `packageName` | `string` |
| `resourceId` | `string \| null` |
| `text` | `string \| null` |
| `contentDesc` | `string \| null` |
| `bounds.left` | `number` |
| `bounds.top` | `number` |
| `bounds.right` | `number` |
| `bounds.bottom` | `number` |
| `snapshot` | `string \| null \| undefined` |

Example:

```json
{"ts":1710000000800,"seq":1,"type":"click","packageName":"com.android.settings","resourceId":"android:id/title","text":"Connected devices","contentDesc":null,"bounds":{"left":216,"top":1503,"right":661,"bottom":1573},"snapshot":"<hierarchy .../>"}
```

### `scroll`

| Field | Type |
| --- | --- |
| `ts` | `number` |
| `seq` | `number` |
| `type` | `"scroll"` |
| `packageName` | `string` |
| `resourceId` | `string \| null` |
| `scrollX` | `number` |
| `scrollY` | `number` |
| `maxScrollX` | `number` |
| `maxScrollY` | `number` |
| `snapshot` | `string \| null \| undefined` |

### `press_key`

| Field | Type |
| --- | --- |
| `ts` | `number` |
| `seq` | `number` |
| `type` | `"press_key"` |
| `key` | `"back"` |
| `snapshot` | `string \| null \| undefined` |

Important:

- the current schema only allows `key: "back"`

### `text_change`

| Field | Type |
| --- | --- |
| `ts` | `number` |
| `seq` | `number` |
| `type` | `"text_change"` |
| `packageName` | `string` |
| `resourceId` | `string \| null` |
| `text` | `string` |
| `snapshot` | `string \| null \| undefined` |

## Parse Output Shape

`record parse` does not replay the whole NDJSON one-to-one. It normalizes it into a smaller step log:

```json
{
  "sessionId": "demo-session",
  "schemaVersion": 1,
  "steps": [
    {
      "seq": 0,
      "type": "open_app",
      "packageName": "com.android.settings",
      "uiStateBefore": "<hierarchy .../>"
    },
    {
      "seq": 1,
      "type": "click",
      "packageName": "com.android.settings",
      "resourceId": "android:id/title",
      "text": "Connected devices",
      "contentDesc": null,
      "bounds": {
        "left": 216,
        "top": 1503,
        "right": 661,
        "bottom": 1573
      },
      "uiStateBefore": "<hierarchy .../>"
    }
  ],
  "_warnings": [
    "seq 3: scroll event dropped (not extracted in v1)"
  ]
}
```

Current parsed step types:

- `open_app`
- `click`

Current normalization rules in `parseRecording.ts`:

- the first `window_change` becomes one `open_app` step
- every `click` becomes one `click` step
- `scroll` events are dropped and produce warnings
- `text_change` events are dropped silently
- `press_key` events are dropped silently, but they do affect subsequent `window_change` handling

## Parser Warnings

The parser currently emits warnings for:

- `window_change` or `click` events missing `snapshot`
- dropped `scroll` events

Warnings are written into `_warnings` in the parsed step log and also surfaced by `record parse` in its success wrapper when present.

## Pull Semantics

`pullRecording()` determines the session id like this:

1. use `--session-id` if provided
2. otherwise read `/sdcard/Android/data/<operatorPackage>/files/recordings/latest`

Session ids are accepted only if they match:

```text
^[a-zA-Z0-9_-]+$
```

The pulled file path is:

```text
/sdcard/Android/data/<operatorPackage>/files/recordings/<sessionId>.ndjson
```

## Error Codes

Only document codes that exist in `apps/node/src/contracts/errors.ts`.

| Code | When it happens |
| --- | --- |
| `RECORDING_ALREADY_IN_PROGRESS` | runtime rejected `record start` because a session is already active |
| `RECORDING_NOT_IN_PROGRESS` | runtime rejected `record stop` because no session is active |
| `RECORDING_SESSION_NOT_FOUND` | `record pull` could not resolve a session id or the provided id was invalid |
| `RECORDING_PULL_FAILED` | adb pull failed |
| `RECORDING_PARSE_FAILED` | malformed file, invalid header, bad event fields, bad NDJSON, or unknown event type |
| `RECORDING_SCHEMA_VERSION_UNSUPPORTED` | header schema version was not `1` |

## Common Failure Modes

### `RECORDING_SESSION_NOT_FOUND`

Typical causes:

- no `latest` file on device
- invalid `--session-id` characters
- trying to pull before a recording was started

### `RECORDING_PARSE_FAILED`

Typical causes:

- empty file
- missing header
- malformed JSON on any line
- event object missing required fields
- unsupported event `type`

### `RECORDING_SCHEMA_VERSION_UNSUPPORTED`

The parser is strict:

- only `schemaVersion: 1` is accepted

Agents should branch on this code and stop rather than trying to guess how to parse a newer schema.

## What Agents Should Rely On

- raw recording files are NDJSON, header first
- `record parse` currently extracts only `open_app` and `click` steps
- warnings are significant because they explain dropped or degraded data
- use parsed output as a deterministic summary, not as a promise that every raw event was preserved

## Related Pages

- [API Overview](overview.md)
- [Errors](errors.md)
- [Serve API](serve.md)
- [Skills Authoring](../skills/authoring.md)
