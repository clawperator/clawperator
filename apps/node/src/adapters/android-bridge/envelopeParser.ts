import type { ResultEnvelope, StepResult, StepResultData, TerminalSource } from "../../contracts/result.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";

export interface ParsedTerminal {
  envelope: ResultEnvelope;
  terminalSource: TerminalSource;
}

/**
 * Parse result envelope: [Clawperator-Result] only (canonical envelope).
 * Returns envelope, null if not an envelope, or 'malformed' if prefix exists but JSON is invalid.
 */
export function parseResultEnvelope(line: string, commandId: string): ResultEnvelope | 'malformed' | null {
  const trimmed = line.trim();
  const prefixIndex = trimmed.indexOf(RESULT_ENVELOPE_PREFIX);
  if (prefixIndex === -1) return null;
  const json = trimmed.slice(prefixIndex + RESULT_ENVELOPE_PREFIX.length).trim();
  try {
    const data = normalizeResultEnvelope(JSON.parse(json));
    if (data.commandId === commandId) return data;
    return null; // different commandId
  } catch {
    return 'malformed';
  }
}

/**
 * Parse terminal result: [Clawperator-Result] only (canonical envelope).
 * Returns envelope plus terminalSource for observability.
 */
export function parseTerminalEnvelope(line: string, commandId: string): ParsedTerminal | 'malformed' | null {
  const envelope = parseResultEnvelope(line, commandId);
  if (typeof envelope === 'object' && envelope !== null) {
    return { envelope, terminalSource: "clawperator_result" };
  }
  return envelope;
}

function normalizeResultEnvelope(raw: unknown): ResultEnvelope {
  const envelope = raw as Partial<ResultEnvelope> & { stepResults?: unknown[] };
  if (envelope.status !== "success" && envelope.status !== "failed") {
    throw new Error("Invalid envelope status");
  }

  return {
    commandId: String(envelope.commandId ?? ""),
    taskId: String(envelope.taskId ?? ""),
    status: envelope.status,
    stepResults: Array.isArray(envelope.stepResults) ? envelope.stepResults.map(normalizeStepResult) : [],
    error: typeof envelope.error === "string" || envelope.error === null ? envelope.error : null,
  };
}

function normalizeStepResult(raw: unknown): StepResult {
  const step = raw as Partial<StepResult> & { data?: unknown };

  return {
    id: String(step.id ?? ""),
    actionType: String(step.actionType ?? ""),
    success: step.success === false ? false : true,
    data: normalizeStepResultData(step.data),
  };
}

function normalizeStepResultData(raw: unknown): StepResultData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const normalized: StepResultData = {};
  for (const [key, value] of Object.entries(raw)) {
    normalized[key] = typeof value === "string" ? value : String(value);
  }
  return normalized;
}
