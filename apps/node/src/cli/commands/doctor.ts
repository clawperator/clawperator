/**
 * Doctor diagnostics for Clawperator.
 * Checks host, device, and readiness state for end-to-end automation.
 */
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { DoctorService } from "../../domain/doctor/DoctorService.js";
import { isCriticalDoctorCheck } from "../../domain/doctor/criticalChecks.js";
import { type DoctorReport, type DoctorCheckResult } from "../../contracts/doctor.js";
import type { OutputOptions } from "../output.js";

export async function cmdDoctor(options: {
  format: OutputOptions["format"];
  fix?: boolean;
  full?: boolean;
  checkOnly?: boolean;
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
    process.exitCode = getDoctorExitCode(report, options.checkOnly);
    return JSON.stringify(report, null, 2);
  }

  // Pretty human output
  if (options.fix) {
    // If --fix was passed, we've already done fixes in DoctorService,
    // so just print the report.
  }
  process.exitCode = getDoctorExitCode(report, options.checkOnly);
  return renderPrettyDoctorReport(report);
}

function renderPrettyDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  const criticalChecks = report.checks.filter(isCriticalDoctorCheck);
  const advisoryChecks = report.checks.filter(check => !isCriticalDoctorCheck(check) && check.status !== "pass");
  const passedChecks = report.checks.filter(check => check.status === "pass" && !isCriticalDoctorCheck(check));
  const allOk = report.checks.every(check => check.status === "pass");

  lines.push("");
  lines.push("Clawperator Doctor Diagnostics");
  lines.push("");

  if (criticalChecks.length > 0) {
    lines.push("Critical checks:");
    for (const check of criticalChecks) {
      renderCheck(lines, check);
    }
    lines.push("");
  }

  if (advisoryChecks.length > 0) {
    lines.push("Advisory checks:");
    for (const check of advisoryChecks) {
      renderCheck(lines, check);
    }
    lines.push("");
  }

  if (passedChecks.length > 0) {
    lines.push(`Additional passed checks: ${passedChecks.length}`);
    lines.push("");
  }

  if (report.criticalOk ?? report.ok) {
    lines.push(allOk ? "[OK] Ready to use Clawperator." : "[WARN] Critical checks passed. Address warnings before relying on the setup.");
  } else {
    lines.push("[FAIL] Critical setup checks failed.");
  }

  if (report.nextActions && report.nextActions.length > 0) {
    lines.push("");
    lines.push("Next actions:");
    for (const action of report.nextActions) {
      lines.push(`  - ${action}`);
    }
  }

  return lines.join("\n");
}

function getDoctorExitCode(report: DoctorReport, checkOnly?: boolean): number {
  if (checkOnly) return 0;
  return (report.criticalOk ?? report.ok) ? 0 : 1;
}

function renderCheck(lines: string[], check: DoctorCheckResult): void {
  const status = check.status === "pass" ? "[OK]" : check.status === "warn" ? "[WARN]" : "[FAIL]";
  lines.push(`  ${status} ${check.summary}`);
  if (check.status !== "pass" && check.detail) {
    lines.push(`    ${check.detail}`);
  }
  if (check.status !== "pass" && check.fix) {
    lines.push(`    ${check.fix.title}:`);
    for (const step of check.fix.steps) {
      lines.push(`      - ${step.value}`);
    }
  }
  if (check.status !== "pass" && check.deviceGuidance) {
    lines.push(`    On device (${check.deviceGuidance.screen}):`);
    for (const step of check.deviceGuidance.steps) {
      lines.push(`      - ${step}`);
    }
  }
}
