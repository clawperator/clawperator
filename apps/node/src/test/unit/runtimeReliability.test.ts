import { cmdSkillsRun } from "../../cli/commands/skills.js";
import { cmdObserveSnapshot } from "../../cli/commands/observe.js";
import { shouldCliStdoutForceExitCode1 } from "../../cli/stdoutExitCode.js";
import { executionRunner } from "./fakes/executionResultRunner.js";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EventEmitter } from "node:events";
import { extractSnapshotRecordsFromLogs, extractSnapshotsForCommand, validateSnapshotXml } from "../../domain/executions/snapshotHelper.js";
import { attachSnapshotsToStepResults, markExtractionFailedSnapshotSteps, reconcileEnvelopeStatusAfterPostProcessing, runExecution } from "../../domain/executions/runExecution.js";
import { probeInteractiveState, ensureInteractiveAutomationReady } from "../../domain/doctor/checks/deviceInteractivity.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import type { ResultEnvelope } from "../../contracts/result.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

const marker = (xml: string, commandId = "requested") => `D/TaskScope: [TaskScope] UI Hierarchy [commandId=${commandId}]: ${xml}`;

describe("snapshot source completeness", () => {
  for (const xml of ["<hierarchy/>", "<?xml version='1.0'?><hierarchy><node text='a &amp; b'/></hierarchy>"]) {
    it(`accepts complete source ${xml}`, () => assert.equal(validateSnapshotXml(xml), undefined));
  }
  for (const xml of ["", "<hierarchy><node>", "<hierarchy><node></hierarchy>", "<hierarchy/><node/>", "<!DOCTYPE hierarchy SYSTEM 'file:///etc/passwd'><hierarchy/>", "<hierarchy>&unknown;</hierarchy>", "<other/>"]) {
    it(`rejects invalid source ${xml}`, () => {
      const records = extractSnapshotRecordsFromLogs([marker(xml)]);
      assert.equal(records.length, 1);
      assert.equal(records[0].commandId, "requested");
      assert.ok(records[0].validationError);
      assert.equal(records[0].snapshot, "");
      assert.ok((records[0].diagnosticPreview?.length ?? 0) <= 1024);
    });
  }
  it("bounds source size and nesting", () => {
    assert.equal(validateSnapshotXml("x".repeat(8 * 1024 * 1024 + 1)), "payload_limit");
    assert.equal(validateSnapshotXml("<hierarchy>" + "<node>".repeat(256)), "depth_limit");
  });
  for (const partialIndex of [0, 1, 2]) {
    it(`retains association with invalid occurrence ${partialIndex}`, () => {
      const logs = [0, 1, 2].map(index => marker(index === partialIndex ? "<hierarchy><node>" : `<hierarchy id='${index}'/>`));
      logs.splice(1, 0, "D/Other: unrelated log", marker("<hierarchy/>", "other-command"));
      const envelope: ResultEnvelope = { commandId: "requested", taskId: "task", status: "success", error: null, stepResults: [0, 1, 2].map(index => ({ id: String(index), actionType: "snapshot", success: true, data: {} })) };
      attachSnapshotsToStepResults(envelope.stepResults, extractSnapshotsForCommand(logs, "requested"));
      markExtractionFailedSnapshotSteps(envelope.stepResults);
      reconcileEnvelopeStatusAfterPostProcessing(envelope);
      assert.equal(envelope.status, "failed");
      for (const [index, step] of envelope.stepResults.entries()) {
        assert.equal(step.success, index !== partialIndex);
        if (index === partialIndex) {
          assert.equal(step.data.error, "SNAPSHOT_EXTRACTION_FAILED");
          assert.equal(step.data.text, undefined);
        } else assert.equal(step.data.text, `<hierarchy id='${index}'/>`);
      }
    });
  }
  it("rejects a fragment terminated by an intervening same-tag event", () => {
    const records = extractSnapshotRecordsFromLogs([marker("<hierarchy>"), "D/TaskScope: [TaskScope] completed", "D/TaskScope: </hierarchy>"]);
    assert.equal(records[0].validationError, "malformed_xml");
  });
});

