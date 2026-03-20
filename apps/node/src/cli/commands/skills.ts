import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { compileArtifact } from "../../domain/skills/compileArtifact.js";
import { syncSkills } from "../../domain/skills/syncSkills.js";
import { searchSkills } from "../../domain/skills/searchSkills.js";
import { runSkill, type SkillRunEnv } from "../../domain/skills/runSkill.js";
import { scaffoldSkill } from "../../domain/skills/scaffoldSkill.js";
import { validateAllSkills, validateSkill } from "../../domain/skills/validateSkill.js";
import { SKILL_OUTPUT_ASSERTION_FAILED } from "../../contracts/skills.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import {
  CLAWPERATOR_BIN_ENV_VAR,
  CLAWPERATOR_RECEIVER_PACKAGE_ENV_VAR,
  resolveSkillBinCommand,
  resolveReceiverPackage,
} from "../../domain/skills/skillsConfig.js";

export async function cmdSkillsList(options: { format: OutputOptions["format"] }): Promise<string> {
  const result = await listSkills();
  if (result.ok) {
    return formatSuccess({ skills: result.skills, count: result.skills.length }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsGet(
  skillId: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await getSkill(skillId);
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
  const result = await compileArtifact(skillId, artifact, varsJson ?? "{}");
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

export async function cmdSkillsInstall(
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills("main");
  if (result.ok) {
    return formatSuccess({
      synced: result.synced,
      message: result.message,
      registryPath: result.registryPath,
      envInstruction: `export CLAWPERATOR_SKILLS_REGISTRY="${result.registryPath}"`,
    }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsUpdate(
  ref: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills(ref || "main");
  if (result.ok) {
    return formatSuccess({ synced: result.synced, message: result.message }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsSearch(
  query: { app?: string; intent?: string; keyword?: string },
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await searchSkills(query);
  if (result.ok) {
    return formatSuccess({ skills: result.skills, count: result.skills.length }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsRun(
  skillId: string,
  args: string[],
  timeoutMs: number | undefined,
  expectContains: string | undefined,
  receiverPackage: string | undefined,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  // Resolve the env vars for the skill script
  // Priority: explicit flag > env var > default
  const resolvedBin = resolveSkillBinCommand();
  const resolvedReceiverPackage = receiverPackage ?? resolveReceiverPackage();

  const env: SkillRunEnv = {
    [CLAWPERATOR_BIN_ENV_VAR]: resolvedBin,
    [CLAWPERATOR_RECEIVER_PACKAGE_ENV_VAR]: resolvedReceiverPackage,
  };

  const result = await runSkill(skillId, args, undefined, timeoutMs, env);
  if (result.ok) {
    if (expectContains && !result.output.includes(expectContains)) {
      return formatError({
        code: SKILL_OUTPUT_ASSERTION_FAILED,
        message: `Skill ${skillId} output did not include expected text`,
        skillId,
        output: result.output,
        expectedSubstring: expectContains,
        timeoutMs: timeoutMs ?? undefined,
      }, options);
    }
    return formatSuccess({
      skillId: result.skillId,
      output: result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      timeoutMs: timeoutMs ?? undefined,
      expectedSubstring: expectContains ?? undefined,
    }, options);
  }
  return formatError({
    code: result.code,
    message: result.message,
    skillId: result.skillId,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    timeoutMs: timeoutMs ?? undefined,
    expectedSubstring: expectContains ?? undefined,
  }, options);
}

export async function cmdSkillsNew(
  skillId: string,
  options: { format: OutputOptions["format"]; summary?: string }
): Promise<string> {
  const result = await scaffoldSkill(skillId, { summary: options.summary });
  if (result.ok) {
    return formatSuccess({
      created: true,
      skillId: result.skillId,
      registryPath: result.registryPath,
      skillPath: result.skillPath,
      files: result.files,
      next: "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>",
    }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsValidate(
  skillId: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await validateSkill(skillId);
  if (result.ok) {
    return formatSuccess({
      valid: true,
      skill: result.skill,
      registryPath: result.registryPath,
      checks: result.checks,
    }, options);
  }
  return formatError({
    code: result.code,
    message: result.message,
    details: result.details,
  }, options);
}

export async function cmdSkillsValidateAll(
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await validateAllSkills();
  if (result.ok) {
    return formatSuccess({
      valid: true,
      totalSkills: result.totalSkills,
      registryPath: result.registryPath,
      validSkills: result.validSkills,
    }, options);
  }
  return formatError({
    code: result.code,
    message: result.message,
    registryPath: result.registryPath,
    details: result.details,
  }, options);
}
