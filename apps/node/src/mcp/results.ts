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

export function extractStepDataValue(
  envelope: ResultEnvelope,
  options: {
    actionType: string;
    dataKey: string;
    errorKey?: string;
  }
): StepDataExtractionResult {
  const step = [...envelope.stepResults].reverse().find(candidate => candidate.actionType === options.actionType);
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
