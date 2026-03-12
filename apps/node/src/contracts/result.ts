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
  /**
   * Stable enumerated error code for top-level failures. Present when the Android APK emits
   * a known error code (e.g. "SERVICE_UNAVAILABLE"). May be absent for older APK versions or
   * unclassified failures. Agents should branch on this field rather than string-matching `error`.
   */
  errorCode?: string | null;
}

export const RESULT_ENVELOPE_PREFIX = "[Clawperator-Result]";
export const EVENT_ENVELOPE_PREFIX = "[Clawperator-Event]";
