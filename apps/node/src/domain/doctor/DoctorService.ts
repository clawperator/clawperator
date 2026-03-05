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
  checkOnly?: boolean;
}

export class DoctorService {
  async run(options: RunDoctorOptions): Promise<DoctorReport> {
    const { config, full } = options;
    const checks: DoctorCheckResult[] = [];

    // 1. Host Checks (Critical - halt on fail)
    checks.push(await checkNodeVersion());

    const adbPresence = await checkAdbPresence(config);
    checks.push(adbPresence);
    if (adbPresence.status === "fail") return this.finalize(checks, config, options);

    const adbServer = await checkAdbServer(config);
    checks.push(adbServer);
    if (adbServer.status === "fail") return this.finalize(checks, config, options);

    if (full) {
      checks.push(await checkJavaVersion(config));

      const build = await runAndroidBuild(config);
      checks.push(build);
      if (build.status === "fail") return this.finalize(checks, config, options);
    }

    // 2. Device Discovery (Critical - halt on fail)
    const discovery = await checkDeviceDiscovery(config);
    checks.push(discovery);
    if (discovery.status === "fail") return this.finalize(checks, config, options);

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
      if (install.status === "fail") return this.finalize(checks, config, options);

      const launch = await runAndroidLaunch(config);
      checks.push(launch);
      if (launch.status === "fail") return this.finalize(checks, config, options);
    }

    // 3. Device Capabilities (Warning - continue on fail)
    const capabilities = await checkDeviceCapabilities(config);
    checks.push(capabilities);
    // Continue even if capabilities check warns

    // 4. APK Presence (Warning - continue on fail)
    const apkPresence = await checkApkPresence(config);
    checks.push(apkPresence);
    // Continue even if APK is not installed (warn instead of fail)

    // Skip remaining checks if APK is not installed
    if (apkPresence.status !== "pass") {
      return this.finalize(checks, config, options);
    }

    // 5. Android Settings (Warning - continue on fail)
    const settingsResults = await checkSettings(config);
    checks.push(...settingsResults);
    // Continue even if settings checks warn

    // 6. Handshake (Critical for functionality, but we already checked APK)
    const handshake = await runHandshake(config);
    checks.push(handshake);
    // Don't halt on handshake failure - it's a warning-level issue

    // 7. Smoke Test (Only if full)
    if (full) {
      const smoke = await runSmokeTest(config);
      checks.push(smoke);
    }

    return this.finalize(checks, config, options);
  }

  private async finalize(checks: DoctorCheckResult[], config: RuntimeConfig, options: RunDoctorOptions): Promise<DoctorReport> {
    const { fix } = options;
    
    // Critical checks are those that prevent any further operation
    const criticalChecks = [
      "host.node.version",
      "host.adb.present",
      "host.adb.server",
      "device.discovery",
    ];
    
    const criticalOk = checks
      .filter(c => criticalChecks.some(id => c.id.startsWith(id)))
      .every(c => c.status !== "fail");
    
    // Overall ok includes warnings - true if no critical failures
    const ok = criticalOk;

    const nextActions: string[] = [];
    
    if (ok && checks.every(c => c.status === "pass")) {
      // Full pass - suggest next steps
      nextActions.push("All checks passed! Try: clawperator observe snapshot --device-id <id>");
    } else if (ok) {
      // Critical checks passed but some warnings
      const warningChecks = checks.filter(c => c.status === "warn" || c.status === "fail");
      for (const check of warningChecks) {
        if (check.fix) {
          for (const step of check.fix.steps) {
            if (step.kind === "shell") {
              if (fix) {
                try { await config.runner.runShell(step.value); } catch { /* ignore */ }
              } else {
                nextActions.push(`${check.summary}: ${step.value}`);
              }
            } else {
              nextActions.push(`${check.summary}: ${step.value}`);
            }
          }
        }
        if (check.deviceGuidance) {
          nextActions.push(`${check.summary}: Go to ${check.deviceGuidance.screen} on device`);
        }
      }
    } else {
      // Critical failure
      for (const check of checks) {
        if (check.status === "fail" && check.fix) {
          for (const step of check.fix.steps) {
            if (step.kind === "shell") {
              if (fix) {
                try { await config.runner.runShell(step.value); } catch { /* ignore */ }
              } else {
                nextActions.push(step.value);
              }
            } else {
              nextActions.push(step.value);
            }
          }
        }
      }
    }

    return {
      ok,
      criticalOk,
      deviceId: config.deviceId,
      receiverPackage: config.receiverPackage,
      checks,
      nextActions: nextActions.length > 0 ? nextActions : undefined,
    };
  }
}
