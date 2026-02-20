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
import { extractSnapshotFromLogs } from "./snapshotHelper.js";
import { emitResult, emitExecution } from "../observe/events.js";

export interface RunExecutionOptions {
  deviceId?: string;
  receiverPackage?: string;
  adbPath?: string;
}

export type RunExecutionResult =
  | { ok: true; envelope: ResultEnvelope; deviceId: string; terminalSource: TerminalSource }
  | { ok: false; error: { code: string; message: string; [k: string]: unknown }; deviceId?: string };

/**
 * Internal helper to validate, resolve device, and perform actual execution.
 */
async function performExecution(
  executionInput: unknown,
  options: RunExecutionOptions = {}
): Promise<RunExecutionResult> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: options.adbPath ?? process.env.ADB_PATH,
  });

  let execution: Execution;
  try {
    execution = validateExecution(executionInput);
  } catch (e) {
    return { ok: false, error: e as { code: string; message: string; [k: string]: unknown } };
  }

  try {
    validatePayloadSize(JSON.stringify(execution));
  } catch (e) {
    return { ok: false, error: e as { code: string; message: string; [k: string]: unknown } };
  }

  let deviceId: string;
  try {
    const resolved = await resolveDevice(config);
    deviceId = resolved.deviceId;
    config.deviceId = deviceId;
  } catch (e) {
    return { ok: false, error: e as { code: string; message: string; [k: string]: unknown } };
  }

  if (!tryAcquire(deviceId, execution.commandId)) {
    return { ok: false, error: getConflictError(deviceId, execution.commandId), deviceId };
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
        return { success: broadcast.success, stderr: broadcast.stderr };
      }
    );

    if (result.ok) {
      // Post-process to retrieve snapshot text from logcat
      const hasSnapshot = result.envelope.stepResults.some(s => s.actionType === "snapshot_ui");
      if (hasSnapshot) {
        const dump = await runAdb(config, ["logcat", "-d", "-v", "tag"]);
        const fullSnapshot = extractSnapshotFromLogs(dump.stdout.split("\n"));
        
        if (fullSnapshot) {
          const snapStep = result.envelope.stepResults.find(s => s.actionType === "snapshot_ui");
          if (snapStep) {
            snapStep.data = { ...snapStep.data, text: fullSnapshot };
          }
        }
      }

      // Post-process take_screenshot via adb exec-out
      const screenAction = execution.actions.find(a => a.type === "take_screenshot");
      const hasScreenshot = result.envelope.stepResults.some(s => s.actionType === "take_screenshot");
      if (hasScreenshot) {
        const screenshotPath = screenAction?.params?.path || join(tmpdir(), `clawperator-screenshot-${execution.commandId}-${Date.now()}.png`);
        try {
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

          if (buffer.length > 0) {
            await writeFile(screenshotPath, buffer);
            const screenStep = result.envelope.stepResults.find(s => s.actionType === "take_screenshot");
            if (screenStep) {
              screenStep.data = { ...screenStep.data, path: screenshotPath };
            }
          }
        } catch (e) {
          console.warn(`⚠️ Failed to capture screenshot via adb: ${String(e)}`);
        }
      }

      emitResult(deviceId, result.envelope);
      return { ok: true, envelope: result.envelope, deviceId, terminalSource: result.terminalSource };
    }
    if ("broadcastFailed" in result && result.broadcastFailed && "diagnostics" in result) {
      return { ok: false, error: { ...result.diagnostics }, deviceId };
    }
    if ("timeout" in result && result.timeout && "diagnostics" in result) {
      return { ok: false, error: { ...result.diagnostics }, deviceId };
    }
    return { ok: false, error: { code: "UNKNOWN", message: ("error" in result ? result.error : undefined) ?? "Unknown error" }, deviceId };
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
  const result = await performExecution(executionInput, options);
  const resolvedDeviceId: string | null = result.deviceId || options.deviceId || null;
  if (resolvedDeviceId !== null) {
    emitExecution(resolvedDeviceId, executionInput, result);
  }
  return result;
}
