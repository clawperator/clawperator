import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export function buildWaitExecution(selector: NodeMatcher): Execution {
  const commandId = `wait-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-action",
    expectedFormat: "android-ui-automator",
    timeoutMs: 30_000,
    actions: [
      {
        id: "wait",
        type: "wait_for_node",
        params: { matcher: selector },
      },
    ],
    mode: "direct",
  };
}
