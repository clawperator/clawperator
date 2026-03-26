import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export function buildClickExecution(
  selector?: NodeMatcher,
  clickType?: "default" | "long_click" | "focus",
  coordinate?: { x: number; y: number }
): Execution {
  const commandId = `click-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const params: Record<string, unknown> = {};
  if (selector && Object.keys(selector).length > 0) params.matcher = selector;
  if (coordinate) params.coordinate = coordinate;
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
