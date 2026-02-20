import { spawn } from "node:child_process";
import type { RuntimeConfig } from "./runtimeConfig.js";
import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";
import { parseTerminalEnvelope } from "./envelopeParser.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import type { TimeoutDiagnostics, BroadcastDiagnostics } from "../../contracts/errors.js";
import { extractSnapshotFromLogs } from "../../domain/executions/snapshotHelper.js";

export interface LogcatResultOptions {
  commandId: string;
  timeoutMs: number;
  /** Last N lines to include in timeout diagnostics */
  lastCorrelatedLines?: number;
}

export type LogcatResult =
  | { ok: true; envelope: ResultEnvelope; terminalSource: TerminalSource }
  | { ok: false; timeout: true; diagnostics: TimeoutDiagnostics }
  | { ok: false; broadcastFailed: true; diagnostics: BroadcastDiagnostics }
  | { ok: false; error: string };

/**
 * Start logcat stream, then invoke onBroadcast (after a short delay so logcat is attached).
 * Wait for one terminal envelope or timeout. Kills logcat on envelope or timeout.
 */
export async function waitForResultEnvelope(
  config: RuntimeConfig,
  options: LogcatResultOptions,
  onBroadcast: () => Promise<{ success: boolean; stderr?: string }>
): Promise<LogcatResult> {
  const { commandId, timeoutMs, lastCorrelatedLines = 20 } = options;
  const deviceArgs = config.deviceId ? ["-s", config.deviceId] : [];
  const args = [...deviceArgs, "logcat", "-v", "time", "-T", "1"];

  return new Promise((resolve) => {
    const correlatedLines: string[] = [];
    let broadcastStatus = "not_sent";
    let pending = "";
    let settled = false;
    let stderrBuffer = "";
    let timeoutId: NodeJS.Timeout;

    const proc = spawn(config.adbPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });

    const finalize = (result: LogcatResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    const flush = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    };

    timeoutId = setTimeout(() => {
      flush();
      const diagnostics: TimeoutDiagnostics = {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: `No [Clawperator-Result] envelope within ${timeoutMs}ms`,
        lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
        broadcastDispatchStatus: broadcastStatus,
        deviceId: config.deviceId,
        receiverPackage: config.receiverPackage,
      };
      finalize({ ok: false, timeout: true, diagnostics });
    }, timeoutMs);

    proc.stdout?.on("data", (chunk: Buffer) => {
      pending += chunk.toString();
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        if (line.includes("TaskScopeDefault:")) {
          correlatedLines.push(line);
        }
        if (!line.includes(RESULT_ENVELOPE_PREFIX)) continue;
        
        const parsed = parseTerminalEnvelope(line, commandId);
        if (parsed) {
          flush();
          
          const fullSnapshot = extractSnapshotFromLogs(correlatedLines);
          if (fullSnapshot) {
            const snapStep = parsed.envelope.stepResults.find(s => s.actionType === "snapshot_ui");
            if (snapStep) {
              snapStep.data = { ...snapStep.data, text: fullSnapshot };
            }
          }

          // Clear correlated lines so snapshot content from previous envelopes
          // does not leak into subsequent command executions in long-running processes.
          correlatedLines.length = 0;

          finalize({ ok: true, envelope: parsed.envelope, terminalSource: parsed.terminalSource });
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    proc.on("error", (error) => {
      finalize({ ok: false, error: `logcat spawn failed: ${error.message}` });
    });

    proc.on("close", (code, signal) => {
      if (settled) return;
      const base = `logcat exited before terminal envelope (code=${code ?? "null"}, signal=${signal ?? "null"})`;
      const stderr = stderrBuffer.trim();
      finalize({ ok: false, error: stderr ? `${base}: ${stderr}` : base });
    });

    // Start broadcast after logcat is attached (short delay)
    (async () => {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const result = await onBroadcast();
        if (!result.success) {
          const stderr = (result.stderr ?? "unknown").trim();
          broadcastStatus = `failed: ${stderr || "unknown"}`;
          const diagnostics: BroadcastDiagnostics = {
            code: ERROR_CODES.BROADCAST_FAILED,
            message: `Broadcast dispatch failed${stderr ? `: ${stderr}` : ""}`,
            lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
            broadcastDispatchStatus: broadcastStatus,
            deviceId: config.deviceId,
            receiverPackage: config.receiverPackage,
          };
          flush();
          finalize({ ok: false, broadcastFailed: true, diagnostics });
          return;
        }
        broadcastStatus = "sent";
      } catch (e) {
        const err = String(e).trim();
        broadcastStatus = `error: ${err}`;
        const diagnostics: BroadcastDiagnostics = {
          code: ERROR_CODES.BROADCAST_FAILED,
          message: `Broadcast dispatch threw${err ? `: ${err}` : ""}`,
          lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
          broadcastDispatchStatus: broadcastStatus,
          deviceId: config.deviceId,
          receiverPackage: config.receiverPackage,
        };
        flush();
        finalize({ ok: false, broadcastFailed: true, diagnostics });
      }
    })();
  });
}
