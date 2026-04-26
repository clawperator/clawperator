import { spawn } from "node:child_process";
import { chmodSync, closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface DaemonPathsOptions {
  baseDir?: string;
  processController?: {
    isAlive(pid: number): boolean;
    kill(pid: number, signal: NodeJS.Signals): void;
  };
  terminationTimeoutMs?: number;
  terminationPollIntervalMs?: number;
  cliEntryPath?: string;
}

export interface DaemonMetadata {
  pid: number;
  startedAt: number;
}

const DEFAULT_TERMINATION_TIMEOUT_MS = 2000;
const DEFAULT_TERMINATION_POLL_INTERVAL_MS = 100;

function getProcessController(options?: DaemonPathsOptions): NonNullable<DaemonPathsOptions["processController"]> {
  return options?.processController ?? {
    isAlive(pid: number): boolean {
      try {
        process.kill(pid, 0);
        return true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        return code === "EPERM";
      }
    },
    kill(pid: number, signal: NodeJS.Signals): void {
      process.kill(pid, signal);
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readDaemonMetadata(path: string): DaemonMetadata | undefined {
  try {
    const raw = readFileSync(path, "utf8").trim();
    if (raw.length === 0) {
      return undefined;
    }
    const parsed = JSON.parse(raw) as Partial<DaemonMetadata>;
    if (
      typeof parsed.pid === "number" &&
      Number.isInteger(parsed.pid) &&
      parsed.pid > 0 &&
      typeof parsed.startedAt === "number" &&
      Number.isFinite(parsed.startedAt)
    ) {
      return { pid: parsed.pid, startedAt: parsed.startedAt };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function removeDaemonFiles(rawDeviceId: string | undefined, options?: DaemonPathsOptions): void {
  rmSync(getDaemonPidPath(rawDeviceId, options), { force: true });
  rmSync(getDaemonSocketPath(rawDeviceId, options), { force: true });
}

export function sanitizeDaemonKey(rawDeviceId: string | undefined): string {
  if (rawDeviceId === undefined || rawDeviceId.trim().length === 0) {
    return "default";
  }
  const sanitized = rawDeviceId.replace(/:/g, "-").replace(/[\/\s]/g, "");
  return sanitized.length > 0 ? sanitized : "default";
}

export function getDaemonDir(options?: DaemonPathsOptions): string {
  const dir = options?.baseDir ?? join(homedir(), ".clawperator");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stats = statSync(dir);
  if (!stats.isDirectory()) {
    throw new Error(`${dir} is not a directory`);
  }
  const currentMode = stats.mode & 0o777;
  if (currentMode !== 0o700) {
    chmodSync(dir, 0o700);
  }
  return dir;
}

export function getDaemonSocketPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string {
  return join(getDaemonDir(options), `daemon-${sanitizeDaemonKey(rawDeviceId)}.sock`);
}

export function getDaemonPidPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string {
  return join(getDaemonDir(options), `daemon-${sanitizeDaemonKey(rawDeviceId)}.pid`);
}

export function getDaemonLogPath(rawDeviceId: string | undefined, options?: DaemonPathsOptions): string {
  return join(getDaemonDir(options), `daemon-${sanitizeDaemonKey(rawDeviceId)}.log`);
}

export async function isDaemonRunning(rawDeviceId: string | undefined, options?: DaemonPathsOptions): Promise<boolean> {
  const metadata = readDaemonMetadata(getDaemonPidPath(rawDeviceId, options));
  if (!metadata) {
    return false;
  }
  return getProcessController(options).isAlive(metadata.pid);
}

export async function stopDaemon(
  rawDeviceId: string | undefined,
  options?: DaemonPathsOptions
): Promise<"stopped" | "not_running"> {
  const pidPath = getDaemonPidPath(rawDeviceId, options);
  const metadata = readDaemonMetadata(pidPath);
  if (!metadata) {
    return "not_running";
  }

  const controller = getProcessController(options);
  if (!controller.isAlive(metadata.pid)) {
    removeDaemonFiles(rawDeviceId, options);
    return "not_running";
  }

  controller.kill(metadata.pid, "SIGTERM");
  const timeoutMs = options?.terminationTimeoutMs ?? DEFAULT_TERMINATION_TIMEOUT_MS;
  const pollIntervalMs = options?.terminationPollIntervalMs ?? DEFAULT_TERMINATION_POLL_INTERVAL_MS;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!controller.isAlive(metadata.pid)) {
      removeDaemonFiles(rawDeviceId, options);
      return "stopped";
    }
    await delay(pollIntervalMs);
  }

  throw new Error(`Daemon process ${metadata.pid} did not exit within ${timeoutMs}ms`);
}

export function spawnDaemonRun(
  rawDeviceId: string | undefined,
  operatorPackage?: string,
  options?: DaemonPathsOptions
): void {
  const logPath = getDaemonLogPath(rawDeviceId, options);
  mkdirSync(dirname(logPath), { recursive: true, mode: 0o700 });
  const logFd = openSync(logPath, "a", 0o600);
  try {
    const cliEntryPath = options?.cliEntryPath ?? process.argv[1];
    const args = [cliEntryPath, "daemon", "run"];
    if (rawDeviceId !== undefined && rawDeviceId.trim().length > 0) {
      args.push("--device", rawDeviceId);
    }
    if (operatorPackage !== undefined && operatorPackage.trim().length > 0) {
      args.push("--operator-package", operatorPackage);
    }

    const child = spawn(process.execPath, args, {
      detached: true,
      stdio: ["ignore", logFd, logFd],
    });
    child.unref();
  } finally {
    closeSync(logFd);
  }
}

export function readDaemonPidMetadata(
  rawDeviceId: string | undefined,
  options?: DaemonPathsOptions
): DaemonMetadata | undefined {
  return readDaemonMetadata(getDaemonPidPath(rawDeviceId, options));
}

export function writeDaemonPidMetadata(
  rawDeviceId: string | undefined,
  metadata: DaemonMetadata,
  options?: DaemonPathsOptions
): void {
  writeFileSync(getDaemonPidPath(rawDeviceId, options), `${JSON.stringify(metadata)}\n`, { mode: 0o600 });
}

export function cleanupDaemonFiles(rawDeviceId: string | undefined, options?: DaemonPathsOptions): void {
  removeDaemonFiles(rawDeviceId, options);
}
