import type { Execution } from "../../contracts/execution.js";

export function buildOpenAppExecution(applicationId: string): Execution {
    return {
        commandId: `open_app_${Date.now()}`,
        taskId: "cli-action-open-app",
        source: "clawperator-cli",
        timeoutMs: 15000,
        expectedFormat: "android-ui-automator",
        actions: [
            {
                id: "a1",
                type: "open_app",
                params: {
                    applicationId,
                },
            },
        ],
    };
}
