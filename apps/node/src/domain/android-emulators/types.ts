export type EmulatorUnsupportedReason =
  | "missing_play_store"
  | "unsupported_api_level"
  | "unsupported_abi"
  | "unsupported_device_profile";

export interface EmulatorCompatibility {
  supported: boolean;
  unsupportedReasons: EmulatorUnsupportedReason[];
}

export interface ConfiguredAvd extends EmulatorCompatibility {
  name: string;
  exists: boolean;
  running: boolean;
  apiLevel: number | null;
  abi: string | null;
  playStore: boolean;
  deviceProfile: string | null;
  systemImage: string | null;
}

export interface RunningEmulator extends EmulatorCompatibility {
  type: "emulator";
  avdName: string;
  serial: string;
  booted: boolean;
}

export interface ProvisionedEmulator {
  type: "emulator";
  avdName: string;
  serial: string;
  booted: boolean;
  created: boolean;
  started: boolean;
  reused: boolean;
}
