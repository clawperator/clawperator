import { isAdbAvailable, runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { DOCTOR_DOCS_URLS } from "../docsUrls.js";
import {
  EXECUTABLE_NAME_PATTERN,
  resolveExecutableOnPath,
} from "../../skills/agentCli.js";

const DEFAULT_ORCHESTRATED_SKILL_AGENT_CLI = "codex";
const ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR = "CLAWPERATOR_SKILL_AGENT_CLI";

export async function checkNodeVersion(): Promise<DoctorCheckResult> {
  const version = process.version;
  const major = parseInt(version.slice(1).split(".")[0], 10);
  const MIN_NODE_VERSION = 24;

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
          { kind: "shell", value: "nvm install 24" },
          { kind: "shell", value: "nvm use 24" },
          { kind: "manual", value: "Alternatively, download from nodejs.org" }
        ],
        docsUrl: DOCTOR_DOCS_URLS.setup,
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
        docsUrl: DOCTOR_DOCS_URLS.setup,
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
        docsUrl: DOCTOR_DOCS_URLS.setup,
      },
    };
  }

  return {
    id: "host.adb.server",
    status: "pass",
    summary: "adb server is healthy.",
  };
}

export async function checkOrchestratedSkillAgentCli(_config: RuntimeConfig): Promise<DoctorCheckResult> {
  const configuredCli = process.env[ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR]?.trim() || DEFAULT_ORCHESTRATED_SKILL_AGENT_CLI;

  if (!EXECUTABLE_NAME_PATTERN.test(configuredCli)) {
    return {
      id: "host.skill-agent-cli.presence",
      status: "warn",
      code: ERROR_CODES.HOST_DEPENDENCY_MISSING,
      summary: `Configured orchestrated-skill agent CLI '${configuredCli}' is not a plain executable name.`,
      detail: `Set ${ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR} to an executable name without slashes, spaces, or shell syntax.`,
      fix: {
        title: "Configure a plain executable name for the orchestrated skill agent CLI",
        platform: "any",
        steps: [
          { kind: "manual", value: `Set ${ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR} to an executable name such as '${DEFAULT_ORCHESTRATED_SKILL_AGENT_CLI}'.` },
        ],
        docsUrl: DOCTOR_DOCS_URLS.setup,
      },
      evidence: {
        configuredCli,
      },
    };
  }

  const resolvedPath = await resolveExecutableOnPath(configuredCli, process.env.PATH);

  if (resolvedPath === null) {
    return {
      id: "host.skill-agent-cli.presence",
      status: "warn",
      code: ERROR_CODES.HOST_DEPENDENCY_MISSING,
      summary: `Default orchestrated-skill agent CLI '${configuredCli}' was not found on PATH.`,
      detail: "Agent-driven skills can still be validated, but `skills run` for orchestrated skills will fail until the configured agent CLI is installed or overridden.",
      fix: {
        title: "Install or configure the orchestrated skill agent CLI",
        platform: "any",
        steps: [
          { kind: "manual", value: "Install the configured agent CLI so it is available on PATH." },
          { kind: "manual", value: `Or set ${ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR} to a different executable name before running doctor or orchestrated skills.` },
        ],
        docsUrl: DOCTOR_DOCS_URLS.setup,
      },
      evidence: {
        configuredCli,
      },
    };
  }

  return {
    id: "host.skill-agent-cli.presence",
    status: "pass",
    summary: `Default orchestrated-skill agent CLI '${configuredCli}' is available.`,
    evidence: {
      configuredCli,
      resolvedPath,
    },
  };
}
