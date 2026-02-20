import type { Execution } from "../../contracts/execution.js";
import type { NodeMatcher } from "../../contracts/selectors.js";

export interface TypeTextOptions {
  selector: NodeMatcher;
  text: string;
  submit?: boolean;
  clear?: boolean;
}

export function buildTypeTextExecution(options: TypeTextOptions): Execution {
  const { selector, text, submit = false, clear = false } = options;
  const commandId = `type-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  return {
    commandId,
    taskId: commandId,
    source: "clawperator-action",
    expectedFormat: "android-ui-automator",
    timeoutMs: 30_000,
    actions: [
      {
        id: "type",
        type: "enter_text",
        params: { matcher: selector, text, submit, clear },
      },
    ],
    mode: "direct",
  };
}
