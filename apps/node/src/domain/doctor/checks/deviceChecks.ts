import { runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { listDevices } from "../../devices/listDevices.js";
import { DOCTOR_DOCS_URLS } from "../docsUrls.js";

export async function checkDeviceDiscovery(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const devices = await listDevices(config);

  if (devices.length === 0) {
    return {
      id: "device.discovery",
      status: "fail",
      code: ERROR_CODES.NO_DEVICES,
      summary: "No connected Android devices found.",
      detail: "Check USB connection, cable, and ensure the device is powered on.",
    };
  }

  const unauthorized = devices.filter(d => d.state === "unauthorized");
  if (unauthorized.length > 0 && (!config.deviceId || unauthorized.some(d => d.serial === config.deviceId))) {
    return {
      id: "device.discovery",
      status: "fail",
      code: ERROR_CODES.DEVICE_UNAUTHORIZED,
      summary: "Device is unauthorized.",
      detail: "Accept the RSA key prompt on the device screen.",
      deviceGuidance: {
        screen: "Device Dialog",
        steps: ["Accept the RSA key prompt on the device screen by allowing USB Debugging."],
      },
    };
  }

  const offline = devices.filter(d => d.state === "offline");
  if (offline.length > 0 && (!config.deviceId || offline.some(d => d.serial === config.deviceId))) {
    return {
      id: "device.discovery",
      status: "fail",
      code: ERROR_CODES.DEVICE_OFFLINE,
      summary: "Device is offline.",
      detail: "Try reconnecting the cable or restarting adb.",
      fix: {
        title: "Reconnect device",
        platform: "any",
        steps: [
          { kind: "shell", value: "adb kill-server" },
          { kind: "shell", value: "adb start-server" }
        ],
        docsUrl: DOCTOR_DOCS_URLS.devices,
      },
    };
  }

  if (devices.length > 1 && !config.deviceId) {
    return {
      id: "device.discovery",
      status: "warn",
      code: ERROR_CODES.MULTIPLE_DEVICES_DEVICE_ID_REQUIRED,
      summary: "Multiple devices connected.",
      detail: "Specify --device to target a single device.",
      evidence: { devices: devices.map(d => d.serial) },
    };
  }

  const target = config.deviceId ? devices.find(d => d.serial === config.deviceId) : devices[0];
  if (!target || target.state !== "device") {
    return {
      id: "device.discovery",
      status: "fail",
      code: ERROR_CODES.DEVICE_NOT_FOUND,
      summary: `Device ${config.deviceId ?? "target"} not reachable.`,
      evidence: { targetState: target?.state },
    };
  }

  return {
    id: "device.discovery",
    status: "pass",
    summary: `Device ${target.serial} is connected and reachable.`,
    evidence: { serial: target.serial },
  };
}

export async function checkDeviceCapabilities(config: RuntimeConfig): Promise<DoctorCheckResult> {
  if (!config.deviceId) {
    return { id: "device.capability", status: "fail", summary: "No device ID resolved." };
  }

  const sdkResult = await runAdb(config, ["shell", "getprop", "ro.build.version.sdk"]);
  const wmSizeResult = await runAdb(config, ["shell", "wm", "size"]);
  const wmDensityResult = await runAdb(config, ["shell", "wm", "density"]);

  if (sdkResult.code !== 0) {
    return {
      id: "device.capability",
      status: "fail",
      code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
      summary: "Could not execute shell commands on device.",
      detail: sdkResult.stderr,
    };
  }

  return {
    id: "device.capability",
    status: "pass",
    summary: "Device shell is available.",
    evidence: {
      sdk: sdkResult.stdout.trim(),
      wmSize: wmSizeResult.stdout.trim(),
      wmDensity: wmDensityResult.stdout.trim(),
    },
  };
}
