import { z, type ZodError, type ZodType } from "zod";
import type { Execution } from "../../contracts/execution.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { runExecution } from "../../domain/executions/runExecution.js";
import { resolveOperatorPackageForRequest } from "../../domain/config/resolveOperatorPackage.js";
import { buildMcpErrorResult, buildMcpSuccessResult, type McpToolResult } from "../errors.js";

export const executionToolOptionsSchema = z.object({
  deviceId: z.string().optional(),
  operatorPackage: z.string().refine(
    value => value.trim().length > 0,
    { message: "operatorPackage must be a non-empty string when provided" }
  ).optional(),
  timeoutMs: z.number().int().optional(),
}).strict();

export type ExecutionToolOptions = z.infer<typeof executionToolOptionsSchema>;

export function parseToolArguments<T>(schema: ZodType<T>, args: Record<string, unknown>): T | McpToolResult {
  const parsed = schema.safeParse(args);
  if (parsed.success) {
    return parsed.data;
  }

  return buildMcpValidationError(parsed.error);
}

export function buildMcpValidationError(error: ZodError): McpToolResult {
  const firstIssue = error.issues[0];
  return buildMcpErrorResult({
    code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
    message: firstIssue?.message ?? "Invalid MCP tool arguments",
    details: firstIssue ? { path: firstIssue.path.join(".") } : undefined,
  });
}

export async function runExecutionTool(
  execution: Execution,
  options: ExecutionToolOptions,
  onSuccess: (result: Awaited<ReturnType<typeof runExecution>> & { ok: true }) => McpToolResult | Promise<McpToolResult>,
): Promise<McpToolResult> {
  try {
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: resolveOperatorPackageForRequest(options.operatorPackage),
      timeoutMs: options.timeoutMs,
      warn: message => process.stderr.write(message),
    });

    if (!result.ok) {
      return buildMcpErrorResult(result.error);
    }

    return await onSuccess(result);
  } catch (error) {
    return buildMcpErrorResult(error);
  }
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
