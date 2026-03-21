import { createRequire } from "node:module";
import { runAdb } from "../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES, type ClawperatorError } from "../../contracts/errors.js";
import { hasListedPackage } from "../device/grantPermissions.js";

const require = createRequire(import.meta.url);

export { hasListedPackage } from "../device/grantPermissions.js";

const COMPATIBILITY_VERSION_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export interface ParsedCompatibilityVersion {
  raw: string;
  normalized: string;
  major: number;
  minor: number;
  patch: number;
}

export interface InstalledApkVersion {
  versionName: string;
  versionCode?: number;
}

export interface VersionCompatibilityProbe {
  cliVersion: string;
  apkVersion?: string;
  apkVersionCode?: number;
  receiverPackage: string;
  compatible: boolean;
  error?: ClawperatorError;
  remediation?: string[];
}

interface CliPackageMetadata {
  version?: string;
}

export function getAlternateReceiverVariant(receiverPackage: string): string {
  return receiverPackage.endsWith(".dev")
    ? receiverPackage.slice(0, -4)
    : `${receiverPackage}.dev`;
}

export function getReceiverPackageApkPath(receiverPackage: string): string {
  return receiverPackage.endsWith(".dev")
    ? "~/.clawperator/downloads/operator-debug.apk"
    : "~/.clawperator/downloads/operator.apk";
}

export function readCliVersion(pkg: CliPackageMetadata): string {
  if (!pkg.version || pkg.version.trim().length === 0) {
    throw new Error("package.json version is missing");
  }
  return pkg.version;
}

interface InstalledReceiverVariantResult {
  installed: boolean;
  alternateVariant?: string;
  error?: ClawperatorError;
}

function buildReceiverProbeError(
  receiverPackage: string,
  stderr: string,
  exitCode: number | null
): ClawperatorError {
  return {
    code: ERROR_CODES.DEVICE_SHELL_UNAVAILABLE,
    message: `Could not query installed packages for ${receiverPackage}.`,
    hint: "Verify adb shell access on the device and retry the compatibility check.",
    details: {
      stderr: stderr || undefined,
      exitCode: exitCode ?? undefined,
    },
  };
}

async function getInstalledReceiverVariant(
  config: RuntimeConfig,
  receiverPackage: string
): Promise<InstalledReceiverVariantResult> {
  const packageList = await runAdb(config, ["shell", "pm", "list", "packages", receiverPackage]);
  if (packageList.code !== 0) {
    return {
      installed: false,
      error: buildReceiverProbeError(receiverPackage, packageList.stderr, packageList.code),
    };
  }
  if (hasListedPackage(packageList.stdout, receiverPackage)) {
    return { installed: true };
  }

  const alternateVariant = getAlternateReceiverVariant(receiverPackage);
  const alternateList = await runAdb(config, ["shell", "pm", "list", "packages", alternateVariant]);
  if (alternateList.code !== 0) {
    return {
      installed: false,
      error: buildReceiverProbeError(alternateVariant, alternateList.stderr, alternateList.code),
    };
  }
  if (hasListedPackage(alternateList.stdout, alternateVariant)) {
    return { installed: false, alternateVariant };
  }

  return { installed: false };
}

export function getCliVersion(): string {
  const pkg = require("../../../package.json") as CliPackageMetadata;
  return readCliVersion(pkg);
}

export function normalizeCompatibilityVersion(versionName: string): string {
  return versionName.trim().replace(/-d$/, "");
}

export function getOperatorApkDownloadUrl(versionName: string): string {
  const normalized = normalizeCompatibilityVersion(versionName);
  return `https://downloads.clawperator.com/operator/v${normalized}/operator-v${normalized}.apk`;
}

export function getOperatorApkSha256Url(versionName: string): string {
  const normalized = normalizeCompatibilityVersion(versionName);
  return `https://downloads.clawperator.com/operator/v${normalized}/operator-v${normalized}.apk.sha256`;
}

