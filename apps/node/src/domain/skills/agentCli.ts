import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { delimiter, extname, join, resolve, isAbsolute } from "node:path";
import type { SkillAgentConfig } from "../../contracts/skills.js";

export const SKILL_AGENT_CLI_ENV_VAR = "CLAWPERATOR_SKILL_AGENT_CLI";
export const EXECUTABLE_NAME_PATTERN = /^[A-Za-z0-9._+-]+$/;

export interface AgentCliResolutionSuccess {
  ok: true;
  executablePath: string;
}

export interface AgentCliResolutionFailure {
  ok: false;
  message: string;
}

export type AgentCliResolution = AgentCliResolutionSuccess | AgentCliResolutionFailure;

export interface EffectiveAgentConfigSuccess {
  ok: true;
  agent: SkillAgentConfig;
}

export type EffectiveAgentConfigResolution = EffectiveAgentConfigSuccess | AgentCliResolutionFailure;

export async function canResolveAgentTarget(path: string): Promise<boolean> {
  const requiredMode = extname(path) === ".js" ? fsConstants.F_OK : fsConstants.X_OK;
  try {
    await access(path, requiredMode);
    return true;
  } catch {
    return false;
  }
}

export function resolveConfiguredAgentCli(
  agent: SkillAgentConfig,
  resolvedEnv: NodeJS.ProcessEnv
): EffectiveAgentConfigResolution {
  const overriddenCli = resolvedEnv[SKILL_AGENT_CLI_ENV_VAR]?.trim();
  if (!overriddenCli) {
    return { ok: true, agent };
  }
  if (!EXECUTABLE_NAME_PATTERN.test(overriddenCli)) {
    return {
      ok: false,
      message: `Configured ${SKILL_AGENT_CLI_ENV_VAR} value '${overriddenCli}' is not a plain executable name`,
    };
  }
  return {
    ok: true,
    agent: {
      ...agent,
      cli: overriddenCli,
      cliPath: undefined,
    },
  };
}

export async function resolveExecutableOnPath(
  executableName: string,
  pathValue: string | undefined
): Promise<string | null> {
  const pathEntries = (pathValue ?? "").split(delimiter).filter((entry) => entry.length > 0);
  for (const entry of pathEntries) {
    const candidate = join(entry, executableName);
    if (await canResolveAgentTarget(candidate)) {
      return candidate;
    }
  }
  return null;
}

export async function resolveAgentCliExecutable(
  agent: SkillAgentConfig,
  skillDir: string,
  resolvedEnv: NodeJS.ProcessEnv
): Promise<AgentCliResolution> {
  if (agent.cliPath && agent.cliPath.length > 0) {
    const resolvedCliPath = isAbsolute(agent.cliPath) ? agent.cliPath : resolve(skillDir, agent.cliPath);
    if (await canResolveAgentTarget(resolvedCliPath)) {
      return { ok: true, executablePath: resolvedCliPath };
    }
    return {
      ok: false,
      message: `Configured agent CLI was not found or is not executable at ${resolvedCliPath}`,
    };
  }

  const resolvedPath = await resolveExecutableOnPath(agent.cli, resolvedEnv.PATH);
  if (resolvedPath !== null) {
    return { ok: true, executablePath: resolvedPath };
  }

  return {
    ok: false,
    message: `Configured agent CLI '${agent.cli}' was not found on PATH`,
  };
}
