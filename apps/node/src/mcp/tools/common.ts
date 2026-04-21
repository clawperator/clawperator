import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { z, type ZodError, type ZodType } from "zod";
import type { NodeMatcher } from "../../contracts/selectors.js";
import type { Execution } from "../../contracts/execution.js";
import { LIMITS } from "../../contracts/limits.js";
import type { Logger } from "../../adapters/logger.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { runExecution } from "../../domain/executions/runExecution.js";
import { resolveOperatorPackageForRequest } from "../../domain/config/resolveOperatorPackage.js";
import { buildMcpErrorResult, buildMcpSuccessResult, type McpToolResult } from "../errors.js";
import { createMcpExecutionIds } from "../executionIds.js";
import type { McpSelectorInput } from "../selectors.js";
import type { SessionDefaults } from "../session.js";
import { mapSelectorToNodeMatcher } from "../selectors.js";

const nonEmptyOptionalStringSchema = z.string().trim().min(1, {
  message: "must be a non-empty string when provided",
});

export const executionToolOptionsSchema = z.object({
  deviceId: nonEmptyOptionalStringSchema.optional(),
  operatorPackage: nonEmptyOptionalStringSchema.optional(),
  timeoutMs: z.number().int().min(LIMITS.MIN_EXECUTION_TIMEOUT_MS).max(LIMITS.MAX_EXECUTION_TIMEOUT_MS).optional(),
}).strict();

export type ExecutionToolOptions = z.infer<typeof executionToolOptionsSchema>;

export function mergeWithSessionDefaults<T extends ExecutionToolOptions>(
  options: T,
  session: SessionDefaults,
): T {
  return {
    ...options,
    deviceId: options.deviceId ?? session.deviceId,
    operatorPackage: options.operatorPackage ?? session.operatorPackage,
    timeoutMs: options.timeoutMs ?? session.timeoutMs,
  };
}

export function parseToolArguments<T>(schema: ZodType<T>, args: Record<string, unknown>): T {
  const parsed = schema.safeParse(args);
  if (parsed.success) {
    return parsed.data;
  }

  throw buildMcpValidationError(parsed.error);
}

export function buildMcpValidationError(error: ZodError): McpError {
  const firstIssue = error.issues[0];
  const path = firstIssue ? firstIssue.path.join(".") : undefined;
  return new McpError(
    ErrorCode.InvalidParams,
    path ? `${firstIssue?.message ?? "Invalid MCP tool arguments"} (path: ${path})` : (firstIssue?.message ?? "Invalid MCP tool arguments"),
  );
}

export async function runExecutionTool(
  execution: Execution,
  options: ExecutionToolOptions,
  logger: Logger | undefined,
  onSuccess: (result: Awaited<ReturnType<typeof runExecution>> & { ok: true }) => McpToolResult | Promise<McpToolResult>,
): Promise<McpToolResult> {
  try {
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: resolveOperatorPackageForRequest(options.operatorPackage),
      warn: message => process.stderr.write(message),
      logger,
    });

    if (!result.ok) {
      return buildExecutionToolFailureResult(result.error);
    }

    if (result.envelope.status === "failed") {
      return buildMcpErrorResult({
        code: result.envelope.errorCode ?? "EXECUTION_FAILED",
        message: result.envelope.error ?? "Execution failed",
        envelope: result.envelope,
        deviceId: result.deviceId,
        terminalSource: result.terminalSource,
      });
    }

    return await onSuccess(result);
  } catch (error) {
    return buildMcpErrorResult(error);
  }
}

export function buildExecutionToolFailureResult(
  error: { code: string; message: string; [k: string]: unknown }
): McpToolResult {
  return buildMcpErrorResult(error);
}

export function applyMcpExecutionMetadata(
  execution: Omit<Execution, "commandId" | "taskId"> & Partial<Pick<Execution, "commandId" | "taskId">>,
  toolName: string,
  timeoutMs?: number,
): Execution {
  const ids = createMcpExecutionIds(toolName);
  return {
    ...execution,
    commandId: ids.commandId,
    taskId: ids.taskId,
    source: "mcp",
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  };
}

export function createRuntimeConfig() {
  return getDefaultRuntimeConfig({
    adbPath: process.env.ADB_PATH,
  });
}

export function buildExecutionSuccessPayload(result: Awaited<ReturnType<typeof runExecution>> & { ok: true }) {
  return {
    deviceId: result.deviceId,
    terminalSource: result.terminalSource,
    envelope: result.envelope,
  };
}

export function buildSuccessResult(payload: unknown): McpToolResult {
  return buildMcpSuccessResult(payload);
}

export function buildCommonExecutionSchema(properties: Record<string, unknown>, required: string[] = []): Record<string, unknown> {
  return {
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
      ...properties,
    },
    ...(required.length > 0 ? { required } : {}),
  };
}

export function buildValidationResult(message: string, path?: string): never {
  throw new McpError(
    ErrorCode.InvalidParams,
    path !== undefined ? `${message} (path: ${path})` : message,
  );
}

export function mapRequiredSelector(
  selector: McpSelectorInput,
  fieldName = "selector"
): NodeMatcher {
  try {
    return mapSelectorToNodeMatcher(selector, fieldName);
  } catch (error) {
    return buildValidationResult(error instanceof Error ? error.message : String(error), fieldName);
  }
}

export function mapOptionalSelector(
  selector: McpSelectorInput | undefined,
  fieldName = "selector"
): NodeMatcher | undefined {
  if (selector === undefined) {
    return undefined;
  }

  return mapRequiredSelector(selector, fieldName);
}
