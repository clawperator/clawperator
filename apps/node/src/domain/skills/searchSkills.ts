import { loadRegistry } from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { SkillEntry } from "../../contracts/skills.js";
import { REGISTRY_READ_FAILED } from "../../contracts/skills.js";

export interface SearchSkillsResult {
  ok: true;
  skills: SkillEntry[];
}

export interface SearchSkillsError {
  ok: false;
  code: string;
  message: string;
}

export async function searchSkills(
  query: { app?: string; intent?: string; keyword?: string },
  registryPath?: string
): Promise<SearchSkillsResult | SearchSkillsError> {
  try {
    const { registry } = await loadRegistry(registryPath);
    let skills = registry.skills;

    if (query.app) {
      skills = skills.filter((s) => s.applicationId === query.app);
    }
    if (query.intent) {
      skills = skills.filter((s) => s.intent === query.intent);
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      skills = skills.filter(
        (s) =>
          s.id.toLowerCase().includes(kw) ||
          s.summary.toLowerCase().includes(kw) ||
          s.applicationId.toLowerCase().includes(kw)
      );
    }

    return { ok: true, skills };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
