import { access } from "node:fs/promises";
import { homedir } from "node:os";
import type { OutputOptions } from "../output.js";
import { formatSuccess } from "../output.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { listDevices, type DeviceInfo } from "../../domain/devices/listDevices.js";
import { DoctorService } from "../../domain/doctor/DoctorService.js";
import type { DoctorReport, DoctorCheckResult } from "../../contracts/doctor.js";
import { resolveOperatorPackageForRequest, DEFAULT_OPERATOR_PACKAGE } from "../../domain/config/resolveOperatorPackage.js";
import { downloadOperatorApk } from "../../domain/version/operatorDownload.js";
import { setupOperator } from "../../domain/device/setupOperator.js";
import { getOperatorPackageApkPath } from "../../domain/version/compatibility.js";
import type { Logger } from "../../adapters/logger.js";

type RemediationDeviceStatus =
  | "ready"
  | "warn"
  | "remediated"
  | "adb-unready"
  | "failed";

export interface OperatorRemediateDeviceResult {
  deviceId: string;
  adbState: string;
  status: RemediationDeviceStatus;
  needsSetup: boolean;
  initialCriticalOk?: boolean;
  finalCriticalOk?: boolean;
  downloadAttempted: boolean;
  setupAttempted: boolean;
  doctorFixAttempted: boolean;
  message: string;
  initialReport?: DoctorReport;
  finalReport?: DoctorReport;
}

export interface OperatorRemediateResult {
  ok: boolean;
  operatorPackage: string;
  summary: {
    totalDevices: number;
    connectedDevices: number;
    ready: number;
    warn: number;
    remediated: number;
    adbUnready: number;
    failed: number;
  };
  devices: OperatorRemediateDeviceResult[];
  message: string;
}

interface OperatorRemediateDeps {
  listDevicesImpl?: typeof listDevices;
  doctorServiceFactory?: () => Pick<DoctorService, "run">;
  downloadOperatorApkImpl?: typeof downloadOperatorApk;
  setupOperatorImpl?: typeof setupOperator;
  apkExistsImpl?: (path: string) => Promise<boolean>;
}

interface DownloadCache {
  localPath: string;
}

function isCriticalOk(report: DoctorReport): boolean {
  return Boolean(report.criticalOk ?? report.ok);
}

function allChecksPass(report: DoctorReport): boolean {
  return isCriticalOk(report) && report.checks.every((check) => check.status === "pass");
}

function findCheck(report: DoctorReport, id: string): DoctorCheckResult | undefined {
  return report.checks.find((check) => check.id === id);
}

function reportNeedsSetup(report: DoctorReport): boolean {
  const apkPresence = findCheck(report, "readiness.apk.presence");
  if (
    apkPresence
    && (apkPresence.status === "fail" || apkPresence.status === "warn")
    && apkPresence.code !== "DEVICE_SHELL_UNAVAILABLE"
  ) {
    return true;
  }

  return findCheck(report, "readiness.version.compatibility")?.status === "fail";
}

function reportNeedsGrantRecovery(report: DoctorReport): boolean {
  return findCheck(report, "readiness.handshake")?.status === "fail";
}

function buildWarnMessage(report: DoctorReport): string {
  const checks = report.checks.filter((check) => check.status !== "pass");
  if (checks.length === 0) {
    return "Critical checks passed.";
  }
  return `Critical checks passed with warnings: ${checks.map((check) => check.id).join(", ")}`;
}

function buildFailureMessage(report: DoctorReport): string {
  const checks = report.checks.filter((check) => check.status === "fail");
  if (checks.length === 0) {
    return "Device still needs attention.";
  }
  return `Critical checks still failing: ${checks.map((check) => check.id).join(", ")}`;
}

