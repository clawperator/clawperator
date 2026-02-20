import { EventEmitter } from "node:events";
import type { ResultEnvelope } from "../../contracts/result.js";

/**
 * Global event emitter for Clawperator envelopes.
 * Used by the 'serve' command to stream SSE events.
 */
export const clawperatorEvents = new EventEmitter();
clawperatorEvents.setMaxListeners(0); // unlimited for SSE clients

export const CLAW_EVENT_TYPES = {
  RESULT: "clawperator:result", // specific canonical terminal envelope (legacy/v0.1)
  EXECUTION: "clawperator:execution", // full outcome of any runExecution call (success or failure)
  EVENT: "clawperator:event", // placeholder for future real-time events
} as const;

export function emitResult(deviceId: string, envelope: ResultEnvelope): void {
  clawperatorEvents.emit(CLAW_EVENT_TYPES.RESULT, { deviceId, envelope });
}

export function emitExecution(deviceId: string, input: any, result: any): void {
  clawperatorEvents.emit(CLAW_EVENT_TYPES.EXECUTION, { deviceId, input, result });
}
