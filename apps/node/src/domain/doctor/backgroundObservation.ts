import type { RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { DoctorCheckResult, DoctorReport } from "../../contracts/doctor.js";
import { checkNodeVersion, checkAdbPresence, checkAdbServer } from "./checks/hostChecks.js";
import { checkDeviceDiscovery } from "./checks/deviceChecks.js";
import { checkApkPresence, checkVersionCompatibility } from "./checks/readinessChecks.js";
import { resolveDevice } from "../devices/resolveDevice.js";
import { runNotificationMedia } from "../notifications/service.js";

/** No interactive handshake, setup, log clearing, or app launch in this path. */
export async function runBackgroundObservationDoctor(config: RuntimeConfig): Promise<DoctorReport> {
  const checks: DoctorCheckResult[] = [];
  const steps = [
    () => checkNodeVersion(), () => checkAdbPresence(config), () => checkAdbServer(config),
    () => checkDeviceDiscovery(config),
    async () => {
      config.deviceId = (await resolveDevice(config)).deviceId;
      return checkApkPresence(config);
    },
    () => checkVersionCompatibility(config),
    async (): Promise<DoctorCheckResult> => {
      let deviceState: Record<string, boolean> | undefined;
      for (const type of ["list_notifications", "list_media_sessions"] as const) {
        const response = await runNotificationMedia(type, { limit: 1, maxTextChars: 1 }, { deviceId: config.deviceId, operatorPackage: config.operatorPackage, timeoutMs: 5000, runner: config.runner, adbPath: config.adbPath });
        if (!response.result.ok) {
          const result = response.result;
          return { id: "readiness.background.observation", status: "fail", code: result.error.code, summary: result.error.message };
        }
        deviceState = response.payload?.deviceState;
        const step = response.result.envelope.stepResults[0];
        if (!step?.success || response.payload === undefined) {
          return { id: "readiness.background.observation", status: "fail", code: step?.data.errorCode, summary: step?.data.error ?? "No usable observation result." };
        }
      }
      return { id: "readiness.background.observation", status: "pass", summary: "Notification and media queries succeeded without UI readiness.", evidence: deviceState };
    },
  ];
  for (const step of steps) {
    try { checks.push(await step()); }
    catch (error) { checks.push({ id: "readiness.background.observation", status: "fail", summary: error instanceof Error ? error.message : "Background readiness failed." }); }
    if (checks.at(-1)?.status !== "pass") break;
  }
  const ok = checks.length === steps.length && checks.every(check => check.status === "pass");
  return { ok, criticalOk: ok, capability: "background-observation", deviceId: config.deviceId, operatorPackage: config.operatorPackage, checks };
}
