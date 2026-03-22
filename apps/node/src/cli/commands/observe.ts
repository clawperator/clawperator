import { observeSnapshot } from "../../domain/observe/snapshot.js";
import { observeScreenshot } from "../../domain/observe/screenshot.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdObserveSnapshot(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
  timeoutMs?: number;
  logger?: Logger;
}): Promise<string> {
  try {
    const result = await observeSnapshot({
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
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

export async function cmdObserveScreenshot(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
  timeoutMs?: number;
  path?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const result = await observeScreenshot({
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      timeoutMs: options.timeoutMs,
      path: options.path,
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
