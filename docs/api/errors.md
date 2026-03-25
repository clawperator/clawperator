# Errors

## Purpose

Document the public error-code contract, show where failures appear in CLI output versus result envelopes, and give concrete recovery steps for the most common host, validation, and runtime failures.

## Sources

- Public error-code enum: `apps/node/src/contracts/errors.ts`
- Result envelope shape: `apps/node/src/contracts/result.ts`
- Execution validation: `apps/node/src/domain/executions/validateExecution.ts`
- CLI formatting: `apps/node/src/cli/output.ts`

## Two Failure Shapes

Clawperator surfaces failures in two main shapes.

### 1. Top-level CLI error object

This appears when Node fails before it can return an execution envelope, for example during argument parsing, payload validation, device selection, or host checks.

Example:

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "open_uri requires params.uri",
  "details": {
    "path": "actions.0.params.uri",
    "actionId": "open-1",
    "actionType": "open_uri"
  }
}
```

Success condition for recovery:

- you change the command or payload
- rerunning no longer returns a top-level `{ "code": ... }` object

### 2. Result envelope failure

This appears when Node successfully sends the command but the execution still fails at dispatch time or during one of the steps.

Per-step example:

```json
{
  "envelope": {
    "commandId": "read-1",
    "taskId": "read-1",
    "status": "failed",
    "error": "Step a1 (read_text) failed: NODE_NOT_FOUND",
    "stepResults": [
      {
        "id": "a1",
        "actionType": "read_text",
        "success": false,
        "data": {
          "error": "NODE_NOT_FOUND",
          "message": "No matching node found"
        }
      }
    ]
  },
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "isCanonicalTerminal": true
}
```

Envelope-level example with `errorCode`:

```json
{
  "envelope": {
    "commandId": "snapshot-1",
    "taskId": "snapshot-1",
    "status": "failed",
    "stepResults": [],
    "error": "Accessibility service is not available",
    "errorCode": "SERVICE_UNAVAILABLE",
    "hint": "Accessibility service not running. Run 'clawperator doctor --fix --device emulator-5554' to diagnose and repair, or 'clawperator operator setup --apk <path-to-apk> --device emulator-5554' to reinstall."
  },
  "deviceId": "emulator-5554",
  "terminalSource": "clawperator_result",
  "isCanonicalTerminal": true
}
```

Success condition for recovery:

- `envelope.status == "success"`
- every `stepResults[i].success == true`

## Public Error Codes

Only the codes defined in `apps/node/src/contracts/errors.ts` are part of the public error-code contract documented on this page.

<!-- CODE-DERIVED: error-codes -->

## Fast Triage

1. If the output is a top-level object with `code`, treat it as a Node-side failure before or outside the Android result envelope.
2. If `envelope.status == "failed"` and `stepResults` is empty, treat it as a dispatch, service, or envelope failure.
3. If `envelope.status == "failed"` and one step has `success == false`, branch on the first failed step's `data.error`.
4. Prefer exact codes over string-matching the human-readable `message` or `error`.

## What To Trust

Use these fields in order:

| Situation | Fields to inspect first |
| --- | --- |
| Top-level CLI error object | `code`, then `details`, then `message` |
| Envelope-level runtime failure | `envelope.errorCode`, then `envelope.hint`, then `envelope.error` |
| Per-step action failure | `stepResults[i].data.error`, then `stepResults[i].data.message` |

Notes:

- `errorCode` is optional on the envelope. Older APK behavior and some unclassified failures may leave it unset.
- envelope `errorCode` may contain Android-emitted values such as `SERVICE_UNAVAILABLE` that are not part of Node's public `errors.ts` enum
- per-step failures do not use the envelope `errorCode`; they usually expose the actionable code in `stepResults[i].data.error`
- `StepResult.data` values are strings, so treat `data.error` and `data.message` as string fields
- Node post-processing can turn some Android-internal failure markers into success results, for example normalizing `UNSUPPORTED_RUNTIME_CLOSE` into a successful `close_app` step when adb pre-flight already succeeded

## Recovery Patterns

| Family | Typical codes | What to do next |
| --- | --- | --- |
| Device targeting | `NO_DEVICES`, `DEVICE_NOT_FOUND`, `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | Run `clawperator devices`, pick one device, and retry with `--device <serial>` |
| Operator setup | `OPERATOR_NOT_INSTALLED`, `OPERATOR_VARIANT_MISMATCH`, `OPERATOR_INSTALL_FAILED`, `OPERATOR_GRANT_FAILED`, `OPERATOR_VERIFY_FAILED` | Install or repair the expected Operator APK, then rerun the command |
| Host tooling | `ADB_NOT_FOUND`, `ADB_SERVER_FAILED`, `HOST_DEPENDENCY_MISSING`, `ANDROID_SDK_TOOL_MISSING`, `SCRCPY_NOT_FOUND` | Repair the host environment before retrying |
| Payload or flag validation | `MISSING_ARGUMENT`, `EXECUTION_VALIDATION_FAILED`, `EXECUTION_ACTION_UNSUPPORTED`, `PAYLOAD_TOO_LARGE` | Change the command or payload. Do not retry unchanged |
| Dispatch or service availability | `RESULT_ENVELOPE_TIMEOUT`, `RESULT_ENVELOPE_MALFORMED`, `BROADCAST_FAILED`, `DEVICE_ACCESSIBILITY_NOT_RUNNING`, `DEVICE_SHELL_UNAVAILABLE` | Run `clawperator doctor --json`, repair the reported issue, then retry |
| UI lookup or gesture | `NODE_NOT_FOUND`, `NODE_NOT_CLICKABLE`, `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE`, `GESTURE_FAILED`, `SECURITY_BLOCK_DETECTED` | Refresh state with `snapshot`, wait for UI readiness, or adjust selectors and scroll strategy |
| Recording state | `RECORDING_ALREADY_IN_PROGRESS`, `RECORDING_NOT_IN_PROGRESS`, `RECORDING_SESSION_NOT_FOUND`, `RECORDING_PULL_FAILED`, `RECORDING_PARSE_FAILED`, `RECORDING_SCHEMA_VERSION_UNSUPPORTED` | Repair recording state or use the right session before retrying |

