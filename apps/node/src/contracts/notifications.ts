import { z } from "zod";
import type { ExecutionAction } from "./execution.js";

export const notificationMediaActions = [
  "list_notifications", "list_media_sessions", "get_media_status", "media_pause", "media_play",
] as const;
export type NotificationMediaAction = typeof notificationMediaActions[number];
const observationActions = new Set<string>(notificationMediaActions.slice(0, 3));
export function isBackgroundObservation(actions: readonly ExecutionAction[]): boolean {
  return actions.length > 0 && actions.every(action => observationActions.has(action.type));
}
const target = {
  applicationId: z.string().min(1).max(512).refine(value => value.trim().length > 0).optional(),
  mediaSessionId: z.string().min(1).max(128).refine(value => value.trim().length > 0).optional(),
};
const listing = z.object({
  applicationId: target.applicationId,
  limit: z.number().int().min(1).max(100).optional(),
  maxTextChars: z.number().int().min(1).max(1024).optional(),
}).strict();
const selected = z.object(target).strict().refine(
  value => (value.applicationId !== undefined) !== (value.mediaSessionId !== undefined),
  "Provide exactly one of applicationId or mediaSessionId; discover sessions with media list.",
);
const control = z.object({ ...target, waitTimeoutMs: z.number().int().min(0).max(30000).optional() }).strict().refine(
  value => (value.applicationId !== undefined) !== (value.mediaSessionId !== undefined),
  "Provide exactly one of applicationId or mediaSessionId; discover sessions with media list.",
);
export function notificationMediaParamsSchema(type: string): z.ZodTypeAny | undefined {
  if (type === "list_notifications" || type === "list_media_sessions") return listing.optional();
  if (type === "get_media_status") return selected;
  if (type === "media_pause" || type === "media_play") return control;
  return undefined;
}
