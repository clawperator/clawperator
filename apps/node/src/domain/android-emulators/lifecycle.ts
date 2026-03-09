import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { runAndroidSdkTool } from "../../adapters/android-sdk/hostToolClient.js";
import { type ClawperatorError, ERROR_CODES } from "../../contracts/errors.js";
import {
  ADB_REGISTRATION_TIMEOUT_MS,
  BOOT_POLL_INTERVAL_MS,
  DEFAULT_EMULATOR_DEVICE_PROFILE,
  DEFAULT_EMULATOR_SYSTEM_IMAGE,
  EMULATOR_BOOT_TIMEOUT_MS,
} from "./constants.js";
import { inspectConfiguredAvd } from "./configuredAvds.js";
import { isEmulatorBooted, resolveRunningEmulatorByName } from "./runningEmulators.js";

function buildError(
  code: ClawperatorError["code"],
  message: string,
  details?: Record<string, unknown>
): ClawperatorError {
  return { code, message, details };
}

export async function isSystemImageInstalled(config: RuntimeConfig, systemImage: string): Promise<boolean> {
  const result = await runAndroidSdkTool(config, "sdkmanager", ["--list_installed"], { timeoutMs: 30_000 });
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.ANDROID_SYSTEM_IMAGE_INSTALL_FAILED,
      result.stderr || "Failed to query installed Android system images",
      { systemImage }
    );
  }
  return result.stdout.includes(systemImage);
}

export async function acceptAndroidSdkLicenses(config: RuntimeConfig): Promise<void> {
  const command = `yes | "${config.sdkmanagerPath}" --licenses`;
  const result = await config.runner.runShell(command, { timeoutMs: 120_000 });
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.ANDROID_SYSTEM_IMAGE_INSTALL_FAILED,
      result.stderr || "Failed to accept Android SDK licenses"
    );
  }
}

export async function ensureSystemImageInstalled(
  config: RuntimeConfig,
  systemImage: string = DEFAULT_EMULATOR_SYSTEM_IMAGE
): Promise<void> {
  if (await isSystemImageInstalled(config, systemImage)) {
    return;
  }

  await acceptAndroidSdkLicenses(config);
  const result = await runAndroidSdkTool(config, "sdkmanager", [systemImage], { timeoutMs: 300_000 });
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.ANDROID_SYSTEM_IMAGE_INSTALL_FAILED,
      result.stderr || "Failed to install Android system image",
      { systemImage }
    );
  }
}

export async function createAvd(
  config: RuntimeConfig,
  options: {
    name: string;
    systemImage?: string;
    deviceProfile?: string;
  }
): Promise<void> {
  const systemImage = options.systemImage ?? DEFAULT_EMULATOR_SYSTEM_IMAGE;
  const deviceProfile = options.deviceProfile ?? DEFAULT_EMULATOR_DEVICE_PROFILE;

  await ensureSystemImageInstalled(config, systemImage);
  const command = `printf 'no\n' | "${config.avdmanagerPath}" create avd --force --name "${options.name}" --package "${systemImage}" --device "${deviceProfile}"`;
  const result = await config.runner.runShell(command, { timeoutMs: 120_000 });
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.ANDROID_AVD_CREATE_FAILED,
      result.stderr || "Failed to create Android Virtual Device",
      { name: options.name, systemImage, deviceProfile }
    );
  }
}

export function startAvd(
  config: RuntimeConfig,
  name: string,
  extraArgs: string[] = []
): void {
  const args = [`@${name}`, "-no-snapshot-load", "-no-boot-anim", ...extraArgs];
  const child = spawn(config.emulatorPath, args, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  child.unref();
}

export async function waitForEmulatorRegistration(
  config: RuntimeConfig,
  name: string,
  timeoutMs: number = ADB_REGISTRATION_TIMEOUT_MS
): Promise<string> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const running = await resolveRunningEmulatorByName(config, name);
    if (running) {
      return running.serial;
    }
    await delay(BOOT_POLL_INTERVAL_MS);
  }

  throw buildError(
    ERROR_CODES.EMULATOR_START_FAILED,
    `Timed out waiting for emulator ${name} to appear in adb`,
    { name, timeoutMs }
  );
}

export async function waitForBootCompletion(
  config: RuntimeConfig,
  serial: string,
  timeoutMs: number = EMULATOR_BOOT_TIMEOUT_MS
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isEmulatorBooted(config, serial)) {
      return;
    }
    await delay(BOOT_POLL_INTERVAL_MS);
  }

  throw buildError(
    ERROR_CODES.EMULATOR_BOOT_TIMEOUT,
    `Timed out waiting for emulator ${serial} to finish booting`,
    { serial, timeoutMs }
  );
}

export async function stopAvd(config: RuntimeConfig, name: string): Promise<void> {
  const running = await resolveRunningEmulatorByName(config, name);
  if (!running) {
    throw buildError(ERROR_CODES.EMULATOR_NOT_RUNNING, `Emulator ${name} is not running`, { name });
  }

  const result = await runAdb({ ...config, deviceId: running.serial }, ["emu", "kill"]);
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.EMULATOR_STOP_FAILED,
      result.stderr || `Failed to stop emulator ${name}`,
      { name, serial: running.serial }
    );
  }
}

export async function deleteAvd(config: RuntimeConfig, name: string): Promise<void> {
  const running = await resolveRunningEmulatorByName(config, name);
  if (running) {
    throw buildError(
      ERROR_CODES.EMULATOR_ALREADY_RUNNING,
      `Cannot delete running emulator ${name}`,
      { name, serial: running.serial }
    );
  }

  const existing = await inspectConfiguredAvd(name);
  if (!existing.exists) {
    throw buildError(ERROR_CODES.EMULATOR_NOT_FOUND, `AVD ${name} does not exist`, { name });
  }

  const result = await runAndroidSdkTool(config, "avdmanager", ["delete", "avd", "--name", name], {
    timeoutMs: 60_000,
  });
  if (result.code !== 0) {
    throw buildError(
      ERROR_CODES.EMULATOR_DELETE_FAILED,
      result.stderr || `Failed to delete emulator ${name}`,
      { name }
    );
  }
}
