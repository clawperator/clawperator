import { type DoctorCheckResult } from "../../contracts/doctor.js";

// Execution order and required checks share this definition. A required warning
// is incomplete verification, even when its diagnostic status remains advisory.
export const DOCTOR_CHECK_PLAN = [
  { id: "host.node.version" },
  { id: "host.adb.presence" },
  { id: "host.adb.server" },
  { id: "host.java.version", fullOnly: true },
  { id: "build.android.assemble", fullOnly: true },
  { id: "device.discovery" },
  { id: "build.android.install", fullOnly: true },
  { id: "build.android.launch", fullOnly: true },
  { id: "device.capability" },
  { id: "readiness.apk.presence" },
  { id: "readiness.version.compatibility" },
  { id: "readiness.handshake" },
  { id: "readiness.device.interactive" },
  { id: "readiness.smoke", fullOnly: true },
] as const;

export type RequiredDoctorCheckId = typeof DOCTOR_CHECK_PLAN[number]["id"];
export const CRITICAL_DOCTOR_CHECK_PREFIXES = DOCTOR_CHECK_PLAN.map(check => check.id);

export function requiredDoctorCheckIds(full = false): RequiredDoctorCheckId[] {
  return DOCTOR_CHECK_PLAN.filter(check => full || !("fullOnly" in check)).map(check => check.id);
}

export function isCriticalDoctorCheck(check: DoctorCheckResult): boolean {
  return isCriticalDoctorCheckId(check.id);
}

export function isCriticalDoctorCheckId(id: string): boolean {
  return CRITICAL_DOCTOR_CHECK_PREFIXES.some(prefix => id.startsWith(prefix));
}
