import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawn } from "node:child_process";
import type { Execution } from "../../contracts/execution.js";
import { validateExecution, validatePayloadSize } from "./validateExecution.js";
import { resolveDevice } from "../devices/resolveDevice.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { broadcastAgentCommand } from "../../adapters/android-bridge/broadcastAgentCommand.js";
import { waitForResultEnvelope } from "../../adapters/android-bridge/logcatResultReader.js";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { tryAcquire, release, getConflictError } from "./executionStore.js";
import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { extractSnapshotsFromLogs } from "./snapshotHelper.js";
import { emitResult, emitExecution } from "../observe/events.js";
import { LIMITS } from "../../contracts/limits.js";
import { ERROR_CODES } from "../../contracts/errors.js";

export interface RunExecutionOptions {
  deviceId?: string;
  receiverPackage?: string;
  adbPath?: string;
  timeoutMs?: number;
}

export type RunExecutionResult =
  | { ok: true; envelope: ResultEnvelope; deviceId: string; terminalSource: TerminalSource }
  | { ok: false; error: { code: string; message: string; [k: string]: unknown }; deviceId?: string };

interface PerformExecutionResult {
  execution?: Execution;
  result: RunExecutionResult;
}

export function attachSnapshotsToStepResults(stepResults: ResultEnvelope["stepResults"], snapshots: string[]): void {
  const snapshotSteps = stepResults.filter(step => step.actionType === "snapshot_ui" && step.success);
  if (snapshotSteps.length === 0 || snapshots.length === 0) {
    return;
  }

  let snapshotIndex = snapshots.length - 1;
  for (let stepIndex = snapshotSteps.length - 1; stepIndex >= 0 && snapshotIndex >= 0; stepIndex -= 1) {
    const snapshotText = snapshots[snapshotIndex];
    const targetStep = snapshotSteps[stepIndex];
    if (snapshotText && targetStep) {
      targetStep.data = { ...targetStep.data, text: snapshotText };
    }
    snapshotIndex -= 1;
  }
}

/**
 * After snapshot attachment, mark any snapshot_ui step that is still success:true but has
 * no data.text as SNAPSHOT_EXTRACTION_FAILED, and emit a warning to stderr for each
 * affected step so users running CLI commands interactively can diagnose the problem
 * without parsing JSON.
 */
export function markExtractionFailedSnapshotSteps(stepResults: ResultEnvelope["stepResults"]): void {
  for (const step of stepResults) {
    if (step.actionType === "snapshot_ui" && step.success && step.data.text === undefined) {
      step.success = false;
      const { text: _text, ...remainingData } = step.data;
      step.data = {
        ...remainingData,
        error: ERROR_CODES.SNAPSHOT_EXTRACTION_FAILED,
        message: "UI hierarchy extraction produced no output for this step. Check clawperator version compatibility and logcat extraction health.",
      };
      if (process.stderr.isTTY) {
        process.stderr.write(
          `[clawperator] WARN: snapshot_ui step "${step.id}" UI hierarchy extraction produced no output. ` +
          `Run 'clawperator doctor' or 'clawperator version --check-compat' to diagnose.\n`
        );
      }
    }
  }
}

export function finalizeSuccessfulScreenshotCapture(
  screenStep: ResultEnvelope["stepResults"][number] | undefined,
  screenshotPath: string
): void {
  if (!screenStep) {
    return;
  }

  if (screenStep.data.error === "UNSUPPORTED_RUNTIME_SCREENSHOT") {
    screenStep.success = true;
    const { error: _error, message: _message, ...remainingData } = screenStep.data;
    screenStep.data = remainingData;
  }

  screenStep.data = { ...screenStep.data, path: screenshotPath };
}

/**
 * Internal helper to validate, resolve device, and perform actual execution.
 */
