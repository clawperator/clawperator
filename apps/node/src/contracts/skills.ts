import { z } from "zod";

/**
 * Skills registry contract (aligns with skills-registry.json schema).
 */
export interface SkillAgentConfig {
  cli: string;
  cliPath?: string | null;
  timeoutMs?: number;
}

export interface SkillContractGoal {
  kind: string;
  [key: string]: unknown;
}

export interface SkillContractNodeTextMatchesVerification {
  kind: "node_text_matches";
  matcher: string;
}

export type SkillContractVerification =
  | SkillContractNodeTextMatchesVerification;

export interface SkillContract {
  inputs: Record<string, string>;
  goal: SkillContractGoal | null;
  verification: SkillContractVerification | null;
}

const reservedSkillContractInputNames = new Set(["__proto__", "constructor", "prototype"]);

const skillContractInputNameSchema = z.string()
  .min(1)
  .regex(/^[A-Za-z0-9_]+$/, "contract input names must contain only letters, numbers, and underscores")
  .refine(
    (name) => !reservedSkillContractInputNames.has(name),
    "contract input names must not use reserved object property names"
  );

export type ParsedSkillContractInputSchema =
  | { kind: "string"; schema: "string" }
  | { kind: "integer"; schema: string; min: number; max: number };

export function parseSkillContractInputSchema(schema: string): ParsedSkillContractInputSchema | null {
  const trimmedSchema = schema.trim();
  if (trimmedSchema === "string") {
    return { kind: "string", schema: "string" };
  }
  const integerRangeMatch = /^integer(?:\[(?<min>-?\d+),(?<max>-?\d+)])?$/.exec(trimmedSchema);
  if (!integerRangeMatch) {
    return null;
  }
  const min = Number.parseInt(integerRangeMatch.groups?.min ?? `${Number.MIN_SAFE_INTEGER}`, 10);
  const max = Number.parseInt(integerRangeMatch.groups?.max ?? `${Number.MAX_SAFE_INTEGER}`, 10);
  if (min > max) {
    return null;
  }
  return {
    kind: "integer",
    schema: trimmedSchema,
    min,
    max,
  };
}

export function isSupportedSkillContractInputSchema(schema: string): boolean {
  return parseSkillContractInputSchema(schema) !== null;
}

function extractMatcherPlaceholders(matcher: string): string[] {
  return Array.from(matcher.matchAll(/\{([A-Za-z0-9_]+)\}/g), (match) => match[1] ?? "");
}

const skillContractInputSchemaStringSchema = z.string()
  .min(1)
  .refine(
    (schema) => isSupportedSkillContractInputSchema(schema),
    (schema) => ({
      message: `unsupported contract input schema '${schema}'`,
    })
  );

export const skillContractVerificationSchema: z.ZodType<SkillContractVerification> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("node_text_matches"),
    matcher: z.string().min(1),
  }),
]);

export const skillContractSchema: z.ZodType<SkillContract> = z.object({
  inputs: z.record(skillContractInputNameSchema, skillContractInputSchemaStringSchema),
  goal: z.object({
    kind: z.string().min(1),
  }).catchall(z.unknown()).nullable(),
  verification: skillContractVerificationSchema.nullable(),
}).superRefine((contract, context) => {
  if (contract.verification?.kind !== "node_text_matches") {
    return;
  }

  const declaredInputs = new Set(Object.keys(contract.inputs));
  const undeclaredPlaceholders = extractMatcherPlaceholders(contract.verification.matcher)
    .filter((placeholder) => !declaredInputs.has(placeholder));
  if (undeclaredPlaceholders.length === 0) {
    return;
  }

  context.addIssue({
    code: z.ZodIssueCode.custom,
    path: ["verification", "matcher"],
    message: `contract matcher references undeclared inputs: ${undeclaredPlaceholders.join(", ")}`,
  });
});

export function hasMeaningfulSkillContract(contract: SkillContract | null | undefined): boolean {
  return contract !== undefined && contract !== null && (
    Object.keys(contract.inputs).length > 0
    || contract.goal !== null
    || contract.verification !== null
  );
}

export interface SkillEntry {
  id: string;
  applicationId: string;
  intent: string;
  summary: string;
  path: string;
  skillFile: string;
  scripts: string[];
  artifacts: string[];
  agent?: SkillAgentConfig;
  contract?: SkillContract;
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
export const SKILL_OUTPUT_ASSERTION_FAILED = "SKILL_OUTPUT_ASSERTION_FAILED";
export const SKILL_RESULT_PARSE_FAILED = "SKILL_RESULT_PARSE_FAILED";
export const SKILL_AGENT_CLI_UNAVAILABLE = "SKILL_AGENT_CLI_UNAVAILABLE";
export const SKILL_ALREADY_EXISTS = "SKILL_ALREADY_EXISTS";
export const SKILL_ID_INVALID = "SKILL_ID_INVALID";
export const SKILLS_SCAFFOLD_FAILED = "SKILLS_SCAFFOLD_FAILED";
export const SKILL_VALIDATION_FAILED = "SKILL_VALIDATION_FAILED";
