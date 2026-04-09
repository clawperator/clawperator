import { z } from "zod";
import type { Logger } from "../../adapters/logger.js";
import type { ExecutionAction } from "../../contracts/execution.js";
import { normalizeExecutionInput } from "../../contracts/inputAliases.js";
import { listDevices } from "../../domain/devices/listDevices.js";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildMcpErrorResult } from "../errors.js";
import { extractStepDataValue } from "../results.js";
import type { McpToolDefinition } from "./index.js";
import {
  applyMcpExecutionMetadata,
  buildCommonExecutionSchema,
  buildValidationResult,
  buildExecutionSuccessPayload,
  buildSuccessResult,
  createRuntimeConfig,
  executionToolOptionsSchema,
  parseToolArguments,
  runExecutionTool,
} from "./common.js";

const emptyArgsSchema = z.object({}).strict();

const snapshotArgsSchema = executionToolOptionsSchema;

const executionActionSchema = z.object({
  id: z.string().trim().min(1),
  type: z.string().trim().min(1),
  params: z.record(z.unknown()).optional(),
}).strict();

const executeArgsSchema = executionToolOptionsSchema.extend({
  actions: z.array(executionActionSchema).min(1, { message: "actions is required" }),
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

export function getCoreMcpTools(logger?: Logger): McpToolDefinition[] {
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
      inputSchema: buildCommonExecutionSchema({}),
      handler: async (args) => {
        const parsed = parseToolArguments(snapshotArgsSchema, args);

        const execution = applyMcpExecutionMetadata(
          buildSnapshotExecution({ timeoutMs: parsed.timeoutMs }),
          "snapshot",
          parsed.timeoutMs,
        );

        return await runExecutionTool(execution, parsed, logger, (result) => {
          const extracted = extractStepDataValue(result.envelope, {
            actionType: "snapshot_ui",
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

          return buildSuccessResult({
            ...buildExecutionSuccessPayload(result),
            snapshot: extracted.value,
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

        if (parsed.actions.some((action) => hasCallerControlledScreenshotPath(action))) {
          return buildValidationResult("execute does not allow caller-controlled take_screenshot paths over MCP", "actions");
        }

        const execution = {
          source: "mcp",
          expectedFormat: "android-ui-automator" as const,
          timeoutMs: parsed.timeoutMs ?? 30_000,
          actions: parsed.actions as ExecutionAction[],
        };
        const stampedExecution = applyMcpExecutionMetadata(execution, "execute", parsed.timeoutMs ?? 30_000);

        return await runExecutionTool(stampedExecution, parsed, logger, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
  ];
}
