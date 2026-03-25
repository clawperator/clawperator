# Errors

## Purpose

Classify failures across CLI parsing, execution validation, device/runtime dispatch, and per-step action results.

## Error Classes

| Class | Where it appears | How to branch |
| --- | --- | --- |
| CLI usage errors | Top-level JSON object with `code`, such as `MISSING_ARGUMENT` or `UNKNOWN_COMMAND` | Fix the command shape before retrying |
| Execution validation errors | Top-level JSON object with `code = EXECUTION_VALIDATION_FAILED` | Fix payload or flags before any adb retry |
| Top-level runtime errors | Result envelope with `status = "failed"` and optional `errorCode` | Use `errorCode` first, then `hint`, then `error` |
| Per-step failures | Result envelope where one or more `stepResults[].success = false` | Inspect the failed step's `actionType` and `data.error` |

## Fast Triage

1. If the CLI returned a top-level `{ "code": ... }` object instead of an `envelope`, treat it as a host-side failure.
2. If `envelope.status = "failed"` and `stepResults` is empty, treat it as a dispatch / envelope / service failure.
3. If `envelope.status = "failed"` and a step has `success = false`, treat the first failed step as the actionable failure.
4. Prefer exact codes over messages.

## Error Codes

<!-- CODE-DERIVED: error-codes -->

## Recovery Patterns

| Error family | Recovery |
| --- | --- |
| Device targeting (`NO_DEVICES`, `DEVICE_NOT_FOUND`, `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`) | Re-run `clawperator devices`, choose one serial, and add `--device <serial>` |
| Operator install / package (`OPERATOR_NOT_INSTALLED`, `OPERATOR_VARIANT_MISMATCH`) | Run `clawperator operator setup --apk <path> ...` or switch `--operator-package` to the installed variant |
| Validation (`MISSING_ARGUMENT`, `MISSING_SELECTOR`, `EXECUTION_VALIDATION_FAILED`) | Change the command or payload. Do not retry unchanged |
| Envelope / service (`RESULT_ENVELOPE_TIMEOUT`, `RESULT_ENVELOPE_MALFORMED`, `DEVICE_ACCESSIBILITY_NOT_RUNNING`) | Re-run `clawperator doctor --json`, repair permissions, then retry |
| UI matching (`NODE_NOT_FOUND`, `NODE_NOT_CLICKABLE`, `CONTAINER_NOT_FOUND`) | Refresh state with `snapshot`, adjust selectors, or add a wait / scroll step |

## Key Cases

### `MISSING_SELECTOR`

- Emitted by selector-driven CLI commands such as `click`, `read`, `wait`, and `scroll-until`
- Means the command did not receive any valid selector flags
- Recovery: supply one selector form only, for example `--text`, `--id`, `--role`, `--selector`, or `--coordinate` for `click`

### `MISSING_ARGUMENT`

- Emitted when a required value is absent, for example `press` with no key or `wait-for-nav` with no `--timeout`
- Recovery: add the missing positional argument or flag value

### `UNKNOWN_COMMAND`

- Emitted by CLI command resolution, not by the execution runtime
- May include a `suggestion` field when the registry can map the input to a close command or a removed nested form
- Recovery: replace the command with the suggested flat form, for example use `snapshot` when the registry suggests the flat replacement

### `OPERATOR_NOT_INSTALLED`

- Means the requested package is not present on the device
- Recovery: run `clawperator operator setup --apk <path> [--device <serial>] [--operator-package <pkg>]`

### `OPERATOR_VARIANT_MISMATCH`

- Means the device has the other known Operator variant installed
- Recovery: either pass the installed package via `--operator-package` or reinstall the intended APK variant

## Related Pages

- [API Overview](overview.md)
- [Setup](../setup.md)
- [Devices](devices.md)
- [Doctor](doctor.md)
- [Operator App Troubleshooting](../troubleshooting/operator.md)
