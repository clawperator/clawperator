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
| `OPERATOR_NOT_INSTALLED` | The Clawperator Operator APK is not installed on the device |
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
| `SNAPSHOT_EXTRACTION_FAILED` | UI hierarchy extraction from device logs failed |

---

## UI and Nodes

| Code | Description |
|------|-------------|
| `NODE_NOT_FOUND` | No UI node matched the provided `NodeMatcher` |
| `NODE_NOT_CLICKABLE` | The matched node is not interactable |
| `SECURITY_BLOCK_DETECTED` | A security overlay or lock screen blocked the action |
| `CONTAINER_NOT_FOUND` | `scroll` or `scroll_until` could not locate a scrollable container. Either no scrollable node is present on screen, or the provided `container` matcher matched nothing. |
| `CONTAINER_NOT_SCROLLABLE` | `scroll` or `scroll_until` found the matched container but it is not scrollable, and `findFirstScrollableChild` is false (or no scrollable descendant was found). |
| `GESTURE_FAILED` | `scroll` step: the OS rejected the gesture dispatch. The accessibility service was running but Android declined to execute the swipe gesture. Step returns `success: false`. |

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
| `APK_VERSION_UNREADABLE` | The installed APK version could not be read from `adb shell dumpsys package` |
| `APK_VERSION_INVALID` | The installed APK version string is not parseable for compatibility checks |
| `CLI_VERSION_INVALID` | The CLI version string is not parseable for compatibility checks |
| `VERSION_INCOMPATIBLE` | Node API and Android runtime versions are incompatible |
| `LOGCAT_UNAVAILABLE` | Could not access device logcat |
| `ANDROID_SDK_TOOL_MISSING` | A required Android SDK tool such as `adb`, `emulator`, `sdkmanager`, or `avdmanager` is not available |
| `EMULATOR_NOT_FOUND` | The requested AVD does not exist |
| `EMULATOR_ALREADY_RUNNING` | The requested operation requires the AVD to be stopped first |
| `EMULATOR_NOT_RUNNING` | The requested AVD is not currently running |
| `EMULATOR_UNSUPPORTED` | The AVD exists but does not satisfy Clawperator compatibility rules |
| `EMULATOR_CREATE_FAILED` | Reserved generic emulator creation failure code |
| `EMULATOR_START_FAILED` | Emulator process did not register with adb in time |
| `EMULATOR_STOP_FAILED` | Emulator stop request failed |
| `EMULATOR_DELETE_FAILED` | Emulator deletion failed |
| `EMULATOR_BOOT_TIMEOUT` | Android boot completion did not finish before timeout |
| `ANDROID_SYSTEM_IMAGE_INSTALL_FAILED` | Android SDK system image install or license acceptance failed |
| `ANDROID_AVD_CREATE_FAILED` | `avdmanager` failed to create the AVD |

---

## Operator setup

These codes are produced by `clawperator operator setup` (or the `operator install` alias).

| Code | Description |
|------|-------------|
| `OPERATOR_APK_NOT_FOUND` | Local APK file not found |
| `OPERATOR_INSTALL_FAILED` | `adb install` returned a non-zero exit code |
| `OPERATOR_GRANT_FAILED` | One or more required device permission grants failed |
| `OPERATOR_VERIFY_FAILED` | Operator package not visible to package manager after install |

---

## CLI Validation

These codes are returned by the flat CLI commands when required arguments are missing.

| Code | Description |
|------|-------------|
| `MISSING_SELECTOR` | `click`, `type`, `read`, or `wait` was called without `--selector` |
| `MISSING_ARGUMENT` | A required positional argument was omitted (`open`, `type`, `press`, or `scroll`) |

---

## Internal / Other

| Code | Description |
|------|-------------|
| `BROADCAST_FAILED` | ADB broadcast to the receiver package failed |
| `PAYLOAD_TOO_LARGE` | Execution payload exceeds the 64,000 byte limit |
| `DOCTOR_FAILED` | Doctor check runner encountered an unexpected error |

---

## Skills

These codes are produced by the skills CLI commands (`skills list`, `skills get`, `skills search`, `skills run`, `skills compile-artifact`, `skills install`, `skills update`, `skills sync`) and may also be returned by the HTTP skills endpoints when running in serve mode.

| Code | Description |
|------|-------------|
| `SKILL_NOT_FOUND` | No skill with the given ID exists in the registry |
| `ARTIFACT_NOT_FOUND` | The named artifact does not exist for the skill |
| `COMPILE_VARS_REQUIRED` | Reserved; not currently emitted |
| `COMPILE_VAR_MISSING` | A required placeholder variable was not provided |
| `COMPILE_VARS_PARSE_FAILED` | The `--vars` JSON string could not be parsed |
| `COMPILE_VALIDATION_FAILED` | Compiled artifact failed execution schema validation |
| `REGISTRY_READ_FAILED` | Could not read or parse the skills registry file |
| `SKILL_SCRIPT_NOT_FOUND` | The skill's script file does not exist on disk |
| `SKILL_EXECUTION_FAILED` | The skill script exited with a non-zero code |
| `SKILL_EXECUTION_TIMEOUT` | The skill script exceeded the execution timeout |
| `SKILLS_SYNC_FAILED` | Git clone or pull of the skills repository failed |
| `SKILLS_GIT_NOT_FOUND` | `git` is not installed or not on PATH |

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
  operatorPackage?: string;
}
```

### BroadcastDiagnostics

Returned when `BROADCAST_FAILED` or `OPERATOR_NOT_INSTALLED` occurs.

```ts
{
  code: "BROADCAST_FAILED" | "OPERATOR_NOT_INSTALLED";
  message: string;
  lastCorrelatedEvents?: string[];
  broadcastDispatchStatus?: string;
  deviceId?: string;
  operatorPackage?: string;
}
```

---

## Doctor Check Result

`clawperator doctor` returns a `DoctorReport`:

```ts
{
  ok: boolean;
  deviceId?: string;
  operatorPackage?: string;
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
