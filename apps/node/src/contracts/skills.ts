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
