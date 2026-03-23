import { runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { broadcastAgentCommand } from "../../../adapters/android-bridge/broadcastAgentCommand.js";
import { waitForResultEnvelope } from "../../../adapters/android-bridge/logcatResultReader.js";
import {
  getAlternateOperatorVariant,
  getCliVersion,
  getOperatorApkDownloadUrl,
  getOperatorApkSha256Url,
  getOperatorPackageApkPath,
  hasListedPackage,
  probeVersionCompatibility,
} from "../../version/compatibility.js";

export async function checkApkPresence(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const packageList = await runAdb(config, ["shell", "pm", "list", "packages", config.operatorPackage]);
  if (packageList.code !== 0) {
    return {
      id: "readiness.apk.presence",
      status: "fail",
      code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
      summary: "Could not query installed packages on the device.",
      detail: packageList.stderr || undefined,
      evidence: {
        operatorPackage: config.operatorPackage,
        exitCode: packageList.code ?? undefined,
      },
    };
  }
  const isInstalled = hasListedPackage(packageList.stdout, config.operatorPackage);

  if (!isInstalled) {
    // Check if the other variant is installed
    const otherVariant = getAlternateOperatorVariant(config.operatorPackage);

    const alternateList = await runAdb(config, ["shell", "pm", "list", "packages", otherVariant]);
    if (alternateList.code !== 0) {
      return {
        id: "readiness.apk.presence",
        status: "fail",
        code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
        summary: "Could not query installed packages on the device.",
        detail: alternateList.stderr || undefined,
        evidence: {
          operatorPackage: otherVariant,
          exitCode: alternateList.code ?? undefined,
        },
      };
    }
    if (hasListedPackage(alternateList.stdout, otherVariant)) {
      return {
        id: "readiness.apk.presence",
        status: "warn",
        code: ERROR_CODES.RECEIVER_VARIANT_MISMATCH,
        summary: `Wrong Operator variant installed.`,
        detail: `Expected ${config.operatorPackage} but found ${otherVariant}.`,
        fix: {
          title: "Switch variant",
          platform: "any",
          steps: [
            { kind: "manual", value: `Use --operator-package ${otherVariant} or reinstall the correct APK` },
            { kind: "manual", value: `Public installs typically use com.clawperator.operator; local debug builds use com.clawperator.operator.dev` },
          ],
        },
      };
    }

    return {
      id: "readiness.apk.presence",
      status: "fail",
      code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
      summary: "Operator APK not installed.",
      detail: `Package ${config.operatorPackage} was not found on the device.`,
      evidence: {
        cliVersion: getCliVersion(),
        operatorPackage: config.operatorPackage,
      },
      fix: {
        title: "Install Operator APK",
        platform: "any",
        steps: [
          config.operatorPackage.endsWith(".dev")
            ? { kind: "manual", value: "If you do not already have a local debug APK copy, rebuild the debug app from the same checkout before rerunning setup." }
            : {
                kind: "manual",
                value: `Download the exact release APK from ${getOperatorApkDownloadUrl(getCliVersion())} and the checksum from ${getOperatorApkSha256Url(getCliVersion())}.`,
              },
          {
            kind: "shell",
            value: `clawperator operator setup --apk ${getOperatorPackageApkPath(config.operatorPackage)} --device ${config.deviceId}${config.operatorPackage !== "com.clawperator.operator" ? ` --operator-package ${config.operatorPackage}` : ""}`,
          },
        ],
      },
    };
  }

  return {
    id: "readiness.apk.presence",
    status: "pass",
    summary: `Operator APK (${config.operatorPackage}) is installed.`,
  };
}

export async function checkSettings(config: RuntimeConfig): Promise<DoctorCheckResult[]> {
  const results: DoctorCheckResult[] = [];

  const devOptions = await runAdb(config, ["shell", "settings", "get", "global", "development_settings_enabled"]);
  if (devOptions.stdout.trim() !== "1") {
    results.push({
      id: "readiness.settings.dev_options",
      status: "warn",
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
      status: "warn",
      code: ERROR_CODES.DEVICE_USB_DEBUGGING_DISABLED,
      summary: "USB debugging is disabled.",
    });
  } else {
    results.push({ id: "readiness.settings.usb_debugging", status: "pass", summary: "USB debugging is enabled." });
  }

  return results;
}

export async function checkVersionCompatibility(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const result = await probeVersionCompatibility(config);
  const errorCode = result.error?.code ?? ERROR_CODES.VERSION_INCOMPATIBLE;

  if (result.compatible) {
    return {
      id: "readiness.version.compatibility",
      status: "pass",
      summary: `CLI ${result.cliVersion} is compatible with installed APK ${result.apkVersion}.`,
      evidence: {
        cliVersion: result.cliVersion,
        apkVersion: result.apkVersion,
        apkVersionCode: result.apkVersionCode,
        operatorPackage: result.operatorPackage,
      },
    };
  }

  return {
    id: "readiness.version.compatibility",
    status: "fail",
    code: errorCode,
    summary: errorCode === ERROR_CODES.VERSION_INCOMPATIBLE
      ? "CLI and installed APK versions are not compatible."
      : "Could not verify CLI and installed APK version compatibility.",
    detail: result.error?.message,
    fix: result.remediation && result.remediation.length > 0
      ? {
        title: "Align CLI and APK versions",
        platform: "any",
        steps: result.remediation.map(step => ({ kind: "manual" as const, value: step })),
      }
      : undefined,
    evidence: {
      cliVersion: result.cliVersion,
      apkVersion: result.apkVersion,
      apkVersionCode: result.apkVersionCode,
      operatorPackage: result.operatorPackage,
    },
  };
}

export async function runHandshake(
  config: RuntimeConfig,
  _waitForResultEnvelope = waitForResultEnvelope
): Promise<DoctorCheckResult> {
  const commandId = `handshake-${Date.now()}`;
  const payload = JSON.stringify({
    commandId,
    taskId: "doctor-handshake",
    source: "clawperator-doctor",
    expectedFormat: "android-ui-automator",
    actions: [{ id: "h1", type: "doctor_ping" }],
    timeoutMs: 5000,
  });

  // Clear logcat for clean handshake capture
  await runAdb(config, ["logcat", "-c"]);

  const result = await _waitForResultEnvelope(
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
      const deviceFlag = config.deviceId ? ` --device ${config.deviceId}` : "";
      const pkgFlag = config.operatorPackage ? ` --operator-package ${config.operatorPackage}` : "";
      return {
        id: "readiness.handshake",
        status: "fail",
        code: ERROR_CODES.DEVICE_ACCESSIBILITY_NOT_RUNNING,
        summary: "Handshake failed (runtime error).",
        detail: `Operator returned an error: ${result.envelope.error}`,
        fix: {
          title: "Grant accessibility permissions via adb",
          platform: "any",
          steps: [
            { kind: "shell", value: `clawperator grant-device-permissions${deviceFlag}${pkgFlag}` },
          ],
        },
        deviceGuidance: {
          screen: "Accessibility Settings",
          steps: ["Ensure Clawperator Accessibility Service is ON in Android Settings"],
        },
      };
    }
  }

  if ("timeout" in result && result.timeout) {
    const deviceFlag = config.deviceId ? ` --device ${config.deviceId}` : "";
    const pkgFlag = config.operatorPackage ? ` --operator-package ${config.operatorPackage}` : "";
    const timeoutMessage = [
      `No [Clawperator-Result] envelope received within 7000ms.`,
      `Broadcast dispatch: ${result.diagnostics.broadcastDispatchStatus}.`,
        `Operator package: ${config.operatorPackage}.`,
      config.deviceId ? `Device: ${config.deviceId}.` : undefined,
      (result.diagnostics.lastCorrelatedEvents?.length ?? 0) > 0
        ? "Re-run with --verbose to inspect correlated Android log lines."
        : undefined,
    ].filter(Boolean).join(" ");
    return {
      id: "readiness.handshake",
      status: "fail",
      code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
      summary: "Handshake timed out.",
      detail: timeoutMessage,
      fix: {
        title: "Grant accessibility permissions via adb",
        platform: "any",
        steps: [
          { kind: "shell", value: `clawperator grant-device-permissions${deviceFlag}${pkgFlag}` },
          { kind: "shell", value: `clawperator snapshot${deviceFlag}${pkgFlag} --timeout 5000 --verbose` },
        ],
      },
      deviceGuidance: {
        screen: "Accessibility Settings",
        steps: ["Ensure Clawperator Accessibility Service is ON in Android Settings"],
      },
    };
  }

  if ("broadcastFailed" in result && result.broadcastFailed) {
    return {
      id: "readiness.handshake",
      status: "fail",
      code: result.diagnostics.code,
      summary: "Handshake broadcast failed.",
      detail: result.diagnostics.message,
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
