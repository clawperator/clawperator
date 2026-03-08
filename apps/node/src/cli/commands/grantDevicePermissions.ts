import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { grantDevicePermissions } from "../../domain/device/grantPermissions.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

export async function cmdGrantDevicePermissions(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: process.env.ADB_PATH,
  });

  const result = await grantDevicePermissions(config, options.receiverPackage);

  if (!result.accessibility.ok && !result.accessibility.alreadyEnabled) {
    return formatError(
      {
        code: "GRANT_DEVICE_PERMISSIONS_FAILED",
        message: result.accessibility.error ?? "Failed to grant accessibility permission.",
        receiverPackage: result.receiverPackage,
        notification: result.notification,
      },
      options
    );
  }

  return formatSuccess(
    {
      receiverPackage: result.receiverPackage,
      accessibility: result.accessibility,
      notification: result.notification,
      message: result.accessibility.alreadyEnabled
        ? "Accessibility service was already enabled."
        : "Accessibility service enabled. Run clawperator doctor to verify.",
    },
    options
  );
}
