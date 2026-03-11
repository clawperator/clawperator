import { describe, it } from "node:test";
import assert from "node:assert";
import { attachSnapshotsToStepResults, finalizeSuccessfulScreenshotCapture, markExtractionFailedSnapshotSteps } from "../../domain/executions/runExecution.js";
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

  it("does not set data.text when snapshot extraction returned no snapshots", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    attachSnapshotsToStepResults(stepResults, []);

    // data.text must remain absent - not set to undefined or empty string
    assert.ok(!("text" in stepResults[0].data), "data.text must not be set when no snapshots extracted");
    assert.deepStrictEqual(stepResults[0].data, {});
  });
});

describe("markExtractionFailedSnapshotSteps", () => {
  it("marks success:true snapshot steps with no data.text as SNAPSHOT_EXTRACTION_FAILED", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, false);
    assert.strictEqual(stepResults[0].data.error, "SNAPSHOT_EXTRACTION_FAILED");
    assert.ok(typeof stepResults[0].data.message === "string", "must include message");
    assert.ok(!("text" in stepResults[0].data), "data.text must not be set");
  });

  it("only emits the warning when stderr is attached to an interactive TTY", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    const originalIsTTY = process.stderr.isTTY;
    const originalWrite = process.stderr.write.bind(process.stderr);
    const warnings: string[] = [];

    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: true,
    });
    process.stderr.write = ((chunk: string | Uint8Array) => {
      warnings.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stderr.write;

    try {
      markExtractionFailedSnapshotSteps(stepResults);
    } finally {
      Object.defineProperty(process.stderr, "isTTY", {
        configurable: true,
        value: originalIsTTY,
      });
      process.stderr.write = originalWrite;
    }

    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /snapshot_ui step "snap-1"/);
  });

  it("does not emit the warning when stderr is not a TTY", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    const originalIsTTY = process.stderr.isTTY;
    const originalWrite = process.stderr.write.bind(process.stderr);
    let warningCount = 0;

    Object.defineProperty(process.stderr, "isTTY", {
      configurable: true,
      value: false,
    });
    process.stderr.write = (() => {
      warningCount += 1;
      return true;
    }) as typeof process.stderr.write;

    try {
      markExtractionFailedSnapshotSteps(stepResults);
    } finally {
      Object.defineProperty(process.stderr, "isTTY", {
        configurable: true,
        value: originalIsTTY,
      });
      process.stderr.write = originalWrite;
    }

    assert.strictEqual(warningCount, 0);
  });

  it("does not modify snapshot steps that already have data.text", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: { text: "<hierarchy/>" } },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, { text: "<hierarchy/>" });
  });

  it("does not modify snapshot steps that are already failed", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: false, data: { error: "NODE_NOT_FOUND" } },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, false);
    assert.strictEqual(stepResults[0].data.error, "NODE_NOT_FOUND");
  });

  it("does not modify non-snapshot steps", () => {
    const stepResults: StepResult[] = [
      { id: "click-1", actionType: "click", success: true, data: {} },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, {});
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
