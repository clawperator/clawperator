import { z } from "zod";
import type { ResultEnvelope } from "./result.js";

export const SKILL_RESULT_FRAME_PREFIX = "[Clawperator-Skill-Result]";
export const SKILL_RESULT_CONTRACT_VERSION = "1.0.0";
export const SKILL_RESULT_CONTRACT_MAJOR_VERSION = 1;
export const SKILL_RESULT_CONTRACT_MINOR_VERSION = 0;

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
  status: SkillResultStatus;
  checkpoints: SkillCheckpoint[];
  terminalVerification?: SkillTerminalVerification | null;
  execEnvelopes?: ResultEnvelope[];
  diagnostics?: SkillDiagnostics;
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(jsonValueSchema)])
);

const resultEnvelopeSchema: z.ZodType<ResultEnvelope> = z.object({
  commandId: z.string(),
  taskId: z.string(),
  status: z.enum(["success", "failed"]),
  stepResults: z.array(z.object({
    id: z.string(),
    actionType: z.string(),
    success: z.boolean(),
    data: z.record(z.string()),
  })),
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
  status: z.enum(["success", "failed", "indeterminate"]),
  checkpoints: z.array(skillCheckpointSchema),
  terminalVerification: skillTerminalVerificationSchema.nullable().optional(),
  execEnvelopes: z.array(resultEnvelopeSchema).optional(),
  diagnostics: skillDiagnosticsSchema.optional(),
}).passthrough();

export type EmittedSkillResult = z.infer<typeof emittedSkillResultSchema>;
