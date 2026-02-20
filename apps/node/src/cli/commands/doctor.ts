/**
 * Doctor diagnostics for Clawperator.
 * Checks host, device, and readiness state for end-to-end automation.
 */
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { DoctorService } from "../../domain/doctor/DoctorService.js";
import { type DoctorReport, type DoctorCheckResult } from "../../contracts/doctor.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import { ERROR_CODES } from "../../contracts/errors.js";

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
  const report = await service.run({ config, full: options.full });

  if (options.format === "json") {
    if (report.ok) {
      return formatSuccess(report, options);
    }
    return formatError({ code: ERROR_CODES.DOCTOR_FAILED, ...report }, options);
  }

  // Pretty human output
  return renderPrettyDoctorReport(report);
}

function renderPrettyDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("\n🩺 Clawperator Doctor Diagnostics\n");

  const grouped: Record<string, DoctorCheckResult[]> = {};
  for (const check of report.checks) {
    const group = check.id.split(".")[0];
    grouped[group] = grouped[group] || [];
    grouped[group].push(check);
  }

  for (const [group, checks] of Object.entries(grouped)) {
    lines.push(`${group.toUpperCase()}:`);
    for (const check of checks) {
      const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
      lines.push(`  ${icon} ${check.summary}`);
      if (check.status !== "pass" && check.detail) {
        lines.push(`     Detail: ${check.detail}`);
      }
      if (check.status !== "pass" && check.fix) {
        lines.push(`     Fix: ${check.fix.title}`);
        for (const cmd of check.fix.commands) {
          lines.push(`       > ${cmd}`);
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

  if (report.nextCommand) {
    lines.push(`\nNext command: ${report.nextCommand}\n`);
  }

  return lines.join("\n");
}
