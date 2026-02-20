import { isAdbAvailable, runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";

export async function checkNodeVersion(): Promise<DoctorCheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  const MIN_NODE_VERSION = 22;

  if (major < MIN_NODE_VERSION) {
    return {
      id: "host.node.version",
      status: "fail",
      code: ERROR_CODES.NODE_TOO_OLD,
      summary: `Node version ${version} is too old.`,
      detail: `Clawperator requires Node.js v${MIN_NODE_VERSION} or newer.`,
      fix: {
        title: "Upgrade Node.js",
        platform: "any",
        steps: [
          { kind: "shell", value: "nvm install 22" },
          { kind: "shell", value: "nvm use 22" },
          { kind: "manual", value: "Alternatively, download from nodejs.org" }
        ],
      },
    };
  }

  return {
    id: "host.node.version",
    status: "pass",
    summary: `Node version ${version} is compatible.`,
  };
}

export async function checkAdbPresence(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const adbOk = await isAdbAvailable(config);
  if (!adbOk) {
    return {
      id: "host.adb.presence",
      status: "fail",
      code: ERROR_CODES.ADB_NOT_FOUND,
      summary: "adb not found in PATH.",
      detail: "The Android Debug Bridge (adb) is required to communicate with devices.",
      fix: {
        title: "Install Android Platform Tools",
        platform: "any",
        steps: [
          { kind: "manual", value: "macOS: brew install --cask android-platform-tools" },
          { kind: "manual", value: "Linux: sudo apt update && sudo apt install android-tools-adb" }
        ],
      },
    };
  }

  const { stdout } = await runAdb(config, ["version"]);
  return {
    id: "host.adb.presence",
    status: "pass",
    summary: "adb is installed.",
    evidence: { version: stdout.trim() },
  };
}

export async function checkAdbServer(config: RuntimeConfig): Promise<DoctorCheckResult> {
  const { code, stderr } = await runAdb(config, ["start-server"]);
  if (code !== 0) {
    return {
      id: "host.adb.server",
      status: "fail",
      code: ERROR_CODES.ADB_SERVER_FAILED,
      summary: "adb server failed to start.",
      detail: stderr,
      fix: {
        title: "Restart adb server",
        platform: "any",
        steps: [
          { kind: "shell", value: "adb kill-server" },
          { kind: "shell", value: "adb start-server" }
        ],
      },
    };
  }

  return {
    id: "host.adb.server",
    status: "pass",
    summary: "adb server is healthy.",
  };
}
