import { isAdbAvailable, runAdb } from "../../../adapters/android-bridge/adbClient.js";
import { type RuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { type DoctorCheckResult } from "../../../contracts/doctor.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { DOCTOR_DOCS_URLS } from "../docsUrls.js";
import { join } from "node:path";
import { loadRegistry, getRepoRoot } from "../../../adapters/skills-repo/localSkillsRegistry.js";
import {
  EXECUTABLE_NAME_PATTERN,
  resolveExecutableOnPath,
  resolveConfiguredAgentCli,
  resolveAgentCliExecutable,
} from "../../skills/agentCli.js";
import { readSkillManifestMetadata } from "../../skills/skillManifest.js";

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

export async function checkDefaultOrchestratedSkillAgentCli(_config: RuntimeConfig): Promise<DoctorCheckResult> {
  const configuredCli = process.env[ORCHESTRATED_SKILL_AGENT_CLI_ENV_VAR]?.trim() || DEFAULT_ORCHESTRATED_SKILL_AGENT_CLI;

  if (!EXECUTABLE_NAME_PATTERN.test(configuredCli)) {
    return {
      id: "host.skill-agent-cli.default",
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
      id: "host.skill-agent-cli.default",
      status: "warn",
      code: ERROR_CODES.HOST_DEPENDENCY_MISSING,
      summary: `Default orchestrated-skill agent CLI '${configuredCli}' was not found on PATH.`,
      detail: "This is a host-level advisory for PATH-based resolution only. Some orchestrated skills may still run via skill.json.agent.cliPath, but PATH-based agent resolution will fail until the configured CLI is installed or overridden.",
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
    id: "host.skill-agent-cli.default",
    status: "pass",
    summary: `Default orchestrated-skill agent CLI '${configuredCli}' is available.`,
    evidence: {
      configuredCli,
      resolvedPath,
    },
  };
}

export async function checkInstalledOrchestratedSkillAgentCliAvailability(_config: RuntimeConfig): Promise<DoctorCheckResult> {
  let registryResult;
  try {
    registryResult = await loadRegistry();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const registryNotConfigured = process.env.CLAWPERATOR_SKILLS_REGISTRY === undefined
      && detail.startsWith("Registry not found at default path:");
    if (registryNotConfigured) {
      return {
        id: "host.skill-agent-cli.skills",
        status: "pass",
        summary: "Skipping skill-aware orchestrated agent CLI check because no local skills registry is configured.",
        detail,
      };
    }
    return {
      id: "host.skill-agent-cli.skills",
      status: "warn",
      code: ERROR_CODES.HOST_DEPENDENCY_MISSING,
      summary: "Skill-aware orchestrated agent CLI readiness could not inspect the local skills registry.",
      detail,
      fix: {
        title: "Repair the local skills registry before relying on orchestrated skill readiness",
        platform: "any",
        steps: [
          { kind: "manual", value: "Fix the configured skills-registry.json path or repair the registry JSON contents." },
          { kind: "manual", value: "If no registry is installed yet, run clawperator skills install first." },
        ],
        docsUrl: DOCTOR_DOCS_URLS.setup,
      },
    };
  }

  const repoRoot = getRepoRoot(registryResult.resolvedPath);
  const failures: string[] = [];
  const manifestFailures: string[] = [];
  let orchestratedSkills = 0;

  for (const skill of registryResult.registry.skills) {
    const manifestResult = await readSkillManifestMetadata(repoRoot, skill.path);
    if (!manifestResult.ok) {
      manifestFailures.push(`${skill.id}: ${manifestResult.message}`);
      continue;
    }
    if (!manifestResult.metadata.agent) {
      continue;
    }

    orchestratedSkills += 1;
    const effectiveAgent = resolveConfiguredAgentCli(manifestResult.metadata.agent, process.env);
    if (!effectiveAgent.ok) {
      failures.push(`${skill.id}: ${effectiveAgent.message}`);
      continue;
    }

    const resolution = await resolveAgentCliExecutable(
      effectiveAgent.agent,
      join(repoRoot, skill.path),
      process.env
    );
    if (!resolution.ok) {
      failures.push(`${skill.id}: ${resolution.message}`);
    }
  }

  if (orchestratedSkills === 0 && manifestFailures.length === 0) {
    return {
      id: "host.skill-agent-cli.skills",
      status: "pass",
      summary: "No orchestrated skills in the local registry require agent CLI resolution.",
      evidence: {
        checkedSkills: 0,
      },
    };
  }

  if (failures.length > 0 || manifestFailures.length > 0) {
    const detailLines = [
      ...manifestFailures,
      ...failures,
    ];
    const failingSkills = [
      ...manifestFailures.map((failure) => failure.split(":")[0]),
      ...failures.map((failure) => failure.split(":")[0]),
    ];
    return {
      id: "host.skill-agent-cli.skills",
      status: "warn",
      code: ERROR_CODES.HOST_DEPENDENCY_MISSING,
      summary: [
        failures.length > 0
          ? `${failures.length} of ${orchestratedSkills} orchestrated skills have unresolved agent CLI dependencies.`
          : undefined,
        manifestFailures.length > 0
          ? `${manifestFailures.length} installed skills could not be inspected because their skill metadata is unreadable.`
          : undefined,
      ].filter((line): line is string => line !== undefined).join(" "),
      detail: detailLines.join("\n"),
      fix: {
        title: "Align installed orchestrated skills with reachable agent CLIs",
        platform: "any",
        steps: [
          { kind: "manual", value: "Install the required agent CLI on PATH for skills that use agent.cli." },
          { kind: "manual", value: "Or fix skill.json.agent.cliPath for skills that pin an explicit launcher path." },
          { kind: "manual", value: "If doctor reports unreadable skill metadata, repair the affected skill.json before relying on the readiness result." },
        ],
        docsUrl: DOCTOR_DOCS_URLS.setup,
      },
      evidence: {
        checkedSkills: orchestratedSkills,
        unreadableSkills: manifestFailures.map((failure) => failure.split(":")[0]),
        failingSkills,
      },
    };
  }

  return {
    id: "host.skill-agent-cli.skills",
    status: "pass",
    summary: `All ${orchestratedSkills} orchestrated skills in the local registry resolved their configured agent CLI.`,
    evidence: {
      checkedSkills: orchestratedSkills,
    },
  };
}
