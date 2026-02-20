import type { Execution } from "../../../contracts/execution.js";

/**
 * Android Settings: Capture Overview
 */
export function buildSettingsCaptureOverviewExecution(): Execution {
  const commandId = `skill-settings-overview-${Date.now()}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-skill",
    expectedFormat: "android-ui-automator",
    timeoutMs: 60_000,
    actions: [
      {
        id: "close",
        type: "close_app",
        params: { applicationId: "com.android.settings" },
      },
      {
        id: "open",
        type: "open_app",
        params: { applicationId: "com.android.settings" },
      },
      {
        id: "settle",
        type: "sleep",
        params: { durationMs: 2000 },
      },
      {
        id: "snap",
        type: "snapshot_ui",
        params: { format: "ascii" },
      },
    ],
  };
}
