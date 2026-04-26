import { z } from "zod";
import type { ResultEnvelope, StepResult } from "./result.js";

export const SKILL_RESULT_FRAME_PREFIX = "[Clawperator-Skill-Result]";
export const SKILL_RESULT_CONTRACT_VERSION = "1.0.0";
export const SKILL_RESULT_CONTRACT_MAJOR_VERSION = 1;
export const SKILL_RESULT_CONTRACT_MINOR_VERSION = 0;

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): ParsedSemver | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return null;
  }

  return {
    major: Number.parseInt(match[1]!, 10),
    minor: Number.parseInt(match[2]!, 10),
    patch: Number.parseInt(match[3]!, 10),
  };
}

export type SkillResultContractVersionValidation =
  | { ok: true; minorAhead: boolean }
  | { ok: false; message: string };

export function validateSupportedSkillResultContractVersion(
  contractVersion: string
): SkillResultContractVersionValidation {
  const semver = parseSemver(contractVersion);
  if (semver === null) {
    return {
      ok: false,
      message: `SkillResult contractVersion must be semver-shaped, got ${contractVersion}`,
    };
  }

  if (semver.major !== SKILL_RESULT_CONTRACT_MAJOR_VERSION) {
    return {
      ok: false,
      message: `Unsupported SkillResult contract major version ${semver.major}; expected ${SKILL_RESULT_CONTRACT_MAJOR_VERSION}`,
    };
  }

  return {
    ok: true,
    minorAhead: semver.minor > SKILL_RESULT_CONTRACT_MINOR_VERSION,
  };
}

export type SkillResultSource =
  | { kind: "script" }
  | { kind: "agent"; agentCli: string };

export type SkillResultStatus = "success" | "failed" | "indeterminate";
export type SkillCheckpointStatus = "ok" | "failed" | "skipped";
export type SkillRuntimeState = "healthy" | "poisoned" | "unavailable" | "unknown";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type SkillCheckpointEvidence =
  | { kind: "text"; text: string }
  | { kind: "json"; value: JsonValue }
  | { kind: "result_envelope_ref"; execEnvelopeIndex: number; stepResultId?: string };

export interface SkillCheckpoint {
  id: string;
  status: SkillCheckpointStatus;
  observedAt?: string;
  evidence?: SkillCheckpointEvidence;
  note?: string;
}

export interface SkillTerminalVerification {
  status: "verified" | "failed" | "not_run";
  expected?: SkillCheckpointEvidence | null;
  observed?: SkillCheckpointEvidence | null;
  note?: string | null;
}

export interface SkillDiagnostics {
  runtimeState?: SkillRuntimeState;
  warnings?: string[];
  hints?: string[];
  [key: string]: JsonValue | string[] | undefined;
}

export interface SkillResult {
  contractVersion: string;
  skillId: string;
  source: SkillResultSource;
  goal?: JsonObject;
  inputs?: JsonObject;
  /** Domain answer. Optional only during the migration window (PR-C1); PR-C2 will require this field on framed results. */
  result?: SkillCheckpointEvidence | null;
  status: SkillResultStatus;
  checkpoints: SkillCheckpoint[];
  terminalVerification?: SkillTerminalVerification | null;
  execEnvelopes?: ResultEnvelope[];
  diagnostics?: SkillDiagnostics;
}

export const skillResultSourceSchema: z.ZodType<SkillResultSource> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("script"),
  }),
  z.object({
    kind: z.literal("agent"),
    agentCli: z.string().min(1),
  }),
]);

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

function normalizeEnvelopeStepResultData(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = typeof value === "string" ? value : String(value);
  }
  return normalized;
}

const resultEnvelopeStepSchema: z.ZodType<StepResult, z.ZodTypeDef, unknown> = z.object({
  id: z.string(),
  actionType: z.string(),
  success: z.boolean(),
  data: z.unknown().transform((raw) => normalizeEnvelopeStepResultData(raw)),
});

const resultEnvelopeSchema: z.ZodType<ResultEnvelope, z.ZodTypeDef, unknown> = z.object({
  commandId: z.string(),
  taskId: z.string(),
  status: z.enum(["success", "failed"]),
  stepResults: z.array(resultEnvelopeStepSchema),
  error: z.string().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  hint: z.string().optional(),
});

const skillCheckpointEvidenceSchema: z.ZodType<SkillCheckpointEvidence> = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("json"),
    value: jsonValueSchema,
  }),
  z.object({
    kind: z.literal("result_envelope_ref"),
    execEnvelopeIndex: z.number().int().nonnegative(),
    stepResultId: z.string().optional(),
  }),
]);

const skillCheckpointSchema: z.ZodType<SkillCheckpoint> = z.object({
  id: z.string().min(1),
  status: z.enum(["ok", "failed", "skipped"]),
  observedAt: z.string().optional(),
  evidence: skillCheckpointEvidenceSchema.optional(),
  note: z.string().optional(),
});

const skillTerminalVerificationSchema: z.ZodType<SkillTerminalVerification> = z.object({
  status: z.enum(["verified", "failed", "not_run"]),
  expected: skillCheckpointEvidenceSchema.nullable().optional(),
  observed: skillCheckpointEvidenceSchema.nullable().optional(),
  note: z.string().nullable().optional(),
});

export const skillDiagnosticsSchema: z.ZodType<SkillDiagnostics> = z.object({
  runtimeState: z.enum(["healthy", "poisoned", "unavailable", "unknown"]).optional(),
  warnings: z.array(z.string()).optional(),
  hints: z.array(z.string()).optional(),
}).catchall(jsonValueSchema);

export const emittedSkillResultSchema = z.object({
  contractVersion: z.string(),
  skillId: z.string().min(1),
  goal: z.record(jsonValueSchema).optional(),
  inputs: z.record(jsonValueSchema).optional(),
  result: skillCheckpointEvidenceSchema.nullable().optional(),
  status: z.enum(["success", "failed", "indeterminate"]),
  checkpoints: z.array(skillCheckpointSchema),
  terminalVerification: skillTerminalVerificationSchema.nullable().optional(),
  execEnvelopes: z.array(resultEnvelopeSchema).optional(),
  diagnostics: skillDiagnosticsSchema.optional(),
});

export type EmittedSkillResult = z.infer<typeof emittedSkillResultSchema>;

export const skillResultSchema = emittedSkillResultSchema.extend({
  source: skillResultSourceSchema,
});
