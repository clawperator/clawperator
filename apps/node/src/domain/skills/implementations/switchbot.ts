import type { Execution } from "../../../contracts/execution.js";

/**
 * SwitchBot: Get Bedroom Temperature
 * Implementation using Node SDK primitives.
 * Refined to match canonical recipe from skills repo.
 */
export function buildGetBedroomTemperatureExecution(): Execution {
  const commandId = `skill-switchbot-temp-${Date.now()}`;
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
        params: { applicationId: "com.theswitchbot.switchbot" },
      },
      {
        id: "open",
        type: "open_app",
        params: { applicationId: "com.theswitchbot.switchbot" },
      },
      {
        id: "wait_open",
        type: "sleep",
        params: { durationMs: 4000 },
      },
      {
        id: "read_temp",
        type: "read_text",
        params: {
          matcher: { resourceId: "com.theswitchbot.switchbot:id/tvTemp" },
        },
      },
    ],
  };
}
