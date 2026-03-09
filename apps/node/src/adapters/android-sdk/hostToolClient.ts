import type { ProcessResult } from "../android-bridge/processRunner.js";
import type { RuntimeConfig } from "../android-bridge/runtimeConfig.js";

export type AndroidSdkTool = "adb" | "emulator" | "sdkmanager" | "avdmanager";

function getToolPath(config: RuntimeConfig, tool: AndroidSdkTool): string {
  switch (tool) {
    case "adb":
      return config.adbPath;
    case "emulator":
      return config.emulatorPath;
    case "sdkmanager":
      return config.sdkmanagerPath;
    case "avdmanager":
      return config.avdmanagerPath;
  }
}

export async function runAndroidSdkTool(
  config: RuntimeConfig,
  tool: AndroidSdkTool,
  args: string[],
  options?: { timeoutMs?: number; cwd?: string; input?: string }
): Promise<ProcessResult> {
  return config.runner.run(getToolPath(config, tool), args, options);
}

export async function isAndroidSdkToolAvailable(
  config: RuntimeConfig,
  tool: AndroidSdkTool
): Promise<boolean> {
  const result = await runAndroidSdkTool(config, tool, ["--help"], { timeoutMs: 5_000 });
  if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
    return false;
  }
  return result.code === 0 || result.code === 1 || result.stdout.length > 0 || result.stderr.length > 0;
}
