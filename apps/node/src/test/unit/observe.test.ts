import { once } from "node:events";
import { describe, it } from "node:test";
import assert from "node:assert";
import { buildSnapshotExecution } from "../../domain/observe/snapshot.js";
import { buildScreenshotExecution } from "../../domain/observe/screenshot.js";
import { attachSnapshotsToStepResults, runExecution } from "../../domain/executions/runExecution.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { clawperatorEvents, CLAW_EVENT_TYPES } from "../../domain/observe/events.js";

describe("observe executions", () => {
  it("maps snapshots only onto successful snapshot_ui steps", () => {
    const stepResults = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
      { id: "tap-1", actionType: "tap", success: true, data: {} },
      { id: "snap-2", actionType: "snapshot_ui", success: true, data: {} },
      { id: "snap-3", actionType: "snapshot_ui", success: false, data: {} },
    ];

    attachSnapshotsToStepResults(stepResults, ["first snapshot", "second snapshot"]);

    assert.deepStrictEqual(stepResults, [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: { text: "first snapshot" } },
      { id: "tap-1", actionType: "tap", success: true, data: {} },
      { id: "snap-2", actionType: "snapshot_ui", success: true, data: { text: "second snapshot" } },
      { id: "snap-3", actionType: "snapshot_ui", success: false, data: {} },
    ]);
  });

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

  it("emits the resolved execution metadata when timeout overrides are applied", async () => {
    const largeExecution = buildSnapshotExecution();
    largeExecution.actions = Array.from({ length: 50 }, (_, index) => ({
      id: `enter-${index}`,
      type: "enter_text",
      params: {
        matcher: {
          resourceId: "r".repeat(512),
          role: "o".repeat(512),
          textEquals: "e".repeat(512),
          textContains: "x".repeat(512),
          contentDescEquals: "d".repeat(512),
          contentDescContains: "c".repeat(512),
        },
        text: "y".repeat(512),
      },
    }));

    const executionEvent = once(clawperatorEvents, CLAW_EVENT_TYPES.EXECUTION);
    const result = await runExecution(largeExecution, { deviceId: "test-device", timeoutMs: 12_345 });
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, ERROR_CODES.PAYLOAD_TOO_LARGE);

    const [event] = await executionEvent;
    assert.strictEqual(event.deviceId, "test-device");
    assert.strictEqual(event.input.timeoutMs, 12_345);
  });
});
