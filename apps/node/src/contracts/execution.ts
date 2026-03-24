/**
 * Execution unit contract. Aligns with Android AgentCommand / UiAction.
 */
import type { NodeMatcher } from "./selectors.js";

export interface ActionParams {
  applicationId?: string;
  sessionId?: string;
  uri?: string;
  durationMs?: number;
  path?: string;
  matcher?: NodeMatcher;
  text?: string;
  submit?: boolean;
  clear?: boolean;
  /** clickType: default | long_click | focus */
  clickType?: string;
  container?: NodeMatcher;
  direction?: string;
  maxSwipes?: number;
  distanceRatio?: number;
  settleDelayMs?: number;
  /** scroll_until */
  maxScrolls?: number;
  maxDurationMs?: number;
  noPositionChangeThreshold?: number;
  findFirstScrollableChild?: boolean;
  /** scroll_and_click: when false, scroll until visible but do not click */
  clickAfter?: boolean;
  validator?: string;
  /** read_text: when true, return all matches */
  all?: boolean;
  /** press_key: back | home | recents */
  key?: string;
  retry?: Record<string, unknown>;
  scrollRetry?: Record<string, unknown>;
  clickRetry?: Record<string, unknown>;
  // wait_for_navigation params
  expectedPackage?: string;
  expectedNode?: NodeMatcher;
  /** Action-level timeout in milliseconds (distinct from execution-level timeoutMs) */
  timeoutMs?: number;
  // read_key_value_pair params
  labelMatcher?: NodeMatcher;
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
  expectedFormat: "android-ui-automator";
  timeoutMs: number;
  actions: ExecutionAction[];
  /** Set by runtime: artifact_compiled | direct */
  mode?: "artifact_compiled" | "direct";
}

export type ExecutionMode = "artifact_compiled" | "direct";
