import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { EventEmitter } from "node:events";
import { chmod, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import {
  addSettleWarnings,
  attachSnapshotsToStepResults,
  buildTimeoutError,
  finalizeSuccessfulCloseAppSteps,
  finalizeSuccessfulScreenshotCapture,
  injectServiceUnavailableHint,
  markExtractionFailedSnapshotSteps,
  reconcileEnvelopeStatusAfterPostProcessing,
  runCloseAppPreflight,
  runExecution,
} from "../../domain/executions/runExecution.js";
import { buildResultEnvelopeTimeoutHint } from "../../domain/executions/timeoutGuidance.js";
import type { Execution } from "../../contracts/execution.js";
import type { ResultEnvelope, StepResult } from "../../contracts/result.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { createLogger } from "../../adapters/logger.js";
import { isAbsolute, join } from "node:path";
import { tmpdir } from "node:os";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

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

describe("addSettleWarnings", () => {
  it("warns when snapshot_ui follows click without a sleep step", () => {
    const execution: Execution = {
      commandId: "cmd-settle",
      taskId: "task-settle",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "click-1", type: "click" },
        { id: "snap-1", type: "snapshot_ui" },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "click-1", actionType: "click", success: true, data: {} },
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    addSettleWarnings(stepResults, execution);

    assert.match(stepResults[1].data.warn ?? "", /snapshot captured without a preceding sleep step/);
  });

  it("does not warn when a sleep step appears between click and snapshot_ui", () => {
    const execution: Execution = {
      commandId: "cmd-settle",
      taskId: "task-settle",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "click-1", type: "click" },
        { id: "sleep-1", type: "sleep" },
        { id: "snap-1", type: "snapshot_ui" },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "click-1", actionType: "click", success: true, data: {} },
      { id: "sleep-1", actionType: "sleep", success: true, data: {} },
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    addSettleWarnings(stepResults, execution);

    assert.ok(!("warn" in stepResults[2].data));
  });

  it("does not warn when no preceding click-like action exists", () => {
    const execution: Execution = {
      commandId: "cmd-settle",
      taskId: "task-settle",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "open-1", type: "open_app" },
        { id: "snap-1", type: "snapshot_ui" },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "open-1", actionType: "open_app", success: true, data: {} },
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    addSettleWarnings(stepResults, execution);

    assert.ok(!("warn" in stepResults[1].data));
  });

  it("warns when snapshot_ui follows scroll_and_click without a sleep step", () => {
    const execution: Execution = {
      commandId: "cmd-settle",
      taskId: "task-settle",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "scroll-1", type: "scroll_and_click" },
        { id: "snap-1", type: "snapshot_ui" },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "scroll-1", actionType: "scroll_and_click", success: true, data: {} },
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    addSettleWarnings(stepResults, execution);

    assert.match(stepResults[1].data.warn ?? "", /snapshot captured without a preceding sleep step/);
  });

  it("does not warn when a non-sleep intermediate step separates click from snapshot_ui", () => {
    // read_text, wait_for_node, etc. may themselves introduce settling time —
    // only warn when click is the immediately preceding action.
    const execution: Execution = {
      commandId: "cmd-settle",
      taskId: "task-settle",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "click-1", type: "click" },
        { id: "read-1", type: "read_text" },
        { id: "snap-1", type: "snapshot_ui" },
      ],
    };
    const stepResults: StepResult[] = [
      { id: "click-1", actionType: "click", success: true, data: {} },
      { id: "read-1", actionType: "read_text", success: true, data: {} },
      { id: "snap-1", actionType: "snapshot_ui", success: true, data: {} },
    ];

    addSettleWarnings(stepResults, execution);

    assert.ok(!("warn" in stepResults[2].data));
  });
});

