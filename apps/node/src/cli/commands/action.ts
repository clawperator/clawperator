import { runExecution } from "../../domain/executions/runExecution.js";
import { buildClickExecution } from "../../domain/actions/click.js";
import { buildReadExecution } from "../../domain/actions/read.js";
import { buildWaitExecution } from "../../domain/actions/wait.js";
import { buildTypeTextExecution } from "../../domain/actions/typeText.js";
import { buildOpenAppExecution } from "../../domain/actions/openApp.js";
import { buildOpenUriExecution } from "../../domain/actions/openUri.js";
import { buildPressKeyExecution } from "../../domain/actions/pressKey.js";
import { buildScrollExecution } from "../../domain/actions/scroll.js";
import type { NodeMatcher } from "../../contracts/selectors.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

function parseSelector(selectorJson: string): NodeMatcher {
  const s = JSON.parse(selectorJson) as NodeMatcher;
  if (typeof s !== "object" || s === null) throw new Error("Selector must be a JSON object");
  return s;
}

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

export async function cmdActionClick(options: {
  format: OutputOptions["format"];
  selector: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildClickExecution(selector);
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
  selector: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildReadExecution(selector);
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
  selector: string;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildWaitExecution(selector);
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
  selector: string;
  text: string;
  submit?: boolean;
  clear?: boolean;
  deviceId?: string;
  operatorPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildTypeTextExecution({
      selector,
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
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildScrollExecution(options.direction, options.timeoutMs);
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
