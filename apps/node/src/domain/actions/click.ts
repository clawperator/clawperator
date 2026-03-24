import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export function buildClickExecution(
  selector: NodeMatcher,
  clickType?: "default" | "long_click" | "focus",
): Execution {
  const commandId = `click-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const params: Record<string, unknown> = { matcher: selector };
  if (clickType && clickType !== "default") {
    params.clickType = clickType;
  }
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-action",
    expectedFormat: "android-ui-automator",
    timeoutMs: 30_000,
    actions: [
      {
        id: "click",
        type: "click",
        params,
      },
    ],
    mode: "direct",
  };
}
