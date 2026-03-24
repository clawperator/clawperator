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
import type { NodeMatcher } from "../../contracts/selectors.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdActionOpenApp(options: {
  format: OutputOptions["format"];
  applicationId: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildOpenAppExecution(options.applicationId);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildSleepExecution(options.durationMs, options.globalTimeoutMs);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildCloseAppExecution(options.applicationId, options.timeoutMs);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildClickExecution(options.matcher, options.clickType, options.coordinate);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildReadExecution(options.matcher, options.readAll, options.container);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildWaitExecution(options.matcher, options.waitTimeoutMs);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildTypeTextExecution({
      selector: options.matcher,
      text: options.text,
      submit: options.submit ?? false,
      clear: options.clear ?? false,
    });
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionOpenUri(options: {
  format: OutputOptions["format"];
  uri: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildOpenUriExecution(options.uri);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdActionPressKey(options: {
  format: OutputOptions["format"];
  key: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildPressKeyExecution(options.key);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildScrollExecution(options.direction, options.timeoutMs, options.container);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
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
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      operatorPackage: options.operatorPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
      warn: message => process.stderr.write(message),
      logger: options.logger,
    });
    if (result.ok)
      return formatSuccess(
        {
          envelope: result.envelope,
          deviceId: result.deviceId,
          terminalSource: result.terminalSource,
          isCanonicalTerminal: result.terminalSource === "clawperator_result",
        },
        options
      );
    return formatError(result.error, options);
  } catch (e) {
    return formatError(e, options);
  }
}
