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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

function computeKeywordMatchRank(skill: SkillEntry, keyword: string): number {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (normalizedKeyword.length === 0) {
    return -1;
  }

  const keywords = (skill.keywords ?? []).map((entry) => entry.toLowerCase());
  const id = skill.id.toLowerCase();
  const applicationId = skill.applicationId.toLowerCase();
  const summary = skill.summary.toLowerCase();

  if (keywords.includes(normalizedKeyword)) {
    return 600;
  }

  if (keywords.some((entry) => tokenize(entry).includes(normalizedKeyword))) {
    return 550;
  }

  if (id === normalizedKeyword || applicationId === normalizedKeyword) {
    return 500;
  }

  if (tokenize(skill.id).includes(normalizedKeyword) || tokenize(skill.applicationId).includes(normalizedKeyword)) {
    return 450;
  }

  if (keywords.some((entry) => entry.includes(normalizedKeyword))) {
    return 400;
  }

  if (id.includes(normalizedKeyword) || applicationId.includes(normalizedKeyword)) {
    return 300;
  }

  if (summary.includes(normalizedKeyword)) {
    return 100;
  }

  return -1;
}

export async function searchSkills(
  query: { app?: string; intent?: string; keyword?: string },
  registryPath?: string
): Promise<SearchSkillsResult | SearchSkillsError> {
  try {
    const { registry } = await loadRegistry(registryPath);
    let skills = registry.skills.map((skill, index) => ({ skill, index, rank: 0 }));

    if (query.app) {
      skills = skills.filter(({ skill }) => skill.applicationId === query.app);
    }
    if (query.intent) {
      skills = skills.filter(({ skill }) => skill.intent === query.intent);
    }
    if (query.keyword) {
      const keywordQuery = query.keyword;
      skills = skills.map(({ skill, index }) => ({
        skill,
        index,
        rank: computeKeywordMatchRank(skill, keywordQuery),
      }));
      skills = skills.filter(
        ({ rank }) => rank >= 0
      );
      skills.sort((left, right) => {
        if (right.rank !== left.rank) {
          return right.rank - left.rank;
        }
        return left.index - right.index;
      });
    }

    return { ok: true, skills: skills.map(({ skill }) => skill) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