export function parseCompatibilityVersion(versionName: string): ParsedCompatibilityVersion {
  const normalized = normalizeCompatibilityVersion(versionName);
  const match = COMPATIBILITY_VERSION_REGEX.exec(normalized);
  if (!match) {
    throw new Error(`Unsupported Clawperator version format: ${versionName}`);
  }

  return {
    raw: versionName,
    normalized,
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function parseInstalledApkVersion(dumpsysOutput: string): InstalledApkVersion {
  const versionNameMatch = dumpsysOutput.match(/^\s*versionName=(.+)$/m);
  if (!versionNameMatch?.[1]) {
    throw new Error("versionName was not found in dumpsys output");
  }

  const versionCodeMatch = dumpsysOutput.match(/^\s*versionCode=(\d+)/m);
  return {
    versionName: versionNameMatch[1].trim(),
    versionCode: versionCodeMatch?.[1] ? Number(versionCodeMatch[1]) : undefined,
  };
}

export function isVersionCompatible(cliVersion: string, apkVersion: string): boolean {
  const parsedCli = parseCompatibilityVersion(normalizeCompatibilityVersion(cliVersion));
  const parsedApk = parseCompatibilityVersion(normalizeCompatibilityVersion(apkVersion));
  return parsedCli.normalized === parsedApk.normalized;
}

export async function probeVersionCompatibility(config: RuntimeConfig): Promise<VersionCompatibilityProbe> {
  let cliVersion: string;
  try {
    cliVersion = getCliVersion();
  } catch (error) {
    return {
      cliVersion: "unknown",
      receiverPackage: config.receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.CLI_VERSION_INVALID,
        message: "CLI version metadata is missing or unreadable.",
        hint: "Reinstall the CLI or verify that the installed package is intact.",
        details: { cause: String(error) },
      },
      remediation: [
        "Reinstall the CLI: npm install -g clawperator@latest",
      ],
    };
  }

  const receiverPackage = config.receiverPackage;

  let parsedCli: ParsedCompatibilityVersion;
  try {
    parsedCli = parseCompatibilityVersion(cliVersion);
  } catch (error) {
    return {
      cliVersion,
      receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.CLI_VERSION_INVALID,
        message: `CLI version ${cliVersion} is not parseable for compatibility checks.`,
        hint: "Reinstall the CLI or verify that the installed package is intact.",
        details: { cause: String(error) },
      },
      remediation: [
        "Reinstall the CLI: npm install -g clawperator@latest",
      ],
    };
  }

  const receiverVariant = await getInstalledReceiverVariant(config, receiverPackage);
  if (receiverVariant.error) {
    return {
      cliVersion,
      receiverPackage,
      compatible: false,
      error: receiverVariant.error,
      remediation: [
        "Verify adb shell access with: adb shell pm list packages",
        "Reconnect the device or restart adb if shell commands are failing",
      ],
    };
  }

  if (!receiverVariant.installed) {
    if (receiverVariant.alternateVariant) {
      return {
        cliVersion,
        receiverPackage,
        compatible: false,
        error: {
          code: ERROR_CODES.RECEIVER_VARIANT_MISMATCH,
          message: `Expected ${receiverPackage} but found installed variant ${receiverVariant.alternateVariant}.`,
          hint: "Use the installed receiver package or reinstall the correct APK variant.",
        },
        remediation: [
          `Use --receiver-package ${receiverVariant.alternateVariant}`,
          `Reinstall the correct APK variant for ${receiverPackage}`,
        ],
      };
    }

    return {
      cliVersion,
      receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
        message: `Package ${receiverPackage} is not installed on the device.`,
        hint: "Install the Operator APK or choose the correct receiver package.",
      },
      remediation: [
        `Download the matching APK: ${getOperatorApkDownloadUrl(parsedCli.normalized)}`,
        `Download the checksum: ${getOperatorApkSha256Url(parsedCli.normalized)}`,
        `Verify the checksum: sha256sum -c operator-v${parsedCli.normalized}.apk.sha256`,
        `Install the matching APK: clawperator operator setup --apk operator-v${parsedCli.normalized}.apk --device-id <device_id>${receiverPackage.endsWith(".dev") ? " --receiver-package com.clawperator.operator.dev" : ""}`,
        receiverPackage.endsWith(".dev")
          ? "If you are targeting the local debug package, rebuild and reinstall the debug APK from the same source checkout instead of using the release download."
          : "If you are using the release package, the versioned download above is the exact APK to install.",
      ],
    };
  }

  const dump = await runAdb(config, ["shell", "dumpsys", "package", receiverPackage]);
  if (dump.code !== 0 || !dump.stdout.trim()) {
    return {
      cliVersion,
      receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.APK_VERSION_UNREADABLE,
        message: `Could not read the installed APK version for ${receiverPackage}.`,
        hint: "Reinstall the APK or verify adb shell access.",
        details: {
          stderr: dump.stderr || undefined,
          exitCode: dump.code ?? undefined,
        },
      },
      remediation: [
        `Reinstall the APK for ${receiverPackage}`,
        "Verify adb shell access with: adb shell dumpsys package <receiverPackage>",
      ],
    };
  }

  let installed: InstalledApkVersion;
  try {
    installed = parseInstalledApkVersion(dump.stdout);
  } catch (error) {
    return {
      cliVersion,
      receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.APK_VERSION_UNREADABLE,
        message: `Could not find version metadata for ${receiverPackage} in dumpsys output.`,
        hint: "Reinstall the APK or inspect the package dump output.",
        details: { cause: String(error) },
      },
      remediation: [
        `Inspect the package dump with: adb shell dumpsys package ${receiverPackage}`,
        `Reinstall the APK for ${receiverPackage}`,
      ],
    };
  }

  try {
    const parsedApk = parseCompatibilityVersion(normalizeCompatibilityVersion(installed.versionName));
    const compatible = parsedCli.normalized === parsedApk.normalized;

    if (!compatible) {
      const apkUrl = getOperatorApkDownloadUrl(parsedCli.normalized);
      const sha256Url = getOperatorApkSha256Url(parsedCli.normalized);
      return {
        cliVersion,
        apkVersion: installed.versionName,
        apkVersionCode: installed.versionCode,
        receiverPackage,
        compatible: false,
        error: {
          code: ERROR_CODES.VERSION_INCOMPATIBLE,
          message: `CLI ${cliVersion} is not compatible with installed APK ${installed.versionName}.`,
          hint: "Clawperator requires the exact same version between the CLI and APK, ignoring only the debug suffix.",
        },
        remediation: [
          `Download the matching APK: ${apkUrl}`,
          `Download the checksum: ${sha256Url}`,
          `Verify the checksum: sha256sum -c operator-v${parsedCli.normalized}.apk.sha256`,
          `Install the matching APK: clawperator operator setup --apk operator-v${parsedCli.normalized}.apk --device-id <device_id>`,
          receiverPackage.endsWith(".dev")
            ? "If you are targeting the local debug package, rebuild and reinstall the debug APK from the same source checkout instead of using the release download."
            : "If you are using the release package, the versioned download above is the exact APK to install.",
        ],
      };
    }

    return {
      cliVersion,
      apkVersion: installed.versionName,
      apkVersionCode: installed.versionCode,
      receiverPackage,
      compatible: true,
    };
  } catch (error) {
    return {
      cliVersion,
      apkVersion: installed.versionName,
      apkVersionCode: installed.versionCode,
      receiverPackage,
      compatible: false,
      error: {
        code: ERROR_CODES.APK_VERSION_INVALID,
        message: `Installed APK version ${installed.versionName} is not parseable for compatibility checks.`,
        hint: "Reinstall the APK with a supported Clawperator version string.",
        details: { cause: String(error) },
      },
      remediation: [
        `Reinstall the APK for ${receiverPackage} from a current release`,
      ],
    };
  }
}
