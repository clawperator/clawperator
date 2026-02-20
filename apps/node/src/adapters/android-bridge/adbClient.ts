
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
  const result = await config.runner.run(config.adbPath, deviceArgs, options);

  if (result.error && (result.error as any).code === "ENOENT") {
    return { stdout: result.stdout, stderr: `ADB command not found at path: ${config.adbPath}`, code: 127 };
  }

  return result;
}

/**
 * Check if adb is available and (optionally) server is reachable.
 */
export async function isAdbAvailable(config: RuntimeConfig): Promise<boolean> {
  const { code, stderr } = await runAdb(config, ["version"], { timeoutMs: 5000 });
  return code === 0 && !stderr.includes("command not found");
}
