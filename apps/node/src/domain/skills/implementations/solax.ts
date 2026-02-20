import type { Execution } from "../../../contracts/execution.js";

/**
 * SolaX Cloud: Get Battery Level
 */
export function buildSolaxGetBatteryExecution(): Execution {
  const commandId = `skill-solax-battery-${Date.now()}`;
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
        params: { applicationId: "com.solaxcloud.starter" },
      },
      {
        id: "open",
        type: "open_app",
        params: { applicationId: "com.solaxcloud.starter" },
      },
      {
        id: "wait_load",
        type: "sleep",
        params: { durationMs: 12_000 },
      },
      {
        id: "read-battery-value",
        type: "read_text",
        params: {
          matcher: { resourceId: "com.solaxcloud.starter:id/tv_pb_title" },
        },
      },
      {
        id: "read-battery-unit",
        type: "read_text",
        params: {
          matcher: { resourceId: "com.solaxcloud.starter:id/tv_pb_unit" },
        },
      },
    ],
  };
}
