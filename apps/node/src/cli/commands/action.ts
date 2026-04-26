import { runExecution } from "../../domain/executions/runExecution.js";
import { buildClickExecution } from "../../domain/actions/click.js";
import { buildReadExecution } from "../../domain/actions/read.js";
import { buildWaitExecution } from "../../domain/actions/wait.js";
import { buildTypeTextExecution } from "../../domain/actions/typeText.js";
import { buildOpenAppExecution } from "../../domain/actions/openApp.js";
import { buildOpenUriExecution } from "../../domain/actions/openUri.js";
import { buildPressKeyExecution } from "../../domain/actions/pressKey.js";
import { buildScrollExecution } from "../../domain/actions/scroll.js";
import { buildScrollUntilExecution } from "../../domain/actions/scrollUntil.js";
import { buildCloseAppExecution } from "../../domain/actions/closeApp.js";
import { buildSleepExecution } from "../../domain/actions/sleep.js";
import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatRunExecutionResultForCli } from "../output.js";
import type { Logger } from "../../adapters/logger.js";
import { tryDaemonExecution } from "../daemonProxy.js";

interface ActionCommandOptions {
  format: OutputOptions["format"];
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
  tryDaemonExecutionFn?: typeof tryDaemonExecution;
  runExecutionFn?: typeof runExecution;
}

async function runActionExecution(execution: Execution, options: ActionCommandOptions): Promise<string> {
  const tryDaemonExecutionFn = options.tryDaemonExecutionFn ?? tryDaemonExecution;
  const runExecutionFn = options.runExecutionFn ?? runExecution;
  const proxyResult = options.noDaemon === true
    ? null
    : await tryDaemonExecutionFn(execution, {
      rawDeviceId: options.deviceId,
      operatorPackage: options.operatorPackage,
      noDaemon: options.noDaemon,
      allowPostDispatchFallback: false,
    });
  const result = proxyResult ?? await runExecutionFn(execution, {
    deviceId: options.deviceId,
    operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
    warn: message => process.stderr.write(message),
    logger: options.logger,
  });
  return formatRunExecutionResultForCli(result, options);
}

export async function cmdActionOpenApp(options: {
  format: OutputOptions["format"];
  applicationId: string;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
  tryDaemonExecutionFn?: typeof tryDaemonExecution;
  runExecutionFn?: typeof runExecution;
}): Promise<string> {
  try {
    const execution = buildOpenAppExecution(options.applicationId);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdSleep(options: {
  format: OutputOptions["format"];
  durationMs: number;
  globalTimeoutMs?: number;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildSleepExecution(options.durationMs, options.globalTimeoutMs);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdCloseApp(options: {
  format: OutputOptions["format"];
  applicationId: string;
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildCloseAppExecution(options.applicationId, options.timeoutMs);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionClick(options: {
  format: OutputOptions["format"];
  matcher?: NodeMatcher;
  coordinate?: { x: number; y: number };
  clickType?: "default" | "long_click" | "focus";
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
  tryDaemonExecutionFn?: typeof tryDaemonExecution;
  runExecutionFn?: typeof runExecution;
}): Promise<string> {
  try {
    const execution = buildClickExecution(options.matcher, options.clickType, options.coordinate);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionRead(options: {
  format: OutputOptions["format"];
  matcher: NodeMatcher;
  readAll?: boolean;
  container?: NodeMatcher;
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  validateOnly?: boolean;
  dryRun?: boolean;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildReadExecution(options.matcher, options.readAll, options.container);
    if (options.validateOnly || options.dryRun) {
      // Reuse exec's contract-only paths so read validation never dispatches to a device.
      return (await import("./execute.js")).cmdExecute({
        format: options.format,
        execution: JSON.stringify(execution),
        deviceId: options.deviceId,
        operatorPackage: options.operatorPackage,
        timeoutMs: options.timeoutMs,
        validateOnly: options.validateOnly,
        dryRun: options.dryRun,
        noDaemon: options.noDaemon,
        logger: options.logger,
      });
    }
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionWait(options: {
  format: OutputOptions["format"];
  matcher: NodeMatcher;
  waitTimeoutMs?: number;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildWaitExecution(options.matcher, options.waitTimeoutMs);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionType(options: {
  format: OutputOptions["format"];
  matcher: NodeMatcher;
  text: string;
  submit?: boolean;
  clear?: boolean;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildTypeTextExecution({
      selector: options.matcher,
      text: options.text,
      submit: options.submit ?? false,
      clear: options.clear ?? false,
    });
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionOpenUri(options: {
  format: OutputOptions["format"];
  uri: string;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildOpenUriExecution(options.uri);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionPressKey(options: {
  format: OutputOptions["format"];
  key: string;
  deviceId?: string;
  operatorPackage?: string;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildPressKeyExecution(options.key);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdScroll(options: {
  format: OutputOptions["format"];
  direction: string;
  container?: NodeMatcher;
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildScrollExecution(options.direction, options.timeoutMs, options.container);
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdScrollUntil(options: {
  format: OutputOptions["format"];
  direction: string;
  matcher: NodeMatcher;
  container?: NodeMatcher;
  clickAfter: boolean;
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  noDaemon?: boolean;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildScrollUntilExecution(
      options.direction,
      options.matcher,
      options.container,
      options.clickAfter,
      options.timeoutMs,
    );
    return await runActionExecution(execution, options);
  } catch (e) {
    return formatError(e, options);
  }
}