describe("injectServiceUnavailableHint", () => {
  it("adds a recovery hint for SERVICE_UNAVAILABLE envelopes", () => {
    const envelope: ResultEnvelope = {
      commandId: "cmd-1",
      taskId: "task-1",
      status: "failed",
      stepResults: [],
      errorCode: "SERVICE_UNAVAILABLE",
    };

    injectServiceUnavailableHint(envelope, "device-123");

    assert.ok(envelope.hint?.includes("doctor --fix --device device-123"), `hint: ${envelope.hint}`);
    assert.ok(envelope.hint?.includes("operator setup"), `hint should mention operator setup: ${envelope.hint}`);
  });

  it("does not add a hint for other error codes", () => {
    const envelope: ResultEnvelope = {
      commandId: "cmd-1",
      taskId: "task-1",
      status: "failed",
      stepResults: [],
      errorCode: "OTHER_ERROR",
    };

    injectServiceUnavailableHint(envelope, "device-123");

    assert.strictEqual(envelope.hint, undefined);
  });

  it("does not add a hint for successful envelopes", () => {
    const envelope: ResultEnvelope = {
      commandId: "cmd-1",
      taskId: "task-1",
      status: "success",
      stepResults: [],
      errorCode: "SERVICE_UNAVAILABLE",
    };

    injectServiceUnavailableHint(envelope, "device-123");

    assert.strictEqual(envelope.hint, undefined);
  });
});

