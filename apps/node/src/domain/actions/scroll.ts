import type { Execution } from "../../contracts/execution.js";

export function buildScrollExecution(direction: string, timeoutMs = 30000): Execution {
    return {
        commandId: `scroll-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        taskId: "cli-action-scroll",
        source: "clawperator-cli",
        timeoutMs,
        expectedFormat: "android-ui-automator",
        actions: [
            {
                id: "a1",
                type: "scroll",
                params: { direction },
            },
        ],
    };
}
