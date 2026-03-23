import type { Execution } from "../../contracts/execution.js";

export function buildCloseAppExecution(applicationId: string, timeoutMs = 30000): Execution {
  return {
    commandId: `close-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    taskId: "cli-action-close",
    source: "clawperator-cli",
    timeoutMs,
    expectedFormat: "android-ui-automator",
    actions: [
      {
        id: "close",
        type: "close_app",
        params: { applicationId },
      },
    ],
  };
}
