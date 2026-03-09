import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { type ProcessRunner, NodeProcessRunner } from "./processRunner.js";

export const DEFAULT_ACTION_AGENT_COMMAND = "app.clawperator.operator.ACTION_AGENT_COMMAND";
export const EXTRA_AGENT_PAYLOAD = "payload";

export interface RuntimeConfig {
  /** Root directory of the clawperator project */
  projectRoot: string;
  /** adb binary path */
  adbPath: string;
  /** emulator binary path */
  emulatorPath: string;
  /** sdkmanager binary path */
  sdkmanagerPath: string;
  /** avdmanager binary path */
  avdmanagerPath: string;
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

function resolveDefaultSdkToolPath(
  fallback: string,
  candidatePaths: string[]
): string {
  for (const candidatePath of candidatePaths) {
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  return fallback;
}

export function getDefaultRuntimeConfig(overrides?: Partial<RuntimeConfig>): RuntimeConfig {
  const definedOverrides = Object.fromEntries(
    Object.entries(overrides ?? {}).filter(([, value]) => value !== undefined)
  ) as Partial<RuntimeConfig>;

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const defaultProjectRoot = join(__dirname, "../../../../..");
  const homeDirectory = process.env.HOME;
  const defaultEmulatorPath = resolveDefaultSdkToolPath("emulator", [
    ...(homeDirectory ? [join(homeDirectory, "Library/Android/sdk/emulator/emulator")] : []),
    "/opt/homebrew/share/android-commandlinetools/emulator/emulator",
  ]);

  return {
    projectRoot: defaultProjectRoot,
    adbPath: "adb",
    emulatorPath: defaultEmulatorPath,
    sdkmanagerPath: "sdkmanager",
    avdmanagerPath: "avdmanager",
    receiverPackage: "com.clawperator.operator",
    actionAgentCommand: DEFAULT_ACTION_AGENT_COMMAND,
    payloadExtraKey: EXTRA_AGENT_PAYLOAD,
    runner: new NodeProcessRunner(),
    ...definedOverrides,
  };
}
