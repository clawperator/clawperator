import assert from "node:assert/strict";
import { it } from "node:test";
import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { waitForResultEnvelope } from "../../adapters/android-bridge/logcatResultReader.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

const options = { commandId: "transport-command", taskId: "transport-task", timeoutMs: 1000, broadcastDelayMs: 0 };
const config = () => getDefaultRuntimeConfig({ deviceId: "test-device", operatorPackage: "com.test.operator" });
const terminal = '[Clawperator-Result] {"commandId":"transport-command","taskId":"transport-task","status":"success","stepResults":[],"error":null}';
function fake() {
  const proc = new EventEmitter() as ChildProcess;
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let kills = 0;
  Object.assign(proc, { stdout, stderr, kill: () => { kills++; return true; } });
  const runtime = config();
  runtime.runner = { ...runtime.runner, spawn: () => proc };
  return { proc, stdout, stderr, runtime, kills: () => kills };
}

for (const [label, script, exitCode, signal] of [
  ["exit status", 'process.stderr.write("transport unavailable"); process.exit(255)', 255, null],
  ["signal", 'process.stderr.write("transport unavailable"); process.kill(process.pid, "SIGTERM")', null, "SIGTERM"],
] as const) {
  it(`preserves subprocess ${label} and dispatch uncertainty`, async () => {
    const runtime = config();
    runtime.runner = { ...runtime.runner, spawn: () => spawn(process.execPath, ["-e", script]) };
    let dispatches = 0;
    const result = await waitForResultEnvelope(runtime, options, async begin => {
      begin(); dispatches++; return { success: true };
    });
    assert.ok(!result.ok && "error" in result);
    assert.equal(result.code, "RESULT_TRANSPORT_EXITED");
    assert.equal(result.diagnostics?.exitCode, exitCode);
    assert.equal(result.diagnostics?.signal, signal);
    assert.equal(result.diagnostics?.stderr, "transport unavailable");
    assert.equal(result.diagnostics?.commandId, options.commandId);
    assert.equal(result.diagnostics?.taskId, options.taskId);
    assert.equal(result.diagnostics?.deviceId, "test-device");
    assert.equal(result.diagnostics?.operatorPackage, "com.test.operator");
    assert.equal(result.diagnostics?.executionPosition, "unknown");
    assert.equal(result.diagnostics?.dispatchAttempted, true);
    assert.equal(dispatches, 1);
  });
}

it("classifies real spawn failure without dispatch", async () => {
  const runtime = config();
  runtime.runner = { ...runtime.runner, spawn: () => spawn("/nonexistent/r13-adb", []) };
  let dispatches = 0;
  const result = await waitForResultEnvelope(runtime, { ...options, broadcastDelayMs: 100 }, async () => {
    dispatches++; return { success: true };
  });
  assert.ok(!result.ok && "error" in result);
  assert.equal(result.code, "ADB_NOT_FOUND");
  assert.equal(result.diagnostics?.processErrorCode, "ENOENT");
  assert.equal(result.diagnostics?.dispatchAttempted, false);
  assert.equal(dispatches, 0);
});

it("classifies synchronous and asynchronous non-ENOENT spawn errors", async () => {
  for (const synchronous of [true, false]) {
    const f = fake();
    const error = Object.assign(new Error("permission denied"), { code: "EACCES" });
    if (synchronous) f.runtime.runner.spawn = () => { throw error; };
    else queueMicrotask(() => f.proc.emit("error", error));
    const result = await waitForResultEnvelope(f.runtime, options, async () => ({ success: true }));
    assert.ok(!result.ok && "error" in result);
    assert.equal(result.code, "RESULT_TRANSPORT_SPAWN_FAILED");
    assert.equal(result.diagnostics?.processErrorCode, "EACCES");
    assert.equal(result.diagnostics?.originalMessage, "permission denied");
  }
});

it("blocks deferred mutation dispatch after the reader exits", async () => {
  const f = fake();
  let release!: () => void;
  let dispatches = 0;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const result = await waitForResultEnvelope(f.runtime, options, async begin => {
    f.proc.emit("close", 255, null);
    await gate;
    begin();
    dispatches++;
    return { success: true };
  });
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!result.ok && "error" in result);
  assert.equal(result.diagnostics?.dispatchAttempted, false);
  assert.equal(dispatches, 0);
});

for (const dispatched of [false, true]) {
  it(`cancels with truthful dispatch state (${dispatched}) and cleans up`, async () => {
    const f = fake();
    const controller = new AbortController();
    if (!dispatched) controller.abort();
    const result = await waitForResultEnvelope(f.runtime, { ...options, cancelSignal: controller.signal }, async begin => {
      begin(); controller.abort(); return { success: true };
    });
    assert.ok(!result.ok && "error" in result);
    assert.equal(result.code, "RESULT_TRANSPORT_CANCELLED");
    assert.equal(result.diagnostics?.dispatchAttempted, dispatched);
    assert.equal(f.kills(), 1);
  });
}

it("drains a final unterminated envelope before close and resolves only once", async () => {
  const f = fake();
  const result = await waitForResultEnvelope(f.runtime, options, async begin => {
    begin();
    const bytes = Buffer.from(terminal);
    for (const byte of bytes) f.stdout.write(Buffer.from([byte]));
    f.proc.emit("close", 0, null);
    return { success: true };
  });
  assert.ok(result.ok);
  f.proc.emit("close", 255, null);
  assert.equal(f.kills(), 1);
});

it("retains bounded stderr and rejected chunk evidence without replay", async () => {
  const f = fake();
  let dispatches = 0;
  const result = await waitForResultEnvelope(f.runtime, { ...options, timeoutMs: 10 }, async begin => {
    begin(); dispatches++;
    f.stderr.write("x".repeat(20000));
    f.stdout.write('I/Result: [Clawperator-Result-Chunk] {"commandId":"transport-command","index":1}\n');
    return { success: true };
  });
  assert.ok(!result.ok && "error" in result);
  assert.equal(result.code, "RESULT_ENVELOPE_MALFORMED");
  assert.equal(String(result.diagnostics?.stderr).length, 8192);
  assert.match(result.error, /expectedIndex=0, receivedIndex=1/);
  assert.equal(dispatches, 1);
});
