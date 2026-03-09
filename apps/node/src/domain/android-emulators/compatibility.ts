import {
  DEFAULT_EMULATOR_TAG,
  SUPPORTED_EMULATOR_ABIS,
  SUPPORTED_EMULATOR_API_LEVEL,
  SUPPORTED_EMULATOR_DEVICE_PROFILES,
} from "./constants.js";
import type { ConfiguredAvd, EmulatorCompatibility, EmulatorUnsupportedReason } from "./types.js";

export interface EmulatorCompatibilityInput {
  apiLevel: number | null;
  abi: string | null;
  playStore: boolean;
  deviceProfile: string | null;
  systemImage: string | null;
}

function hasPlayStoreSystemImage(systemImage: string | null): boolean {
  return systemImage !== null && systemImage.includes(DEFAULT_EMULATOR_TAG);
}

export function evaluateEmulatorCompatibility(
  input: EmulatorCompatibilityInput
): EmulatorCompatibility {
  const unsupportedReasons: EmulatorUnsupportedReason[] = [];

  if (!input.playStore || !hasPlayStoreSystemImage(input.systemImage)) {
    unsupportedReasons.push("missing_play_store");
  }
  if (input.apiLevel !== SUPPORTED_EMULATOR_API_LEVEL) {
    unsupportedReasons.push("unsupported_api_level");
  }
  if (input.abi === null || !SUPPORTED_EMULATOR_ABIS.includes(input.abi as (typeof SUPPORTED_EMULATOR_ABIS)[number])) {
    unsupportedReasons.push("unsupported_abi");
  }
  if (
    input.deviceProfile === null ||
    !SUPPORTED_EMULATOR_DEVICE_PROFILES.includes(
      input.deviceProfile as (typeof SUPPORTED_EMULATOR_DEVICE_PROFILES)[number]
    )
  ) {
    unsupportedReasons.push("unsupported_device_profile");
  }

  return {
    supported: unsupportedReasons.length === 0,
    unsupportedReasons,
  };
}

export function applyCompatibility(avd: Omit<ConfiguredAvd, keyof EmulatorCompatibility>): ConfiguredAvd {
  return {
    ...avd,
    ...evaluateEmulatorCompatibility(avd),
  };
}
