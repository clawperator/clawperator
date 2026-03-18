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
  maxScrolls: z.number().optional(),
  maxDurationMs: z.number().optional(),
  noPositionChangeThreshold: z.number().optional(),
  findFirstScrollableChild: z.boolean().optional(),
  clickAfter: z.boolean().optional(),
  validator: z.string().optional(),
  validatorPattern: z.string().optional(),
  key: z.string().optional(),
  retry: z.record(z.unknown()).optional(),
  scrollRetry: z.record(z.unknown()).optional(),
  clickRetry: z.record(z.unknown()).optional(),
  // wait_for_navigation params
  expectedPackage: z.string().max(LIMITS.MAX_MATCHER_VALUE_LENGTH).optional(),
  expectedNode: nodeMatcherSchema.optional(),
  timeoutMs: z.number().optional(),
  // read_key_value_pair params
  labelMatcher: nodeMatcherSchema.optional(),
  // Transient flag for deprecated param tracking (not sent to Android)
  _usedDeprecatedTarget: z.boolean().optional(),
}).strict();

// NOTE: "doctor_ping" is intentionally excluded. It is an internal diagnostic action
// used only by `clawperator doctor`, which bypasses validateExecution and dispatches
// directly via broadcastAgentCommand. It is not part of the public agent-facing API.
const supportedTypes = [
  "open_app",
  "open_uri",
  "close_app",
  "wait_for_node",
  "click",
  "scroll_and_click",
  "scroll",
  "scroll_until",
  "read_text",
  "enter_text",
  "snapshot_ui",
  "take_screenshot",
  "sleep",
  "press_key",
  "wait_for_navigation",
  "read_key_value_pair",
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
      case "wait_for_node":
        if (!params?.matcher) {
          addIssue(index, `${action.type} requires params.matcher`, ["params", "matcher"]);
        }
        break;
      case "read_text":
        if (!params?.matcher) {
          addIssue(index, "read_text requires params.matcher", ["params", "matcher"]);
        }
        // regex validator requires validatorPattern
        if (params?.validator === "regex") {
          if (!params?.validatorPattern || params.validatorPattern.trim() === "") {
            addIssue(index, "read_text with validator='regex' requires params.validatorPattern", ["params", "validatorPattern"]);
          } else {
            // Validate that validatorPattern is a valid regex
            try {
              new RegExp(params.validatorPattern);
            } catch {
              addIssue(index, "read_text params.validatorPattern is not a valid regex pattern", ["params", "validatorPattern"]);
            }
          }
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
      case "scroll_and_click": {
        const hasMatcher = params?.matcher !== undefined;
        const hasTarget = params?.target !== undefined;
        if (hasMatcher && hasTarget) {
          addIssue(index, "scroll_and_click requires params.matcher or params.target, not both", ["params"]);
        } else if (!hasMatcher && !hasTarget) {
          addIssue(index, "scroll_and_click requires params.matcher", ["params", "matcher"]);
        }
        break;
      }
      case "scroll": {
        const SUPPORTED_DIRECTIONS = ["down", "up", "left", "right"] as const;
        if (params?.direction !== undefined) {
          const normalizedDir = params.direction.trim().toLowerCase();
          if (!(SUPPORTED_DIRECTIONS as readonly string[]).includes(normalizedDir)) {
            addIssue(
              index,
              `scroll params.direction must be one of: ${SUPPORTED_DIRECTIONS.join(", ")}`,
              ["params", "direction"]
            );
          }
        }
        if (params?.distanceRatio !== undefined) {
          if (params.distanceRatio < 0 || params.distanceRatio > 1) {
            addIssue(index, "scroll params.distanceRatio must be in [0.0, 1.0]", ["params", "distanceRatio"]);
          }
        }
        if (params?.settleDelayMs !== undefined) {
          if (params.settleDelayMs < 0 || params.settleDelayMs > 10000) {
            addIssue(index, "scroll params.settleDelayMs must be in [0, 10000]", ["params", "settleDelayMs"]);
          }
        }
        break;
      }
      case "scroll_until": {
        const hasMatcher = params?.matcher !== undefined;
        const hasTarget = params?.target !== undefined;
        if (params?.clickAfter === true && !hasMatcher && !hasTarget) {
          addIssue(index, "scroll_until params.clickAfter=true requires params.matcher", ["params", "matcher"]);
        }
        if (hasMatcher && hasTarget) {
          addIssue(index, "scroll_until requires params.matcher or params.target, not both", ["params"]);
        }
        const SUPPORTED_DIRECTIONS_SU = ["down", "up", "left", "right"] as const;
        if (params?.direction !== undefined) {
          const normalizedDir = params.direction.trim().toLowerCase();
          if (!(SUPPORTED_DIRECTIONS_SU as readonly string[]).includes(normalizedDir)) {
            addIssue(
              index,
              `scroll_until params.direction must be one of: ${SUPPORTED_DIRECTIONS_SU.join(", ")}`,
              ["params", "direction"]
            );
          }
        }
        if (params?.distanceRatio !== undefined) {
          if (params.distanceRatio < 0 || params.distanceRatio > 1) {
            addIssue(index, "scroll_until params.distanceRatio must be in [0.0, 1.0]", ["params", "distanceRatio"]);
          }
        }
        if (params?.settleDelayMs !== undefined) {
          if (params.settleDelayMs < 0 || params.settleDelayMs > 10000) {
            addIssue(index, "scroll_until params.settleDelayMs must be in [0, 10000]", ["params", "settleDelayMs"]);
          }
        }
        if (params?.maxScrolls !== undefined) {
          if (!Number.isInteger(params.maxScrolls) || params.maxScrolls < 1 || params.maxScrolls > 200) {
            addIssue(index, "scroll_until params.maxScrolls must be an integer in [1, 200]", ["params", "maxScrolls"]);
          }
        }
        if (params?.maxDurationMs !== undefined) {
          if (params.maxDurationMs < 0 || params.maxDurationMs > 120000) {
            addIssue(index, "scroll_until params.maxDurationMs must be in [0, 120000]", ["params", "maxDurationMs"]);
          }
        }
        if (params?.noPositionChangeThreshold !== undefined) {
          if (!Number.isInteger(params.noPositionChangeThreshold) || params.noPositionChangeThreshold < 1 || params.noPositionChangeThreshold > 20) {
            addIssue(index, "scroll_until params.noPositionChangeThreshold must be an integer in [1, 20]", ["params", "noPositionChangeThreshold"]);
          }
        }
        break;
      }
      case "press_key": {
        const SUPPORTED_KEYS = ["back", "home", "recents"] as const;
        const normalizedKey = params?.key?.trim().toLowerCase();
        if (!normalizedKey) {
          addIssue(index, "press_key requires params.key", ["params", "key"]);
        } else if (!(SUPPORTED_KEYS as readonly string[]).includes(normalizedKey)) {
          addIssue(
            index,
            `press_key params.key must be one of: ${SUPPORTED_KEYS.join(", ")}`,
            ["params", "key"]
          );
        }
        break;
      }
      case "take_screenshot":
        if (params?.path !== undefined && params.path.trim() === "") {
          addIssue(index, "take_screenshot params.path must be a non-empty string", ["params", "path"]);
        }
        break;
      case "wait_for_navigation": {
        const hasExpectedPackage = params?.expectedPackage !== undefined && params.expectedPackage.trim() !== "";
        const hasExpectedNode = params?.expectedNode !== undefined;
        if (!hasExpectedPackage && !hasExpectedNode) {
          addIssue(index, "wait_for_navigation requires at least one of params.expectedPackage or params.expectedNode", ["params"]);
        }
        if (typeof params?.timeoutMs !== "number" || params.timeoutMs <= 0) {
          addIssue(index, "wait_for_navigation requires params.timeoutMs > 0", ["params", "timeoutMs"]);
        } else if (params.timeoutMs > 30000) {
          addIssue(index, "wait_for_navigation params.timeoutMs must not exceed 30000", ["params", "timeoutMs"]);
        }
        break;
      }
      case "read_key_value_pair":
        if (!params?.labelMatcher) {
          addIssue(index, "read_key_value_pair requires params.labelMatcher", ["params", "labelMatcher"]);
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
 * Normalize scroll actions: copy matcher to target for Android compatibility,
 * and track when deprecated 'target' was used instead of canonical 'matcher'.
 */
function normalizeScrollActions(execution: Execution): Execution {
  const normalizedActions = execution.actions.map((action) => {
    if (action.type !== "scroll_and_click" && action.type !== "scroll_until") {
      return action;
    }

    const params = action.params;
    if (!params) return action;

    const hasMatcher = params.matcher !== undefined;
    const hasTarget = params.target !== undefined;

    // If matcher is present, copy it to target (canonical form for Android)
    if (hasMatcher && !hasTarget) {
      return {
        ...action,
        params: {
          ...params,
          target: params.matcher,
          // Not deprecated usage - using canonical matcher
          _usedDeprecatedTarget: false,
        },
      };
    }

    // If only target is present, mark as deprecated usage
    if (!hasMatcher && hasTarget) {
      return {
        ...action,
        params: {
          ...params,
          _usedDeprecatedTarget: true,
        },
      };
    }

    // Both present or neither - validation will catch this, but default to no flag
    return action;
  });

  return {
    ...execution,
    actions: normalizedActions,
  };
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
  const execution = parsed.data as Execution;
  return normalizeScrollActions(execution);
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
