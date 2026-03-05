# Error Codes

All errors returned by the Node API use a structured `ClawperatorError` shape:

```ts
{
  code: ErrorCode;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  fallback_instructions_path?: string;
}
```

The `code` field is always one of the string constants listed below.

---

## Host

| Code | Description |
|------|-------------|
| `HOST_DEPENDENCY_MISSING` | A required host-side tool or dependency is missing |

---

## Setup and Connectivity

| Code | Description |
|------|-------------|
| `ADB_NOT_FOUND` | `adb` binary not found on the host |
| `NO_DEVICES` | No Android devices are connected |
| `MULTIPLE_DEVICES_DEVICE_ID_REQUIRED` | Multiple devices connected but no `--device-id` specified |
| `RECEIVER_NOT_INSTALLED` | The Clawperator Operator APK is not installed on the device |
| `DEVICE_NOT_FOUND` | The specified `--device-id` is not among connected devices |

---

## Execution and State

| Code | Description |
|------|-------------|
| `EXECUTION_VALIDATION_FAILED` | The execution payload failed schema validation |
| `EXECUTION_ACTION_UNSUPPORTED` | One or more action types in the payload are not supported |
| `EXECUTION_CONFLICT_IN_FLIGHT` | Another execution is already running on this device |
| `RESULT_ENVELOPE_TIMEOUT` | The device did not emit a `[Clawperator-Result]` envelope within the timeout |
| `RESULT_ENVELOPE_MALFORMED` | The result envelope emitted by the device could not be parsed |

---

## UI and Nodes

| Code | Description |
|------|-------------|
| `NODE_NOT_FOUND` | No UI node matched the provided `NodeMatcher` |
| `NODE_NOT_CLICKABLE` | The matched node is not interactable |
| `SECURITY_BLOCK_DETECTED` | A security overlay or lock screen blocked the action |

---

## Doctor and Host Checks

These codes are produced by `clawperator doctor` and related checks.

| Code | Description |
|------|-------------|
| `NODE_TOO_OLD` | Node.js version is below the required minimum |
| `ADB_SERVER_FAILED` | The ADB server failed to start |
| `ADB_NO_USB_PERMISSIONS` | The host lacks USB permissions to communicate with the device |
| `DEVICE_UNAUTHORIZED` | Device is connected but has not authorized this host for ADB |
| `DEVICE_OFFLINE` | Device is listed by ADB but is offline |
| `DEVICE_SHELL_UNAVAILABLE` | ADB shell is not available on the device |
| `RECEIVER_VARIANT_MISMATCH` | The installed APK variant (debug/release) does not match the expected variant |
| `DEVICE_DEV_OPTIONS_DISABLED` | Developer options are not enabled on the device |
| `DEVICE_USB_DEBUGGING_DISABLED` | USB debugging is not enabled on the device |
| `DEVICE_ACCESSIBILITY_NOT_RUNNING` | The Clawperator accessibility service is not running |
| `ANDROID_BUILD_FAILED` | The Android APK build step failed |
| `ANDROID_INSTALL_FAILED` | APK installation on the device failed |
| `ANDROID_APP_LAUNCH_FAILED` | The app failed to launch after install |
| `SMOKE_OPEN_SETTINGS_FAILED` | Smoke test: opening device Settings failed |
| `SCRCPY_NOT_FOUND` | `scrcpy` binary not found (optional dependency) |
| `VERSION_INCOMPATIBLE` | Node API and Android runtime versions are incompatible |
| `LOGCAT_UNAVAILABLE` | Could not access device logcat |

---

## Internal / Other

| Code | Description |
|------|-------------|
| `BROADCAST_FAILED` | ADB broadcast to the receiver package failed |
| `PAYLOAD_TOO_LARGE` | Execution payload exceeds the 64,000 byte limit |
| `DOCTOR_FAILED` | Doctor check runner encountered an unexpected error |

---

## Diagnostic Types

Some errors include additional fields for deeper diagnosis.

### TimeoutDiagnostics

Returned when `RESULT_ENVELOPE_TIMEOUT` occurs.

```ts
{
  code: "RESULT_ENVELOPE_TIMEOUT";
  message: string;
  lastCorrelatedEvents?: string[];    // last logcat lines correlated to this command
  broadcastDispatchStatus?: string;   // result of the ADB broadcast call
  deviceId?: string;
  receiverPackage?: string;
}
```

### BroadcastDiagnostics

Returned when `BROADCAST_FAILED` or `RECEIVER_NOT_INSTALLED` occurs.

```ts
{
  code: "BROADCAST_FAILED" | "RECEIVER_NOT_INSTALLED";
  message: string;
  lastCorrelatedEvents?: string[];
  broadcastDispatchStatus?: string;
  deviceId?: string;
  receiverPackage?: string;
}
```

---

## Doctor Check Result

`clawperator doctor` returns a `DoctorReport`:

```ts
{
  ok: boolean;
  deviceId?: string;
  receiverPackage?: string;
  checks: DoctorCheckResult[];
  nextActions?: string[];
}
```

Each check in `checks`:

```ts
{
  id: string;          // e.g. "host.adb.present"
  status: "pass" | "warn" | "fail";
  code?: string;       // one of the error codes above
  summary: string;
  detail?: string;
  fix?: {
    title: string;
    platform: "mac" | "linux" | "win" | "any";
    steps: Array<{ kind: "shell" | "manual"; value: string }>;
  };
  deviceGuidance?: {
    screen: string;
    steps: string[];
  };
  evidence?: Record<string, unknown>;
}
```
