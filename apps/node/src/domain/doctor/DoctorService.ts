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

export interface RunDoctorOptions {
  config: RuntimeConfig;
  full?: boolean;
  fix?: boolean;
}

export class DoctorService {
  async run(options: RunDoctorOptions): Promise<DoctorReport> {
    const { config, full } = options;
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

    // After discovery, ensure we have a deviceId in config for subsequent checks
    if (!config.deviceId) {
      try {
        const resolved = await resolveDevice(config);
        config.deviceId = resolved.deviceId;
      } catch {
        // Should have been caught by checkDeviceDiscovery
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

    // 5. Android Settings
    const settingsResults = await checkSettings(config);
    checks.push(...settingsResults);

    // 6. Handshake
    if (apkPresence.status === "pass") {
      checks.push(await runHandshake(config));
    }

    // 7. Smoke Test (Only if full)
    if (full) {
      const smoke = await runSmokeTest(config);
      checks.push(smoke);
    }

    return this.finalize(checks, config, options.fix);
  }

  private async finalize(checks: DoctorCheckResult[], config: RuntimeConfig, autoFix?: boolean): Promise<DoctorReport> {
    const criticalOk = checks
      .filter(check => this.isCriticalCheck(check))
      .every(check => check.status !== "fail");
    const ok = checks.every(check => check.status === "pass");

    const nextActions: string[] = [];
    if (criticalOk && ok) {
      nextActions.push("Read the setup guide: https://docs.clawperator.com/getting-started/first-time-setup/");
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
    return check.status === "fail" && this.isCriticalCheck(check);
  }

  private isCriticalCheck(check: DoctorCheckResult): boolean {
    return [
      "host.node.version",
      "host.adb.presence",
      "host.adb.server",
      "host.java.version",
      "device.discovery",
      "build.android.assemble",
      "build.android.install",
      "build.android.launch",
    ].some(prefix => check.id.startsWith(prefix));
  }
}
