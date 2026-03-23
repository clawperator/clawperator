import type { Execution } from "../../contracts/execution.js";

export function buildScrollExecution(direction: string): Execution {
    return {
        commandId: `scroll_${Date.now()}`,
        taskId: "cli-action-scroll",
        source: "clawperator-cli",
        timeoutMs: 15000,
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