describe("readiness failure evidence", () => {
  for (const dispatch of [false, true]) {
    it(`preserves probe identity and diagnostics with dispatch=${dispatch}`, async () => {
      const runner = new FakeProcessRunner();
      runner.queueResult({ code: 0, stdout: "Broadcast completed: result=0", stderr: "" });
      const config = getDefaultRuntimeConfig({ runner, deviceId: "test-device" });
      const result = await ensureInteractiveAutomationReady(config, {
        probeInteractiveStateFn: cfg => probeInteractiveState(cfg, async (_config, options, broadcast) => {
          if (dispatch) await broadcast!(() => {});
          return { ok: false, timeout: true, diagnostics: { code: "RESULT_ENVELOPE_TIMEOUT", message: "No result", details: { commandId: options.commandId, reader: { events: ["deadline_reached"] } } } };
        }),
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(String(result.error.details?.probeCommandId), /^doctor-handshake-/);
        assert.equal(result.error.details?.probeTaskId, "doctor-handshake");
        assert.equal(result.error.details?.probeDispatchState, dispatch ? "dispatched" : "not_dispatched");
        assert.ok(result.error.details?.transport);
      }
    });
  }
  it("retains unknown dispatch when the probe broadcast throws", async () => {
    const runner = new FakeProcessRunner();
    runner.run = async () => { throw new Error("transport disconnected"); };
    const result = await probeInteractiveState(getDefaultRuntimeConfig({ runner }), async (_config, _options, broadcast) => {
      await broadcast!(() => {});
      throw new Error("unreachable");
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.details?.probeDispatchState, "unknown");
  });
  it("retains prior force-stop and requested correlation on readiness failure", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.test.operator\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.spawn = (() => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} })) as FakeProcessRunner["spawn"];
    const result = await runExecution({ commandId: "requested", taskId: "requested-task", source: "test", expectedFormat: "android-ui-automator", timeoutMs: 1000, actions: [{ id: "close", type: "close_app", params: { applicationId: "com.example.app" } }, { id: "snap", type: "snapshot" }] }, {
      runner, deviceId: "test-device", operatorPackage: "com.test.operator",
      ensureInteractiveAutomationReadyFn: async () => ({ ok: false, error: { code: "RESULT_ENVELOPE_TIMEOUT", message: "probe failed", details: { probeCommandId: "doctor-handshake-separate" } } }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      const details = result.error.details as Record<string, unknown>;
      assert.equal(details.commandId, "requested");
      assert.equal(details.taskId, "requested-task");
      assert.equal(details.probeCommandId, "doctor-handshake-separate");
      assert.equal(details.phase, "readiness");
      assert.equal(details.dispatchState, "not_dispatched");
      assert.deepEqual(details.earlierEffects, [{ actionId: "close", effect: "force_stop" }]);
    }
  });
});


const ready = async () => ({ ok: true as const, state: { screenOn: true, deviceLocked: false, userUnlocked: true } });

describe("public snapshot source failures", () => {
  for (const compact of [false, true]) {
    it(`fails before presentation with compact=${compact}`, async () => {
      const stdout = await cmdObserveSnapshot({ format: "json", compact, tryDaemonExecutionFn: async () => null,
        runExecutionFn: async input => {
          const execution = input as import("../../contracts/execution.js").Execution;
          const envelope: ResultEnvelope = { commandId: execution.commandId, taskId: execution.taskId, status: "success", error: null, stepResults: [{ id: "snap", actionType: "snapshot_ui", success: true, data: {} }] };
          return runExecution(execution, { deviceId: "test-device", operatorPackage: "com.test.operator", runner: executionRunner(envelope, "<hierarchy><node>"), ensureInteractiveAutomationReadyFn: ready, logcatBroadcastDelayMs: 0 });
        },
      });
      const output = JSON.parse(stdout);
      assert.ok(output.envelope, stdout);
      assert.equal(output.envelope.status, "failed");
      assert.equal(output.envelope.stepResults[0].data.extractionReason, "malformed_xml");
      assert.equal(output.envelope.stepResults[0].data.text, undefined);
      assert.equal(output.envelope.stepResults[0].data.failurePhase, "post_processing");
      assert.equal(shouldCliStdoutForceExitCode1(stdout, false), true);
    });
  }
});

