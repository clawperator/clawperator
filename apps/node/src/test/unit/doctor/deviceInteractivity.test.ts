import assert from "node:assert";
import { describe, it } from "node:test";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import {
  ensureDeviceAwake,
  parseDoctorPingInteractiveState,
  probeInteractiveState,
  type InternalInteractiveState,
  type InteractiveStateProbeResult,
} from "../../../domain/doctor/checks/deviceInteractivity.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";

describe("parseDoctorPingInteractiveState", () => {
  it("parses strict booleans from the doctor ping step payload", () => {
    const state = parseDoctorPingInteractiveState({
      id: "h1",
      actionType: "doctor_ping",
      success: true,
      data: {
        screen_on: "false",
        device_locked: "true",
        user_unlocked: "false",
      },
    });

    assert.deepStrictEqual(state, {
      screenOn: false,
      interactive: false,
      deviceLocked: true,
      userUnlocked: false,
    });
  });

  it("throws when a required boolean is missing or malformed", () => {
    assert.throws(
      () =>
        parseDoctorPingInteractiveState({
          id: "h1",
          actionType: "doctor_ping",
          success: true,
          data: {
            screen_on: "maybe",
            device_locked: "true",
            user_unlocked: "false",
          },
        }),
      /invalid boolean for screen_on/
    );
  });
});

describe("probeInteractiveState", () => {
  function createConfig(runner = new FakeProcessRunner()) {
    return {
      config: getDefaultRuntimeConfig({
        runner,
        deviceId: "test-device",
        operatorPackage: "com.test.operator",
      }),
      runner,
    };
  }

  it("returns the parsed internal interactive state when doctor ping succeeds", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const mockWait = async () => ({
      ok: true as const,
      envelope: {
        status: "success" as const,
        commandId: "test-cmd",
        taskId: "test-task",
        stepResults: [
          {
            id: "h1",
            actionType: "doctor_ping",
            success: true,
            data: {
              screen_on: "false",
              device_locked: "true",
              user_unlocked: "false",
            },
          },
        ],
      },
      terminalSource: "clawperator_result" as const,
    });

    const result = await probeInteractiveState(config, mockWait as any);
    assert.deepStrictEqual(result, {
      ok: true,
      state: {
        screenOn: false,
        interactive: false,
        deviceLocked: true,
        userUnlocked: false,
      },
    });
  });

  it("fails closed when a required doctor ping boolean is missing", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const mockWait = async () => ({
      ok: true as const,
      envelope: {
        status: "success" as const,
        commandId: "test-cmd",
        taskId: "test-task",
        stepResults: [
          {
            id: "h1",
            actionType: "doctor_ping",
            success: true,
            data: {
              device_locked: "true",
              user_unlocked: "false",
            },
          },
        ],
      },
      terminalSource: "clawperator_result" as const,
    });

    const result = await probeInteractiveState(config, mockWait as any);
    assert.deepStrictEqual(result, {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping returned an invalid boolean for screen_on: missing",
    });
  });

  it("fails closed when doctor ping returns an unsuccessful step result", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const mockWait = async () => ({
      ok: true as const,
      envelope: {
        status: "success" as const,
        commandId: "test-cmd",
        taskId: "test-task",
        stepResults: [
          {
            id: "h1",
            actionType: "doctor_ping",
            success: false,
            data: {
              screen_on: "true",
              device_locked: "false",
              user_unlocked: "true",
            },
          },
        ],
      },
      terminalSource: "clawperator_result" as const,
    });

    const result = await probeInteractiveState(config, mockWait as any);
    assert.deepStrictEqual(result, {
      ok: false,
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping step result was unsuccessful.",
    });
  });
});

