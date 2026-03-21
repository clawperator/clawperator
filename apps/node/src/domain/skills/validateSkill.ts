import { access, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
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
import { validateExecution, type ValidationFailure } from "../executions/validateExecution.js";

const SKILL_DRY_RUN_SKIP_REASON =
  "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script";

export interface ValidateSkillDryRunSkipped {
  payloadValidation: "skipped";
  reason: string;
}

export interface ValidateSkillResult {
  ok: true;
  skill: SkillEntry;
  registryPath: string;
  dryRun?: ValidateSkillDryRunSkipped;
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
    missingFields?: string[];
    missingFiles?: string[];
    mismatchFields?: string[];
    artifact?: string;
    actionId?: string;
    actionType?: string;
    invalidKeys?: string[];
    hint?: string;
    path?: string;
    reason?: string;
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
  resolvedRegistryPath: string,
  options?: { dryRun?: boolean }
): Promise<ValidateSkillResult | ValidateSkillError> {
  const repoRoot = getRepoRoot(resolvedRegistryPath);
  const skillJsonPath = join(repoRoot, getSkillJsonRelativePath(skill));
  const skillFilePath = join(repoRoot, skill.skillFile);

  if (!Array.isArray(skill.scripts)) {
    return {
      ok: false,
      code: SKILL_VALIDATION_FAILED,
      message: `Skill ${skill.id} registry entry is missing required scripts`,
      details: {
        skillJsonPath,
        missingFields: ["scripts"],
        reason: "scripts must be an array",
      },
    };
  }

  if (skill.artifacts !== undefined && !Array.isArray(skill.artifacts)) {
    return {
      ok: false,
      code: SKILL_VALIDATION_FAILED,
      message: `Skill ${skill.id} registry entry has an invalid artifacts value`,
      details: {
        skillJsonPath,
        reason: "artifacts must be an array when present",
      },
    };
  }

  const scriptPaths = skill.scripts.map((file) => join(repoRoot, file));
  // Artifacts are optional for script-only skills, but when present they must be explicit arrays.
  const artifactPaths = skill.artifacts === undefined ? [] : skill.artifacts.map((file) => join(repoRoot, file));
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

  if (options?.dryRun) {
    if (artifactPaths.length === 0) {
      return {
        ok: true,
        skill,
        registryPath: resolvedRegistryPath,
        dryRun: {
          payloadValidation: "skipped",
          reason: SKILL_DRY_RUN_SKIP_REASON,
        },
        checks: {
          skillJsonPath,
          skillFilePath,
          scriptPaths,
          artifactPaths,
        },
      };
    }

    for (let index = 0; index < artifactPaths.length; index++) {
      const artifactPath = artifactPaths[index];
      const artifact = basename(skill.artifacts?.[index] ?? artifactPath);
      let rawArtifact: string;
      try {
        rawArtifact = await readFile(artifactPath, "utf8");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          code: SKILL_VALIDATION_FAILED,
          message: `Skill ${skill.id}: artifact payload schema violation`,
          details: {
            artifact,
            reason: `Failed to read artifact: ${message}`,
          },
        };
      }

      let parsedArtifact: unknown;
      try {
        parsedArtifact = JSON.parse(rawArtifact);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return {
          ok: false,
          code: SKILL_VALIDATION_FAILED,
          message: `Skill ${skill.id}: artifact payload schema violation`,
          details: {
            artifact,
            reason: `Failed to parse artifact JSON: ${message}`,
          },
        };
      }

      try {
        validateExecution(parsedArtifact);
      } catch (e) {
        const failure = e as ValidationFailure;
        return {
          ok: false,
          code: SKILL_VALIDATION_FAILED,
          message: `Skill ${skill.id}: artifact payload schema violation`,
          details: {
            artifact,
            path: failure.details?.path,
            reason: failure.details?.reason,
            actionId: failure.details?.actionId,
            actionType: failure.details?.actionType,
            invalidKeys: failure.details?.invalidKeys,
            hint: failure.details?.hint,
          },
        };
      }
    }
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
  registryPath?: string,
  options?: { dryRun?: boolean }
): Promise<ValidateSkillResult | ValidateSkillError> {
  try {
    const loaded = await loadRegistry(registryPath);
    const skill = findSkillById(loaded.registry, skillId);
    if (!skill) {
      return { ok: false, code: SKILL_NOT_FOUND, message: `Skill not found: ${skillId}` };
    }
    return await validateLoadedSkill(skill, loaded.resolvedPath, options);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }
}

export async function validateAllSkills(
  registryPath?: string,
  options?: { dryRun?: boolean }
): Promise<ValidateAllSkillsResult | ValidateAllSkillsError> {
  try {
    const loaded = await loadRegistry(registryPath);
    const validSkills: ValidateAllSkillsResult["validSkills"] = [];
    const failures: NonNullable<ValidateAllSkillsError["details"]>["failures"] = [];

    for (const skill of loaded.registry.skills) {
      const result = await validateLoadedSkill(skill, loaded.resolvedPath, options);
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