function expandHomePath(path: string): string {
  return path.startsWith("~/") ? `${homedir()}/${path.slice(2)}` : path;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function runDoctorReport(
  doctorService: Pick<DoctorService, "run">,
  operatorPackage: string,
  deviceId: string,
  logger: Logger | undefined,
  fix = false,
): Promise<DoctorReport> {
  const config = getDefaultRuntimeConfig({
    deviceId,
    operatorPackage,
    adbPath: process.env.ADB_PATH,
    logger,
  });
  return doctorService.run({ config, fix, logger });
}

async function ensureSetupApkPath(
  operatorPackage: string,
  downloadCache: DownloadCache | undefined,
  deps: Required<Pick<OperatorRemediateDeps, "downloadOperatorApkImpl" | "apkExistsImpl">>,
): Promise<{ localPath?: string; message?: string; cache?: DownloadCache }> {
  if (downloadCache) {
    return { localPath: downloadCache.localPath, cache: downloadCache };
  }

  if (operatorPackage === DEFAULT_OPERATOR_PACKAGE) {
    const downloaded = await deps.downloadOperatorApkImpl({ operatorPackage });
    return {
      localPath: downloaded.localPath,
      cache: { localPath: downloaded.localPath },
    };
  }

  const localPath = expandHomePath(getOperatorPackageApkPath(operatorPackage));
  if (await deps.apkExistsImpl(localPath)) {
    return { localPath, cache: { localPath } };
  }

  return {
    message: `Automatic APK download is only available for ${DEFAULT_OPERATOR_PACKAGE}. Provide a matching local APK at ${localPath} for ${operatorPackage}.`,
  };
}

async function remediateConnectedDevice(
  device: DeviceInfo,
  operatorPackage: string,
  logger: Logger | undefined,
  deps: Required<OperatorRemediateDeps>,
  downloadCache: DownloadCache | undefined,
): Promise<{ result: OperatorRemediateDeviceResult; cache?: DownloadCache }> {
  const doctorService = deps.doctorServiceFactory();
  const initialReport = await runDoctorReport(doctorService, operatorPackage, device.serial, logger, false);
  const needsSetup = reportNeedsSetup(initialReport);
  const needsGrantRecovery = reportNeedsGrantRecovery(initialReport);

  if (allChecksPass(initialReport)) {
    return {
      result: {
        deviceId: device.serial,
        adbState: device.state,
        status: "ready",
        needsSetup: false,
        initialCriticalOk: true,
        finalCriticalOk: true,
        downloadAttempted: false,
        setupAttempted: false,
        doctorFixAttempted: false,
        message: "Device is ready.",
        initialReport,
        finalReport: initialReport,
      },
      cache: downloadCache,
    };
  }

  if (isCriticalOk(initialReport) && !needsSetup && !needsGrantRecovery) {
    return {
      result: {
        deviceId: device.serial,
        adbState: device.state,
        status: "warn",
        needsSetup: false,
        initialCriticalOk: true,
        finalCriticalOk: true,
        downloadAttempted: false,
        setupAttempted: false,
        doctorFixAttempted: false,
        message: buildWarnMessage(initialReport),
        initialReport,
        finalReport: initialReport,
      },
      cache: downloadCache,
    };
  }

  let currentCache = downloadCache;
  if (!needsSetup && !needsGrantRecovery && !isCriticalOk(initialReport)) {
    return {
      result: {
        deviceId: device.serial,
        adbState: device.state,
        status: "failed",
        needsSetup: false,
        initialCriticalOk: false,
        finalCriticalOk: false,
        downloadAttempted: false,
        setupAttempted: false,
        doctorFixAttempted: false,
        message: buildFailureMessage(initialReport),
        initialReport,
        finalReport: initialReport,
      },
      cache: downloadCache,
    };
  }

  let downloadAttempted = false;
  let setupAttempted = false;
  let doctorFixAttempted = false;

  if (needsSetup) {
    const hadCachedDownload = currentCache !== undefined;
    const setupApk = await ensureSetupApkPath(operatorPackage, currentCache, {
      downloadOperatorApkImpl: deps.downloadOperatorApkImpl,
      apkExistsImpl: deps.apkExistsImpl,
    });
    currentCache = setupApk.cache ?? currentCache;
    downloadAttempted = operatorPackage === DEFAULT_OPERATOR_PACKAGE && !hadCachedDownload;

    if (!setupApk.localPath) {
      return {
        result: {
          deviceId: device.serial,
          adbState: device.state,
          status: "failed",
          needsSetup: true,
          initialCriticalOk: isCriticalOk(initialReport),
          finalCriticalOk: false,
          downloadAttempted,
          setupAttempted: false,
          doctorFixAttempted: false,
          message: setupApk.message ?? "No APK was available for remediation.",
          initialReport,
          finalReport: initialReport,
        },
        cache: currentCache,
      };
    }

    setupAttempted = true;
    const setupConfig = getDefaultRuntimeConfig({
      deviceId: device.serial,
      operatorPackage,
      adbPath: process.env.ADB_PATH,
      logger,
    });
    const setupResult = await deps.setupOperatorImpl(setupConfig, setupApk.localPath, operatorPackage);
    const permissionsOk = setupResult.permissions === undefined
      || (setupResult.permissions.accessibility.ok
        && setupResult.permissions.notification.ok
        && setupResult.permissions.notificationListener.ok);

    if (!setupResult.install.ok || !permissionsOk || !setupResult.verification?.ok) {
      return {
        result: {
          deviceId: device.serial,
          adbState: device.state,
          status: "failed",
          needsSetup: true,
          initialCriticalOk: isCriticalOk(initialReport),
          finalCriticalOk: false,
          downloadAttempted,
          setupAttempted,
          doctorFixAttempted: false,
          message: setupResult.install.error
            ?? setupResult.verification?.error
            ?? setupResult.permissions?.accessibility.error
            ?? setupResult.permissions?.notification.error
            ?? setupResult.permissions?.notificationListener.error
            ?? "Operator setup failed.",
          initialReport,
        },
        cache: currentCache,
      };
    }
  }

  let finalReport = await runDoctorReport(doctorService, operatorPackage, device.serial, logger, false);
  if (reportNeedsGrantRecovery(finalReport)) {
    doctorFixAttempted = true;
    await runDoctorReport(doctorService, operatorPackage, device.serial, logger, true);
    finalReport = await runDoctorReport(doctorService, operatorPackage, device.serial, logger, false);
  }

  if (allChecksPass(finalReport)) {
    return {
      result: {
        deviceId: device.serial,
        adbState: device.state,
        status: needsSetup || doctorFixAttempted ? "remediated" : "ready",
        needsSetup,
        initialCriticalOk: isCriticalOk(initialReport),
        finalCriticalOk: true,
        downloadAttempted,
        setupAttempted,
        doctorFixAttempted,
        message: needsSetup || doctorFixAttempted
          ? "Device was remediated and is now ready."
          : "Device is ready.",
        initialReport,
        finalReport,
      },
      cache: currentCache,
    };
  }

  if (isCriticalOk(finalReport)) {
    return {
      result: {
        deviceId: device.serial,
        adbState: device.state,
        status: needsSetup || doctorFixAttempted ? "remediated" : "warn",
        needsSetup,
        initialCriticalOk: isCriticalOk(initialReport),
        finalCriticalOk: true,
        downloadAttempted,
        setupAttempted,
        doctorFixAttempted,
        message: buildWarnMessage(finalReport),
        initialReport,
        finalReport,
      },
      cache: currentCache,
    };
  }

  return {
    result: {
      deviceId: device.serial,
      adbState: device.state,
      status: "failed",
      needsSetup,
      initialCriticalOk: isCriticalOk(initialReport),
      finalCriticalOk: false,
      downloadAttempted,
      setupAttempted,
      doctorFixAttempted,
      message: buildFailureMessage(finalReport),
      initialReport,
      finalReport,
    },
    cache: currentCache,
  };
}

function summarize(results: OperatorRemediateDeviceResult[]): OperatorRemediateResult["summary"] {
  const summary = {
    totalDevices: results.length,
    connectedDevices: results.filter((device) => device.adbState === "device").length,
    ready: 0,
    warn: 0,
    remediated: 0,
    adbUnready: 0,
    failed: 0,
  };

  for (const result of results) {
    if (result.status === "ready") {
      summary.ready += 1;
    } else if (result.status === "warn") {
      summary.warn += 1;
    } else if (result.status === "remediated") {
      summary.remediated += 1;
    } else if (result.status === "adb-unready") {
      summary.adbUnready += 1;
    } else if (result.status === "failed") {
      summary.failed += 1;
    }
  }

  return summary;
}

function buildSummaryMessage(summary: OperatorRemediateResult["summary"]): string {
  if (summary.totalDevices === 0) {
    return "No connected Android devices found.";
  }
  if (summary.failed === 0 && summary.adbUnready === 0) {
    if (summary.remediated > 0) {
      return `Remediated ${summary.remediated} device${summary.remediated === 1 ? "" : "s"}.`;
    }
    if (summary.warn > 0) {
      return `All connected devices passed critical checks. ${summary.warn} device${summary.warn === 1 ? "" : "s"} still have warnings.`;
    }
    return "All connected devices are ready.";
  }
  if (summary.failed === 0) {
    const adbRecoverySummary = `${summary.adbUnready} visible device${summary.adbUnready === 1 ? "" : "s"} still need${summary.adbUnready === 1 ? "s" : ""} ADB recovery.`;
    if (summary.remediated > 0) {
      return `Remediated ${summary.remediated} device${summary.remediated === 1 ? "" : "s"}. ${adbRecoverySummary}`;
    }
    if (summary.warn > 0) {
      return `All connected devices passed critical checks. ${adbRecoverySummary}`;
    }
    if (summary.connectedDevices > 0) {
      return `All connected devices are ready. ${adbRecoverySummary}`;
    }
    return `No connected device is ready for ADB yet. ${adbRecoverySummary}`;
  }
  return `Remediation still required for ${summary.failed + summary.adbUnready} device${summary.failed + summary.adbUnready === 1 ? "" : "s"}.`;
}

export async function cmdOperatorRemediate(
  options: OutputOptions & {
    operatorPackage?: string;
    logger?: Logger;
  },
  deps: OperatorRemediateDeps = {},
): Promise<string> {
  const operatorPackage = resolveOperatorPackageForRequest(options.operatorPackage);
  const config = getDefaultRuntimeConfig({
    operatorPackage,
    adbPath: process.env.ADB_PATH,
    logger: options.logger,
  });

  const listDevicesImpl = deps.listDevicesImpl ?? listDevices;
  const doctorServiceFactory = deps.doctorServiceFactory ?? (() => new DoctorService());
  const downloadOperatorApkImpl = deps.downloadOperatorApkImpl ?? downloadOperatorApk;
  const setupOperatorImpl = deps.setupOperatorImpl ?? setupOperator;
  const apkExistsImpl = deps.apkExistsImpl ?? fileExists;
  const devices = await listDevicesImpl(config);

  if (devices.length === 0) {
    return formatSuccess({
      ok: true,
      operatorPackage,
      summary: {
        totalDevices: 0,
        connectedDevices: 0,
        ready: 0,
        warn: 0,
        remediated: 0,
        adbUnready: 0,
        failed: 0,
      },
      devices: [],
      message: "No connected Android devices found.",
    } satisfies OperatorRemediateResult, options);
  }

  let downloadCache: DownloadCache | undefined;
  const results: OperatorRemediateDeviceResult[] = [];
  for (const device of devices) {
    if (device.state !== "device") {
      results.push({
        deviceId: device.serial,
        adbState: device.state,
        status: "adb-unready",
        needsSetup: false,
        initialCriticalOk: false,
        finalCriticalOk: false,
        downloadAttempted: false,
        setupAttempted: false,
        doctorFixAttempted: false,
        message: `ADB reports state '${device.state}'. Resolve device connectivity before remediation.`,
      });
      continue;
    }

    const remediated = await remediateConnectedDevice(
      device,
      operatorPackage,
      options.logger,
      {
        listDevicesImpl,
        doctorServiceFactory,
        downloadOperatorApkImpl,
        setupOperatorImpl,
        apkExistsImpl,
      },
      downloadCache,
    );
    downloadCache = remediated.cache ?? downloadCache;
    results.push(remediated.result);
  }

  const summary = summarize(results);
  const ok = summary.failed === 0;
  if (!ok) {
    process.exitCode = 1;
  }

  return formatSuccess({
    ok,
    operatorPackage,
    summary,
    devices: results,
    message: buildSummaryMessage(summary),
  } satisfies OperatorRemediateResult, options);
}
