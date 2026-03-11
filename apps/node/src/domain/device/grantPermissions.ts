import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

const DEFAULT_DEBUG_PACKAGE = "com.clawperator.operator.dev";
const DEFAULT_RELEASE_PACKAGE = "com.clawperator.operator";
const ACCESSIBILITY_SERVICE_CLASS =
  "clawperator.operator.accessibilityservice.OperatorAccessibilityService";
const NOTIFICATION_LISTENER_SERVICE_CLASS =
  "action.notification.NotificationListenerService";

export interface AccessibilityGrantResult {
  ok: boolean;
  alreadyEnabled: boolean;
  error?: string;
}

export interface NotificationGrantResult {
  ok: boolean;
  skipped: boolean;
  error?: string;
}

export interface NotificationListenerGrantResult {
  ok: boolean;
  alreadyEnabled: boolean;
  error?: string;
}

export interface PermissionGrantResult {
  receiverPackage: string;
  accessibility: AccessibilityGrantResult;
  notification: NotificationGrantResult;
  notificationListener: NotificationListenerGrantResult;
}

export async function detectReceiverPackage(config: RuntimeConfig): Promise<string | undefined> {
  for (const pkg of [DEFAULT_RELEASE_PACKAGE, DEFAULT_DEBUG_PACKAGE]) {
    const result = await runAdb(config, ["shell", "pm", "list", "packages", pkg]);
    if (result.code === 0 && result.stdout.trim().includes(`package:${pkg}`)) {
      return pkg;
    }
  }
  return undefined;
}

export async function grantAccessibilityPermission(
  config: RuntimeConfig,
  receiverPackage: string
): Promise<AccessibilityGrantResult> {
  const svc = `${receiverPackage}/${ACCESSIBILITY_SERVICE_CLASS}`;

  const currentResult = await runAdb(config, [
    "shell", "settings", "get", "secure", "enabled_accessibility_services",
  ]);
  if (currentResult.code !== 0) {
    return { ok: false, alreadyEnabled: false, error: currentResult.stderr || "Could not read accessibility services" };
  }

  const current = currentResult.stdout.trim();
  const alreadyEnabled = current.includes(svc);

  if (alreadyEnabled) {
    return { ok: true, alreadyEnabled: true };
  }

  const newValue = !current || current === "null" ? svc : `${current}:${svc}`;

  const enableResult = await runAdb(config, [
    "shell", "settings", "put", "secure", "accessibility_enabled", "1",
  ]);
  if (enableResult.code !== 0) {
    return { ok: false, alreadyEnabled: false, error: enableResult.stderr || "Could not set accessibility_enabled" };
  }

  const setResult = await runAdb(config, [
    "shell", "settings", "put", "secure", "enabled_accessibility_services", newValue,
  ]);
  if (setResult.code !== 0) {
    return { ok: false, alreadyEnabled: false, error: setResult.stderr || "Could not set enabled_accessibility_services" };
  }

  return { ok: true, alreadyEnabled: false };
}

export async function grantNotificationPermission(
  config: RuntimeConfig,
  receiverPackage: string
): Promise<NotificationGrantResult> {
  const result = await runAdb(config, [
    "shell", "pm", "grant", receiverPackage, "android.permission.POST_NOTIFICATIONS",
  ]);
  if (result.code !== 0) {
    // Android <13 or already granted - not fatal, treat as a successful skip
    return { ok: true, skipped: true, error: result.stderr || undefined };
  }
  return { ok: true, skipped: false };
}

export async function grantNotificationListenerPermission(
  config: RuntimeConfig,
  receiverPackage: string
): Promise<NotificationListenerGrantResult> {
  const svc = `${receiverPackage}/${NOTIFICATION_LISTENER_SERVICE_CLASS}`;

  const currentResult = await runAdb(config, [
    "shell", "settings", "get", "secure", "enabled_notification_listeners",
  ]);
  if (currentResult.code !== 0) {
    return { ok: false, alreadyEnabled: false, error: currentResult.stderr || "Could not read notification listeners" };
  }

  const current = currentResult.stdout.trim();
  const alreadyEnabled = current.includes(svc);

  if (alreadyEnabled) {
    return { ok: true, alreadyEnabled: true };
  }

  const newValue = !current || current === "null" ? svc : `${current}:${svc}`;

  const setResult = await runAdb(config, [
    "shell", "settings", "put", "secure", "enabled_notification_listeners", newValue,
  ]);
  if (setResult.code !== 0) {
    return { ok: false, alreadyEnabled: false, error: setResult.stderr || "Could not set enabled_notification_listeners" };
  }

  return { ok: true, alreadyEnabled: false };
}

export async function grantDevicePermissions(
  config: RuntimeConfig,
  receiverPackage?: string
): Promise<PermissionGrantResult> {
  const pkg = receiverPackage ?? config.receiverPackage ?? await detectReceiverPackage(config);
  if (!pkg) {
    return {
      receiverPackage: "<unknown>",
      accessibility: {
        ok: false,
        alreadyEnabled: false,
        error: "No Clawperator Operator APK found on device. Install the APK first.",
      },
      notification: { ok: false, skipped: true },
      notificationListener: { ok: false, alreadyEnabled: false },
    };
  }

  const accessibility = await grantAccessibilityPermission(config, pkg);
  const notification = await grantNotificationPermission(config, pkg);
  const notificationListener = await grantNotificationListenerPermission(config, pkg);

  return { receiverPackage: pkg, accessibility, notification, notificationListener };
}
