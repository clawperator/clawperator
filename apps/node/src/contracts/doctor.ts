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
    platform: "mac" | "linux" | "win" | "any";
    steps: Array<{ kind: "shell" | "manual"; value: string }>;
    docsUrl?: string;
  };
  deviceGuidance?: {
    screen: string;
    steps: string[];
  };
  evidence?: Record<string, unknown>;
}

export interface DoctorReport {
  ok: boolean;
  criticalOk?: boolean;
  deviceId?: string;
  operatorPackage?: string;
  checks: DoctorCheckResult[];
  nextActions?: string[];
}
