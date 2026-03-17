import { describe, it } from "node:test";
import assert from "node:assert";
import {
  attachSnapshotsToStepResults,
  finalizeSuccessfulCloseAppSteps,
  finalizeSuccessfulScreenshotCapture,
  markExtractionFailedSnapshotSteps,
  runCloseAppPreflight,
} from "../../domain/executions/runExecution.js";
import type { Execution } from "../../contracts/execution.js";
import type { StepResult } from "../../contracts/result.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

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

  it("emits the warning through the provided callback", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    const warnings: string[] = [];

    markExtractionFailedSnapshotSteps(stepResults, message => {
      warnings.push(message);
    });

    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /snapshot_ui step "snap-1"/);
  });

  it("does not emit the warning when no callback is provided", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];
    markExtractionFailedSnapshotSteps(stepResults);
    assert.strictEqual(stepResults[0].success, false);
  });

  it("does not modify snapshot steps that already have data.text", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: { text: "<hierarchy/>" } },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, { text: "<hierarchy/>" });
  });

  it("does not treat an existing empty-string text field as missing", () => {
    const stepResults: StepResult[] = [
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: { text: "" } },
    ];

    markExtractionFailedSnapshotSteps(stepResults);

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, { text: "" });
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

describe("finalizeSuccessfulCloseAppSteps", () => {
  it("normalizes unsupported runtime close steps into success when the Node pre-flight close ran", () => {
    const execution: Execution = {
      commandId: "cmd-close",
      taskId: "task-close",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "close-1", type: "close_app", params: { applicationId: "com.example.app" } },
      ],
    };
    const stepResults: StepResult[] = [
      {
        id: "close-1",
        actionType: "close_app",
        success: false,
        data: {
          error: "UNSUPPORTED_RUNTIME_CLOSE",
          message: "Android runtime cannot reliably close apps.",
        },
      },
    ];

    finalizeSuccessfulCloseAppSteps(stepResults, execution, new Set(["close-1"]));

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, { application_id: "com.example.app" });
  });

  it("does not modify unrelated or already-successful close_app steps", () => {
    const execution: Execution = {
      commandId: "cmd-close",
      taskId: "task-close",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "close-1", type: "close_app", params: { applicationId: "com.example.app" } },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "close-1", actionType: "close_app", success: true, data: { application_id: "com.example.app" } },
      { id: "click-1", actionType: "click", success: true, data: {} },
    ];

    finalizeSuccessfulCloseAppSteps(stepResults, execution, new Set(["close-1"]));

    assert.strictEqual(stepResults[0].success, true);
    assert.deepStrictEqual(stepResults[0].data, { application_id: "com.example.app" });
    assert.deepStrictEqual(stepResults[1].data, {});
  });

  it("does not normalize unsupported runtime close when the pre-flight close did not succeed", () => {
    const execution: Execution = {
      commandId: "cmd-close",
      taskId: "task-close",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "close-1", type: "close_app", params: { applicationId: "com.example.app" } },
      ],
    };
    const stepResults: StepResult[] = [
      {
        id: "close-1",
        actionType: "close_app",
        success: false,
        data: {
          error: "UNSUPPORTED_RUNTIME_CLOSE",
          message: "Android runtime cannot reliably close apps.",
        },
      },
    ];

    finalizeSuccessfulCloseAppSteps(stepResults, execution, new Set());

    assert.strictEqual(stepResults[0].success, false);
    assert.deepStrictEqual(stepResults[0].data, {
      error: "UNSUPPORTED_RUNTIME_CLOSE",
      message: "Android runtime cannot reliably close apps.",
    });
  });
});

describe("runCloseAppPreflight", () => {
  it("tracks successful close_app pre-flight steps", async () => {
    const execution: Execution = {
      commandId: "cmd-close",
      taskId: "task-close",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "close-1", type: "close_app", params: { applicationId: "com.example.app" } },
      ],
    };
    const config = getDefaultRuntimeConfig({
      runner: {
        run: async () => ({ stdout: "", stderr: "", code: 0 }),
        runShell: async () => ({ stdout: "", stderr: "", code: 0 }),
        spawn: () => { throw new Error("not used"); },
      },
    });

    const result = await runCloseAppPreflight(execution, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.deepStrictEqual([...result.successfulCloseActionIds], ["close-1"]);
    }
  });

  it("returns a structured failure when adb force-stop exits non-zero", async () => {
    const execution: Execution = {
      commandId: "cmd-close",
      taskId: "task-close",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "close-1", type: "close_app", params: { applicationId: "com.example.app" } },
      ],
    };
    const config = getDefaultRuntimeConfig({
      runner: {
        run: async () => ({ stdout: "", stderr: "shell failed", code: 1 }),
        runShell: async () => ({ stdout: "", stderr: "", code: 0 }),
        spawn: () => { throw new Error("not used"); },
      },
    });

    const result = await runCloseAppPreflight(execution, config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, ERROR_CODES.DEVICE_SHELL_UNAVAILABLE);
      assert.match(result.error.message, /close_app pre-flight force-stop failed/);
      assert.deepStrictEqual(result.error.details, {
        applicationId: "com.example.app",
        adbExitCode: 1,
        stdout: "",
        stderr: "shell failed",
      });
    }
  });
});
