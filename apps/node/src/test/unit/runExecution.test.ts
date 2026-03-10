import { describe, it } from "node:test";
import assert from "node:assert";
import { attachSnapshotsToStepResults, finalizeSuccessfulScreenshotCapture } from "../../domain/executions/runExecution.js";
import type { StepResult } from "../../contracts/result.js";

describe("attachSnapshotsToStepResults", () => {
  it("aligns fewer snapshots to the last snapshot_ui steps", () => {
    const stepResults: StepResult[] = [
      { id: "s1", actionType: "snapshot_ui", success: false, data: { error: "FAILED" } },
      { id: "click-1", actionType: "click", success: true, data: {} },
      { id: "s2", actionType: "snapshot_ui", success: true, data: {} },
      { id: "s3", actionType: "snapshot_ui", success: true, data: {} },
    ];

    attachSnapshotsToStepResults(stepResults, ["<tree-two/>", "<tree-three/>"]);

    assert.deepStrictEqual(stepResults[0].data, { error: "FAILED" });
    assert.deepStrictEqual(stepResults[2].data, { text: "<tree-two/>" });
    assert.deepStrictEqual(stepResults[3].data, { text: "<tree-three/>" });
  });

  it("keeps the most recent snapshots when logs contain more dumps than steps", () => {
    const stepResults: StepResult[] = [
      { id: "s1", actionType: "snapshot_ui", success: true, data: {} },
      { id: "s2", actionType: "snapshot_ui", success: true, data: {} },
    ];

    attachSnapshotsToStepResults(stepResults, ["<old/>", "<new-one/>", "<new-two/>"]);

    assert.deepStrictEqual(stepResults[0].data, { text: "<new-one/>" });
    assert.deepStrictEqual(stepResults[1].data, { text: "<new-two/>" });
  });
});

describe("finalizeSuccessfulScreenshotCapture", () => {
  it("only marks unsupported runtime screenshots successful after adb capture succeeds", () => {
    const screenStep: StepResult = {
      id: "shot-1",
      actionType: "take_screenshot",
      success: false,
      data: {
        error: "UNSUPPORTED_RUNTIME_SCREENSHOT",
        message: "Runtime screenshot not supported",
      },
    };

    finalizeSuccessfulScreenshotCapture(screenStep, "/tmp/capture.png");

    assert.strictEqual(screenStep.success, true);
    assert.deepStrictEqual(screenStep.data, { path: "/tmp/capture.png" });
  });

  it("preserves existing success state and metadata for already-supported screenshots", () => {
    const screenStep: StepResult = {
      id: "shot-2",
      actionType: "take_screenshot",
      success: true,
      data: { source: "adb-fallback" },
    };

    finalizeSuccessfulScreenshotCapture(screenStep, "/tmp/capture.png");

    assert.strictEqual(screenStep.success, true);
    assert.deepStrictEqual(screenStep.data, {
      source: "adb-fallback",
      path: "/tmp/capture.png",
    });
  });
});
