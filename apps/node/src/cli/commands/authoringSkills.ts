import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { DEFAULT_AUTHORING_SKILLS_DIR } from "../../domain/skills/skillsConfig.js";
import {
  copyAuthoringSkills,
  listInstalledAuthoringSkills,
  type CopyAuthoringSkillsOptions,
} from "../../domain/skills/copyAuthoringSkills.js";
import type { OutputOptions } from "../output.js";
import { formatError, formatSuccess } from "../output.js";

export interface AuthoringSkillCommandOptions extends CopyAuthoringSkillsOptions {
  format: OutputOptions["format"];
}

async function installDirExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
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
    agentDirs: result.agentDirs,
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
  if (!(await installDirExists(installDir))) {
    return formatSuccess({
      skills: [],
      count: 0,
      installedDir: installDir,
      message: "No installed authoring skills found. Run clawperator authoring-skills install.",
    }, options);
  }

  try {
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
