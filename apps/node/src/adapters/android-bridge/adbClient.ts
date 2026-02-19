import { spawn } from "node:child_process";
import { type RuntimeConfig } from "./runtimeConfig.js";

export interface AdbResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

/**
 * Run adb with optional device serial. Does not interpolate payload in shell.
 */
export async function runAdb(
  config: RuntimeConfig,
  args: string[],
  options?: { timeoutMs?: number }
): Promise<AdbResult> {
  const deviceArgs = config.deviceId ? ["-s", config.deviceId, ...args] : args;
  return new Promise((resolve) => {
    const proc = spawn(config.adbPath, deviceArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    const timeoutMs = options?.timeoutMs ?? 30_000;
    const t = setTimeout(() => {
      proc.kill("SIGTERM");
    }, timeoutMs);
    proc.on("close", (code) => {
      clearTimeout(t);
      resolve({ stdout, stderr, code: code ?? null });
    });
  });
}

/**
 * Check if adb is available and (optionally) server is reachable.
 */
export async function isAdbAvailable(config: RuntimeConfig): Promise<boolean> {
  const { code, stderr } = await runAdb(config, ["version"], { timeoutMs: 5000 });
  return code === 0 && !stderr.includes("command not found");
}
