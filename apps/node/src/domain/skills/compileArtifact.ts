import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  loadRegistry,
  findSkillById,
  resolveArtifactPath,
  getArtifactPathFromSkill,
} from "../../adapters/skills-repo/localSkillsRegistry.js";
import { validateExecution } from "../executions/validateExecution.js";
import type { Execution } from "../../contracts/execution.js";
import type { SkillsRegistry } from "../../contracts/skills.js";
import {
  REGISTRY_READ_FAILED,
  SKILL_NOT_FOUND,
  ARTIFACT_NOT_FOUND,
  COMPILE_VAR_MISSING,
  COMPILE_VARS_PARSE_FAILED,
  COMPILE_VALIDATION_FAILED,
} from "../../contracts/skills.js";

export interface CompileArtifactResult {
  ok: true;
  execution: Execution;
}

export interface CompileArtifactError {
  ok: false;
  code: string;
  message: string;
  details?: {
    placeholder?: string;
    artifactName?: string;
    skillId?: string;
    registryPath?: string;
    [key: string]: unknown;
  };
}

/**
 * Substitute {{VAR}} in template string using provided vars.
 * All placeholders must be satisfied by vars; ID generation happens before this.
 */
function substitutePlaceholders(
  template: string,
  vars: Record<string, string>
): { ok: true; result: string } | { ok: false; placeholder: string } {
  const placeholders = template.match(/\{\{([A-Za-z0-9_]+)\}\}/g) ?? [];
  const missing = placeholders.find((p) => {
    const key = p.slice(2, -2);
    return vars[key] === undefined || vars[key] === "";
  });
  if (missing) {
    return { ok: false, placeholder: missing.slice(2, -2) };
  }
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    // Placeholders are string-valued and are expected to be used inside JSON string literals.
    // Escape the value content so user-provided vars cannot break JSON structure.
    const escapedValue = JSON.stringify(value).slice(1, -1);
    result = result.split(`{{${key}}}`).join(escapedValue);
  }
  return { ok: true, result };
}

export async function compileArtifact(
  skillId: string,
  artifactName: string,
  varsJson: string,
  registryPath?: string
): Promise<CompileArtifactResult | CompileArtifactError> {
  let resolvedPath: string;
  let registry: SkillsRegistry;
  try {
    const loaded = await loadRegistry(registryPath);
    registry = loaded.registry;
    resolvedPath = loaded.resolvedPath;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: REGISTRY_READ_FAILED,
      message,
      details: registryPath ? { registryPath } : undefined,
    };
  }

  const skill = findSkillById(registry, skillId);
  if (!skill) {
    return {
      ok: false,
      code: SKILL_NOT_FOUND,
      message: `Skill not found: ${skillId}`,
      details: { skillId },
    };
  }

  const artifactRelative = getArtifactPathFromSkill(skill, artifactName);
  if (!artifactRelative) {
    return {
      ok: false,
      code: ARTIFACT_NOT_FOUND,
      message: `Artifact not found: ${artifactName} (skill: ${skillId})`,
      details: { skillId, artifactName },
    };
  }

  let vars: Record<string, string> = {};
  try {
    const parsed = JSON.parse(varsJson || "{}");
    if (typeof parsed === "object" && parsed !== null) {
      for (const [k, v] of Object.entries(parsed)) {
        vars[k] = String(v);
      }
    }
  } catch {
    return {
      ok: false,
      code: COMPILE_VARS_PARSE_FAILED,
      message: "Invalid --vars JSON",
      details: { varsJson },
    };
  }

  // Ensure deterministic COMMAND_ID/TASK_ID when not provided in vars.
  // Normalize artifact name so "climate-status" and "climate-status.recipe.json" yield the same IDs.
  const normalizedArtifactName = artifactName.replace(/\.recipe\.json$/i, "");
  const sortedVars: Record<string, string> = {};
  for (const key of Object.keys(vars).sort()) {
    sortedVars[key] = vars[key];
  }
  const idSeed = {
    skillId,
    artifactName: normalizedArtifactName,
    vars: sortedVars,
  };
  const hash = createHash("sha256").update(JSON.stringify(idSeed)).digest("hex").slice(0, 12);
  const varsWithIds: Record<string, string> = { ...vars };
  if (!varsWithIds.COMMAND_ID) {
    varsWithIds.COMMAND_ID = `cmd-${hash}`;
  }
  if (!varsWithIds.TASK_ID) {
    varsWithIds.TASK_ID = `task-${hash}`;
  }

  const absolutePath = resolveArtifactPath(resolvedPath, artifactRelative);
  let template: string;
  try {
    template = await readFile(absolutePath, "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: REGISTRY_READ_FAILED,
      message: `Cannot read artifact: ${message}`,
      details: { registryPath: resolvedPath, artifactName },
    };
  }

  const sub = substitutePlaceholders(template, varsWithIds);
  if (!sub.ok) {
    return {
      ok: false,
      code: COMPILE_VAR_MISSING,
      message: `Missing required variable: ${sub.placeholder}`,
      details: { placeholder: sub.placeholder, skillId, artifactName },
    };
  }

  let execution: Execution;
  try {
    execution = validateExecution(JSON.parse(sub.result));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: COMPILE_VALIDATION_FAILED,
      message: msg,
      details: { skillId, artifactName },
    };
  }

  execution.mode = "artifact_compiled";
  return { ok: true, execution };
}
