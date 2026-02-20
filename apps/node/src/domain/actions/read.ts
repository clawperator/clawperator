import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export function buildReadExecution(selector: NodeMatcher): Execution {
  const commandId = `read-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-action",
    expectedFormat: "android-ui-automator",
    timeoutMs: 30_000,
    actions: [
      {
        id: "read",
        type: "read_text",
        params: { matcher: selector },
      },
    ],
    mode: "direct",
  };
}
