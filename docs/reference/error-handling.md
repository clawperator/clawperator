# Error Handling Guide

This page is the agent-oriented companion to the structured
[Error Codes](error-codes.md) reference.

Use it when you need to decide:

- whether a failure is top-level or step-level
- whether retrying is reasonable
- what the next recovery action should be

## First classify the failure surface

Always check failures in this order:

1. `error.code` for Node CLI or API failures
2. `envelope.errorCode` for Android-side top-level execution failures
3. `stepResults[n].data.error` for per-step runtime failures

That ordering matters because the same execution can:

- fail before any step runs
- complete overall but still contain failed steps

## Fast triage model

| Failure class | Typical examples | Agent response |
| :--- | :--- | :--- |
| Targeting / environment | `NO_DEVICES`, `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`, `DEVICE_UNAUTHORIZED`, `RECEIVER_NOT_INSTALLED` | Fix environment first. Do not blindly retry the same execution. |
| Payload / contract | `EXECUTION_VALIDATION_FAILED` | Fix the payload shape. Retrying unchanged is wasted work. |
| Concurrency / timing | `EXECUTION_CONFLICT_IN_FLIGHT`, `RESULT_ENVELOPE_TIMEOUT`, `SNAPSHOT_EXTRACTION_FAILED` | Retry only after a short wait or after reducing contention. |
| UI state / selector | `NODE_NOT_FOUND`, `CONTAINER_NOT_FOUND`, `CONTAINER_NOT_SCROLLABLE` | Re-observe the UI, then adjust selectors or navigation. |
| Runtime refusal | `GESTURE_FAILED`, `GLOBAL_ACTION_FAILED`, `SECURITY_BLOCK_DETECTED` | Inspect current state, then choose a different action or recovery path. |

## Recommended agent responses

### `NO_DEVICES`

Meaning:
- No connected Android device is currently reachable in adb `device` state.

Usually recoverable:
- yes, but only after the environment changes

Recommended next action:
- check `clawperator devices --output json`
- reconnect USB or start the emulator
- do not retry the same execution until a device appears

### `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`

Meaning:
- More than one reachable Android target is connected and the command did not
  specify `--device-id`.

Usually recoverable:
- yes

Recommended next action:
- run `clawperator devices --output json`
- choose one serial
- rerun the same command with `--device-id <device_id>`

### `DEVICE_UNAUTHORIZED`

Meaning:
- adb can see the device, but Android has not authorized the host.

Usually recoverable:
- yes

Recommended next action:
- unlock the device
- accept the USB debugging prompt
- rerun `clawperator doctor --device-id <device_id> --output json`

### `RECEIVER_NOT_INSTALLED`

Meaning:
- the targeted Clawperator Operator APK package is not installed on the device

Usually recoverable:
- yes

Recommended next action:
- run `clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id <device_id>`
- if using a local debug APK, also pass `--receiver-package com.clawperator.operator.dev`

### `EXECUTION_VALIDATION_FAILED`

Meaning:
- the execution payload failed schema validation before dispatch

Usually recoverable:
- yes, after fixing the payload

Recommended next action:
- inspect the reported path and message
- correct required fields such as `taskId`, `source`, `expectedFormat`, or
  action params
- do not retry unchanged payloads

### `EXECUTION_CONFLICT_IN_FLIGHT`

Meaning:
- another execution is still running on the same device

Usually recoverable:
- yes

Recommended next action:
- wait briefly
- avoid parallel retries on the same device
- serialize the work queue per target device

### `RESULT_ENVELOPE_TIMEOUT`

Meaning:
- the command was dispatched, but the Node layer did not receive a terminal
  envelope before the timeout budget expired

Usually recoverable:
- sometimes

Recommended next action:
- inspect whether the device is mid-transition or overloaded
- retry with a larger `timeoutMs` only if the workflow genuinely needs it
- if repeated, run `clawperator doctor --device-id <device_id> --output json`

### `SNAPSHOT_EXTRACTION_FAILED`

Meaning:
- the Android step completed, but the Node layer failed to attach snapshot XML

Usually recoverable:
- often

Recommended next action:
- retry the snapshot once or twice after a short delay
- if repeated, check CLI and APK compatibility with
  `clawperator version --check-compat`
- then run `clawperator doctor`

### `NODE_NOT_FOUND`

Meaning:
- the selector did not match any current UI node

Usually recoverable:
- often

Recommended next action:
- capture a fresh `snapshot_ui`
- confirm the current screen really matches the agent's assumption
- prefer `resourceId` selectors when available

### `CONTAINER_NOT_FOUND`

Meaning:
- the requested or auto-detected scroll container could not be resolved

Usually recoverable:
- often

Recommended next action:
- snapshot the screen
- identify the actual scrollable node and pass it explicitly as `container`
- do not keep retrying the same auto-detect path on nested layouts

### `CONTAINER_NOT_SCROLLABLE`

Meaning:
- the matched container exists but is not scrollable, and no suitable
  scrollable child was found

Usually recoverable:
- often

Recommended next action:
- inspect the snapshot again
- choose the real list or scroll view node instead
- on complex layouts, rely on explicit `resourceId` rather than heuristic
  auto-detection

### `GESTURE_FAILED`

Meaning:
- Android declined to execute the swipe gesture

Usually recoverable:
- sometimes

Recommended next action:
- re-observe before retrying
- if a popup or transition is present, resolve that first
- if the same gesture fails repeatedly, choose another navigation tactic

### `GLOBAL_ACTION_FAILED`

Meaning:
- Android declined the requested global accessibility action such as `back` or
  `home`

Usually recoverable:
- sometimes

Recommended next action:
- verify the accessibility service is still running with `clawperator doctor`
- inspect current UI state before issuing another global action

### `SECURITY_BLOCK_DETECTED`

Meaning:
- Android blocked the requested action because of a system security boundary

Usually recoverable:
- sometimes, but not always within the same workflow

Recommended next action:
- do not spam retries
- inspect the current screen and choose a different path
- if the action is blocked by design, escalate that limitation to the user or
  outer agent

## Retry guidance

Safe to retry after a short delay:

- `EXECUTION_CONFLICT_IN_FLIGHT`
- `SNAPSHOT_EXTRACTION_FAILED`
- some `RESULT_ENVELOPE_TIMEOUT` cases

Usually wrong to retry unchanged:

- `EXECUTION_VALIDATION_FAILED`
- `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED`
- `RECEIVER_NOT_INSTALLED`
- `NODE_NOT_FOUND` when the agent has not re-observed the UI

## Recommended recovery loop

For most UI failures:

1. capture a fresh snapshot
2. classify whether the problem is environment, payload, or UI state
3. change one thing
4. retry once with intent

For the full structured code list, use [Error Codes](error-codes.md).
