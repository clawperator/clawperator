import type { Execution } from "../../../contracts/execution.js";

/**
 * GloBird Energy: Get Usage
 */
export function buildGlobirdGetUsageExecution(): Execution {
  const commandId = `skill-globird-usage-${Date.now()}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-skill",
    expectedFormat: "android-ui-automator",
    timeoutMs: 120_000,
    actions: [
      {
        id: "close",
        type: "close_app",
        params: { applicationId: "com.globird.energy" },
      },
      {
        id: "open",
        type: "open_app",
        params: { applicationId: "com.globird.energy" },
      },
      {
        id: "wait_open",
        type: "sleep",
        params: { durationMs: 8000 },
      },
      {
        id: "open-energy-tab",
        type: "click",
        params: {
          matcher: { textEquals: "Energy" },
        },
      },
      {
        id: "wait-energy",
        type: "sleep",
        params: { durationMs: 4000 },
      },
      {
        id: "snap",
        type: "snapshot_ui",
        params: { format: "ascii" },
      },
    ],
  };
}
