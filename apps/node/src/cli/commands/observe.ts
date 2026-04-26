import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildScreenshotExecution } from "../../domain/observe/screenshot.js";
import { runExecution } from "../../domain/executions/runExecution.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatRunExecutionResultForCli } from "../output.js";
import type { Logger } from "../../adapters/logger.js";
import { tryDaemonExecution } from "../daemonProxy.js";
import { validateExecution, validatePayloadSize } from "../../domain/executions/validateExecution.js";

export async function cmdObserveSnapshot(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  noDaemon?: boolean;
  logger?: Logger;
  tryDaemonExecutionFn?: typeof tryDaemonExecution;
  runExecutionFn?: typeof runExecution;
}): Promise<string> {
  try {
    const execution = validateExecution(buildSnapshotExecution({ timeoutMs: options.timeoutMs }));
    validatePayloadSize(JSON.stringify(execution));
    const tryDaemonExecutionFn = options.tryDaemonExecutionFn ?? tryDaemonExecution;
    const runExecutionFn = options.runExecutionFn ?? runExecution;
    const proxyResult = await tryDaemonExecutionFn(execution, {
      rawDeviceId: options.deviceId,
      operatorPackage: options.operatorPackage,
      noDaemon: options.noDaemon,
      allowPostDispatchFallback: true,
    });
    const result = proxyResult ?? await runExecutionFn(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      timeoutMs: options.timeoutMs,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    return formatRunExecutionResultForCli(result, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdObserveScreenshot(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  path?: string;
  noDaemon?: boolean;
  logger?: Logger;
  tryDaemonExecutionFn?: typeof tryDaemonExecution;
  runExecutionFn?: typeof runExecution;
}): Promise<string> {
  try {
    const execution = validateExecution(buildScreenshotExecution({
      timeoutMs: options.timeoutMs,
      path: options.path,
    }));
    validatePayloadSize(JSON.stringify(execution));
    const tryDaemonExecutionFn = options.tryDaemonExecutionFn ?? tryDaemonExecution;
    const runExecutionFn = options.runExecutionFn ?? runExecution;
    const proxyResult = await tryDaemonExecutionFn(execution, {
      rawDeviceId: options.deviceId,
      operatorPackage: options.operatorPackage,
      noDaemon: options.noDaemon,
      // Relative output paths already run direct; post-dispatch loss may have written a host file.
      allowPostDispatchFallback: false,
    });
    const result = proxyResult ?? await runExecutionFn(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      timeoutMs: options.timeoutMs,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    return formatRunExecutionResultForCli(result, options);
  } catch (e) {
    return formatError(e, options);
  }
}
