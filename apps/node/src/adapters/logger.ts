import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
  type LogEvent,
  type LogLevel,
  type ClawperatorLogger,
  LEVEL_ORDER,
  resolveRoutingRule,
  DEFAULT_ROUTING_RULES,
} from "../contracts/logging.js";

// Re-export contract types for consumers
export type { LogEvent, LogLevel, ClawperatorLogger };

/**
 * Compatibility: the old Logger interface had log() instead of emit().
 * During migration (Phase 1 -> Phase 2), callers that still use log()
 * go through this extended type. Once Phase 2 migrates all call sites
 * to emit(), this can be collapsed to just ClawperatorLogger.
 */
export interface Logger extends ClawperatorLogger {
  log(event: LogEvent): void;
  /** Override child() to return Logger so callers keep the log() shim. */
  child(defaultContext: Partial<LogEvent>): Logger;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function normalizeLogLevel(level?: string): LogLevel {
  const lowered = level?.toLowerCase();
  return lowered === "debug" || lowered === "warn" || lowered === "error" ? lowered : "info";
}

function expandHomePath(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return join(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

function formatDate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLogPath(logDir: string, date = new Date()): string {
  return join(logDir, `clawperator-${formatDate(date)}.log`);
}

function warnOnce(state: { warned: boolean }, message: string): void {
  if (state.warned) {
    return;
  }
  state.warned = true;
  process.stderr.write(message);
}

// ---------------------------------------------------------------------------
// Unified logger factory
// ---------------------------------------------------------------------------

export interface CreateClawperatorLoggerOptions {
  logDir?: string;
  logLevel?: string;
  outputFormat?: "json" | "pretty";
}

/**
 * Create a unified Clawperator logger with file and terminal routing.
 *
 * File destination: NDJSON lines at `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`.
 * Terminal destination: selected events written to stderr in pretty mode, suppressed in JSON mode.
 * Fail-open: if the log directory is unavailable, one stderr warning then file logging disabled.
 */
export function createClawperatorLogger(options?: CreateClawperatorLoggerOptions): Logger {
  const configuredDir =
    options?.logDir?.trim() ||
    process.env.CLAWPERATOR_LOG_DIR?.trim() ||
    "~/.clawperator/logs";
  const logDir = resolve(expandHomePath(configuredDir));
  const threshold = normalizeLogLevel(options?.logLevel ?? process.env.CLAWPERATOR_LOG_LEVEL);
  const outputFormat = options?.outputFormat ?? "json";
  const state = { warned: false, fileDisabled: false };

  function shouldLogToFile(level: LogLevel): boolean {
    return (LEVEL_ORDER.get(level) ?? 1) >= (LEVEL_ORDER.get(threshold) ?? 1);
  }

  function writeToFile(event: LogEvent): void {
    if (state.fileDisabled) {
      return;
    }
    const path = formatLogPath(logDir);
    try {
      mkdirSync(logDir, { recursive: true });
      appendFileSync(path, `${JSON.stringify(event)}\n`, "utf8");
    } catch (error) {
      const message =
        error instanceof Error
          ? `[clawperator] WARN: logging disabled after write failure for ${path}: ${error.message}\n`
          : `[clawperator] WARN: logging disabled after write failure for ${path}\n`;
      warnOnce(state, message);
      state.fileDisabled = true;
    }
  }

  function writeToTerminal(event: LogEvent): void {
    process.stderr.write(`${event.message}\n`);
  }

  function buildLogger(defaultContext?: Partial<LogEvent>): Logger {
    function emitEvent(event: LogEvent): void {
      // Merge child context into event. Explicit event fields take precedence.
      const merged: LogEvent = defaultContext
        ? { ...defaultContext, ...event } as LogEvent
        : event;

      const rule = resolveRoutingRule(merged.event, DEFAULT_ROUTING_RULES);

      // File destination
      if (rule.file && shouldLogToFile(merged.level)) {
        writeToFile(merged);
      }

      // Terminal destination
      if (rule.terminal) {
        const isJsonMode = outputFormat === "json";
        if (!isJsonMode || rule.terminalInJsonMode) {
          writeToTerminal(merged);
        }
      }
    }

    return {
      emit: emitEvent,

      /**
       * Compatibility shim: log() delegates to emit() via closure.
       * Safe to destructure or pass as a callback - no `this` dependency.
       */
      log: emitEvent,

      child(childContext: Partial<LogEvent>): Logger {
        const mergedContext: Partial<LogEvent> = defaultContext
          ? { ...defaultContext, ...childContext }
          : childContext;
        return buildLogger(mergedContext);
      },

      logPath(): string | undefined {
        if (state.fileDisabled) {
          return undefined;
        }
        return formatLogPath(logDir);
      },
    };
  }

  return buildLogger();
}

/**
 * Compatibility alias: createLogger maps to createClawperatorLogger.
 * During migration, call sites that import createLogger continue to work.
 * The returned logger uses emit() instead of log(). Callers using the old
 * log() method must migrate to emit().
 */
export function createLogger(options?: { logDir?: string; logLevel?: string }): Logger {
  return createClawperatorLogger({
    logDir: options?.logDir,
    logLevel: options?.logLevel,
  });
}