describe("reconcileEnvelopeStatusAfterPostProcessing", () => {
  it("marks envelope failed from first failed step and sets error", () => {
    const envelope: ResultEnvelope = {
      commandId: "c",
      taskId: "t",
      status: "success",
      stepResults: [
        { id: "a1", actionType: "scroll_until", success: false, data: { error: "TARGET_NOT_FOUND" } },
      ],
      error: null,
    };
    reconcileEnvelopeStatusAfterPostProcessing(envelope);
    assert.strictEqual(envelope.status, "failed");
    assert.strictEqual(envelope.error, "Step a1 (scroll_until) failed: TARGET_NOT_FOUND");
  });

  it("marks envelope success when all steps succeed after normalization", () => {
    const envelope: ResultEnvelope = {
      commandId: "c",
      taskId: "t",
      status: "failed",
      stepResults: [{ id: "close-1", actionType: "close_app", success: true, data: { application_id: "com.example" } }],
      error: "stale",
      errorCode: "X",
      hint: "stale",
    };
    reconcileEnvelopeStatusAfterPostProcessing(envelope);
    assert.strictEqual(envelope.status, "success");
    assert.strictEqual(envelope.error, null);
    assert.strictEqual(envelope.errorCode, undefined);
    assert.strictEqual(envelope.hint, undefined);
  });

  it("no-ops when stepResults is empty", () => {
    const envelope: ResultEnvelope = {
      commandId: "c",
      taskId: "t",
      status: "failed",
      stepResults: [],
      error: "Accessibility service is not available",
      errorCode: "SERVICE_UNAVAILABLE",
    };
    reconcileEnvelopeStatusAfterPostProcessing(envelope);
    assert.strictEqual(envelope.status, "failed");
    assert.strictEqual(envelope.error, "Accessibility service is not available");
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

describe("runExecution", () => {
  it("fails fast when the Operator APK is missing and never broadcasts", async () => {
    const runner = new FakeProcessRunner();
    const warnings: string[] = [];
    const execution: Execution = {
      commandId: "cmd-preflight",
      taskId: "task-preflight",
      source: "test",
      expectedFormat: "android-ui-automator",
      timeoutMs: 5000,
      actions: [
        { id: "sleep-1", type: "sleep", params: { durationMs: 0 } },
      ],
    };

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await runExecution(execution, {
      deviceId: "test-device-1",
      operatorPackage: "com.test.operator.dev",
      runner,
      warn: message => warnings.push(message),
    });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.strictEqual(result.error.code, ERROR_CODES.OPERATOR_NOT_INSTALLED);
      assert.strictEqual(result.deviceId, "test-device-1");
      assert.match(result.error.message, /Operator APK \(com\.test\.operator\.dev\) is not installed on test-device-1/);
      assert.match(result.error.message, /clawperator operator setup --apk/);
      assert.match(result.error.message, /operator-debug\.apk/);
    }
    assert.strictEqual(warnings.length, 0);
    assert.deepStrictEqual(
      runner.calls.map(call => call.args.join(" ")),
      [
        "-s test-device-1 devices",
        "-s test-device-1 shell pm list packages com.test.operator.dev",
        "-s test-device-1 shell pm list packages com.test.operator",
      ]
    );
  });
});

describe("buildTimeoutError", () => {
  it("includes correlation context and elapsed timing", () => {
    const error = buildTimeoutError(
      {
        commandId: "cmd-timeout-1",
        taskId: "task-timeout-1",
        actions: [
          { id: "click-1", type: "click" },
          { id: "snap-1", type: "snapshot_ui" },
        ],
        timeoutMs: 30000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
      },
      321
    );

    assert.strictEqual(error.code, ERROR_CODES.RESULT_ENVELOPE_TIMEOUT);
    assert.strictEqual(error.message, "Timed out waiting for result envelope");
    assert.deepStrictEqual(error.details, {
      commandId: "cmd-timeout-1",
      taskId: "task-timeout-1",
      lastActionId: "snap-1",
      lastActionType: "snapshot_ui",
      lastActionCaveat: "payload-last only; Android execution position is unknown",
      elapsedMs: 321,
      timeoutMs: 30000,
    });
  });

  it("omits commandId and taskId keys when they are absent from the payload", () => {
    const error = buildTimeoutError(
      {
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
        timeoutMs: 1000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
      },
      42
    );

    assert.strictEqual("commandId" in error.details, false);
    assert.strictEqual("taskId" in error.details, false);
    assert.strictEqual(error.details.lastActionId, "snap-1");
  });

  it("preserves timeout diagnostics fields on the returned error", () => {
    const error = buildTimeoutError(
      {
        commandId: "cmd-timeout-2",
        taskId: "task-timeout-2",
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
        timeoutMs: 2000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
        lastCorrelatedEvents: ["TaskScopeDefault: example"],
        broadcastDispatchStatus: "sent",
        deviceId: "emulator-5554",
        operatorPackage: "com.clawperator.operator.dev",
      },
      55
    );

    assert.deepStrictEqual(error.lastCorrelatedEvents, ["TaskScopeDefault: example"]);
    assert.strictEqual(error.broadcastDispatchStatus, "sent");
    assert.strictEqual(error.deviceId, "emulator-5554");
    assert.strictEqual(error.operatorPackage, "com.clawperator.operator.dev");
    assert.strictEqual(error.hint, undefined);
  });

  it("adds a version-compatibility hint when no correlated events were captured", () => {
    const error = buildTimeoutError(
      {
        commandId: "cmd-timeout-3",
        taskId: "task-timeout-3",
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
        timeoutMs: 2000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
        lastCorrelatedEvents: [],
        broadcastDispatchStatus: "sent",
        deviceId: "emulator-5554",
        operatorPackage: "com.clawperator.operator.dev",
      },
      55
    );

    assert.match(error.hint ?? "", /No correlated Android log lines were captured/);
    assert.match(error.hint ?? "", /APK\/CLI version mismatch/);
    assert.match(error.hint ?? "", /clawperator doctor --json --device emulator-5554 --operator-package com\.clawperator\.operator\.dev/);
  });

  it("does not add a version hint when broadcast dispatch failed", () => {
    const error = buildTimeoutError(
      {
        commandId: "cmd-timeout-4",
        taskId: "task-timeout-4",
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
        timeoutMs: 2000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
        lastCorrelatedEvents: [],
        broadcastDispatchStatus: "failed: Target package not found",
        deviceId: "emulator-5554",
        operatorPackage: "com.clawperator.operator.dev",
      },
      55
    );

    assert.strictEqual(error.hint, undefined);
  });

  it("builds a stable timeout hint when context fields are missing", () => {
    const hint = buildResultEnvelopeTimeoutHint(
      {
        broadcastDispatchStatus: "sent: broadcast_sent",
        lastCorrelatedEvents: [],
      },
      {}
    );

    assert.match(hint ?? "", /--device <device_id>/);
    assert.match(hint ?? "", /--operator-package <package>/);
  });
});

describe("runExecution logging", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-run-log-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  async function writeFakeAdbScript(scriptName: string): Promise<string> {
    const scriptPath = join(tempRoot, scriptName);
    await writeFile(
      scriptPath,
      "#!/bin/sh\nexit 0\n",
      "utf8"
    );
    await chmod(scriptPath, 0o755);
    return scriptPath;
  }

  function createLogcatRunner(envelopeLine: string, delayMs = 350): FakeProcessRunner {
    const runner = new FakeProcessRunner();
    runner.spawn = (() => {
      const proc = new EventEmitter() as EventEmitter & {
        stdout?: EventEmitter;
        stderr?: EventEmitter;
        kill: () => void;
      };
      proc.stdout = new EventEmitter();
      proc.stderr = new EventEmitter();
      proc.kill = () => undefined;
      setTimeout(() => {
        proc.stdout?.emit("data", Buffer.from(`${envelopeLine}\n`));
        proc.emit("close", 0, null);
      }, delayMs);
      return proc;
    }) as FakeProcessRunner["spawn"];
    return runner;
  }

  it("writes broadcast and envelope events with the execution commandId", async () => {
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });
    const adbPath = await writeFakeAdbScript("adb");
    const runner = createLogcatRunner(
      `[Clawperator-Result] ${JSON.stringify({
        commandId: "cmd-log-1",
        taskId: "task-log-1",
        status: "success",
        stepResults: [{ id: "a1", actionType: "enter_text", success: true, data: {} }],
        error: null,
      })}`,
      1200
    );

    runner.queueResult({ code: 0, stdout: "List of devices attached\ndevice-123\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.test.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await runExecution(
      {
        commandId: "cmd-log-1",
        taskId: "task-log-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 1000,
        actions: [
          {
            id: "a1",
            type: "enter_text",
            params: {
              matcher: { textEquals: "input" },
              text: "hello",
            },
          },
        ],
      },
      {
        deviceId: "device-123",
        operatorPackage: "com.test.operator.dev",
        adbPath,
        runner,
        logger,
      }
    );

    assert.strictEqual(result.ok, true);
    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string; commandId?: string });
    const broadcastLine = lines.find(line => line.event === "broadcast.dispatched");
    const envelopeLine = lines.find(line => line.event === "envelope.received");
    assert.strictEqual(broadcastLine?.commandId, "cmd-log-1");
    assert.strictEqual(envelopeLine?.commandId, "cmd-log-1");
  });

  it("keeps sentinel payload text out of every log line", async () => {
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "debug" });
    const adbPath = await writeFakeAdbScript("adb");
    const sentinel = "CLAWPERATOR_TEST_SENTINEL_X9Z";
    const runner = createLogcatRunner(
      `[Clawperator-Result] ${JSON.stringify({
        commandId: "cmd-log-2",
        taskId: "task-log-2",
        status: "success",
        stepResults: [{ id: "a1", actionType: "enter_text", success: true, data: {} }],
        error: null,
      })}`,
      1200
    );

    runner.queueResult({ code: 0, stdout: "List of devices attached\ndevice-123\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.test.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await runExecution(
      {
        commandId: "cmd-log-2",
        taskId: "task-log-2",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 1000,
        actions: [
          {
            id: "a1",
            type: "enter_text",
            params: {
              matcher: { textEquals: "input" },
              text: sentinel,
            },
          },
        ],
      },
      {
        deviceId: "device-123",
        operatorPackage: "com.test.operator.dev",
        adbPath,
        runner,
        logger,
      }
    );

    assert.strictEqual(result.ok, true);
    const contents = await readFile(logger.logPath()!, "utf8");
    for (const line of contents.trimEnd().split("\n")) {
      assert.strictEqual(line.includes(sentinel), false, `sentinel leaked into log line: ${line}`);
    }
  });

  it("adds the logger path to timeout errors as an absolute file path", async () => {
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });
    const logPath = logger.logPath();
    assert.ok(logPath);

    logger.log({
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "preflight.apk.pass",
      commandId: "cmd-timeout",
      taskId: "task-timeout",
      deviceId: "device-123",
      message: "Operator APK is installed",
    });

    const error = buildTimeoutError(
      {
        commandId: "cmd-timeout",
        taskId: "task-timeout",
        actions: [{ id: "a1", type: "snapshot_ui" }],
        timeoutMs: 1000,
      },
      {
        code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
        message: "Timed out waiting for result envelope",
      },
      123,
      logPath
    );

    assert.ok(error.details.logPath);
    assert.strictEqual(error.details.logPath, logPath);
    assert.strictEqual(isAbsolute(error.details.logPath), true);
    assert.strictEqual((await stat(error.details.logPath)).isFile(), true);
  });
});
