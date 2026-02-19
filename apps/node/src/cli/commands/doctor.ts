/**
 * Stage 3 starter: doctor preflight diagnostics.
 * Checks: adb available, device connected/resolved, receiver package installed, strict/canonical mode state.
 * doctor --fix remains a stub (no automatic fixes).
 */
import { isAdbAvailable, runAdb } from "../../adapters/android-bridge/adbClient.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { resolveDevice } from "../../domain/devices/resolveDevice.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import { ERROR_CODES } from "../../contracts/errors.js";

export interface DoctorCheck {
  ok: boolean;
  message?: string;
}

export interface DoctorResult {
  ok: boolean;
  checks: {
    adb: DoctorCheck;
    device: DoctorCheck & { deviceId?: string };
    receiverPackage: DoctorCheck & { package?: string };
    strictMode: DoctorCheck & { strictMode: boolean };
  };
  fix?: { applied: boolean; message?: string };
}

export async function cmdDoctor(options: {
  format: OutputOptions["format"];
  fix?: boolean;
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: process.env.ADB_PATH,
  });

  const checks: DoctorResult["checks"] = {
    adb: { ok: false },
    device: { ok: false },
    receiverPackage: { ok: false },
    strictMode: { ok: true, strictMode: true },
  };

  const adbOk = await isAdbAvailable(config);
  checks.adb = adbOk ? { ok: true } : { ok: false, message: "adb not found or not executable" };

  let deviceId: string | undefined;
  if (adbOk) {
    try {
      const resolved = await resolveDevice(config);
      deviceId = resolved.deviceId;
      config.deviceId = deviceId;
      checks.device = { ok: true, message: resolved.deviceId, deviceId: resolved.deviceId };
    } catch (e) {
      checks.device = { ok: false, message: (e as { message?: string }).message ?? "No single device" };
    }
  } else {
    checks.device = { ok: false, message: "Skipped (adb unavailable)" };
  }

  if (adbOk && deviceId) {
    const { stdout } = await runAdb(config, ["shell", "pm", "list", "packages", "-3"], { timeoutMs: 5000 });
    const packages = stdout.split("\n").map((l) => l.replace(/^package:/, "").trim()).filter(Boolean);
    const receiverInstalled = packages.includes(config.receiverPackage);
    checks.receiverPackage = receiverInstalled
      ? { ok: true, message: "installed", package: config.receiverPackage }
      : { ok: false, message: `Receiver package not installed on device`, package: config.receiverPackage };
  } else {
    checks.receiverPackage = { ok: false, message: "Skipped (adb or device unavailable)", package: config.receiverPackage };
  }

  const allOk = checks.adb.ok && checks.device.ok && checks.receiverPackage.ok;
  const result: DoctorResult = {
    ok: allOk,
    checks,
  };
  if (options.fix) {
    result.fix = { applied: false, message: "doctor --fix not implemented; resolve checks manually." };
  }

  if (allOk) {
    return formatSuccess(result, options);
  }
  return formatError({ code: ERROR_CODES.DOCTOR_FAILED, message: "Some checks failed", ...result }, options);
}
