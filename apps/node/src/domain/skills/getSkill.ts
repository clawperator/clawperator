import { loadRegistry, findSkillById } from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { SkillEntry } from "../../contracts/skills.js";
import { REGISTRY_READ_FAILED, SKILL_NOT_FOUND } from "../../contracts/skills.js";

export interface GetSkillResult {
  ok: true;
  skill: SkillEntry;
}

export interface GetSkillError {
  ok: false;
  code: string;
  message: string;
}

export async function getSkill(
  skillId: string,
  registryPath?: string
): Promise<GetSkillResult | GetSkillError> {
  try {
    const { registry } = await loadRegistry(registryPath);
    const skill = findSkillById(registry, skillId);
    if (!skill) {
      return { ok: false, code: SKILL_NOT_FOUND, message: `Skill not found: ${skillId}` };
    }
    return { ok: true, skill };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
