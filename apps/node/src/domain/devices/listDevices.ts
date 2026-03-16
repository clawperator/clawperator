import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

export interface DeviceInfo {
  serial: string;
  state: string;
}

/** Parse `adb devices` output. Lines like `SERIAL\tstate`. */
export async function listDevices(config: RuntimeConfig): Promise<DeviceInfo[]> {
  const { stdout } = await runAdb(config, ["devices"]);
  const lines = stdout.trim().split("\n").slice(1); // skip "List of devices attached"
  const devices: DeviceInfo[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [serial, state] = trimmed.split(/\t/);
    if (serial) {
      devices.push({ serial, state: state ?? "unknown" });
    }
  }
  return devices;
}
