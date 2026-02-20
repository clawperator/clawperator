import { type ProcessRunner, NodeProcessRunner } from "./processRunner.js";

export const DEFAULT_ACTION_AGENT_COMMAND = "app.clawperator.operator.ACTION_AGENT_COMMAND";
export const EXTRA_AGENT_PAYLOAD = "payload";

export interface RuntimeConfig {
  /** adb binary path */
  adbPath: string;
  /** Target device serial (optional; resolved by domain if not set) */
  deviceId?: string;
  /** Receiver package for broadcast -p (required at dispatch time) */
  receiverPackage: string;
  /** Action name for agent command broadcast */
  actionAgentCommand: string;
  /** Intent extra key for JSON payload */
  payloadExtraKey: string;
  /** Process runner for executing commands (optional, defaults to NodeProcessRunner) */
  runner: ProcessRunner;
}

export function getDefaultRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<RuntimeConfig>;

  return {
    adbPath: "adb",
    receiverPackage: "com.clawperator.operator.dev",
    actionAgentCommand: DEFAULT_ACTION_AGENT_COMMAND,
    payloadExtraKey: EXTRA_AGENT_PAYLOAD,
    runner: new NodeProcessRunner(),
    ...definedOverrides,
  };
}
