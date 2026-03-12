import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { setupOperator } from "../../domain/device/setupOperator.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import type { PermissionGrantResult } from "../../domain/device/setupOperator.js";

export function didAllPermissionsAlreadyExist(permissions?: PermissionGrantResult): boolean {
  if (!permissions) {
    return false;
  }

  return Boolean(
    permissions.accessibility.alreadyEnabled &&
    permissions.notificationListener.alreadyEnabled &&
    !permissions.notification.skipped
  );
}

export async function cmdOperatorSetup(options: {
  format: OutputOptions["format"];
  apkPath: string;
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  const receiverPackage =
    options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE;
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage,
    adbPath: process.env.ADB_PATH,
  });

  const result = await setupOperator(config, options.apkPath, receiverPackage);

  // Install phase failure.
  if (!result.install.ok) {
    const isNotFound = result.install.error?.startsWith("APK file not found");
    return formatError(
      {
        code: isNotFound ? ERROR_CODES.OPERATOR_APK_NOT_FOUND : ERROR_CODES.OPERATOR_INSTALL_FAILED,
        message: result.install.error ?? "APK install failed.",
        receiverPackage: result.receiverPackage,
        install: result.install,
      },
      options
    );
  }

  // Permission grant phase failure.
  if (result.permissions) {
    const { accessibility, notification, notificationListener } = result.permissions;
    const permFailed =
      !accessibility.ok ? accessibility
        : !notification.ok ? notification
          : !notificationListener.ok ? notificationListener
            : undefined;

    if (permFailed) {
      return formatError(
        {
          code: ERROR_CODES.OPERATOR_GRANT_FAILED,
          message: permFailed.error ?? "Failed to grant required device permissions.",
          receiverPackage: result.receiverPackage,
          install: result.install,
          permissions: {
            accessibility,
            notification,
            notificationListener,
          },
        },
        options
      );
    }
  }

  // Verification phase failure.
  if (result.verification && !result.verification.ok) {
    return formatError(
      {
        code: ERROR_CODES.OPERATOR_VERIFY_FAILED,
        message: result.verification.error ?? "Operator verification failed after install.",
        receiverPackage: result.receiverPackage,
        install: result.install,
        permissions: result.permissions
          ? {
            accessibility: result.permissions.accessibility,
            notification: result.permissions.notification,
            notificationListener: result.permissions.notificationListener,
          }
          : undefined,
        verification: result.verification,
      },
      options
    );
  }

  // All phases succeeded.
  const permissionsAlreadyEnabled = didAllPermissionsAlreadyExist(result.permissions);

  return formatSuccess(
    {
      receiverPackage: result.receiverPackage,
      install: result.install,
      permissions: result.permissions
        ? {
          accessibility: result.permissions.accessibility,
          notification: result.permissions.notification,
          notificationListener: result.permissions.notificationListener,
        }
        : undefined,
      verification: result.verification,
      message: permissionsAlreadyEnabled
        ? "Operator installed. Required permissions were already enabled."
        : "Operator installed and ready. Run clawperator doctor to verify.",
    },
    options
  );
}
