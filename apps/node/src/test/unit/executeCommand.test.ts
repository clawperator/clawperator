import { describe, it } from "node:test";
import assert from "node:assert";
import { cmdExecute } from "../../cli/commands/execute.js";

describe("cmdExecute --validate-only", () => {
  it("validates a payload without requiring a device", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      execution: JSON.stringify({
        commandId: "cmd-1",
        taskId: "task-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.validated, true);
    assert.strictEqual(result.execution.commandId, "cmd-1");
    assert.strictEqual(result.execution.timeoutMs, 5000);
  });

  it("applies timeout override during validate-only checks", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      timeoutMs: 12000,
      execution: JSON.stringify({
        commandId: "cmd-1",
        taskId: "task-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.execution.timeoutMs, 12000);
  });

  it("returns validation error for invalid payloads without dispatch", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      execution: JSON.stringify({
        commandId: "cmd-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.code, "EXECUTION_VALIDATION_FAILED");
  });
});