async function performExecution(
  executionInput: unknown,
  options: RunExecutionOptions = {}
): Promise<PerformExecutionResult> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: options.adbPath ?? process.env.ADB_PATH,
  });

  let execution: Execution;
  try {
    execution = validateExecution(executionInput);
  } catch (e) {
    return { result: { ok: false, error: e as { code: string; message: string; [k: string]: unknown } } };
  }

  if (options.timeoutMs !== undefined) {
    if (!Number.isFinite(options.timeoutMs)) {
      return {
        execution,
        result: {
          ok: false,
          error: {
            code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
            message: "timeoutMs must be a finite number",
          },
        },
      };
    }
    if (options.timeoutMs < LIMITS.MIN_EXECUTION_TIMEOUT_MS || options.timeoutMs > LIMITS.MAX_EXECUTION_TIMEOUT_MS) {
      return {
        execution,
        result: {
          ok: false,
          error: {
            code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
            message: `timeoutMs must be between ${LIMITS.MIN_EXECUTION_TIMEOUT_MS} and ${LIMITS.MAX_EXECUTION_TIMEOUT_MS}`,
          },
        },
      };
    }
    execution = { ...execution, timeoutMs: options.timeoutMs };
  }

  try {
    validatePayloadSize(JSON.stringify(execution));
  } catch (e) {
    return { execution, result: { ok: false, error: e as { code: string; message: string; [k: string]: unknown } } };
  }

  let deviceId: string;
  try {
    const resolved = await resolveDevice(config);
    deviceId = resolved.deviceId;
    config.deviceId = deviceId;
  } catch (e) {
    return { execution, result: { ok: false, error: e as { code: string; message: string; [k: string]: unknown } } };
  }

  if (!tryAcquire(deviceId, execution.commandId)) {
    return { execution, result: { ok: false, error: getConflictError(deviceId, execution.commandId), deviceId } };
  }

  try {
    // 1. Handle pre-flight side effects (e.g., force-close apps via adb)
    for (const action of execution.actions) {
      if (action.type === "close_app" && action.params?.applicationId) {
        await runAdb(config, ["shell", "am", "force-stop", action.params.applicationId]);
      }
    }

    // 2. Clear logcat so we only see this command's output
    await runAdb(config, ["logcat", "-c"]);

    const payload = JSON.stringify(execution);
    const result = await waitForResultEnvelope(
      config,
      {
        commandId: execution.commandId,
        timeoutMs: execution.timeoutMs + 5000, // buffer for envelope write
        lastCorrelatedLines: 30,
      },
      async () => {
        const broadcast = await broadcastAgentCommand(config, payload);
        return { success: broadcast.success, stdout: broadcast.stdout, stderr: broadcast.stderr };
      }
    );

    if (result.ok) {
      // Post-process to retrieve snapshot text from logcat
      const hasSnapshot = result.envelope.stepResults.some(s => s.actionType === "snapshot_ui");
      if (hasSnapshot) {
        const dump = await runAdb(config, ["logcat", "-d", "-v", "tag"]);
        const snapshots = extractSnapshotsFromLogs(dump.stdout.split("\n"));
        attachSnapshotsToStepResults(result.envelope.stepResults, snapshots);
        markExtractionFailedSnapshotSteps(result.envelope.stepResults);
      }

      const hasScreenshot = result.envelope.stepResults.some(s => s.actionType === "take_screenshot");
      const screenAction = execution.actions.find(a => a.type === "take_screenshot");
      if (hasScreenshot) {
        try {
          const screenshotPath = screenAction?.params?.path || join(tmpdir(), `clawperator-screenshot-${execution.commandId}-${Date.now()}.png`);
          const screenStep = result.envelope.stepResults.find(s => s.actionType === "take_screenshot");

          const deviceArgs = config.deviceId ? ["-s", config.deviceId] : [];
          const proc = spawn(config.adbPath, [...deviceArgs, "exec-out", "screencap", "-p"], {
            stdio: ["ignore", "pipe", "ignore"],
            shell: false,
          });

          let buffer = Buffer.alloc(0);
          proc.stdout?.on("data", (chunk: Buffer) => {
            buffer = Buffer.concat([buffer, chunk]);
          });

          await new Promise((resolve, reject) => {
            proc.on("close", (code) => {
              if (code === 0) resolve(true);
              else reject(new Error(`screencap exited with code ${code}`));
            });
            proc.on("error", reject);
          });

          if (buffer.length === 0) {
            throw new Error("screencap returned empty output");
          }

          await writeFile(screenshotPath, buffer);
          finalizeSuccessfulScreenshotCapture(screenStep, screenshotPath);
        } catch (e) {
          console.warn(`⚠️ Failed to capture screenshot via adb: ${String(e)}`);
        }
      }

      emitResult(deviceId, result.envelope);
      return {
        execution,
        result: { ok: true, envelope: result.envelope, deviceId, terminalSource: result.terminalSource },
      };
    }

    // Handle failure emission for SSE subscribers relying on the terminal envelope signal.
    const failureEnvelope: ResultEnvelope = {
      commandId: execution.commandId,
      taskId: execution.taskId,
      status: "failed",
      stepResults: [],
      error: "Execution failed during runtime"
    };

    if ("broadcastFailed" in result && result.broadcastFailed && "diagnostics" in result) {
      failureEnvelope.error = result.diagnostics.code;
      emitResult(deviceId, failureEnvelope);
      return { execution, result: { ok: false, error: { ...result.diagnostics }, deviceId } };
    }
    if ("timeout" in result && result.timeout && "diagnostics" in result) {
      failureEnvelope.error = result.diagnostics.code;
      emitResult(deviceId, failureEnvelope);
      return { execution, result: { ok: false, error: { ...result.diagnostics }, deviceId } };
    }
    
    const errCode = ("code" in result && result.code) ? (result.code as string) : (("error" in result && typeof result.error === "string") ? result.error : "UNKNOWN_RUNTIME_ERROR");
    failureEnvelope.error = errCode;
    emitResult(deviceId, failureEnvelope);
    return {
      execution,
      result: {
        ok: false,
        error: { code: errCode, message: ("error" in result && typeof result.error === "string") ? result.error : "Unknown error" },
        deviceId,
      },
    };
  } finally {
    release(deviceId, execution.commandId);
  }
}

/**
 * Validate, resolve device, enforce single-flight, dispatch broadcast, wait for terminal envelope.
 * Always emits outcome to SSE subscribers via emitExecution.
 */
export async function runExecution(
  executionInput: unknown,
  options: RunExecutionOptions = {}
): Promise<RunExecutionResult> {
  const { execution, result } = await performExecution(executionInput, options);
  
  // We emit the execution outcome even if resolution failed, as long as we have SOME deviceId 
  // (either from options or resolved during the process).
  const resolvedDeviceId: string | null = result.deviceId || options.deviceId || null;
  if (resolvedDeviceId !== null) {
    emitExecution(resolvedDeviceId, execution ?? executionInput, result);
  }
  return result;
}
