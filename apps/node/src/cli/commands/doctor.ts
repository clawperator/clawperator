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
  const report = await service.run({ 
    config, 
    full: options.full, 
    fix: options.fix,
    checkOnly: options.checkOnly 
  });

  if (options.format === "json") {
    // With --check-only, always exit 0 regardless of outcome
    process.exitCode = (options.checkOnly || report.ok) ? 0 : 1;
    return JSON.stringify(report, null, 2);
  }

  // Pretty human output
  if (options.fix) {
    // If --fix was passed, we've already done fixes in DoctorService,
    // so just print the report.
  }
  // With --check-only, always exit 0 regardless of outcome
  process.exitCode = (options.checkOnly || report.ok) ? 0 : 1;
  return renderPrettyDoctorReport(report);
}

function renderPrettyDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  lines.push("\n🩺 Clawperator Doctor Diagnostics\n");

  // Group by severity and prefix
  const criticalChecks = report.checks.filter(c => isCriticalCheck(c.id));
  const warningChecks = report.checks.filter(c => !isCriticalCheck(c.id) && c.status !== "pass");
  const passedChecks = report.checks.filter(c => c.status === "pass");

  // Show critical checks first
  if (criticalChecks.length > 0) {
    lines.push("CRITICAL CHECKS:");
    for (const check of criticalChecks) {
      renderCheck(lines, check, true);
    }
    lines.push("");
  }

  // Show warning checks
  if (warningChecks.length > 0) {
    lines.push("WARNINGS:");
    for (const check of warningChecks) {
      renderCheck(lines, check, false);
    }
    lines.push("");
  }

  // Show passed checks summary
  if (passedChecks.length > 0) {
    lines.push(`✅ ${passedChecks.length} check(s) passed`);
    lines.push("");
  }

  // Summary
  if (report.ok) {
    if (warningChecks.length === 0) {
      lines.push("✅ All checks passed! Ready to use Clawperator.");
    } else {
      lines.push("✅ Critical checks passed. Warnings above should be addressed for full functionality.");
    }
  } else {
    lines.push("❌ Critical verification failed. Fix the issues above before using Clawperator.");
  }

  if (report.nextActions && report.nextActions.length > 0) {
    lines.push(`\n📋 Next actions:`);
    for (const action of report.nextActions) {
      lines.push(`  • ${action}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function isCriticalCheck(id: string): boolean {
  const criticalPrefixes = [
    "host.node.version",
    "host.adb.present",
    "host.adb.server",
    "device.discovery",
  ];
  return criticalPrefixes.some(prefix => id.startsWith(prefix));
}

function renderCheck(lines: string[], check: DoctorCheckResult, isCritical: boolean): void {
  const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
  const severity = isCritical ? "[CRITICAL]" : "";
  lines.push(`  ${icon} ${severity} ${check.summary}`);
  
  if (check.status !== "pass" && check.detail) {
    lines.push(`     ${check.detail}`);
  }
  
  if (check.status !== "pass" && check.fix) {
    lines.push(`     💡 ${check.fix.title}:`);
    for (const step of check.fix.steps) {
      if (step.kind === "shell") {
        lines.push(`       $ ${step.value}`);
      } else {
        lines.push(`       → ${step.value}`);
      }
    }
  }
  
  if (check.status !== "pass" && check.deviceGuidance) {
    lines.push(`     📱 On device (${check.deviceGuidance.screen}):`);
    for (const step of check.deviceGuidance.steps) {
      lines.push(`       → ${step}`);
    }
  }
}
