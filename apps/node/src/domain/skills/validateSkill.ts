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

export interface ValidateAllSkillsResult {
  ok: true;
  registryPath: string;
  totalSkills: number;
  validSkills: Array<{
    skill: SkillEntry;
    checks: ValidateSkillResult["checks"];
  }>;
}

export interface ValidateAllSkillsError {
  ok: false;
  code: string;
  message: string;
  registryPath?: string;
  details?: {
    totalSkills: number;
    validCount: number;
    invalidCount: number;
    failures: Array<{
      skillId: string;
      code: string;
      message: string;
      details?: ValidateSkillError["details"];
    }>;
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

async function validateLoadedSkill(
  skill: SkillEntry,
  resolvedRegistryPath: string
): Promise<ValidateSkillResult | ValidateSkillError> {
  const repoRoot = getRepoRoot(resolvedRegistryPath);
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
      message: `Skill ${skill.id} is missing required files`,
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
      message: `Skill ${skill.id} metadata does not match the registry entry`,
      details: {
        skillJsonPath,
        mismatchFields,
      },
    };
  }

  return {
    ok: true,
    skill,
    registryPath: resolvedRegistryPath,
    checks: {
      skillJsonPath,
      skillFilePath,
      scriptPaths,
      artifactPaths,
    },
  };
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
    return await validateLoadedSkill(skill, loaded.resolvedPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}

export async function validateAllSkills(
  registryPath?: string
): Promise<ValidateAllSkillsResult | ValidateAllSkillsError> {
  try {
    const loaded = await loadRegistry(registryPath);
    const validSkills: ValidateAllSkillsResult["validSkills"] = [];
    const failures: NonNullable<ValidateAllSkillsError["details"]>["failures"] = [];

    for (const skill of loaded.registry.skills) {
      const result = await validateLoadedSkill(skill, loaded.resolvedPath);
      if (result.ok) {
        validSkills.push({
          skill: result.skill,
          checks: result.checks,
        });
      } else {
        failures.push({
          skillId: skill.id,
          code: result.code,
          message: result.message,
          details: result.details,
        });
      }
    }

    if (failures.length > 0) {
      return {
        ok: false,
        code: SKILL_VALIDATION_FAILED,
        message: `${failures.length} of ${loaded.registry.skills.length} registered skills failed validation`,
        registryPath: loaded.resolvedPath,
        details: {
          totalSkills: loaded.registry.skills.length,
          validCount: validSkills.length,
          invalidCount: failures.length,
          failures,
        },
      };
    }

    return {
      ok: true,
      registryPath: loaded.resolvedPath,
      totalSkills: loaded.registry.skills.length,
      validSkills,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}
