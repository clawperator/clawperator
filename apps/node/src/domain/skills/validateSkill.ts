import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  loadRegistry,
  findSkillById,
  getRepoRoot,
} from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { SkillEntry } from "../../contracts/skills.js";
import {
  REGISTRY_READ_FAILED,
  SKILL_NOT_FOUND,
  SKILL_VALIDATION_FAILED,
} from "../../contracts/skills.js";

export interface ValidateSkillResult {
  ok: true;
  skill: SkillEntry;
  registryPath: string;
  checks: {
    skillJsonPath: string;
    skillFilePath: string;
    scriptPaths: string[];
    artifactPaths: string[];
  };
}

export interface ValidateSkillError {
  ok: false;
  code: string;
  message: string;
  details?: {
    skillJsonPath?: string;
    missingFiles?: string[];
    mismatchFields?: string[];
  };
}

function getSkillJsonRelativePath(skill: SkillEntry): string {
  return join(skill.path, "skill.json");
}

function findMismatchFields(skill: SkillEntry, parsed: Partial<SkillEntry>): string[] {
  const mismatches: string[] = [];
  if (parsed.id !== skill.id) mismatches.push("id");
  if (parsed.applicationId !== skill.applicationId) mismatches.push("applicationId");
  if (parsed.intent !== skill.intent) mismatches.push("intent");
  if (parsed.summary !== skill.summary) mismatches.push("summary");
  if (parsed.path !== skill.path) mismatches.push("path");
  if (parsed.skillFile !== skill.skillFile) mismatches.push("skillFile");
  if (JSON.stringify(parsed.scripts ?? []) !== JSON.stringify(skill.scripts)) mismatches.push("scripts");
  if (JSON.stringify(parsed.artifacts ?? []) !== JSON.stringify(skill.artifacts)) mismatches.push("artifacts");
  return mismatches;
}

export async function validateSkill(
  skillId: string,
  registryPath?: string
): Promise<ValidateSkillResult | ValidateSkillError> {
  try {
    const loaded = await loadRegistry(registryPath);
    const skill = findSkillById(loaded.registry, skillId);
    if (!skill) {
      return { ok: false, code: SKILL_NOT_FOUND, message: `Skill not found: ${skillId}` };
    }

    const repoRoot = getRepoRoot(loaded.resolvedPath);
    const skillJsonPath = join(repoRoot, getSkillJsonRelativePath(skill));
    const skillFilePath = join(repoRoot, skill.skillFile);
    const scriptPaths = skill.scripts.map((file) => join(repoRoot, file));
    const artifactPaths = skill.artifacts.map((file) => join(repoRoot, file));
    const missingFiles: string[] = [];

    for (const file of [skillJsonPath, skillFilePath, ...scriptPaths, ...artifactPaths]) {
      try {
        await access(file);
      } catch {
        missingFiles.push(file);
      }
    }

    if (missingFiles.length > 0) {
      return {
        ok: false,
        code: SKILL_VALIDATION_FAILED,
        message: `Skill ${skillId} is missing required files`,
        details: {
          skillJsonPath,
          missingFiles,
        },
      };
    }

    const raw = await readFile(skillJsonPath, "utf8");
    const parsed = JSON.parse(raw) as Partial<SkillEntry>;
    const mismatchFields = findMismatchFields(skill, parsed);
    if (mismatchFields.length > 0) {
      return {
        ok: false,
        code: SKILL_VALIDATION_FAILED,
        message: `Skill ${skillId} metadata does not match the registry entry`,
        details: {
          skillJsonPath,
          mismatchFields,
        },
      };
    }

    return {
      ok: true,
      skill,
      registryPath: loaded.resolvedPath,
      checks: {
        skillJsonPath,
        skillFilePath,
        scriptPaths,
        artifactPaths,
      },
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
