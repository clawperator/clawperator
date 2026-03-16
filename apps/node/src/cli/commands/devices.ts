import { listDevices } from "../../domain/devices/listDevices.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

export async function cmdDevices(options: OutputOptions): Promise<string> {
  const config = getDefaultRuntimeConfig({
    adbPath: process.env.ADB_PATH,
  });
  try {
    const devices = await listDevices(config);
    return formatSuccess({ devices }, options);
  } catch (e) {
    return formatError(e, options);
  }
}
