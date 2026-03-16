import { spawn } from "node:child_process";
import type { RuntimeConfig } from "./runtimeConfig.js";

function singleQuoteForDeviceShell(value: string): string {
  // Device-side shell-safe single-quoted literal: 'foo'"'"'bar'
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function buildBroadcastShellCommand(config: RuntimeConfig, payloadJson: string): string {
  const action = singleQuoteForDeviceShell(config.actionAgentCommand);
  const receiverPackage = singleQuoteForDeviceShell(config.receiverPackage);
  const payloadKey = singleQuoteForDeviceShell(config.payloadExtraKey);
  const payload = singleQuoteForDeviceShell(payloadJson.replace(/\n/g, ""));

  return `am broadcast -a ${action} -p ${receiverPackage} --es ${payloadKey} ${payload} --receiver-foreground`;
}

/**
 * Dispatch ACTION_AGENT_COMMAND via adb. Payload is passed as a single argv element
 * with device-shell-safe quoting. Device receives JSON string for Intent.getStringExtra(payload).
 */
export async function broadcastAgentCommand(
  config: RuntimeConfig,
  payloadJson: string
): Promise<{ success: boolean; stdout: string; stderr: string }> {
  const deviceArgs = config.deviceId ? ["-s", config.deviceId] : [];
  const shellCommand = buildBroadcastShellCommand(config, payloadJson);
  const args = [...deviceArgs, "shell", shellCommand];

  return new Promise((resolve) => {
    const proc = spawn(config.adbPath, args, {
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}
