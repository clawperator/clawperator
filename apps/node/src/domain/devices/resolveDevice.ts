import { listDevices } from "./listDevices.js";
import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../contracts/errors.js";

export interface ResolveDeviceResult {
  deviceId: string;
  serial: string;
}

/**
 * Resolve target device: explicit deviceId, or single connected device.
 * Fails with DEVICE_AMBIGUOUS or DEVICE_NOT_FOUND.
 */
export async function resolveDevice(config: RuntimeConfig): Promise<ResolveDeviceResult> {
  const devices = await listDevices(config);
  const connected = devices.filter((d) => d.state === "device");

  if (config.deviceId) {
    const found = connected.find((d) => d.serial === config.deviceId);
    if (!found) {
      throw {
        code: ERROR_CODES.DEVICE_NOT_FOUND,
        message: `Device ${config.deviceId} not found or not in device state`,
        details: { connected: connected.map((d) => d.serial) },
      };
    }
    return { deviceId: found.serial, serial: found.serial };
  }

  if (connected.length === 0) {
    throw {
      code: ERROR_CODES.NO_DEVICES,
      message: "No connected devices",
    };
  }
  if (connected.length > 1) {
    throw {
      code: ERROR_CODES.MULTIPLE_DEVICES_DEVICE_ID_REQUIRED,
      message: "Multiple devices connected; set --device",
      details: { devices: connected.map((d) => d.serial) },
    };
  }
  return { deviceId: connected[0].serial, serial: connected[0].serial };
}
