import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { grantDevicePermissions } from "../../domain/device/grantPermissions.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { Logger } from "../../adapters/logger.js";

export async function cmdGrantDevicePermissions(options: {
  format: OutputOptions["format"];
  deviceId?: string;
  receiverPackage?: string;
  logger?: Logger;
}): Promise<string> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: process.env.ADB_PATH,
    logger: options.logger,
  });

  const result = await grantDevicePermissions(config, options.receiverPackage);

  const failedGrant =
    !result.accessibility.ok ? result.accessibility
      : !result.notification.ok ? result.notification
      : !result.notificationListener.ok ? result.notificationListener
      : undefined;

  if (failedGrant) {
    return formatError(
      {
        code: "GRANT_DEVICE_PERMISSIONS_FAILED",
        message: failedGrant.error ?? "Failed to grant required device permissions.",
        receiverPackage: result.receiverPackage,
        accessibility: result.accessibility,
        notification: result.notification,
        notificationListener: result.notificationListener,
      },
      options
    );
  }

  return formatSuccess(
    {
      receiverPackage: result.receiverPackage,
      accessibility: result.accessibility,
      notification: result.notification,
      notificationListener: result.notificationListener,
      message: result.accessibility.alreadyEnabled && result.notificationListener.alreadyEnabled
        ? "Required device permissions were already enabled."
        : "Required device permissions enabled. Run clawperator doctor to verify.",
    },
    options
  );
}
