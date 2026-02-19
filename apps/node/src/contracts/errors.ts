/**
 * Structured error codes and shape for agent consumption.
 */
export const ERROR_CODES = {
  EXECUTION_CONFLICT_IN_FLIGHT: "EXECUTION_CONFLICT_IN_FLIGHT",
  RESULT_ENVELOPE_TIMEOUT: "RESULT_ENVELOPE_TIMEOUT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  DEVICE_AMBIGUOUS: "DEVICE_AMBIGUOUS",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  ADB_UNAVAILABLE: "ADB_UNAVAILABLE",
  RECEIVER_PACKAGE_NOT_INSTALLED: "RECEIVER_PACKAGE_NOT_INSTALLED",
  COMMAND_INGRESS_DISABLED: "COMMAND_INGRESS_DISABLED",
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
  code: typeof ERROR_CODES.BROADCAST_FAILED;
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
