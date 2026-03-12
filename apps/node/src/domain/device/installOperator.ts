import { existsSync } from "node:fs";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import {
  detectReceiverPackage,
  grantDevicePermissions,
  hasListedPackage,
  type PermissionGrantResult,
} from "./grantPermissions.js";

export interface InstallPhaseResult {
  ok: boolean;
  error?: string;
  exitCode?: number | null;
}

export interface VerifyPhaseResult {
  ok: boolean;
  packageInstalled: boolean;
  error?: string;
}

export interface OperatorInstallResult {
  receiverPackage: string;
  install: InstallPhaseResult;
  permissions?: PermissionGrantResult;
  verification?: VerifyPhaseResult;
}

/**
 * Install the Clawperator Operator APK and bring the device to a ready state.
 *
 * Steps:
 *   1. Validate apkPath exists on the local filesystem.
 *   2. Run `adb install -r <apkPath>`.
 *   3. Detect or use the provided receiver package.
 *   4. Grant required device permissions (accessibility, notification listener).
 *   5. Verify the package is installed and accessible via pm list.
 */
export async function installOperator(
  config: RuntimeConfig,
  apkPath: string,
  receiverPackage?: string
): Promise<OperatorInstallResult> {
  // Step 1: Check that the APK file exists before invoking adb.
  if (!existsSync(apkPath)) {
    return {
      receiverPackage: receiverPackage ?? "<unknown>",
      install: {
        ok: false,
        error: `APK file not found: ${apkPath}`,
      },
    };
  }

  // Step 2: Install APK.
  const adbInstall = await runAdb(config, ["install", "-r", apkPath]);
  if (adbInstall.code !== 0) {
    const error = [adbInstall.stderr, adbInstall.stdout].filter(Boolean).join(" ").trim();
    return {
      receiverPackage: receiverPackage ?? "<unknown>",
      install: {
        ok: false,
        error: error || "adb install returned a non-zero exit code",
        exitCode: adbInstall.code,
      },
    };
  }

  const install: InstallPhaseResult = { ok: true };

  // Step 3: Resolve receiver package.
  const pkg = receiverPackage ?? (await detectReceiverPackage(config));
  if (!pkg) {
    return {
      receiverPackage: "<unknown>",
      install,
      permissions: {
        receiverPackage: "<unknown>",
        accessibility: {
          ok: false,
          alreadyEnabled: false,
          error: "Could not detect installed Operator package after install. Use --receiver-package to specify the package explicitly.",
        },
        notification: { ok: false, skipped: true },
        notificationListener: { ok: false, alreadyEnabled: false },
      },
    };
  }

  // Step 4: Grant permissions using shared domain logic.
  const permissions = await grantDevicePermissions(config, pkg);
  const permFailed =
    !permissions.accessibility.ok
      ? permissions.accessibility
      : !permissions.notification.ok
        ? permissions.notification
        : !permissions.notificationListener.ok
          ? permissions.notificationListener
          : undefined;

  if (permFailed) {
    return { receiverPackage: pkg, install, permissions };
  }

  // Step 5: Lightweight post-install verification.
  const pkgCheck = await runAdb(config, ["shell", "pm", "list", "packages", pkg]);
  const packageInstalled =
    pkgCheck.code === 0 && hasListedPackage(pkgCheck.stdout, pkg);

  const verification: VerifyPhaseResult = {
    ok: packageInstalled,
    packageInstalled,
    error: packageInstalled ? undefined : `Package ${pkg} was not found after install.`,
  };

  return { receiverPackage: pkg, install, permissions, verification };
}
