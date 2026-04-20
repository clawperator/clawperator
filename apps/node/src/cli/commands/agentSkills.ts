import { stat } from "node:fs/promises";
import { DEFAULT_AGENT_SKILLS_DIR } from "../../domain/skills/skillsConfig.js";
import {
  copyAgentSkills,
  listInstalledAgentSkills,
  resolveClaudeSkillsDir,
  resolveCodexSkillsDir,
  type CopyAgentSkillsOptions,
} from "../../domain/skills/copyAgentSkills.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatSuccess } from "../output.js";

export interface AgentSkillCommandOptions extends CopyAgentSkillsOptions {
  format: OutputOptions["format"];
}

async function isMissingDir(path: string): Promise<boolean> {
  try {
    await stat(path);
    return false;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

function getAgentSkillsEnvHint(env: NodeJS.ProcessEnv | undefined): string | undefined {
  const sourceDir = env?.CLAWPERATOR_AGENT_SKILLS;
  if (sourceDir === undefined || sourceDir === "") {
    return undefined;
  }
  return `Using CLAWPERATOR_AGENT_SKILLS=${sourceDir}`;
}

async function runAgentSkillsInstall(
  action: "install" | "update",
  options: AgentSkillCommandOptions
): Promise<string> {
  const result = await copyAgentSkills(options);
  if (!result.ok) {
    return formatError({ code: result.code, message: result.message }, options);
  }

  return formatSuccess({
    skills: result.skills,
    count: result.skills.length,
    installedDir: result.installedDir,
    claudeSkillsDir: resolveClaudeSkillsDir(options),
    codexSkillsDir: resolveCodexSkillsDir(options),
    agentDiscoveryDirs: result.agentDiscoveryDirs,
    message: `Agent-skills ${action === "install" ? "installed" : "updated"}.`,
    envHint: getAgentSkillsEnvHint(options.env),
  }, options);
}

export async function cmdAgentSkillsInstall(options: AgentSkillCommandOptions): Promise<string> {
  return runAgentSkillsInstall("install", options);
}

export async function cmdAgentSkillsUpdate(options: AgentSkillCommandOptions): Promise<string> {
  return runAgentSkillsInstall("update", options);
}

export async function cmdAgentSkillsList(
  options: { format: OutputOptions["format"]; installDir?: string }
): Promise<string> {
  const installDir = options.installDir ?? DEFAULT_AGENT_SKILLS_DIR;
  try {
    if (await isMissingDir(installDir)) {
      return formatSuccess({
        skills: [],
        count: 0,
        installedDir: installDir,
        message: "No installed agent-skills found. Run clawperator agent-skills install to get skill-author-by-agent-discovery and skill-author-by-recording.",
      }, options);
    }

    const skills = await listInstalledAgentSkills(installDir);
    return formatSuccess({
      skills,
      count: skills.length,
      installedDir: installDir,
    }, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatError({ code: "AGENT_SKILLS_LIST_FAILED", message }, options);
  }
}
