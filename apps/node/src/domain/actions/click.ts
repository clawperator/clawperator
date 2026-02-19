import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export function buildClickExecution(selector: NodeMatcher): Execution {
  const commandId = `click-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-action",
    timeoutMs: 30_000,
    actions: [
      {
        id: "click",
        type: "click",
        params: { matcher: selector },
      },
    ],
    mode: "direct",
  };
}
