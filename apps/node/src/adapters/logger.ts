import { appendFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface LogEvent {
  ts: string;
  level: string;
  event: string;
  commandId?: string;
  taskId?: string;
  deviceId?: string;
  message: string;
}

export interface Logger {
  log(event: LogEvent): void;
  logPath(): string | undefined;
}

const LEVEL_ORDER = new Map([
  ["debug", 0],
  ["info", 1],
  ["warn", 2],
  ["error", 3],
]);

function normalizeLogLevel(level?: string): "debug" | "info" | "warn" | "error" {
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

export function createLogger(options?: { logDir?: string; logLevel?: string }): Logger {
  const configuredDir = options?.logDir?.trim() || process.env.CLAWPERATOR_LOG_DIR?.trim();
  const logDir = configuredDir ? resolve(expandHomePath(configuredDir)) : undefined;
  const threshold = normalizeLogLevel(options?.logLevel ?? process.env.CLAWPERATOR_LOG_LEVEL);
  const state = { warned: false, disabled: false };

  if (!logDir) {
    return {
      log: () => undefined,
      logPath: () => undefined,
    };
  }

  const shouldLog = (level: string): boolean => {
    const normalized = normalizeLogLevel(level);
    return (LEVEL_ORDER.get(normalized) ?? LEVEL_ORDER.get("info") ?? 1) >= (LEVEL_ORDER.get(threshold) ?? 1);
  };

  return {
    log(event: LogEvent): void {
      if (state.disabled) {
        return;
      }
      if (!shouldLog(event.level)) {
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
        state.disabled = true;
      }
    },
    logPath(): string | undefined {
      return formatLogPath(logDir);
    },
  };
}
