import { readFile } from "node:fs/promises";
import { runExecution } from "../../domain/executions/runExecution.js";
import { validateExecution, validatePayloadSize } from "../../domain/executions/validateExecution.js";
import { LIMITS } from "../../contracts/limits.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdExecute(options: {
  format: OutputOptions["format"];
  execution: string; // JSON string or file path
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  validateOnly?: boolean;
  dryRun?: boolean;
  logger?: Logger;
}): Promise<string> {
  let payload: unknown;
  const raw = options.execution.trim();
  // Detect inline JSON vs file path: if it starts with '{' or '[', parse as JSON
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      payload = JSON.parse(raw);
    } catch {
      return formatError({ code: ERROR_CODES.EXECUTION_VALIDATION_FAILED, message: "Invalid JSON content" }, options);
    }
  } else {
    // Treat as file path: error precedence is unreadable file -> invalid JSON content
    let content: string;
    try {
      content = await readFile(raw, "utf-8");
    } catch (e) {
      return formatError(
        { code: ERROR_CODES.EXECUTION_VALIDATION_FAILED, message: `Failed to read execution file: ${(e as Error).message}` },
        options
      );
    }
    try {
      payload = JSON.parse(content);
    } catch (e) {
      return formatError(
        { code: ERROR_CODES.EXECUTION_VALIDATION_FAILED, message: `Invalid JSON content in execution file: ${(e as Error).message}` },
        options
      );
    }
  }

  try {
    if (options.dryRun) {
      let execution = validateExecution(payload);
      if (options.timeoutMs !== undefined) {
        if (!Number.isFinite(options.timeoutMs)) {
          return formatError(
            {
              code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
              message: "timeoutMs must be a finite number",
            },
            options
          );
        }
        if (options.timeoutMs < LIMITS.MIN_EXECUTION_TIMEOUT_MS || options.timeoutMs > LIMITS.MAX_EXECUTION_TIMEOUT_MS) {
          return formatError(
            {
              code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
              message: `timeoutMs must be between ${LIMITS.MIN_EXECUTION_TIMEOUT_MS} and ${LIMITS.MAX_EXECUTION_TIMEOUT_MS}`,
            },
            options
          );
        }
        execution = { ...execution, timeoutMs: options.timeoutMs };
      }
      validatePayloadSize(JSON.stringify(execution));
      const plan = {
        commandId: execution.commandId,
        timeoutMs: execution.timeoutMs,
        actionCount: execution.actions.length,
        actions: execution.actions.map(action => ({
          id: action.id,
          type: action.type,
          params: action.params,
        })),
      };
      return formatSuccess({ ok: true, dryRun: true, plan }, options);
    }

    if (options.validateOnly) {
      let execution = validateExecution(payload);
      if (options.timeoutMs !== undefined) {
        if (!Number.isFinite(options.timeoutMs)) {
          return formatError(
            {
              code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
              message: "timeoutMs must be a finite number",
            },
            options
          );
        }
        if (options.timeoutMs < LIMITS.MIN_EXECUTION_TIMEOUT_MS || options.timeoutMs > LIMITS.MAX_EXECUTION_TIMEOUT_MS) {
          return formatError(
            {
              code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
              message: `timeoutMs must be between ${LIMITS.MIN_EXECUTION_TIMEOUT_MS} and ${LIMITS.MAX_EXECUTION_TIMEOUT_MS}`,
            },
            options
          );
        }
        execution = { ...execution, timeoutMs: options.timeoutMs };
      }
      validatePayloadSize(JSON.stringify(execution));
      return formatSuccess({ ok: true, validated: true, execution }, options);
    }

    const result = await runExecution(payload, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      timeoutMs: options.timeoutMs,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok) {
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    }
    return formatError(result.error, options);
  } catch (e) {
    return formatError(e, options);
  }
}
