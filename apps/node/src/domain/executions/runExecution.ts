import type { Execution } from "../../contracts/execution.js";
import { validateExecution, validatePayloadSize } from "./validateExecution.js";
import { resolveDevice } from "../devices/resolveDevice.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { broadcastAgentCommand } from "../../adapters/android-bridge/broadcastAgentCommand.js";
import { waitForResultEnvelope } from "../../adapters/android-bridge/logcatResultReader.js";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { tryAcquire, release, getConflictError } from "./executionStore.js";
import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";

export interface RunExecutionOptions {
  deviceId?: string;
  receiverPackage?: string;
  adbPath?: string;
}

export type RunExecutionResult =
  | { ok: true; envelope: ResultEnvelope; deviceId: string; terminalSource: TerminalSource }
  | { ok: false; error: { code: string; message: string; [k: string]: unknown } };

/**
 * Validate, resolve device, enforce single-flight, dispatch broadcast, wait for terminal envelope.
 */
export async function runExecution(
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
    return { ok: false, error: getConflictError(deviceId, execution.commandId) };
  }

  try {
    // 1. Handle pre-flight side effects (e.g., force-close apps via adb)
    // The Android runtime cannot reliably force-stop other apps due to sandbox restrictions.
    // Performing this via adb before dispatch ensures a predictable starting state.
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
      // Post-process to retrieve snapshot text from logcat if any snapshot_ui actions were run.
      // We do this by dumping the buffer and filtering for TaskScopeDefault tags.
      const hasSnapshot = result.envelope.stepResults.some(s => s.actionType === "snapshot_ui");
      if (hasSnapshot) {
        const dump = await runAdb(config, ["logcat", "-d", "-v", "tag"]);
        const snapshotLines = dump.stdout.split("\n")
          .filter(l => l.startsWith("D/TaskScopeDefault:"))
          .map(l => l.slice("D/TaskScopeDefault:".length).trim())
          .map(s => s.startsWith("[TaskScope]") ? s.slice("[TaskScope]".length).trim() : s)
          // Filter for hierarchy start/content
          .filter(s => s.startsWith("<") || s.startsWith("?") || s.includes("text=") || s.includes("res="));
        
        if (snapshotLines.length > 0) {
          const fullSnapshot = snapshotLines.join("\n");
          const snapStep = result.envelope.stepResults.find(s => s.actionType === "snapshot_ui");
          if (snapStep) {
            snapStep.data = { ...snapStep.data, text: fullSnapshot };
          }
        }
      }

      return { ok: true, envelope: result.envelope, deviceId, terminalSource: result.terminalSource };
    }
    if ("broadcastFailed" in result && result.broadcastFailed && "diagnostics" in result) {
      return { ok: false, error: { ...result.diagnostics } };
    }
    if ("timeout" in result && result.timeout && "diagnostics" in result) {
      return { ok: false, error: { ...result.diagnostics } };
    }
    return { ok: false, error: { code: "UNKNOWN", message: ("error" in result ? result.error : undefined) ?? "Unknown error" } };
  } finally {
    release(deviceId, execution.commandId);
  }
}
