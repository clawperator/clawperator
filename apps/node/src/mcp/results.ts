import type { ResultEnvelope, StepResult } from "../contracts/result.js";

export interface StepDataExtractionSuccess {
  ok: true;
  step: StepResult;
  value: string;
}

export interface StepDataExtractionFailure {
  ok: false;
  error: string;
  message: string;
  step?: StepResult;
}

export type StepDataExtractionResult = StepDataExtractionSuccess | StepDataExtractionFailure;

export interface ReadAllResultSuccess {
  ok: true;
  values: string[];
}

export interface ReadAllResultFailure {
  ok: false;
  code: "MCP_STEP_DATA_INVALID";
  message: string;
}

export type ReadAllResult = ReadAllResultSuccess | ReadAllResultFailure;

export function parseReadAllResult(value: string): ReadAllResult {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        code: "MCP_STEP_DATA_INVALID",
        message: "read returned non-array data for all=true",
      };
    }
    if (!parsed.every((entry) => typeof entry === "string")) {
      return {
        ok: false,
        code: "MCP_STEP_DATA_INVALID",
        message: "read returned non-string items in array for all=true",
      };
    }
    return {
      ok: true,
      values: parsed,
    };
  } catch {
    return {
      ok: false,
      code: "MCP_STEP_DATA_INVALID",
      message: "read returned invalid JSON array data",
    };
  }
}

export function extractStepDataValue(
  envelope: ResultEnvelope,
  options: {
    actionType: string;
    dataKey: string;
    errorKey?: string;
  }
): StepDataExtractionResult {
  let step: StepResult | undefined;
  for (let index = envelope.stepResults.length - 1; index >= 0; index -= 1) {
    const candidate = envelope.stepResults[index];
    if (candidate.actionType === options.actionType) {
      step = candidate;
      break;
    }
  }
  if (!step) {
    return {
      ok: false,
      error: "MCP_STEP_NOT_FOUND",
      message: `No ${options.actionType} step result was present in the envelope.`,
    };
  }

  const value = step.data[options.dataKey];
  if (typeof value === "string") {
    return { ok: true, step, value };
  }

  if (options.errorKey !== undefined) {
    const errorValue = step.data[options.errorKey];
    if (typeof errorValue === "string" && errorValue.length > 0) {
      return {
        ok: false,
        error: errorValue,
        message: `${options.actionType} step result did not include ${options.dataKey}.`,
        step,
      };
    }
  }

  return {
    ok: false,
    error: "MCP_STEP_DATA_MISSING",
    message: `${options.actionType} step result did not include ${options.dataKey}.`,
    step,
  };
}
