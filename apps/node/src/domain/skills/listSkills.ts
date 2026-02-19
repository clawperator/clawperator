import { loadRegistry } from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { SkillEntry } from "../../contracts/skills.js";
import { REGISTRY_READ_FAILED } from "../../contracts/skills.js";

export interface ListSkillsResult {
  ok: true;
  skills: SkillEntry[];
}

export interface ListSkillsError {
  ok: false;
  code: string;
  message: string;
}

export async function listSkills(registryPath?: string): Promise<ListSkillsResult | ListSkillsError> {
  try {
    const { registry } = await loadRegistry(registryPath);
    return { ok: true, skills: registry.skills };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
