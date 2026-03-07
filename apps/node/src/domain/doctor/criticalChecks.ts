import { type DoctorCheckResult } from "../../contracts/doctor.js";

export const CRITICAL_DOCTOR_CHECK_PREFIXES = [
  "host.node.version",
  "host.adb.presence",
  "host.adb.server",
  "host.java.version",
  "device.discovery",
  "device.capability",
  "build.android.assemble",
  "build.android.install",
  "build.android.launch",
  "readiness.handshake",
  "readiness.smoke",
] as const;

export function isCriticalDoctorCheck(check: DoctorCheckResult): boolean {
  return isCriticalDoctorCheckId(check.id);
}

export function isCriticalDoctorCheckId(id: string): boolean {
  return CRITICAL_DOCTOR_CHECK_PREFIXES.some(prefix => id.startsWith(prefix));
}
