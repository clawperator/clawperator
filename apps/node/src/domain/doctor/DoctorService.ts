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
    checks.push(await checkNodeVersion());

    const adbPresence = await checkAdbPresence(config);
    checks.push(adbPresence);
    if (adbPresence.status === "fail") return this.finalize(checks, config, options.fix);

    const adbServer = await checkAdbServer(config);
    checks.push(adbServer);
    if (adbServer.status === "fail") return this.finalize(checks, config, options.fix);

    if (full) {
      checks.push(await checkJavaVersion(config));

      const build = await runAndroidBuild(config);
      checks.push(build);
      if (build.status === "fail") return this.finalize(checks, config, options.fix);
    }

    // 2. Device Discovery
    const discovery = await checkDeviceDiscovery(config);
    checks.push(discovery);
    if (discovery.status === "fail") return this.finalize(checks, config, options.fix);

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
      if (install.status === "fail") return this.finalize(checks, config, options.fix);

      const launch = await runAndroidLaunch(config);
      checks.push(launch);
      if (launch.status === "fail") return this.finalize(checks, config, options.fix);
    }

    // 3. Device Capabilities
    const capabilities = await checkDeviceCapabilities(config);
    checks.push(capabilities);
    if (capabilities.status === "fail") return this.finalize(checks, config, options.fix);

    // 4. APK Presence
    const apkPresence = await checkApkPresence(config);
    checks.push(apkPresence);
    if (apkPresence.status === "fail") return this.finalize(checks, config, options.fix);

    // 5. Android Settings
    const settingsResults = await checkSettings(config);
    checks.push(...settingsResults);
    if (settingsResults.some(r => r.status === "fail")) return this.finalize(checks, config, options.fix);

    // 6. Handshake
    const handshake = await runHandshake(config);
    checks.push(handshake);
    if (handshake.status === "fail") return this.finalize(checks, config, options.fix);

    // 7. Smoke Test (Only if full)
    if (full) {
      const smoke = await runSmokeTest(config);
      checks.push(smoke);
    }

    return this.finalize(checks, config, options.fix);
  }

  private async finalize(checks: DoctorCheckResult[], config: RuntimeConfig, autoFix?: boolean): Promise<DoctorReport> {
    const ok = checks.every(c => c.status !== "fail");

    const nextActions: string[] = [];
    if (ok) {
      nextActions.push("clawperator action open-app --app com.android.settings");
    } else {
      for (const check of checks) {
        if (check.status === "fail" && check.fix) {
          for (const step of check.fix.steps) {
            if (step.kind === "shell") {
              if (autoFix) {
                try { await config.runner.runShell(step.value); } catch { /* ignore */ }
              } else {
                nextActions.push(step.value);
              }
            }
          }
        }
      }
    }

    return {
      ok,
      deviceId: config.deviceId,
      receiverPackage: config.receiverPackage,
      checks,
      nextActions,
    };
  }
}
