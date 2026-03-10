/**
 * How the terminal result was obtained. Canonical-only: Node accepts only [Clawperator-Result].
 */
export type TerminalSource = "clawperator_result";

/**
 * Result envelope contract: [Clawperator-Result] terminal envelope.
 */
export type StepResultData = Record<string, string>;

export interface StepResult {
  id: string;
  actionType: string;
  success: boolean;
  data: StepResultData;
}

export interface ResultEnvelope {
  commandId: string;
  taskId: string;
  status: "success" | "failed";
  stepResults: StepResult[];
  error?: string | null;
}

export const RESULT_ENVELOPE_PREFIX = "[Clawperator-Result]";
export const EVENT_ENVELOPE_PREFIX = "[Clawperator-Event]";
