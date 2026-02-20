import { readFile } from "node:fs/promises";
import { runExecution } from "../../domain/executions/runExecution.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import { ERROR_CODES } from "../../contracts/errors.js";

export async function cmdExecute(options: {
  format: OutputOptions["format"];
  execution: string; // JSON string or file path
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  let payload: unknown;
  const raw = options.execution.trim();
  if (raw.startsWith("{")) {
    try {
      payload = JSON.parse(raw);
    } catch {
      return formatError({ code: ERROR_CODES.EXECUTION_VALIDATION_FAILED, message: "Invalid JSON for --execution" }, options);
    }
  } else {
    try {
      const content = await readFile(raw, "utf-8");
      payload = JSON.parse(content);
    } catch (e) {
      return formatError(
        { code: ERROR_CODES.EXECUTION_VALIDATION_FAILED, message: `Failed to read or parse execution file: ${(e as Error).message}` },
        options
      );
    }
  }

  try {
    const result = await runExecution(payload, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
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
