import { runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { broadcastAgentCommand } from "../../../adapters/android-bridge/broadcastAgentCommand.js";
import { waitForResultEnvelope } from "../../../adapters/android-bridge/logcatResultReader.js";

export async function checkApkPresence(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const { stdout } = await runAdb(config, ["shell", "pm", "list", "packages", config.receiverPackage]);
  const isInstalled = stdout.includes(`package:${config.receiverPackage}`);

  if (!isInstalled) {
    // Check if the other variant is installed
    const otherVariant = config.receiverPackage.endsWith(".dev") 
      ? config.receiverPackage.replace(".dev", "") 
      : config.receiverPackage + ".dev";
    
    const { stdout: otherStdout } = await runAdb(config, ["shell", "pm", "list", "packages", otherVariant]);
    if (otherStdout.includes(`package:${otherVariant}`)) {
      return {
        id: "readiness.apk.presence",
        status: "fail",
        code: ERROR_CODES.RECEIVER_VARIANT_MISMATCH,
        summary: `Wrong Operator variant installed.`,
        detail: `Expected ${config.receiverPackage} but found ${otherVariant}.`,
        fix: {
          title: "Switch variant",
          commands: [`# Use --receiver-package ${otherVariant} or reinstall the correct APK`],
        },
      };
    }

    return {
      id: "readiness.apk.presence",
      status: "fail",
      code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
      summary: "Operator APK not installed.",
      detail: `Package ${config.receiverPackage} was not found on the device.`,
      fix: {
        title: "Install Operator APK",
        commands: ["./gradlew :apps:android:app:installDebug"],
      },
    };
  }

  return {
    id: "readiness.apk.presence",
    status: "pass",
    summary: `Operator APK (${config.receiverPackage}) is installed.`,
  };
}

export async function checkSettings(config: RuntimeConfig): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  const devOptions = await runAdb(config, ["shell", "settings", "get", "global", "development_settings_enabled"]);
  if (devOptions.stdout.trim() !== "1") {
    results.push({
      id: "readiness.settings.dev_options",
      status: "fail",
      code: ERROR_CODES.DEVICE_DEV_OPTIONS_DISABLED,
      summary: "Developer options are disabled.",
      detail: "Enable Developer Options in Android Settings (Tap Build Number 7 times).",
    });
  } else {
    results.push({ id: "readiness.settings.dev_options", status: "pass", summary: "Developer options are enabled." });
  }

  const adbEnabled = await runAdb(config, ["shell", "settings", "get", "global", "adb_enabled"]);
  if (adbEnabled.stdout.trim() !== "1") {
    results.push({
      id: "readiness.settings.usb_debugging",
      status: "fail",
      code: ERROR_CODES.DEVICE_USB_DEBUGGING_DISABLED,
      summary: "USB debugging is disabled.",
    });
  } else {
    results.push({ id: "readiness.settings.usb_debugging", status: "pass", summary: "USB debugging is enabled." });
  }

  return results;
}

export async function runHandshake(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const commandId = `handshake-${Date.now()}`;
  const payload = JSON.stringify({
    commandId,
    taskId: "doctor-handshake",
    source: "clawperator-doctor",
    expectedFormat: "android-ui-automator",
    actions: [{ id: "h1", type: "snapshot_ui" }],
    timeoutMs: 5000,
  });

  // Clear logcat for clean handshake capture
  await runAdb(config, ["logcat", "-c"]);

  const result = await waitForResultEnvelope(
    config,
    { commandId, timeoutMs: 7000 },
    async () => broadcastAgentCommand(config, payload)
  );

  if (result.ok) {
    if (result.envelope.status === "success") {
      return {
        id: "readiness.handshake",
        status: "pass",
        summary: "Handshake successful.",
        detail: "Node successfully dispatched a command and received a valid result envelope.",
      };
    } else {
      return {
        id: "readiness.handshake",
        status: "fail",
        code: ERROR_CODES.DEVICE_ACCESSIBILITY_NOT_RUNNING,
        summary: "Handshake failed (runtime error).",
        detail: `Operator returned an error: ${result.envelope.error}`,
        fix: {
          title: "Check Accessibility Service",
          commands: ["# Ensure Clawperator Accessibility Service is ON in Android Settings"],
        },
      };
    }
  }

  if ("timeout" in result && result.timeout) {
    return {
      id: "readiness.handshake",
      status: "fail",
      code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
      summary: "Handshake timed out.",
      detail: "No [Clawperator-Result] envelope received. Is the Accessibility Service running?",
      fix: {
        title: "Check Accessibility Service",
        commands: ["# Ensure Clawperator Accessibility Service is ON in Android Settings"],
      },
    };
  }

  return {
    id: "readiness.handshake",
    status: "fail",
    summary: "Handshake failed with an unknown error.",
    detail: "error" in result ? result.error : "Unknown error",
  };
}

export async function runSmokeTest(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const commandId = `smoke-${Date.now()}`;
  const payload = JSON.stringify({
    commandId,
    taskId: "doctor-smoke",
    source: "clawperator-doctor",
    expectedFormat: "android-ui-automator",
    actions: [
      { id: "s1", type: "close_app", params: { applicationId: "com.android.settings" } },
      { id: "s2", type: "open_app", params: { applicationId: "com.android.settings" } },
      { id: "s3", type: "snapshot_ui" },
    ],
    timeoutMs: 10000,
  });

  const result = await waitForResultEnvelope(
    config,
    { commandId, timeoutMs: 12000 },
    async () => broadcastAgentCommand(config, payload)
  );

  if (result.ok) {
    const hasSettings = result.envelope.stepResults.some(s => 
      s.actionType === "snapshot_ui" && s.success
    );
    if (hasSettings) {
      return {
        id: "readiness.smoke",
        status: "pass",
        summary: "Smoke test successful.",
        detail: "Settings app opened and observed via UI snapshot.",
      };
    }
  }

  return {
    id: "readiness.smoke",
    status: "fail",
    code: ERROR_CODES.SMOKE_OPEN_SETTINGS_FAILED,
    summary: "Smoke test failed.",
    detail: "Could not open Settings or observe its UI.",
  };
}
