import type { ErrorCode } from "./errors.js";

export type DoctorStatus = "pass" | "warn" | "fail";

export interface DoctorCheckResult {
  id: string;                 // e.g., "host.adb.present"
  status: DoctorStatus;
  code?: ErrorCode | string;
  summary: string;
  detail?: string;
  fix?: {
    title: string;
    commands: string[];
    notes?: string[];
  };
  evidence?: Record<string, unknown>;
}

export interface DoctorReport {
  ok: boolean;
  deviceId?: string;
  receiverPackage?: string;
  checks: DoctorCheckResult[];
  nextCommand?: string;
}
