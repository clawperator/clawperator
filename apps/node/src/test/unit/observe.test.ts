import { describe, it } from "node:test";
import assert from "node:assert";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildScreenshotExecution } from "../../domain/observe/screenshot.js";
import { runExecution } from "../../domain/executions/runExecution.js";
import { ERROR_CODES } from "../../contracts/errors.js";

describe("observe executions", () => {
  it("applies timeout override to snapshot execution", () => {
    const execution = buildSnapshotExecution({ timeoutMs: 5000 });
    assert.strictEqual(execution.timeoutMs, 5000);
  });

  it("applies timeout override to screenshot execution", () => {
    const execution = buildScreenshotExecution({ timeoutMs: 7000 });
    assert.strictEqual(execution.timeoutMs, 7000);
  });

  it("uses the centralized execution validation code for invalid timeout overrides", async () => {
    const result = await runExecution(buildSnapshotExecution(), { timeoutMs: Number.NaN });
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, ERROR_CODES.EXECUTION_VALIDATION_FAILED);
  });
});
