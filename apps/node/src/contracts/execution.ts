/**
 * Execution unit contract. Aligns with Android AgentCommand / UiAction.
 */
import type { NodeMatcher } from "./selectors.js";

export interface ActionParams {
  applicationId?: string;
  durationMs?: number;
  format?: "ascii" | "json";
  matcher?: NodeMatcher;
  text?: string;
  submit?: boolean;
  clear?: boolean;
  /** clickType: default | long_click | focus */
  clickType?: string;
  /** scroll_and_click */
  target?: NodeMatcher;
  container?: NodeMatcher;
  direction?: string;
  maxSwipes?: number;
  distanceRatio?: number;
  settleDelayMs?: number;
  findFirstScrollableChild?: boolean;
  validator?: string;
  retry?: Record<string, unknown>;
  scrollRetry?: Record<string, unknown>;
  clickRetry?: Record<string, unknown>;
}

export interface ExecutionAction {
  id: string;
  type: string;
  params?: ActionParams;
}

export interface Execution {
  commandId: string;
  taskId: string;
  source: string;
  timeoutMs: number;
  actions: ExecutionAction[];
  /** Set by runtime: artifact_compiled | direct */
  mode?: "artifact_compiled" | "direct";
}

export type ExecutionMode = "artifact_compiled" | "direct";