describe("requested dispatch evidence", () => {
  for (const acknowledged of [false, true]) {
    it(`distinguishes acknowledged=${acknowledged} from unknown dispatch`, async () => {
      const runner = new FakeProcessRunner();
      runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device\tdevice\n", stderr: "" });
      runner.queueResult({ code: 0, stdout: "package:com.test.operator\n", stderr: "" });
      runner.queueResult({ code: acknowledged ? 0 : 1, stdout: acknowledged ? "Broadcast completed: result=0" : "", stderr: acknowledged ? "" : "transport lost" });
      runner.spawn = (() => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} })) as FakeProcessRunner["spawn"];
      const result = await runExecution({ commandId: "requested-dispatch", taskId: "requested-task", source: "test", expectedFormat: "android-ui-automator", timeoutMs: 1000, actions: [{ id: "back", type: "press_key", params: { key: "BACK" } }] }, {
        deviceId: "test-device", operatorPackage: "com.test.operator", runner,
        ensureInteractiveAutomationReadyFn: ready, logcatBroadcastDelayMs: 0, resultEnvelopeTimeoutMs: 10,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        const details = result.error.details as Record<string, unknown>;
        assert.equal(details.phase, acknowledged ? "result_wait" : "dispatch");
        assert.equal(details.dispatchState, acknowledged ? "dispatched" : "unknown");
        assert.equal(details.commandId, "requested-dispatch");
        assert.equal("envelope" in result, false);
      }
    });
  }
});


describe("unusable device readiness evidence", () => {
  for (const scenario of ["remains_asleep", "wakes_locked"] as const) {
    it(`preserves successful probe and wake effects through public wrappers: ${scenario}`, async () => {
      const runner = new FakeProcessRunner();
      runner.run = async () => ({ code: 0, stdout: "Broadcast completed: result=0", stderr: "" });
      const config = getDefaultRuntimeConfig({ runner, deviceId: "test-device", operatorPackage: "com.test.operator" });
      const probeIds: string[] = [];
      const readiness = await ensureInteractiveAutomationReady(config, {
        settleDelayMs: 0,
        probeInteractiveStateFn: cfg => probeInteractiveState(cfg, async (_config, options, broadcast) => {
          probeIds.push(options.commandId);
          await broadcast!(() => {});
          const screenOn = scenario === "wakes_locked" && probeIds.length > 1;
          return {
            ok: true, terminalSource: "clawperator_result",
            envelope: {
              commandId: options.commandId, taskId: "doctor-handshake", status: "success", error: null,
              stepResults: [{ id: "h1", actionType: "doctor_ping", success: true,
                data: { screen_on: String(screenOn), device_locked: "true", user_unlocked: "true" } }],
            },
          };
        }),
      });
      assert.equal(readiness.ok, false);
      if (readiness.ok) return;
      const expectedAttempts = scenario === "remains_asleep" ? 3 : 1;
      assert.equal(probeIds.length, expectedAttempts + 1);
      const expectedEvidence = {
        phase: "readiness", dispatchState: "not_dispatched",
        probeCommandId: probeIds.at(-1), probeTaskId: "doctor-handshake", probeDispatchState: "dispatched",
      };
      const assertEvidence = (details: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(expectedEvidence)) assert.equal(details[key], value);
        assert.equal((details.wakeAttempts as unknown[]).length, expectedAttempts);
        assert.equal(details.screenOn, undefined);
        assert.equal(details.deviceLocked, undefined);
        assert.equal(details.userUnlocked, undefined);
      };
      const wrapper = JSON.parse(await cmdSkillsRun("test-skill", [], undefined, undefined, undefined, {
        format: "json", skipValidate: true,
        resolveInteractiveSkillTargetImpl: async () => ({ ok: false, error: readiness.error }),
        runSkillImpl: async () => { throw new Error("Skill must not run"); },
      }));
      assert.equal(wrapper.status, "failed");
      assert.equal(wrapper.code, "DEVICE_NOT_INTERACTIVE");
      assertEvidence(wrapper.details);

      const executionProcess = new FakeProcessRunner();
      executionProcess.queueResult({ code: 0, stdout: "List of devices attached\ntest-device\tdevice\n", stderr: "" });
      executionProcess.queueResult({ code: 0, stdout: "package:com.test.operator\n", stderr: "" });
      executionProcess.spawn = (() => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} })) as FakeProcessRunner["spawn"];
      const result = await runExecution({ commandId: "requested", taskId: "requested-task", source: "test", expectedFormat: "android-ui-automator", timeoutMs: 1000, actions: [{ id: "snap", type: "snapshot" }] }, {
        deviceId: "test-device", operatorPackage: "com.test.operator", runner: executionProcess,
        ensureInteractiveAutomationReadyFn: async () => readiness,
      });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.equal(result.error.code, "DEVICE_NOT_INTERACTIVE");
        assertEvidence(result.error.details as Record<string, unknown>);
        assert.equal((result.error.details as Record<string, unknown>).commandId, "requested");
      }
    });
  }
});