## Key Cases

### `EXECUTION_VALIDATION_FAILED`

Use this when the command or payload is structurally wrong before Android execution starts.

Common triggers:

- missing required action fields such as `open_uri.params.uri`
- invalid ranges such as `scroll_until.maxScrolls > 200`
- selector parser violations such as mixing `--selector` with shorthand flags
- invalid JSON payloads for `clawperator exec`

Typical output:

```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "scroll_until params.maxScrolls must be an integer in [1, 200]",
  "details": {
    "path": "actions.0.params.maxScrolls",
    "actionId": "scroll-1",
    "actionType": "scroll_until"
  }
}
```

Recovery:

- fix the payload
- rerun validation
- do not retry unchanged

### `MISSING_ARGUMENT`

Use this for CLI commands that are missing a required positional argument or required flag value.

Common triggers:

- `exec` without a payload
- `wait-for-nav` without `--timeout`
- `read-value` without any label selector flags

Example:

```json
{
  "code": "MISSING_ARGUMENT",
  "message": "wait-for-nav requires --timeout <ms>."
}
```

Recovery:

- add the missing argument or flag
- rerun the command

### `RESULT_ENVELOPE_TIMEOUT`

Use this when Node dispatched the command but did not receive a valid `[Clawperator-Result]` envelope before the execution timeout expired.

Typical fields:

```json
{
  "code": "RESULT_ENVELOPE_TIMEOUT",
  "message": "Timed out waiting for [Clawperator-Result]",
  "details": {
    "commandId": "snapshot-1",
    "taskId": "snapshot-1",
    "lastActionId": "a1",
    "lastActionType": "snapshot_ui",
    "lastActionCaveat": "payload-last only; Android execution position is unknown",
    "elapsedMs": 30000,
    "timeoutMs": 30000
  }
}
```

Recovery:

- run `clawperator doctor --json`
- confirm the accessibility service and operator package are healthy
- increase timeout only if the action legitimately needs more wall-clock time

### `OPERATOR_NOT_INSTALLED`

Use this when the requested operator package is not installed on the selected device.

Typical recovery:

```bash
clawperator operator setup --apk <path-to-apk> --device <device_serial> --operator-package <package_name>
```

If you are doing local branch validation, prefer the debug package:

- `com.clawperator.operator.dev`

### `OPERATOR_VARIANT_MISMATCH`

Use this when the device has an installed Operator APK, but it is the other known package variant than the one requested.

Recovery options:

- pass the installed package via `--operator-package`
- or reinstall the intended APK variant

### `NODE_NOT_FOUND`

This usually appears as a per-step failure in `stepResults[i].data.error`, not as the top-level CLI `code`.

Common triggers:

- the selector never matched
- the app navigated somewhere unexpected
- the UI had not settled before the action ran
- the target was inside a different scroll container

Recovery:

- run `snapshot` or `read --json` to inspect current UI state
- add `wait` or `sleep` before the failing action when appropriate
- tighten or loosen the selector based on what the snapshot actually shows
- add a container selector or a scroll step if the target is off-screen

### `DEVICE_ACCESSIBILITY_NOT_RUNNING`

This is a doctor- and readiness-related failure indicating the Operator accessibility service is not active.

Recovery:

- run `clawperator doctor --fix --device <serial>`
- if needed, reinstall the Operator package and re-enable accessibility access

## Legacy CLI Usage Objects

Some CLI handlers and tests still emit usage-style objects with string codes that are not part of `apps/node/src/contracts/errors.ts`. Treat those as command-line usage failures, not as public stable error codes.

What this means for agents:

- if the code is in `errors.ts`, you can branch on it as part of the public contract
- if the code is not in `errors.ts`, treat it as a CLI-specific usage object and prefer fixing the command shape rather than building long-term logic around that string
- similarly, Android may emit envelope `errorCode` values outside the Node enum; branch on them when present in the envelope, but do not confuse them with the documented Node-side top-level `code` contract

## Related Pages

- [API Overview](overview.md)
- [Actions](actions.md)
- [Selectors](selectors.md)
- [Setup](../setup.md)
- [Devices](devices.md)
- [Doctor](doctor.md)
- [Operator App Troubleshooting](../troubleshooting/operator.md)
