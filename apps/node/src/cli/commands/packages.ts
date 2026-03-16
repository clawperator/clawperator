import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { resolveDevice } from "../../domain/devices/resolveDevice.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

export async function cmdPackagesList(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  thirdParty?: boolean;
}): Promise<string> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    adbPath: process.env.ADB_PATH,
  });
  try {
    const resolved = await resolveDevice(config);
    config.deviceId = resolved.deviceId;
    const args = options.thirdParty ? ["shell", "pm", "list", "packages", "-3"] : ["shell", "pm", "list", "packages"];
    const { stdout } = await runAdb(config, args);
    const packages = stdout
      .split("\n")
      .map((l) => l.replace(/^package:/, "").trim())
      .filter(Boolean);
    return formatSuccess({ packages }, options);
  } catch (e) {
    return formatError(e, options);
  }
}
