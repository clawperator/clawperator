
import type { RuntimeConfig } from "./runtimeConfig.js";
import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";
import { parseTerminalEnvelope } from "./envelopeParser.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import type { TimeoutDiagnostics, BroadcastDiagnostics } from "../../contracts/errors.js";
import { formatCommandLine } from "./adbClient.js";

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
  | { ok: false; error: string; code?: string };

/**
 * Start logcat stream, then invoke onBroadcast (after a short delay so logcat is attached).
 * Wait for one terminal envelope or timeout. Kills logcat on envelope or timeout.
 */
export async function waitForResultEnvelope(
  config: RuntimeConfig,
  options: LogcatResultOptions,
  onBroadcast: () => Promise<{ success: boolean; stdout?: string; stderr?: string }>
): Promise<LogcatResult> {
  const { commandId, timeoutMs, lastCorrelatedLines = 20 } = options;
  const deviceArgs = config.deviceId ? ["-s", config.deviceId] : [];
  const args = [...deviceArgs, "logcat", "-v", "time", "-T", "1"];
  const commandLine = formatCommandLine(config.adbPath, args);

  return new Promise((resolve) => {
    const correlatedLines: string[] = [];
    let broadcastStatus = "not_sent";
    let pending = "";
    let settled = false;
    let stderrBuffer = "";
    let timeoutId: NodeJS.Timeout;

    config.logger?.log({
      ts: new Date().toISOString(),
      level: "debug",
      event: "adb.command",
      deviceId: config.deviceId,
      message: commandLine,
    });

    const proc = config.runner.spawn(config.adbPath, args);

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
        operatorPackage: config.operatorPackage,
      };
      config.logger?.log({
        ts: new Date().toISOString(),
        level: "debug",
        event: "adb.complete",
        deviceId: config.deviceId,
        message: `${commandLine} timeoutMs=${timeoutMs} stdout=[redacted] stderr=[redacted]`,
      });
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
        if (parsed === "malformed") {
          flush();
          finalize({
            ok: false,
            error: "Logcat emitted a malformed JSON envelope",
            code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
          } as any);
          return;
        }

        if (parsed) {
          flush();
          finalize({
            ok: true,
            envelope: parsed.envelope,
            terminalSource: parsed.terminalSource,
          });
          return;
        }
      }
    });

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer += chunk.toString();
    });

    proc.on("error", (error: Error) => {
      if ((error as any).code === "ENOENT") {
        config.logger?.log({
          ts: new Date().toISOString(),
          level: "debug",
          event: "adb.complete",
          deviceId: config.deviceId,
          message: `${commandLine} code=127 stdout=[redacted] stderr=[redacted]`,
        });
        finalize({
          ok: false,
          error: `ADB command not found at path: ${config.adbPath}`,
          code: ERROR_CODES.ADB_NOT_FOUND,
        } as any);
      } else {
        config.logger?.log({
          ts: new Date().toISOString(),
          level: "debug",
          event: "adb.complete",
          deviceId: config.deviceId,
          message: `${commandLine} error=${error.message} stdout=[redacted] stderr=[redacted]`,
        });
        finalize({ ok: false, error: `logcat spawn failed: ${error.message}` });
      }
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      if (settled) return;
      const base = `logcat exited before terminal envelope (code=${code ?? "null"}, signal=${signal ?? "null"})`;
      const stderr = stderrBuffer.trim();
      config.logger?.log({
        ts: new Date().toISOString(),
        level: "debug",
        event: "adb.complete",
        deviceId: config.deviceId,
        message: `${commandLine} code=${code ?? "null"} signal=${signal ?? "null"} stdout=[redacted] stderr=${JSON.stringify(stderr)}`,
      });
      finalize({ ok: false, error: stderr ? `${base}: ${stderr}` : base });
    });

    // Start broadcast after logcat is attached (short delay)
    (async () => {
      await new Promise((r) => setTimeout(r, 300));
      try {
        const result = await onBroadcast();
        if (!result.success) {
          const combined = (result.stderr ?? result.stdout ?? "unknown").trim();
          const isMissingPackage = combined.includes("Target package not found") || combined.includes("does not exist");
          const code = isMissingPackage ? ERROR_CODES.OPERATOR_NOT_INSTALLED : ERROR_CODES.BROADCAST_FAILED;

          broadcastStatus = `failed: ${combined}`;
          const diagnostics: BroadcastDiagnostics = {
            code,
            message: `Broadcast dispatch failed${combined ? `: ${combined}` : ""}`,
            lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
            broadcastDispatchStatus: broadcastStatus,
            deviceId: config.deviceId,
            operatorPackage: config.operatorPackage,
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
          operatorPackage: config.operatorPackage,
        };
        flush();
        finalize({ ok: false, broadcastFailed: true, diagnostics });
      }
    })();
  });
}
