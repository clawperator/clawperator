import type { Execution } from "../../contracts/execution.js";
import { runExecution } from "../executions/runExecution.js";
import type { RunExecutionOptions } from "../executions/runExecution.js";

/**
 * Build execution that runs a single take_screenshot and run it.
 */
export function buildScreenshotExecution(options?: { timeoutMs?: number }): Execution {
  const commandId = `screenshot-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-observe",
    expectedFormat: "android-ui-automator",
    timeoutMs: options?.timeoutMs ?? 30_000,
    actions: [
      {
        id: "snap",
        type: "take_screenshot",
        params: {},
      },
    ],
  };
}

export async function observeScreenshot(runOptions?: RunExecutionOptions) {
  const execution = buildScreenshotExecution();
  return runExecution(execution, runOptions);
}
