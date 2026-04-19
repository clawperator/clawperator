import { stat } from "node:fs/promises";
import { DEFAULT_AUTHORING_SKILLS_DIR } from "../../domain/skills/skillsConfig.js";
import {
  copyAuthoringSkills,
  listInstalledAuthoringSkills,
  resolveClaudeSkillsDir,
  resolveCodexSkillsDir,
  type CopyAuthoringSkillsOptions,
} from "../../domain/skills/copyAuthoringSkills.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatSuccess } from "../output.js";

export interface AuthoringSkillCommandOptions extends CopyAuthoringSkillsOptions {
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

function getAuthoringSkillsEnvHint(env: NodeJS.ProcessEnv | undefined): string | undefined {
  const sourceDir = env?.CLAWPERATOR_AUTHORING_SKILLS;
  if (sourceDir === undefined || sourceDir === "") {
    return undefined;
  }
  return `Using CLAWPERATOR_AUTHORING_SKILLS=${sourceDir}`;
}

async function runAuthoringSkillsInstall(
  action: "install" | "update",
  options: AuthoringSkillCommandOptions
): Promise<string> {
  const result = await copyAuthoringSkills(options);
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
    message: `Authoring skills ${action === "install" ? "installed" : "updated"}.`,
    envHint: getAuthoringSkillsEnvHint(options.env),
  }, options);
}

export async function cmdAuthoringSkillsInstall(options: AuthoringSkillCommandOptions): Promise<string> {
  return runAuthoringSkillsInstall("install", options);
}

export async function cmdAuthoringSkillsUpdate(options: AuthoringSkillCommandOptions): Promise<string> {
  return runAuthoringSkillsInstall("update", options);
}

export async function cmdAuthoringSkillsList(
  options: { format: OutputOptions["format"]; installDir?: string }
): Promise<string> {
  const installDir = options.installDir ?? DEFAULT_AUTHORING_SKILLS_DIR;
  try {
    if (await isMissingDir(installDir)) {
      return formatSuccess({
        skills: [],
        count: 0,
        installedDir: installDir,
        message: "No installed authoring skills found. Run clawperator authoring-skills install to get skill-author-by-agent-discovery and skill-author-by-recording.",
      }, options);
    }

    const skills = await listInstalledAuthoringSkills(installDir);
    return formatSuccess({
      skills,
      count: skills.length,
      installedDir: installDir,
    }, options);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return formatError({ code: "AUTHORING_SKILLS_LIST_FAILED", message }, options);
  }
}
