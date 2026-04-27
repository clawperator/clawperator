import { describe, it } from "node:test";
import assert from "node:assert";
import type { Execution } from "../../contracts/execution.js";
import { buildOpenAppExecution } from "../../domain/actions/openApp.js";
import { cmdActionOpenApp } from "../../cli/commands/action.js";

describe("open app execution builder", () => {
  it("defaults skipNavigationWait to false and navigationTimeoutMs to 15000", () => {
    const execution = buildOpenAppExecution("com.example.app");

    const openApp = execution.actions[0]?.params;
    assert.strictEqual(openApp?.applicationId, "com.example.app");
    assert.strictEqual(openApp?.skipNavigationWait, false);
    assert.strictEqual(openApp?.navigationTimeoutMs, 15_000);
  });

  it("threads explicit skipNavigationWait and navigationTimeoutMs values", () => {
    const execution = buildOpenAppExecution("com.example.app", {
      skipNavigationWait: true,
      navigationTimeoutMs: 22_000,
    });

    const openApp = execution.actions[0]?.params;
    assert.strictEqual(openApp?.skipNavigationWait, true);
    assert.strictEqual(openApp?.navigationTimeoutMs, 22_000);
  });
});

describe("open app CLI command", () => {
  it("passes skipNavigationWait through to the execution builder", async () => {
    let capturedExecution: Execution | undefined;
    let capturedApplicationId: string | undefined;
    let capturedSkipNavigationWait: boolean | undefined;
    let capturedNavigationTimeoutMs: number | undefined;

    const output = await cmdActionOpenApp({
      format: "json",
      applicationId: "com.example.app",
      skipNavigationWait: true,
      navigationTimeoutMs: 20_000,
      noDaemon: true,
      runExecutionFn: async (executionInput: unknown) => {
        const execution = executionInput as Execution;
        capturedExecution = execution;
        capturedApplicationId = execution.actions[0]?.params?.applicationId;
        capturedSkipNavigationWait = execution.actions[0]?.params?.skipNavigationWait;
        capturedNavigationTimeoutMs = execution.actions[0]?.params?.navigationTimeoutMs;
        return {
          ok: false,
          deviceId: "test-device",
          error: {
            code: "EXECUTION_VALIDATION_FAILED",
            message: "stubbed",
          },
        };
      },
    });

    assert.match(output, /EXECUTION_VALIDATION_FAILED/);
    assert.strictEqual(capturedExecution?.actions[0]?.type, "open_app");
    assert.strictEqual(capturedApplicationId, "com.example.app");
    assert.strictEqual(capturedSkipNavigationWait, true);
    assert.strictEqual(capturedNavigationTimeoutMs, 20_000);
  });
});
