import { z } from "zod";
import { LIMITS } from "../../contracts/limits.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { getCanonicalActionType } from "../../contracts/aliases.js";
import type { Execution } from "../../contracts/execution.js";

const nodeMatcherSchema = z
  .object({
    resourceId: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
    role: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
    textEquals: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
    textContains: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
    contentDescEquals: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
    contentDescContains: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
  })
  .strict()
  .refine(
    (m) =>
      (m.resourceId ?? "") !== "" ||
      (m.role ?? "") !== "" ||
      (m.textEquals ?? "") !== "" ||
      (m.textContains ?? "") !== "" ||
      (m.contentDescEquals ?? "") !== "" ||
      (m.contentDescContains ?? "") !== "",
    { message: "Matcher must have at least one field" }
  );

const actionParamsSchema = z.object({
  applicationId: z.string().optional(),
  uri: z.string().max(LIMITS.MAX_URI_LENGTH).optional(),
  durationMs: z.number().optional(),
  path: z.string().optional(),
  matcher: nodeMatcherSchema.optional(),
  text: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
  submit: z.boolean().optional(),
  clear: z.boolean().optional(),
  clickType: z.string().optional(),
  target: nodeMatcherSchema.optional(),
  container: nodeMatcherSchema.optional(),
  direction: z.string().optional(),
  maxSwipes: z.number().optional(),
  distanceRatio: z.number().optional(),
  settleDelayMs: z.number().optional(),
  findFirstScrollableChild: z.boolean().optional(),
  validator: z.string().optional(),
  retry: z.record(z.unknown()).optional(),
  scrollRetry: z.record(z.unknown()).optional(),
  clickRetry: z.record(z.unknown()).optional(),
}).strict();

const supportedTypes = [
  "open_app",
  "open_uri",
  "close_app",
  "wait_for_node",
  "click",
  "scroll_and_click",
  "read_text",
  "enter_text",
  "snapshot_ui",
  "take_screenshot",
  "sleep",
] as const;

const actionSchema = z.object({
  id: z.string().min(1).max(LIMITS.MAX_ID_LENGTH),
  type: z.string().max(64).transform((s) => getCanonicalActionType(s)),
  params: actionParamsSchema.optional(),
}).strict();

const executionSchema = z.object({
  commandId: z.string().min(1).max(LIMITS.MAX_ID_LENGTH),
  taskId: z.string().min(1).max(LIMITS.MAX_ID_LENGTH),
  source: z.string().min(1).max(LIMITS.MAX_SOURCE_LENGTH),
  expectedFormat: z.literal("android-ui-automator"),
  timeoutMs: z
    .number()
    .min(LIMITS.MIN_EXECUTION_TIMEOUT_MS)
    .max(LIMITS.MAX_EXECUTION_TIMEOUT_MS),
  actions: z
    .array(actionSchema)
    .min(1)
    .max(LIMITS.MAX_EXECUTION_ACTIONS)
    .refine(
      (actions) => {
        const types = actions.map((a) => a.type);
        return types.every((t) =>
          (supportedTypes as readonly string[]).includes(t)
        );
      },
      {
        message: "All action types must be supported",
        params: { code: ERROR_CODES.EXECUTION_ACTION_UNSUPPORTED },
      }
    ),
  mode: z.enum(["artifact_compiled", "direct"]).optional(),
}).strict().superRefine((execution, ctx) => {
  const addIssue = (index: number, message: string, path: string[]) => {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: ["actions", index, ...path],
    });
  };

  execution.actions.forEach((action, index) => {
    const params = action.params;
    switch (action.type) {
      case "open_app":
      case "close_app":
        if (!params?.applicationId || params.applicationId.trim() === "") {
          addIssue(index, `${action.type} requires params.applicationId`, ["params", "applicationId"]);
        }
        break;
      case "open_uri":
        if (!params?.uri || params.uri.trim() === "") {
          addIssue(index, "open_uri requires params.uri", ["params", "uri"]);
        }
        break;
      case "sleep":
        if (typeof params?.durationMs !== "number" || params.durationMs < 0) {
          addIssue(index, "sleep requires params.durationMs >= 0", ["params", "durationMs"]);
        } else if (params.durationMs > LIMITS.MAX_EXECUTION_TIMEOUT_MS) {
          addIssue(
            index,
            `sleep.durationMs must not exceed ${LIMITS.MAX_EXECUTION_TIMEOUT_MS} ms`,
            ["params", "durationMs"]
          );
        }
        break;
      case "click":
      case "read_text":
      case "wait_for_node":
        if (!params?.matcher) {
          addIssue(index, `${action.type} requires params.matcher`, ["params", "matcher"]);
        }
        break;
      case "enter_text":
        if (!params?.matcher) {
          addIssue(index, "enter_text requires params.matcher", ["params", "matcher"]);
        }
        if (typeof params?.text !== "string" || params.text.length === 0) {
          addIssue(index, "enter_text requires non-empty params.text", ["params", "text"]);
        }
        break;
      case "scroll_and_click":
        if (!params?.target) {
          addIssue(index, "scroll_and_click requires params.target", ["params", "target"]);
        }
        break;
      default:
        break;
    }
  });
});

export interface ValidationFailure {
  code: typeof ERROR_CODES.EXECUTION_VALIDATION_FAILED;
  message: string;
  details?: { path?: string; reason?: string };
}

/**
 * Validate execution payload. Returns normalized execution or throws ValidationFailure.
 * Call before any adb invocation.
 */
export function validateExecution(input: unknown): Execution {
  const parsed = executionSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.errors[0];
    const err: ValidationFailure = {
      code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
      message: first?.message ?? "Invalid execution payload",
      details: {
        path: first?.path.join("."),
        reason: parsed.error.message,
      },
    };
    throw err;
  }
  return parsed.data as Execution;
}

/**
 * Validate payload size (bytes) before parsing.
 */
export function validatePayloadSize(payload: string): void {
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > LIMITS.MAX_PAYLOAD_BYTES) {
    throw {
      code: ERROR_CODES.PAYLOAD_TOO_LARGE,
      message: `Payload exceeds ${LIMITS.MAX_PAYLOAD_BYTES} bytes (got ${bytes})`,
    };
  }
}
