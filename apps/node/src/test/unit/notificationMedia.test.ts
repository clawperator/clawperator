import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildNotificationMediaExecution } from "../../domain/notifications/service.js";
import { isBackgroundObservation } from "../../contracts/notifications.js";
import { cmdDoctor } from "../../cli/commands/doctor.js";

afterEach(() => { process.exitCode = undefined; });
describe("notification/media contract", () => {
  it("exempts only nonempty validated observation-only lists", () => {
    const actions = ["list_notifications", "list_media_sessions", "get_media_status"].map(type => ({ id: type, type }));
    assert.equal(isBackgroundObservation(actions), true);
    for (const type of ["media_pause", "media_play", "media_seek", "dismiss_notification", "invoke_notification_action", "snapshot", "doctor_ping", "unknown", "LIST_NOTIFICATIONS"]) {
      assert.equal(isBackgroundObservation([...actions, { id: "x", type }]), false);
      assert.equal(isBackgroundObservation([{ id: "x", type }, ...actions]), false);
    }
    assert.equal(isBackgroundObservation([]), false);
  });
  it("rejects invalid/missing targets and inappropriate parameters", () => {
    for (const params of [{}, { applicationId: "" }, { applicationId: " " }, { mediaSessionId: "" }, { applicationId: "p", mediaSessionId: "s" }, { applicationId: "p", limit: 1 }]) {
      assert.throws(() => buildNotificationMediaExecution("get_media_status", params));
    }
    for (const params of [{ limit: 0 }, { limit: 101 }, { limit: 1.5 }, { maxTextChars: 0 }, { applicationId: "" }, { mediaSessionId: "s" }]) {
      assert.throws(() => buildNotificationMediaExecution("list_notifications", params));
    }
    assert.throws(() => buildNotificationMediaExecution("media_play", { applicationId: "p", waitTimeoutMs: -1 }));
    assert.throws(() => buildNotificationMediaExecution("media_pause", { applicationId: "p", waitTimeoutMs: 30001 }));
    assert.equal(buildNotificationMediaExecution("media_pause", { mediaSessionId: "s", waitTimeoutMs: 1000 }).actions[0].type, "media_pause");
    assert.equal(buildNotificationMediaExecution("list_notifications", { limit: 100 }).actions[0].params?.limit, 100);
  });
  it("rejects background doctor mutations before executing any diagnostics", async () => {
    for (const options of [{ capability: "invalid" }, { capability: "background-observation", full: true }, { capability: "background-observation", fix: true }]) {
      const result = JSON.parse(await cmdDoctor({ format: "json", ...options }, { doctorService: { run: async () => { throw new Error("must not run"); } } }));
      assert.equal(result.code, "INVALID_ARGUMENT");
      assert.equal(process.exitCode, 1);
    }
  });
});

import { EventEmitter } from "node:events";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";
import { runExecution } from "../../domain/executions/runExecution.js";

it("dispatches service observations without calling interactive readiness", async () => {
  const execution = buildNotificationMediaExecution("list_notifications");
  const runner = new FakeProcessRunner();
  const envelope = { commandId: execution.commandId, taskId: execution.taskId, status: "success", error: null, stepResults: [{ id: "a1", actionType: "list_notifications", success: true, data: { payload: '{}' } }] };
  let stream: EventEmitter & { stdout: EventEmitter; stderr: EventEmitter; kill: () => void };
  runner.spawn = (() => {
    stream = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} });
    return stream;
  }) as FakeProcessRunner["spawn"];
  runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device\tdevice\n", stderr: "" });
  runner.queueResult({ code: 0, stdout: "package:com.test.operator\n", stderr: "" });
  runner.queueResult({ code: 0, stdout: "0", stderr: "" });
  runner.queueResult({ code: 0, stdout: "RUNNING_UNLOCKED", stderr: "" });
  runner.queueResult({ code: 0, stdout: "Broadcast completed: result=0", stderr: "" }, () => {
    setTimeout(() => { stream.stdout.emit("data", Buffer.from(`[Clawperator-Result] ${JSON.stringify(envelope)}\n`)); }, 5);
  });
  const result = await runExecution(execution, { deviceId: "test-device", operatorPackage: "com.test.operator", runner, logcatBroadcastDelayMs: 0, resultEnvelopeTimeoutMs: 1000,
    ensureInteractiveAutomationReadyFn: async () => { throw new Error("must not wake or probe interactive readiness"); } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(runner.calls.some(call => /WAKEUP|KEYCODE_HOME|logcat -c|doctor_ping/.test(call.args.join(" "))), false);
});

