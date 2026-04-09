import { z } from "zod";
import type { ExecutionAction } from "../../contracts/execution.js";
import { listDevices } from "../../domain/devices/listDevices.js";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { createMcpExecutionIds } from "../executionIds.js";
import { buildMcpErrorResult } from "../errors.js";
import { extractStepDataValue } from "../results.js";
import type { McpToolDefinition } from "./index.js";
import {
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
  id: z.string(),
  type: z.string(),
  params: z.record(z.unknown()).optional(),
}).strict();

const executeArgsSchema = executionToolOptionsSchema.extend({
  actions: z.array(executionActionSchema).min(1, { message: "actions is required" }),
}).strict();

export function getCoreMcpTools(): McpToolDefinition[] {
  return [
    {
      name: "devices",
      description: "List connected Android devices visible to adb.",
      inputSchema: { type: "object" },
      handler: async (args) => {
        const parsed = parseToolArguments(emptyArgsSchema, args);
        if ("content" in parsed) {
          return parsed;
        }

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
      inputSchema: {
        type: "object",
        properties: {
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
        },
      },
      handler: async (args) => {
        const parsed = parseToolArguments(snapshotArgsSchema, args);
        if ("content" in parsed) {
          return parsed;
        }

        const ids = createMcpExecutionIds("snapshot");
        const execution = {
          ...buildSnapshotExecution({ timeoutMs: parsed.timeoutMs }),
          commandId: ids.commandId,
          taskId: ids.taskId,
          source: "mcp",
        };

        return await runExecutionTool(execution, parsed, (result) => {
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
      inputSchema: {
        type: "object",
        properties: {
          deviceId: { type: "string" },
          operatorPackage: { type: "string" },
          timeoutMs: { type: "integer" },
          actions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                type: { type: "string" },
                params: { type: "object" },
              },
              required: ["id", "type"],
            },
          },
        },
        required: ["actions"],
      },
      handler: async (args) => {
        const parsed = parseToolArguments(executeArgsSchema, args);
        if ("content" in parsed) {
          return parsed;
        }

        const ids = createMcpExecutionIds("execute");
        const execution = {
          commandId: ids.commandId,
          taskId: ids.taskId,
          source: "mcp",
          expectedFormat: "android-ui-automator" as const,
          timeoutMs: parsed.timeoutMs ?? 30_000,
          actions: parsed.actions as ExecutionAction[],
        };

        return await runExecutionTool(execution, parsed, (result) => {
          return buildSuccessResult(buildExecutionSuccessPayload(result));
        });
      },
    },
  ];
}