describe("ensureDeviceAwake", () => {
  function createConfig(runner = new FakeProcessRunner()) {
    return {
      config: getDefaultRuntimeConfig({
        runner,
        deviceId: "test-device",
        operatorPackage: "com.test.operator",
      }),
      runner,
    };
  }

  function state(overrides?: Partial<InternalInteractiveState>): InternalInteractiveState {
    return {
      screenOn: false,
      interactive: false,
      deviceLocked: false,
      userUnlocked: true,
      ...overrides,
    };
  }

  function probeSequence(sequence: InteractiveStateProbeResult[]) {
    let index = 0;
    return async () => {
      const next = sequence[index];
      index += 1;
      if (!next) {
        throw new Error("Unexpected probe invocation");
      }
      return next;
    };
  }

  it("skips adb wake commands when the device is already interactive", async () => {
    const { config, runner } = createConfig();

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([{ ok: true, state: state({ screenOn: true, interactive: true }) }]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "already_awake");
    assert.deepStrictEqual(result.state, state({ screenOn: true, interactive: true }));
    assert.deepStrictEqual(runner.calls, []);
  });

  it("reports awake but locked when the initial probe is already interactive", async () => {
    const { config, runner } = createConfig();

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state({ screenOn: true, interactive: true, deviceLocked: true, userUnlocked: false }) },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "awake_but_locked");
    assert.deepStrictEqual(result.state, state({ screenOn: true, interactive: true, deviceLocked: true, userUnlocked: false }));
    assert.deepStrictEqual(runner.calls, []);
  });

  it("uses the host wake retry order until the device becomes interactive", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state() },
        { ok: true, state: state() },
        { ok: true, state: state() },
        { ok: true, state: state({ screenOn: true, interactive: true }) },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "awake");
    assert.deepStrictEqual(
      runner.calls.map(call => call.args),
      [
        ["-s", "test-device", "shell", "cmd", "power", "wakeup"],
        ["-s", "test-device", "shell", "input", "keyevent", "KEYCODE_WAKEUP"],
        ["-s", "test-device", "shell", "input", "keyevent", "KEYCODE_HOME"],
      ]
    );
  });

  it("stops after the first successful wake postcondition", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state() },
        { ok: true, state: state({ screenOn: true, interactive: true }) },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "awake");
    assert.strictEqual(runner.calls.length, 1);
    assert.deepStrictEqual(runner.calls[0]?.args, ["-s", "test-device", "shell", "cmd", "power", "wakeup"]);
  });

  it("reports awake but locked without attempting unlock behavior", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state() },
        { ok: true, state: state({ screenOn: true, interactive: true, deviceLocked: true, userUnlocked: false }) },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "awake_but_locked");
    assert.deepStrictEqual(result.state, state({ screenOn: true, interactive: true, deviceLocked: true, userUnlocked: false }));
  });

  it("fails closed when probe data is unavailable", async () => {
    const { config, runner } = createConfig();

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        {
          ok: false,
          code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
          message: "doctor_ping returned an invalid boolean for screen_on: missing",
        },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "probe_failed");
    assert.deepStrictEqual(result.error, {
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping returned an invalid boolean for screen_on: missing",
    });
    assert.deepStrictEqual(runner.calls, []);
  });

  it("returns still_asleep after exhausting all wake attempts", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state() },
        { ok: true, state: state() },
        { ok: true, state: state() },
        { ok: true, state: state({ deviceLocked: true, userUnlocked: false }) },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "still_asleep");
    assert.deepStrictEqual(result.state, state({ deviceLocked: true, userUnlocked: false }));
    assert.deepStrictEqual(
      runner.calls.map(call => call.args),
      [
        ["-s", "test-device", "shell", "cmd", "power", "wakeup"],
        ["-s", "test-device", "shell", "input", "keyevent", "KEYCODE_WAKEUP"],
        ["-s", "test-device", "shell", "input", "keyevent", "KEYCODE_HOME"],
      ]
    );
  });

  it("returns probe_failed when a post-attempt probe fails", async () => {
    const { config, runner } = createConfig();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await ensureDeviceAwake(config, {
      probeInteractiveStateFn: probeSequence([
        { ok: true, state: state() },
        {
          ok: false,
          code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
          message: "doctor_ping step result was unsuccessful.",
        },
      ]),
      settleDelayMs: 0,
    });

    assert.strictEqual(result.status, "probe_failed");
    assert.deepStrictEqual(result.error, {
      code: ERROR_CODES.RESULT_ENVELOPE_MALFORMED,
      message: "doctor_ping step result was unsuccessful.",
    });
    assert.strictEqual(runner.calls.length, 1);
    assert.deepStrictEqual(runner.calls[0]?.args, ["-s", "test-device", "shell", "cmd", "power", "wakeup"]);
  });
});
