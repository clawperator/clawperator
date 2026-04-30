import { z } from "zod";
import type { Logger } from "../../adapters/logger.js";
import type { ExecutionAction } from "../../contracts/execution.js";
import { normalizeExecutionInput } from "../../contracts/inputAliases.js";
import { LIMITS } from "../../contracts/limits.js";
import type { ResultEnvelope, StepResult } from "../../contracts/result.js";
import { listDevices } from "../../domain/devices/listDevices.js";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildMcpErrorResult } from "../errors.js";
import { extractStepDataValue } from "../results.js";
import { createSessionDefaults, type SessionDefaults } from "../session.js";
import type { McpToolDefinition } from "./index.js";
import {
  applyMcpExecutionMetadata,
  buildCommonExecutionSchema,
  buildValidationResult,
  buildExecutionSuccessPayload,
  buildSuccessResult,
  createRuntimeConfig,
  executionToolOptionsSchema,
  mergeWithSessionDefaults,
  parseToolArguments,
  runExecutionTool,
} from "./common.js";

const emptyArgsSchema = z.object({}).strict();

const snapshotArgsSchema = executionToolOptionsSchema.extend({
  maxChars: z.number().int().positive().optional(),
}).strict();

const executionActionSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  params: z.record(z.unknown()).optional(),
}).strict();

const executeArgsSchema = executionToolOptionsSchema.extend({
  actions: z.array(executionActionSchema).min(1, { message: "actions is required" }),
}).strict();

const configureArgsSchema = z.object({
  deviceId: z.string().trim().min(1).optional(),
  operatorPackage: z.string().trim().min(1).optional(),
  timeoutMs: z.number().int().min(LIMITS.MIN_EXECUTION_TIMEOUT_MS).max(LIMITS.MAX_EXECUTION_TIMEOUT_MS).optional(),
}).strict();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasCallerControlledScreenshotPath(action: z.infer<typeof executionActionSchema>): boolean {
  const normalized = normalizeExecutionInput({ actions: [action] }) as { actions?: unknown };
  const normalizedAction = Array.isArray(normalized.actions) ? normalized.actions[0] : undefined;
  if (!isRecord(normalizedAction)) {
    return false;
  }
  if (normalizedAction.type !== "take_screenshot") {
    return false;
  }
  return isRecord(normalizedAction.params) && Object.prototype.hasOwnProperty.call(normalizedAction.params, "path");
}

export interface SnapshotMaxCharsResult {
  snapshot: string;
  truncated?: true;
}

export function applySnapshotMaxChars(
  snapshot: string,
  maxChars: number | undefined,
): SnapshotMaxCharsResult {
  if (maxChars === undefined || snapshot.length <= maxChars) {
    return { snapshot };
  }

  return { snapshot: snapshot.slice(0, maxChars), truncated: true };
}

export interface SnapshotEnvelopeResult extends SnapshotMaxCharsResult {
  envelope: ResultEnvelope;
}

export function applySnapshotMaxCharsToEnvelope(
  envelope: ResultEnvelope,
  snapshotStep: StepResult,
  snapshot: string,
  maxChars: number | undefined,
): SnapshotEnvelopeResult {
  const truncatedSnapshot = applySnapshotMaxChars(snapshot, maxChars);
  if (!truncatedSnapshot.truncated) {
    return {
      ...truncatedSnapshot,
      envelope,
    };
  }

  return {
    ...truncatedSnapshot,
    envelope: {
      ...envelope,
      stepResults: envelope.stepResults.map((step) => {
        if (step !== snapshotStep) {
          return step;
        }
        return {
          ...step,
          data: {
            ...step.data,
            text: truncatedSnapshot.snapshot,
          },
        };
      }),
    },
  };
}

function buildSessionStatePayload(session: SessionDefaults): { session: SessionDefaults } {
  const current: SessionDefaults = {};
  if (session.deviceId !== undefined) {
    current.deviceId = session.deviceId;
  }
  if (session.operatorPackage !== undefined) {
    current.operatorPackage = session.operatorPackage;
  }
  if (session.timeoutMs !== undefined) {
    current.timeoutMs = session.timeoutMs;
  }

  return { session: current };
}

