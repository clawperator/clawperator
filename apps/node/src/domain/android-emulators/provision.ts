import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { type ClawperatorError, ERROR_CODES } from "../../contracts/errors.js";
import {
  DEFAULT_EMULATOR_AVD_NAME,
  DEFAULT_EMULATOR_DEVICE_PROFILE,
  DEFAULT_EMULATOR_SYSTEM_IMAGE,
} from "./constants.js";
import { inspectConfiguredAvd, listConfiguredAvds } from "./configuredAvds.js";
import {
  createAvd,
  startAvd,
  waitForBootCompletion,
  waitForEmulatorRegistration,
} from "./lifecycle.js";
import { listRunningEmulators } from "./runningEmulators.js";
import type { ConfiguredAvd, ProvisionedEmulator } from "./types.js";

function buildError(
  code: ClawperatorError["code"],
  message: string,
  details?: Record<string, unknown>
): ClawperatorError {
  return { code, message, details };
}

function findFirstSupportedAvd(avds: ConfiguredAvd[]): ConfiguredAvd | undefined {
  return avds.find((avd) => avd.supported);
}

export async function provisionEmulator(
  config: RuntimeConfig,
  options?: {
    name?: string;
    systemImage?: string;
    deviceProfile?: string;
  }
): Promise<ProvisionedEmulator> {
  const desiredName = options?.name ?? DEFAULT_EMULATOR_AVD_NAME;
  const systemImage = options?.systemImage ?? DEFAULT_EMULATOR_SYSTEM_IMAGE;
  const deviceProfile = options?.deviceProfile ?? DEFAULT_EMULATOR_DEVICE_PROFILE;

  const running = await listRunningEmulators(config);
  const runningSupported = running.find((emulator) => emulator.supported);
  if (runningSupported) {
    return {
      type: "emulator",
      avdName: runningSupported.avdName,
      serial: runningSupported.serial,
      booted: runningSupported.booted,
      created: false,
      started: false,
      reused: true,
    };
  }

  const configured = await listConfiguredAvds(config);
  const supportedConfigured = findFirstSupportedAvd(configured);
  if (supportedConfigured) {
    startAvd(config, supportedConfigured.name);
    const serial = await waitForEmulatorRegistration(config, supportedConfigured.name);
    await waitForBootCompletion(config, serial);
    return {
      type: "emulator",
      avdName: supportedConfigured.name,
      serial,
      booted: true,
      created: false,
      started: true,
      reused: true,
    };
  }

  const desired = await inspectConfiguredAvd(desiredName);
  if (desired.exists && !desired.supported) {
    throw buildError(
      ERROR_CODES.EMULATOR_UNSUPPORTED,
      `Existing AVD ${desiredName} is unsupported and cannot be auto-provisioned`,
      { name: desiredName, unsupportedReasons: desired.unsupportedReasons }
    );
  }

  if (!desired.exists) {
    await createAvd(config, {
      name: desiredName,
      systemImage,
      deviceProfile,
    });
  }

  startAvd(config, desiredName);
  const serial = await waitForEmulatorRegistration(config, desiredName);
  await waitForBootCompletion(config, serial);
  return {
    type: "emulator",
    avdName: desiredName,
    serial,
    booted: true,
    created: !desired.exists,
    started: true,
    reused: false,
  };
}
