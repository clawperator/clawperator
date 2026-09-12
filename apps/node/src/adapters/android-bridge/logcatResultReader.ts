
import { ResultEnvelopeTransport } from "./resultEnvelopeTransport.js";
import { StringDecoder } from "node:string_decoder";
import type { RuntimeConfig } from "./runtimeConfig.js";
import type { ResultEnvelope, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";
import { parseTerminalEnvelope } from "./envelopeParser.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import type { TimeoutDiagnostics, BroadcastDiagnostics } from "../../contracts/errors.js";
import { formatCommandLine } from "./adbClient.js";

export interface LogcatResultOptions {
  commandId: string;
  taskId?: string;
  timeoutMs: number;
  broadcastDelayMs?: number;
  cancelSignal?: AbortSignal;
  /** Last N lines to include in timeout diagnostics */
  lastCorrelatedLines?: number;
}

export type LogcatResult =
  | { ok: true; envelope: ResultEnvelope; terminalSource: TerminalSource; snapshotLogLines?: string[] }
  | { ok: false; timeout: true; diagnostics: TimeoutDiagnostics }
  | { ok: false; broadcastFailed: true; diagnostics: BroadcastDiagnostics }
  | { ok: false; error: string; code: string; diagnostics?: Record<string, unknown> };

interface ParsedLogcatLine {
  tag: string | null;
  message: string;
}

interface SnapshotMarkerMatch {
  commandId?: string;
  tag: string | null;
  legacy: boolean;
}

function parseLogcatLine(line: string): ParsedLogcatLine | null {
  const timeFormatMatch = line.match(
    /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+[A-Z]\/([^(]+)(?:\(\s*\d+\))?:\s?(.*)$/
  );
  if (timeFormatMatch) {
    return {
      tag: timeFormatMatch[1].trim(),
      message: timeFormatMatch[2] ?? "",
    };
  }

  const timeFormatPidTidMatch = line.match(
    /^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+\s+[A-Z]\s+([^:]+):\s?(.*)$/
  );
  if (timeFormatPidTidMatch) {
    return {
      tag: timeFormatPidTidMatch[1].trim(),
      message: timeFormatPidTidMatch[2] ?? "",
    };
  }

  if (/^[A-Z]\//.test(line)) {
    const delimiterIndex = line.indexOf(":");
    if (delimiterIndex !== -1) {
      const tag = line.slice(2, delimiterIndex).trim();
      const message = line.slice(delimiterIndex + 1);
      return {
        tag,
        message: message.startsWith(" ") ? message.slice(1) : message,
      };
    }
  }

  const trimmed = line.trim();
  return trimmed.length > 0 ? { tag: null, message: trimmed } : null;
}

function parseSnapshotMarker(line: string): SnapshotMarkerMatch | null {
  const parsed = parseLogcatLine(line);
  if (parsed === null) {
    return null;
  }

  const newFormatMatch = parsed.message.match(/^\[TaskScope\] UI Hierarchy \[commandId=([^\]]+)]:/);
  if (newFormatMatch) {
    return {
      commandId: newFormatMatch[1],
      tag: parsed.tag,
      legacy: false,
    };
  }

  if (parsed.message.match(/^\[TaskScope\] UI Hierarchy:/)) {
    return {
      tag: parsed.tag,
      legacy: true,
    };
  }

  return null;
}

function shouldEndSnapshotBlock(line: string, activeTag: string | null): boolean {
  const parsed = parseLogcatLine(line);
  if (parsed === null || parsed.tag !== activeTag) {
    return false;
  }

  const trimmed = parsed.message.trim();
  return trimmed.startsWith("[") && !trimmed.startsWith("<?xml") && !trimmed.startsWith("<");
}

const SIGNAL_BROADCAST_REPLAY_DRAIN_MS = 25;
const SIGNAL_BROADCAST_MAX_DRAIN_MS = 100;

type BroadcastStatus = "not_sent" | "sent" | `failed: ${string}` | `error: ${string}`;

function envelopeLineReferencesCommand(line: string, commandId: string): boolean {
  return line.includes(JSON.stringify(commandId));
}

/**
 * Start logcat stream, then invoke onBroadcast once stdout proves the stream is attached
 * or the fallback delay elapses.
 * Wait for one terminal envelope or timeout. Kills logcat on envelope or timeout.
 */
export async function waitForResultEnvelope(
  config: RuntimeConfig,
  options: LogcatResultOptions,
  onBroadcast: (beginDispatchCapture: () => void) => Promise<{ success: boolean; stdout?: string; stderr?: string }>
): Promise<LogcatResult> {
  const {
    commandId,
    timeoutMs: rawTimeoutMs,
    lastCorrelatedLines = 20,
    broadcastDelayMs: rawBroadcastDelayMs = 100,
    cancelSignal,
  } = options;
  const timeoutMs = Number.isFinite(rawTimeoutMs) && rawTimeoutMs >= 0 ? rawTimeoutMs : 0;
  const broadcastDelayMs =
    Number.isFinite(rawBroadcastDelayMs) && rawBroadcastDelayMs >= 0 ? rawBroadcastDelayMs : 0;
  const deviceArgs = config.deviceId ? ["-s", config.deviceId] : [];
  const args = [...deviceArgs, "logcat", "-v", "time", "-T", "1"];
  const commandLine = formatCommandLine(config.adbPath, args);

  return new Promise((resolve) => {
    const correlatedLines: string[] = [];
    const snapshotLogLines: string[] = [];
    let broadcastStatus: BroadcastStatus = "not_sent";
    let pending = "";
    const decoder = new StringDecoder("utf8");
    const transport = new ResultEnvelopeTransport(commandId);
    let settled = false;
    let stderrBuffer = "";
    let timeoutId: NodeJS.Timeout | undefined;
    let broadcastStartTimer: NodeJS.Timeout | undefined;
    let signalBroadcastStartTimer: NodeJS.Timeout | undefined;
    let signalBroadcastMaxTimer: NodeJS.Timeout | undefined;
    let broadcastStarted = false;
    let dispatchCaptureStarted = false;
    let stdoutObserved = false;
    let activeSnapshotTag: string | null = null;
    let activeSnapshotCaptured = false;

    config.logger?.emit({
      ts: new Date().toISOString(),
      level: "debug",
      event: "adb.command",
      deviceId: config.deviceId,
      message: commandLine,
    });

    let proc: ReturnType<RuntimeConfig["runner"]["spawn"]>;
    const diagnostics = (extra: Record<string, unknown> = {}) => ({
      commandId, taskId: options.taskId, deviceId: config.deviceId,
      operatorPackage: config.operatorPackage, broadcastDispatchStatus: broadcastStatus,
      dispatchAttempted: dispatchCaptureStarted,
      executionPosition: "unknown", stdoutObserved,
      stderr: stderrBuffer, lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
      transport: transport.diagnostics(), ...extra,
    });
    const remember = (line: string) => {
      correlatedLines.push(line.slice(0, 2048));
      if (correlatedLines.length > lastCorrelatedLines) correlatedLines.shift();
    };

    const finalize = (result: LogcatResult) => {
      if (settled) return;
      settled = true;
      flush();
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      if (broadcastStartTimer !== undefined) {
        clearTimeout(broadcastStartTimer);
      }
      if (signalBroadcastStartTimer !== undefined) {
        clearTimeout(signalBroadcastStartTimer);
      }
      if (signalBroadcastMaxTimer !== undefined) {
        clearTimeout(signalBroadcastMaxTimer);
      }
      cancelSignal?.removeEventListener("abort", abortHandler);
      if (!result.ok) {
        if ("error" in result) result.diagnostics = diagnostics(result.diagnostics);
        else result.diagnostics.details = diagnostics();
      }
      resolve(result);
    };

    const flush = () => {
      try {
        proc.kill("SIGTERM");
      } catch {
        // ignore
      }
    };

    const abortHandler = () => {
      finalize({
        ok: false,
        error: "Logcat result wait canceled",
        code: ERROR_CODES.RESULT_TRANSPORT_CANCELLED,
      });
    };

    try {
      proc = config.runner.spawn(config.adbPath, args);
    } catch (error) {
      const cause = error as NodeJS.ErrnoException;
      finalize({ ok: false, code: cause.code === "ENOENT" ? ERROR_CODES.ADB_NOT_FOUND : ERROR_CODES.RESULT_TRANSPORT_SPAWN_FAILED,
        error: `logcat spawn failed: ${cause.message ?? String(error)}`,
        diagnostics: { processErrorCode: cause.code, originalMessage: cause.message ?? String(error) } });
      return;
    }


    const startTimeout = () => {
      if (timeoutId !== undefined) {
        return;
      }
      timeoutId = setTimeout(() => {
        const diagnostics: TimeoutDiagnostics = {
          code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
          message: `No [Clawperator-Result] envelope within ${timeoutMs}ms`,
          lastCorrelatedEvents: correlatedLines.slice(-lastCorrelatedLines),
          broadcastDispatchStatus: broadcastStatus,
          deviceId: config.deviceId,
          operatorPackage: config.operatorPackage,
        };
        config.logger?.emit({
          ts: new Date().toISOString(),
          level: "debug",
          event: "adb.complete",
          deviceId: config.deviceId,
          message: `${commandLine} timeoutMs=${timeoutMs} stdout=[redacted] stderr=[redacted]`,
        });
        finalize({ ok: false, timeout: true, diagnostics });
      }, timeoutMs);
    };

    const beginDispatchCapture = () => {
      // A deferred preflight callback must never dispatch after its reader has died.
      if (settled) throw new Error("Result reader settled before broadcast dispatch");
      if (dispatchCaptureStarted) {
        return;
      }
      pending = "";
      dispatchCaptureStarted = true;
      broadcastStatus = "sent";
      startTimeout();
    };

    const startBroadcast = () => {
      if (settled || broadcastStarted) {
        return;
      }
      broadcastStarted = true;
      if (broadcastStartTimer !== undefined) {
        clearTimeout(broadcastStartTimer);
      }
      if (signalBroadcastStartTimer !== undefined) {
        clearTimeout(signalBroadcastStartTimer);
      }
      if (signalBroadcastMaxTimer !== undefined) {
        clearTimeout(signalBroadcastMaxTimer);
      }
      (async () => {
        try {
          const result = await onBroadcast(beginDispatchCapture);
          if (settled) return;
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
            finalize({ ok: false, broadcastFailed: true, diagnostics });
            return;
          }
          if (!dispatchCaptureStarted) {
            beginDispatchCapture();
          }
        } catch (e) {
          if (settled) return;
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
          finalize({ ok: false, broadcastFailed: true, diagnostics });
        }
      })();
    };

    const consumeOutput = (text: string) => {
      if (settled) return;
      pending += text;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        const snapshotMarker = parseSnapshotMarker(line);
        if (snapshotMarker !== null) {
          remember(line);
          activeSnapshotTag = snapshotMarker.tag;
          activeSnapshotCaptured = snapshotMarker.commandId === commandId
            || (snapshotMarker.legacy && dispatchCaptureStarted);
          if (activeSnapshotCaptured) {
            snapshotLogLines.push(line);
          }
        } else if (activeSnapshotTag !== null) {
          remember(line);
          const parsed = parseLogcatLine(line);
          if (parsed !== null && parsed.tag === activeSnapshotTag) {
            if (shouldEndSnapshotBlock(line, activeSnapshotTag)) {
              activeSnapshotTag = null;
              activeSnapshotCaptured = false;
            } else {
              if (activeSnapshotCaptured) {
                snapshotLogLines.push(line);
              }
              if (parsed.message.trim() === "</hierarchy>") {
                activeSnapshotTag = null;
                activeSnapshotCaptured = false;
              }
            }
          }
        }
        if (broadcastStatus !== "sent") continue;
        if (line.includes(commandId)) remember(line);
        let terminalLine: string | null;
        try {
          terminalLine = transport.consume(parseLogcatLine(line)?.message ?? line);
        } catch (error) {
          finalize({ ok: false, code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
            error: error instanceof Error ? error.message : "Malformed result transport" });
          return;
        }
        if (terminalLine === null || !terminalLine.includes(RESULT_ENVELOPE_PREFIX)
          || !envelopeLineReferencesCommand(terminalLine, commandId)) continue;

        const parsed = parseTerminalEnvelope(terminalLine, commandId);
        if (parsed === "malformed") {
          finalize({
            ok: false,
            error: "Logcat emitted a malformed JSON envelope",
            code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
          });
          return;
        }

        if (parsed) {
          finalize({
            ok: true,
            envelope: parsed.envelope,
            terminalSource: parsed.terminalSource,
            snapshotLogLines,
          });
          return;
        }
      }
      if (!broadcastStarted) {
        if (!stdoutObserved) {
          stdoutObserved = true;
          signalBroadcastMaxTimer = setTimeout(() => {
            startBroadcast();
          }, SIGNAL_BROADCAST_MAX_DRAIN_MS);
        }
        if (broadcastStartTimer !== undefined) {
          clearTimeout(broadcastStartTimer);
          broadcastStartTimer = undefined;
        }
        if (signalBroadcastStartTimer !== undefined) {
          clearTimeout(signalBroadcastStartTimer);
        }
        signalBroadcastStartTimer = setTimeout(() => {
          startBroadcast();
        }, SIGNAL_BROADCAST_REPLAY_DRAIN_MS);
      }
    };
    proc.stdout?.on("data", (chunk: Buffer) => consumeOutput(decoder.write(chunk)));

    proc.stderr?.on("data", (chunk: Buffer) => {
      stderrBuffer = (stderrBuffer + chunk.toString()).slice(-8192);
    });

    proc.on("error", (error: NodeJS.ErrnoException) => {
      if (settled) return;
      if ((error as any).code === "ENOENT") {
        config.logger?.emit({
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
          diagnostics: { processErrorCode: error.code, originalMessage: error.message },
        });
      } else {
        config.logger?.emit({
          ts: new Date().toISOString(),
          level: "debug",
          event: "adb.complete",
          deviceId: config.deviceId,
          message: `${commandLine} error=${error.message} stdout=[redacted] stderr=[redacted]`,
        });
        finalize({ ok: false, code: ERROR_CODES.RESULT_TRANSPORT_SPAWN_FAILED, error: `logcat spawn failed: ${error.message}`,
          diagnostics: { processErrorCode: error.code, originalMessage: error.message } });
      }
    });

    proc.on("close", (code: number | null, signal: string | null) => {
      if (settled) return;
      consumeOutput(decoder.end() + (pending.length > 0 ? "\n" : ""));
      if (settled) return;
      const base = `logcat exited before terminal envelope (code=${code ?? "null"}, signal=${signal ?? "null"})`;
      const stderr = stderrBuffer.trim();
      config.logger?.emit({
        ts: new Date().toISOString(),
        level: "debug",
        event: "adb.complete",
        deviceId: config.deviceId,
        message: `${commandLine} code=${code ?? "null"} signal=${signal ?? "null"} stdout=[redacted] stderr=${JSON.stringify(stderr)}`,
      });
      finalize({ ok: false, code: ERROR_CODES.RESULT_TRANSPORT_EXITED, error: stderr ? `${base}: ${stderr}` : base,
        diagnostics: { exitCode: code, signal, originalMessage: base } });
    });

    if (cancelSignal?.aborted) {
      abortHandler();
      return;
    }
    cancelSignal?.addEventListener("abort", abortHandler, { once: true });
    broadcastStartTimer = setTimeout(startBroadcast, broadcastDelayMs);
  });
}