export function getCoreMcpTools(
  logger?: Logger,
  session: SessionDefaults = createSessionDefaults(),
): McpToolDefinition[] {
  return [
    {
      name: "devices",
      description: "List connected Android devices visible to adb.",
      inputSchema: { type: "object", additionalProperties: false },
      handler: async (args) => {
        parseToolArguments(emptyArgsSchema, args);

        try {
          const devices = await listDevices(createRuntimeConfig());
          return buildSuccessResult({ devices });
        } catch (error) {
          return buildMcpErrorResult(error);
        }
      },
    },
    {
      name: "snapshot",
      description: "Capture the current Android UI hierarchy as XML.",
      inputSchema: buildCommonExecutionSchema({
        maxChars: { type: "integer", minimum: 1 },
      }),
      handler: async (args) => {
        const parsed = parseToolArguments(snapshotArgsSchema, args);
        const opts = mergeWithSessionDefaults(parsed, session);

        const execution = applyMcpExecutionMetadata(
          buildSnapshotExecution({ timeoutMs: opts.timeoutMs }),
          "snapshot",
          opts.timeoutMs,
        );

        return await runExecutionTool(execution, opts, logger, (result) => {
          const extracted = extractStepDataValue(result.envelope, {
            actionType: "snapshot",
            dataKey: "text",
            errorKey: "error",
          });

          if (!extracted.ok) {
            return buildMcpErrorResult({
              code: extracted.error,
              message: extracted.message,
              envelope: result.envelope,
              deviceId: result.deviceId,
              terminalSource: result.terminalSource,
            });
          }

          const { snapshot, truncated, envelope } = applySnapshotMaxCharsToEnvelope(
            result.envelope,
            extracted.step,
            extracted.value,
            parsed.maxChars,
          );
          return buildSuccessResult({
            ...buildExecutionSuccessPayload({
              ...result,
              envelope,
            }),
            snapshot,
            ...(truncated ? { truncated } : {}),
          });
        });
      },
    },
    {
      name: "execute",
      description: "Run a validated Clawperator execution payload over the canonical execution engine.",
      inputSchema: buildCommonExecutionSchema({
        actions: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", minLength: 1, pattern: "\\S" },
              type: { type: "string", minLength: 1, pattern: "\\S" },
              params: { type: "object" },
            },
            required: ["id", "type"],
          },
        },
      }, ["actions"]),
      handler: async (args) => {
        const parsed = parseToolArguments(executeArgsSchema, args);
        const opts = mergeWithSessionDefaults(parsed, session);

        if (parsed.actions.some((action) => hasCallerControlledScreenshotPath(action))) {
          return buildValidationResult("execute does not allow caller-controlled take_screenshot paths over MCP", "actions");
        }

        const execution = {
          source: "mcp",
          expectedFormat: "android-ui-automator" as const,
          timeoutMs: opts.timeoutMs ?? 30_000,
          actions: parsed.actions as ExecutionAction[],
        };
        const stampedExecution = applyMcpExecutionMetadata(execution, "execute", opts.timeoutMs ?? 30_000);

        return await runExecutionTool(stampedExecution, opts, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
    {
      name: "configure",
      description: "Store per-session defaults for deviceId, operatorPackage, and timeoutMs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          deviceId: { type: "string", minLength: 1, pattern: "\\S" },
          operatorPackage: { type: "string", minLength: 1, pattern: "\\S" },
          timeoutMs: {
            type: "integer",
            minimum: LIMITS.MIN_EXECUTION_TIMEOUT_MS,
            maximum: LIMITS.MAX_EXECUTION_TIMEOUT_MS,
          },
        },
      },
      handler: (args) => {
        const parsed = parseToolArguments(configureArgsSchema, args);

        if (parsed.deviceId !== undefined) {
          session.deviceId = parsed.deviceId;
        }
        if (parsed.operatorPackage !== undefined) {
          session.operatorPackage = parsed.operatorPackage;
        }
        if (parsed.timeoutMs !== undefined) {
          session.timeoutMs = parsed.timeoutMs;
        }

        return buildSuccessResult(buildSessionStatePayload(session));
      },
    },
  ];
}
