import { type RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorReport, type DoctorCheckResult } from "../../contracts/doctor.js";
import { resolveDevice } from "../devices/resolveDevice.js";
import {
  checkNodeVersion,
  checkAdbPresence,
  checkAdbServer
} from "./checks/hostChecks.js";
import {
  checkDeviceDiscovery,
  checkDeviceCapabilities
} from "./checks/deviceChecks.js";
import {
  checkApkPresence,
  checkVersionCompatibility,
  checkSettings,
  runHandshake,
  runSmokeTest
} from "./checks/readinessChecks.js";
import {
  checkJavaVersion,
  runAndroidBuild,
  runAndroidInstall,
  runAndroidLaunch
} from "./checks/buildChecks.js";
import { isCriticalDoctorCheck } from "./criticalChecks.js";
import type { Logger } from "../../adapters/logger.js";

export interface RunDoctorOptions {
  config: RuntimeConfig;
  full?: boolean;
  fix?: boolean;
  logger?: Logger;
}

export class DoctorService {
  async run(options: RunDoctorOptions): Promise<DoctorReport> {
    const config = options.logger === undefined ? options.config : { ...options.config, logger: options.logger };
    const { full } = options;
    const checks: DoctorCheckResult[] = [];

    // 1. Host Checks
    const nodeVersion = await checkNodeVersion();
    checks.push(nodeVersion);
    if (this.shouldHaltOnFailure(nodeVersion)) return this.finalize(checks, config, options.fix);

    const adbPresence = await checkAdbPresence(config);
    checks.push(adbPresence);
    if (this.shouldHaltOnFailure(adbPresence)) return this.finalize(checks, config, options.fix);

    const adbServer = await checkAdbServer(config);
    checks.push(adbServer);
    if (this.shouldHaltOnFailure(adbServer)) return this.finalize(checks, config, options.fix);

    if (full) {
      const javaVersion = await checkJavaVersion(config);
      checks.push(javaVersion);
      if (this.shouldHaltOnFailure(javaVersion)) return this.finalize(checks, config, options.fix);

      const build = await runAndroidBuild(config);
      checks.push(build);
      if (this.shouldHaltOnFailure(build)) return this.finalize(checks, config, options.fix);
    }

    // 2. Device Discovery
    const discovery = await checkDeviceDiscovery(config);
    checks.push(discovery);
    if (this.shouldHaltOnFailure(discovery)) return this.finalize(checks, config, options.fix);

    // After discovery, ensure we have a deviceId in config for subsequent checks.
    // If discovery returned a warn (e.g. MULTIPLE_DEVICES_DEVICE_ID_REQUIRED) rather
    // than a fail, execution reaches here with config.deviceId still unset. Attempt
    // to resolve; if that also fails there is no target device and all subsequent
    // device-specific checks would run without -s, producing adb ambiguity errors.
    // Finalize early in that case — the discovery warn already tells the user what to do.
    if (!config.deviceId) {
      try {
        const resolved = await resolveDevice(config);
        config.deviceId = resolved.deviceId;
      } catch {
        return this.finalize(checks, config, options.fix);
      }
    }

    if (full) {
      const install = await runAndroidInstall(config);
      checks.push(install);
      if (this.shouldHaltOnFailure(install)) return this.finalize(checks, config, options.fix);

      const launch = await runAndroidLaunch(config);
      checks.push(launch);
      if (this.shouldHaltOnFailure(launch)) return this.finalize(checks, config, options.fix);
    }

    // 3. Device Capabilities
    checks.push(await checkDeviceCapabilities(config));

    // 4. APK Presence
    const apkPresence = await checkApkPresence(config);
    checks.push(apkPresence);

    let versionCompatibilityPassed = false;
    if (apkPresence.status === "pass") {
      const versionCompatibility = await checkVersionCompatibility(config);
      checks.push(versionCompatibility);
      if (this.shouldHaltOnFailure(versionCompatibility)) return this.finalize(checks, config, options.fix);
      versionCompatibilityPassed = versionCompatibility.status === "pass";
    }

    // 5. Android Settings
    const settingsResults = await checkSettings(config);
    checks.push(...settingsResults);

    // 6. Handshake
    if (apkPresence.status === "pass" && versionCompatibilityPassed) {
      const handshake = await runHandshake(config);
      checks.push(handshake);
      if (this.shouldHaltOnFailure(handshake)) return this.finalize(checks, config, options.fix);
    }

    // 7. Smoke Test (Only if full)
    if (full && apkPresence.status === "pass" && versionCompatibilityPassed) {
      const smoke = await runSmokeTest(config);
      checks.push(smoke);
      if (this.shouldHaltOnFailure(smoke)) return this.finalize(checks, config, options.fix);
    }

    return this.finalize(checks, config, options.fix);
  }

  private async finalize(checks: DoctorCheckResult[], config: RuntimeConfig, autoFix?: boolean): Promise<DoctorReport> {
    const logger = config.logger;
    for (const check of checks) {
      logger?.log({
        ts: new Date().toISOString(),
        level: check.status === "fail" ? "error" : check.status === "warn" ? "warn" : "info",
        event: "doctor.check",
        deviceId: config.deviceId,
        message: `${check.id} status=${check.status}${check.code ? ` code=${check.code}` : ""}${check.summary ? ` ${check.summary}` : ""}`,
      });
    }

    const criticalOk = checks
      .filter(check => isCriticalDoctorCheck(check))
      .every(check => check.status !== "fail");
    const ok = criticalOk;
    const allOk = checks.every(check => check.status === "pass");

    const nextActions: string[] = [];
    if (criticalOk && allOk) {
      nextActions.push("Docs: https://docs.clawperator.com/getting-started/first-time-setup/");
      nextActions.push(
        config.deviceId
          ? `Try: clawperator observe snapshot --device-id ${config.deviceId}`
          : "Try: clawperator observe snapshot --device-id <device_id>"
      );
    }

    for (const check of checks) {
      if (check.status === "pass") continue;
      if (check.fix) {
        for (const step of check.fix.steps) {
          if (step.kind === "shell") {
            if (autoFix) {
              try {
                await config.runner.runShell(step.value);
              } catch {
                // Keep diagnostics deterministic even if best-effort fix fails.
              }
            } else {
              nextActions.push(step.value);
            }
            continue;
          }
          nextActions.push(step.value);
        }
      }
      if (check.deviceGuidance) {
        nextActions.push(`On device, open ${check.deviceGuidance.screen} and follow the listed steps.`);
      }
    }

    return {
      ok,
      criticalOk,
      deviceId: config.deviceId,
      receiverPackage: config.receiverPackage,
      checks,
      nextActions: nextActions.length > 0 ? [...new Set(nextActions)] : undefined,
    };
  }

  private shouldHaltOnFailure(check: DoctorCheckResult): boolean {
    return check.status === "fail" && isCriticalDoctorCheck(check);
  }
}
