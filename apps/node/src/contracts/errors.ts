/**
 * Structured error codes and shape for agent consumption.
 * Aligned with 0.1.0 Error Taxonomy in docs/node-api-design.md
 */
export const ERROR_CODES = {
  // Host
  HOST_DEPENDENCY_MISSING: "HOST_DEPENDENCY_MISSING",

  // Setup & Connectivity
  ADB_NOT_FOUND: "ADB_NOT_FOUND",
  NO_DEVICES: "NO_DEVICES",
  MULTIPLE_DEVICES_DEVICE_ID_REQUIRED: "MULTIPLE_DEVICES_DEVICE_ID_REQUIRED",
  RECEIVER_NOT_INSTALLED: "RECEIVER_NOT_INSTALLED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND", // Specific device ID provided but not connected

  // Execution & State
  EXECUTION_VALIDATION_FAILED: "EXECUTION_VALIDATION_FAILED",
  EXECUTION_ACTION_UNSUPPORTED: "EXECUTION_ACTION_UNSUPPORTED",
  EXECUTION_CONFLICT_IN_FLIGHT: "EXECUTION_CONFLICT_IN_FLIGHT",
  RESULT_ENVELOPE_TIMEOUT: "RESULT_ENVELOPE_TIMEOUT",
  RESULT_ENVELOPE_MALFORMED: "RESULT_ENVELOPE_MALFORMED",

  // UI & Nodes
  NODE_NOT_FOUND: "NODE_NOT_FOUND",
  NODE_NOT_CLICKABLE: "NODE_NOT_CLICKABLE",
  SECURITY_BLOCK_DETECTED: "SECURITY_BLOCK_DETECTED",

  // Doctor & Host
  NODE_TOO_OLD: "NODE_TOO_OLD",
  ADB_SERVER_FAILED: "ADB_SERVER_FAILED",
  ADB_NO_USB_PERMISSIONS: "ADB_NO_USB_PERMISSIONS",
  DEVICE_UNAUTHORIZED: "DEVICE_UNAUTHORIZED",
  DEVICE_OFFLINE: "DEVICE_OFFLINE",
  DEVICE_SHELL_UNAVAILABLE: "DEVICE_SHELL_UNAVAILABLE",
  RECEIVER_VARIANT_MISMATCH: "RECEIVER_VARIANT_MISMATCH",
  DEVICE_DEV_OPTIONS_DISABLED: "DEVICE_DEV_OPTIONS_DISABLED",
  DEVICE_USB_DEBUGGING_DISABLED: "DEVICE_USB_DEBUGGING_DISABLED",
  DEVICE_ACCESSIBILITY_NOT_RUNNING: "DEVICE_ACCESSIBILITY_NOT_RUNNING",
  ANDROID_BUILD_FAILED: "ANDROID_BUILD_FAILED",
  ANDROID_INSTALL_FAILED: "ANDROID_INSTALL_FAILED",
  ANDROID_APP_LAUNCH_FAILED: "ANDROID_APP_LAUNCH_FAILED",
  SMOKE_OPEN_SETTINGS_FAILED: "SMOKE_OPEN_SETTINGS_FAILED",
  SCRCPY_NOT_FOUND: "SCRCPY_NOT_FOUND",
  APK_VERSION_UNREADABLE: "APK_VERSION_UNREADABLE",
  APK_VERSION_INVALID: "APK_VERSION_INVALID",
  CLI_VERSION_INVALID: "CLI_VERSION_INVALID",
  VERSION_INCOMPATIBLE: "VERSION_INCOMPATIBLE",
  LOGCAT_UNAVAILABLE: "LOGCAT_UNAVAILABLE",
  ANDROID_SDK_TOOL_MISSING: "ANDROID_SDK_TOOL_MISSING",

  // Internal / Other
  BROADCAST_FAILED: "BROADCAST_FAILED",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  DOCTOR_FAILED: "DOCTOR_FAILED",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ClawperatorError {
  code: ErrorCode;
  message: string;
  hint?: string;
  details?: Record<string, unknown>;
  fallback_instructions_path?: string;
}

export interface TimeoutDiagnostics {
  code: typeof ERROR_CODES.RESULT_ENVELOPE_TIMEOUT;
  message: string;
  lastCorrelatedEvents?: string[];
  broadcastDispatchStatus?: string;
  deviceId?: string;
  receiverPackage?: string;
}

export interface BroadcastDiagnostics {
  code: typeof ERROR_CODES.BROADCAST_FAILED | typeof ERROR_CODES.RECEIVER_NOT_INSTALLED;
  message: string;
  lastCorrelatedEvents?: string[];
  broadcastDispatchStatus?: string;
  deviceId?: string;
  receiverPackage?: string;
}

export function isClawperatorError(e: unknown): e is ClawperatorError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as ClawperatorError).code === "string" &&
    "message" in e &&
    typeof (e as ClawperatorError).message === "string"
  );
}
