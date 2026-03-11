import { runExecution } from "../../domain/executions/runExecution.js";
import { buildClickExecution } from "../../domain/actions/click.js";
import { buildReadExecution } from "../../domain/actions/read.js";
import { buildWaitExecution } from "../../domain/actions/wait.js";
import { buildTypeTextExecution } from "../../domain/actions/typeText.js";
import { buildOpenAppExecution } from "../../domain/actions/openApp.js";
import type { NodeMatcher } from "../../contracts/selectors.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

function parseSelector(selectorJson: string): NodeMatcher {
  const s = JSON.parse(selectorJson) as NodeMatcher;
  if (typeof s !== "object" || s === null) throw new Error("Selector must be a JSON object");
  return s;
}

export async function cmdActionOpenApp(options: {
  format: OutputOptions["format"];
  applicationId: string;
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  try {
    const execution = buildOpenAppExecution(options.applicationId);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      warn: message => process.stderr.write(message),
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
  receiverPackage?: string;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildClickExecution(selector);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      warn: message => process.stderr.write(message),
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
  receiverPackage?: string;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildReadExecution(selector);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      warn: message => process.stderr.write(message),
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
  receiverPackage?: string;
}): Promise<string> {
  try {
    const selector = parseSelector(options.selector);
    const execution = buildWaitExecution(selector);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      warn: message => process.stderr.write(message),
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
  receiverPackage?: string;
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
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
      warn: message => process.stderr.write(message),
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
