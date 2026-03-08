import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { type ProcessRunner } from "../../adapters/android-bridge/processRunner.js";
import { type ClawperatorError } from "../../contracts/errors.js";
import { resolveDevice } from "../../domain/devices/resolveDevice.js";
import { getCliVersion, probeVersionCompatibility } from "../../domain/version/compatibility.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatSuccess } from "../output.js";

export async function cmdVersion(options: OutputOptions & {
  checkCompat?: boolean;
  deviceId?: string;
  receiverPackage?: string;
  runner?: ProcessRunner;
}): Promise<string> {
  if (!options.checkCompat) {
    return formatSuccess({ cliVersion: getCliVersion() }, options);
  }

  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: process.env.ADB_PATH,
    runner: options.runner,
  });

  try {
    const resolved = await resolveDevice(config);
    config.deviceId = resolved.deviceId;

    const result = await probeVersionCompatibility(config);
    process.exitCode = result.compatible ? 0 : 1;
    return formatSuccess({
      cliVersion: result.cliVersion,
      apkVersion: result.apkVersion,
      apkVersionCode: result.apkVersionCode,
      receiverPackage: result.receiverPackage,
      compatible: result.compatible,
      error: result.error,
      remediation: result.remediation,
    }, options);
  } catch (error) {
    process.exitCode = 1;
    return formatError(error as ClawperatorError, options);
  }
}
