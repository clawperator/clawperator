import * as fs from "node:fs/promises";
import { runExecution } from "../../domain/executions/runExecution.js";
import { buildStartRecordingExecution } from "../../domain/actions/startRecording.js";
import { buildStopRecordingExecution } from "../../domain/actions/stopRecording.js";
import { pullRecording } from "../../domain/recording/pullRecording.js";
import { parseRecordingFile } from "../../domain/recording/parseRecording.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdRecordStart(options: {
  format: OutputOptions["format"];
  sessionId?: string;
  deviceId?: string;
  receiverPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildStartRecordingExecution(options.sessionId);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
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

export async function cmdRecordStop(options: {
  format: OutputOptions["format"];
  sessionId?: string;
  deviceId?: string;
  receiverPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const execution = buildStopRecordingExecution(options.sessionId);
    const result = await runExecution(execution, {
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
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

export async function cmdRecordPull(options: {
  format: OutputOptions["format"];
  sessionId?: string;
  outputDir: string;
  deviceId?: string;
  receiverPackage?: string;
  logger?: Logger;
}): Promise<string> {
  try {
    const config = getDefaultRuntimeConfig({
      logger: options.logger,
      deviceId: options.deviceId,
      receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_OPERATOR_PACKAGE,
    });

    const { localPath, sessionId } = await pullRecording(config, {
      sessionId: options.sessionId,
      outputDir: options.outputDir,
    });

    return formatSuccess({ ok: true, localPath, sessionId }, options);
  } catch (e) {
    return formatError(e, options);
  }
}

export async function cmdRecordParse(options: {
  format: OutputOptions["format"];
  inputFile: string;
  outputFile?: string;
}): Promise<string> {
  try {
    const stepLog = await parseRecordingFile(options.inputFile);

    // Determine output path
    let outputFile: string;
    if (options.outputFile) {
      outputFile = options.outputFile;
    } else {
      // Replace .ndjson with .steps.json, or append .steps.json
      if (options.inputFile.endsWith(".ndjson")) {
        outputFile = options.inputFile.slice(0, -7) + ".steps.json";
      } else {
        outputFile = options.inputFile + ".steps.json";
      }
    }

    // Write the step log JSON
    await fs.writeFile(outputFile, JSON.stringify(stepLog, null, 2), "utf-8");

    const payload: {
      ok: true;
      outputFile: string;
      stepCount: number;
      warnings?: string[];
    } = {
      ok: true,
      outputFile,
      stepCount: stepLog.steps.length,
    };

    if (stepLog._warnings && stepLog._warnings.length > 0) {
      payload.warnings = stepLog._warnings;
    }

    return formatSuccess(payload, options);
  } catch (e) {
    return formatError(e, options);
  }
}
