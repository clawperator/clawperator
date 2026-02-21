/**
 * Doctor diagnostics for Clawperator.
 * Checks host, device, and readiness state for end-to-end automation.
 */
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { DoctorService } from "../../domain/doctor/DoctorService.js";
import { type DoctorReport, type DoctorCheckResult } from "../../contracts/doctor.js";
import type { OutputOptions } from "../output.js";

export async function cmdDoctor(options: {
  format: OutputOptions["format"];
  fix?: boolean;
  full?: boolean;
  deviceId?: string;
  receiverPackage?: string;
}): Promise<string> {
  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    receiverPackage: options.receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
    adbPath: process.env.ADB_PATH,
  });

  const service = new DoctorService();
  const report = await service.run({ config, full: options.full, fix: options.fix });

  if (options.format === "json") {
    process.exitCode = report.ok ? 0 : 1;
    return JSON.stringify(report, null, 2);
  }

  // Pretty human output
  if (options.fix) {
    // If --fix was passed, we've already done fixes in DoctorService,
    // so just print the report.
  }
  process.exitCode = report.ok ? 0 : 1;
  return renderPrettyDoctorReport(report);
}

function renderPrettyDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("\n🩺 Clawperator Doctor Diagnostics\n");

  // Group by prefix (e.g., host., device., readiness., build.)
  const grouped: Record<string, DoctorCheckResult[]> = {};
  for (const check of report.checks) {
    const group = check.id.split(".")[0] || "other";
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(check);
  }

  const groupOrder = ["host", "device", "readiness", "build"];
  const sortedGroupKeys = Object.keys(grouped).sort((a, b) => {
    const ai = groupOrder.indexOf(a);
    const bi = groupOrder.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });

  for (const group of sortedGroupKeys) {
    const checks = grouped[group];
    lines.push(`${group.toUpperCase()}:`);
    for (const check of checks) {
      const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
      lines.push(`  ${icon} ${check.summary}`);
      if (check.status !== "pass" && check.detail) {
        lines.push(`     Detail: ${check.detail}`);
      }
      if (check.status !== "pass" && check.fix) {
        lines.push(`     Fix: ${check.fix.title}`);
        for (const step of check.fix.steps) {
          if (step.kind === "shell") {
            lines.push(`       > ${step.value}`);
          } else {
            lines.push(`       - ${step.value}`);
          }
        }
      }
      if (check.status !== "pass" && check.deviceGuidance) {
        lines.push(`     Device guidance (${check.deviceGuidance.screen}):`);
        for (const step of check.deviceGuidance.steps) {
          lines.push(`       - ${step}`);
        }
      }
    }
    lines.push("");
  }

  if (report.ok) {
    lines.push("✅ Verified state reached.");
  } else {
    lines.push("❌ Verification failed.");
  }

  if (report.nextActions && report.nextActions.length > 0) {
    lines.push(`\nNext actions:`);
    for (const action of report.nextActions) {
      lines.push(`  ${action}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
