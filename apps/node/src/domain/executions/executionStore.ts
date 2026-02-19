import { ERROR_CODES } from "../../contracts/errors.js";

const inFlightByDevice = new Map<string, string>(); // deviceId -> commandId

/**
 * Try to claim single-flight slot for (deviceId, commandId).
 * Returns true if claimed; false if another execution is in flight (caller should throw EXECUTION_CONFLICT_IN_FLIGHT).
 */
export function tryAcquire(deviceId: string, commandId: string): boolean {
  const current = inFlightByDevice.get(deviceId);
  if (current !== undefined && current !== commandId) {
    return false;
  }
  inFlightByDevice.set(deviceId, commandId);
  return true;
}

export function release(deviceId: string, commandId: string): void {
  if (inFlightByDevice.get(deviceId) === commandId) {
    inFlightByDevice.delete(deviceId);
  }
}

export function getConflictError(deviceId: string, commandId: string): { code: string; message: string; details?: object } {
  return {
    code: ERROR_CODES.EXECUTION_CONFLICT_IN_FLIGHT,
    message: "Another execution is in flight on this device",
    details: { deviceId, commandId },
  };
}
