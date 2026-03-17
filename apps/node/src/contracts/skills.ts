/**
 * Skills registry contract (aligns with skills-registry.json schema).
 */
export interface SkillEntry {
  id: string;
  applicationId: string;
  intent: string;
  summary: string;
  path: string;
  skillFile: string;
  scripts: string[];
  artifacts: string[];
}

export interface SkillsRegistry {
  schemaVersion?: string;
  generatedAt?: string;
  skills: SkillEntry[];
}

export const SKILL_NOT_FOUND = "SKILL_NOT_FOUND";
export const ARTIFACT_NOT_FOUND = "ARTIFACT_NOT_FOUND";
export const COMPILE_VARS_REQUIRED = "COMPILE_VARS_REQUIRED";
export const COMPILE_VAR_MISSING = "COMPILE_VAR_MISSING";
export const COMPILE_VARS_PARSE_FAILED = "COMPILE_VARS_PARSE_FAILED";
export const COMPILE_VALIDATION_FAILED = "COMPILE_VALIDATION_FAILED";
export const REGISTRY_READ_FAILED = "REGISTRY_READ_FAILED";
export const SKILLS_SYNC_FAILED = "SKILLS_SYNC_FAILED";
export const SKILLS_GIT_NOT_FOUND = "SKILLS_GIT_NOT_FOUND";
export const SKILL_SCRIPT_NOT_FOUND = "SKILL_SCRIPT_NOT_FOUND";
export const SKILL_EXECUTION_FAILED = "SKILL_EXECUTION_FAILED";
export const SKILL_EXECUTION_TIMEOUT = "SKILL_EXECUTION_TIMEOUT";
export const SKILL_ALREADY_EXISTS = "SKILL_ALREADY_EXISTS";
export const SKILL_ID_INVALID = "SKILL_ID_INVALID";
export const SKILLS_SCAFFOLD_FAILED = "SKILLS_SCAFFOLD_FAILED";
export const SKILL_VALIDATION_FAILED = "SKILL_VALIDATION_FAILED";