import { grantNotificationListenerPermission } from "../../domain/device/grantPermissions.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
it("reconciles an existing settings grant through NotificationManager", async () => {
  const runner = new FakeProcessRunner();
  const service = "com.test.operator/action.notification.NotificationListenerService";
  runner.queueResult({ code: 0, stdout: service, stderr: "" });
  runner.queueResult({ code: 0, stdout: "", stderr: "" });
  const result = await grantNotificationListenerPermission(getDefaultRuntimeConfig({ runner }), "com.test.operator");
  assert.deepEqual(result, { ok: true, alreadyEnabled: true });
  assert.deepEqual(runner.calls[1].args, ["shell", "cmd", "notification", "allow_listener", service]);
});
it("does not normalize denied notification grant to success", async () => {
  const runner = new FakeProcessRunner();
  runner.queueResult({ code: 0, stdout: "null", stderr: "" });
  runner.queueResult({ code: 0, stdout: "SecurityException: denied", stderr: "" });
  assert.equal((await grantNotificationListenerPermission(getDefaultRuntimeConfig({ runner }), "com.test.operator")).ok, false);
});

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
it("CLI rejects missing, blank, conflicting and invalid service values with JSON and nonzero exits", () => {
  const cli = fileURLToPath(new URL("../../cli/index.js", import.meta.url));
  for (const args of [
    ["notifications", "dismiss"], ["notifications", "dismiss", " "],
    ["notifications", "action", "key"], ["notifications", "action", "key", "--action"],
    ["notifications", "action", "key", "--action", " "], ["notifications", "dismiss", "key", "--action", "a"],
    ["media", "seek", "--session", "s"], ["media", "seek", "--session", "s", "--position-ms"],
    ...["-1", "1.5", "NaN", "Infinity", "9007199254740992", " "].map(value => ["media", "seek", "--session", "s", "--position-ms", value]),
    ["media", "seek", "--session", "s", "--position-ms", "0", "--position-tolerance-ms", "60001"],
    ["media", "status"], ["media", "status", "--session"],
    ["media", "status", "--session", " "], ["media", "status", "--app", "p", "--session", "s"],
    ["media", "play", "--app", "p", "--wait-timeout-ms", "-1"],
    ["notifications", "list", "--limit", "0"], ["notifications", "list", "--max-text-chars", "1025"],
    ["doctor", "--capability"], ["doctor", "--capability", "bogus"],
    ["doctor", "--capability", "background-observation", "--full"],
  ]) {
    for (const optionsFirst of [true, false]) {
      const global = ["--device", "non-existent-test-device", "--output", "json"];
      const result = spawnSync(process.execPath, [cli, ...(optionsFirst ? [...global, ...args] : [...args, ...global])], { encoding: "utf8" });
      assert.notEqual(result.status, 0, JSON.stringify(args));
      const error = JSON.parse(result.stdout);
      assert.match(error.code, /USAGE|INVALID|VALIDATION/);
    }
  }
});

it("returns an explicit pre-unlock error without dispatch, wake or remediation", async () => {
  const runner = new FakeProcessRunner();
  runner.spawn = (() => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} })) as FakeProcessRunner["spawn"];
  for (const stdout of ["List of devices attached\ntest-device\tdevice\n", "package:com.test.operator", "0", "RUNNING_LOCKED"]) {
    runner.queueResult({ code: 0, stdout, stderr: "" });
  }
  const result = await runExecution(buildNotificationMediaExecution("list_notifications"), { deviceId: "test-device", operatorPackage: "com.test.operator", runner, logcatBroadcastDelayMs: 0 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "DEVICE_USER_NOT_UNLOCKED");
  assert.equal(runner.calls.some(call => /broadcast|WAKEUP|HOME|doctor_ping|settings put/.test(call.args.join(" "))), false);
});

import { probeUserUnlockState } from "../../domain/device/userUnlockState.js";
it("leaves unavailable or unsupported unlock probes to the runtime", async () => {
  for (const state of ["Unknown command: get-started-user-state", "", "STOPPING"]) {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "0", stderr: "" });
    runner.queueResult({ code: 0, stdout: state, stderr: "" });
    assert.equal(await probeUserUnlockState(getDefaultRuntimeConfig({ runner })), undefined);
    assert.equal(runner.calls.length, 2);
  }
});

