import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { compileArtifact } from "../../domain/skills/compileArtifact.js";
import { syncSkills } from "../../domain/skills/syncSkills.js";
import { getRegistryPath } from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";

export async function cmdSkillsList(options: { format: OutputOptions["format"] }): Promise<string> {
  const result = await listSkills(getRegistryPath());
  if (result.ok) {
    return formatSuccess({ skills: result.skills, count: result.skills.length }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsGet(
  skillId: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await getSkill(skillId, getRegistryPath());
  if (result.ok) {
    return formatSuccess({ skill: result.skill }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsCompileArtifact(
  skillId: string,
  artifact: string,
  varsJson: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await compileArtifact(skillId, artifact, varsJson ?? "{}", getRegistryPath());
  if (result.ok) {
    return formatSuccess({ execution: result.execution }, options);
  }
  return formatError(
    { code: result.code, message: result.message, details: result.details },
    options
  );
}

export async function cmdSkillsSync(
  ref: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills(ref);
  if (result.ok) {
    return formatSuccess({ synced: result.synced, message: result.message }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}
