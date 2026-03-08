import { describe, it } from "node:test";
import assert from "node:assert";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildScreenshotExecution } from "../../domain/observe/screenshot.js";

describe("observe executions", () => {
  it("applies timeout override to snapshot execution", () => {
    const execution = buildSnapshotExecution({ timeoutMs: 5000 });
    assert.strictEqual(execution.timeoutMs, 5000);
  });

  it("applies timeout override to screenshot execution", () => {
    const execution = buildScreenshotExecution({ timeoutMs: 7000 });
    assert.strictEqual(execution.timeoutMs, 7000);
  });
});