it("does not report a missing notification shell service as a granted permission", async () => {
  for (const output of ["cmd: Can't find service: notification", "notification: not found", "Unknown command: allow_listener", "No shell command implementation."]) {
    const runner = new FakeProcessRunner();
    for (const stdout of ["null", output, "36"]) runner.queueResult({ code: 0, stdout, stderr: "" });
    const result = await grantNotificationListenerPermission(getDefaultRuntimeConfig({ runner }), "com.test.operator");
    assert.equal(result.ok, false, output);
    assert.equal(runner.calls.some(call => call.args.includes("put")), false);
  }
});
it("uses the legacy grant on Android versions before the notification shell implementation", async () => {
  for (const [api, output] of [[21, "Unknown command: allow_listener"], [24, "No shell command implementation."], [25, "No shell command implementation."], [26, "No shell command implementation."]]) {
    const runner = new FakeProcessRunner();
    for (const stdout of ["null", String(output), String(api), ""]) runner.queueResult({ code: 0, stdout, stderr: "" });
    assert.deepEqual(await grantNotificationListenerPermission(getDefaultRuntimeConfig({ runner }), "com.test.operator"), { ok: true, alreadyEnabled: false });
    assert.deepEqual(runner.calls.at(-1)?.args.slice(0, 5), ["shell", "settings", "put", "secure", "enabled_notification_listeners"]);
  }
});


it("validates all N2 mutations strictly and preserves their canonical payloads", () => {
  for (const [type, params] of [
    ["dismiss_notification", { notificationKey: "key", waitTimeoutMs: 100 }],
    ["invoke_notification_action", { notificationKey: "key", actionId: "revision:0" }],
    ["media_seek", { mediaSessionId: "s", positionMs: 0, positionToleranceMs: 0, waitTimeoutMs: 30000 }],
    ["media_seek", { applicationId: "p", positionMs: Number.MAX_SAFE_INTEGER }],
  ] as const) {
    assert.deepEqual(buildNotificationMediaExecution(type, params).actions[0].params, params);
  }
  for (const positionMs of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1", null]) {
    assert.throws(() => buildNotificationMediaExecution("media_seek", { mediaSessionId: "s", positionMs } as never));
  }
  for (const [type, params] of [
    ["dismiss_notification", {}], ["dismiss_notification", { notificationKey: " " }],
    ["dismiss_notification", { notificationKey: "k", applicationId: "p" }],
    ["invoke_notification_action", { notificationKey: "k", actionId: "a", waitTimeoutMs: 1 }],
    ["invoke_notification_action", { notificationKey: "k", actionId: "" }],
    ["media_seek", { positionMs: 1 }], ["media_seek", { mediaSessionId: "s", applicationId: "p", positionMs: 1 }],
    ["media_seek", { mediaSessionId: "s", positionMs: 1, positionToleranceMs: -1 }],
  ] as const) assert.throws(() => buildNotificationMediaExecution(type, params));
});

it("valid N2 CLI values reach device selection with either global flag placement", () => {
  const cli = fileURLToPath(new URL("../../cli/index.js", import.meta.url));
  for (const args of [
    ["notifications", "dismiss", "key", "--wait-timeout-ms", "0"],
    ["notifications", "action", "key", "--action", "revision:0"],
    ["media", "seek", "--session", "s", "--position-ms", "1000", "--position-tolerance-ms", "50"],
  ]) for (const first of [true, false]) {
    const global = ["--device", "non-existent-test-device", "--output", "json", "--no-daemon"];
    const result = spawnSync(process.execPath, [cli, ...(first ? [...global, ...args] : [...args, ...global])], { encoding: "utf8" });
    assert.notEqual(result.status, 0);
    assert.match(JSON.parse(result.stdout).code, /DEVICE/);
  }
});

it("never replays N2 mutations when the transport loses their receipt", async () => {
  for (const [type, params] of [
    ["media_seek", { mediaSessionId: "s", positionMs: 1000 }],
    ["dismiss_notification", { notificationKey: "k" }],
    ["invoke_notification_action", { notificationKey: "k", actionId: "a" }],
  ] as const) {
    const runner = new FakeProcessRunner();
    runner.spawn = (() => Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill() {} })) as FakeProcessRunner["spawn"];
    for (const stdout of ["List of devices attached\ntest-device\tdevice\n", "package:com.test.operator\n", "0", "Broadcast completed: result=0"]) {
      runner.queueResult({ code: 0, stdout, stderr: "" });
    }
    const result = await runExecution(buildNotificationMediaExecution(type, params), {
      deviceId: "test-device", operatorPackage: "com.test.operator", runner, logcatBroadcastDelayMs: 0, resultEnvelopeTimeoutMs: 30,
      ensureInteractiveAutomationReadyFn: async () => ({ ok: true } as never),
    });
    assert.equal(result.ok, false);
    assert.equal(runner.calls.filter(call => call.args.some(arg => arg.includes("am broadcast"))).length, 1);
  }
});
