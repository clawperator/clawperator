import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import { chooseVideoSize, verifyScreenrecordHelp, verifyRemote, atomicJson, type VideoState } from "../../domain/evidence/videoSupport.js";
import { validateVideoStart, videoStatus, stopVideo, managedVideoSession } from "../../domain/evidence/video.js";
import { runVideoWorker, verifyVideo } from "../../domain/evidence/videoWorker.js";
import { evidenceManifestSchema, type EvidenceManifest } from "../../contracts/evidence.js";
import type { ProcessRunner } from "../../adapters/android-bridge/processRunner.js";
import { getVideoMcpTools } from "../../mcp/tools/evidence.js";
import { spawnSync } from "node:child_process";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { startVideo } from "../../domain/evidence/video.js";
import { lockName } from "../../domain/evidence/videoSupport.js";
import { VideoProcessRunner } from "../../domain/evidence/videoProcessRunner.js";
export async function videoFixture(options: { failure?: string; stopped?: boolean } = {}) {
  const outputDir = await fs.mkdtemp(join(tmpdir(), "evidence-video-test-"));
  const state: VideoState = { sessionId: randomUUID(), nonce: randomUUID(), outputDir, lockPath: join(outputDir, "lock.json"), managed: false,
    deviceId: "test-device", operatorPackage: "com.example.operator", adbPath: "adb", durationSeconds: 1, size: "720x1280", hostPid: null,
    hostStartedAt: null, remotePid: null, remoteStart: null, remotePath: "", deadline: Date.now() + 1000, updatedAt: Date.now(), recoveryRequired: false };
  state.remotePath = `/data/local/tmp/clawperator-video-${state.sessionId}.mp4`;
  const manifest: EvidenceManifest = { schemaVersion: 1, evidenceId: state.sessionId, label: null, context: { originalVerdict: "failed" },
    device: { serial: state.deviceId, operatorPackage: state.operatorPackage, cliVersion: "0.10.0", operatorVersion: "0.10.0-d", apiLevel: 36, androidVersion: "16", manufacturer: "test", model: "test", deviceType: "emulator", deviceTypeProperties: { "ro.kernel.qemu": "1", "ro.boot.qemu": null }, display: { width: 720, height: 1280, density: 320, rotation: 0 } },
    startedAt: new Date().toISOString(), finishedAt: null, status: "starting", artifacts: [], errors: [],
    video: { requestedDurationSeconds: 1, hostDurationMs: 0, mediaDurationMs: null, requestedSize: state.size, actualSize: null, codec: null, stopReason: null } };
  await atomicJson(join(outputDir, "session.json"), state);
  await atomicJson(join(outputDir, "manifest.json"), manifest);
  await atomicJson(state.lockPath, { sessionId: state.sessionId, nonce: state.nonce });
  if (options.stopped) await atomicJson(join(outputDir, "stop.json"), { nonce: state.nonce });
  const calls: string[][] = [];
  let child: any;
  let identityReads = 0;
  const runner: ProcessRunner = {
    runShell: async () => { throw new Error("No host shell allowed"); },
    spawn: (_command, args) => {
      calls.push(args);
      child = Object.assign(new EventEmitter(), { stdout: new EventEmitter(), stderr: new EventEmitter(), kill: () => { child.emit("close", null); return true; } });
      queueMicrotask(() => { child.stdout.emit("data", Buffer.from("123\n")); if (options.failure === "startup") child.stderr.emit("data", Buffer.from("encoder failed")); if (options.failure === "stderr-limit") child.stderr.emit("data", Buffer.alloc(1024 * 1024 + 5, 120)); });
      if (!options.stopped) setTimeout(() => child.emit("close", options.failure === "disconnect" ? null : 0), 400);
      return child;
    },
    run: async (command, args) => {
      calls.push([command, ...args]);
      if (args.some(a => a.endsWith("/cmdline"))) {
        identityReads++;
        if (options.failure === "stop-cap-race" && identityReads === 2) {
          child.emit("close", 0);
          return { code: 1, stdout: "", stderr: "No such process" };
        }
      }
      if (args.some(a => a.endsWith("/cmdline"))) return { code: 0, stderr: "", stdout: `screenrecord\0--size\0${state.size}\0--time-limit\0${1}\0${options.failure === "identity" ? "/other.mp4" : state.remotePath}\0` };
      if (args.some(a => a.endsWith("/stat"))) return { code: 0, stderr: "", stdout: "123 (screenrecord) " + [...Array(19).fill("0"), "456"].join(" ") };
      if (args.some(a => a.includes("kill -2")) && options.failure === "stop-signal-race") {
        child.emit("close", 0);
        return { code: 1, stdout: "", stderr: "No such process" };
      }
      if (args.some(a => a.includes("kill -2"))) { queueMicrotask(() => child.emit("close", 130)); return { code: 0, stdout: "", stderr: "" }; }
      if (args.includes("pull")) {
        if (options.failure === "pull") return { code: 1, stdout: "", stderr: "disconnected" };
        await fs.writeFile(args.at(-1)!, Buffer.from("fake media bytes"));
      }
      if (command === "ffprobe") return { code: 0, stderr: "", stdout: JSON.stringify({ streams: [{ codec_name: "h264", width: options.failure === "dimensions" ? 640 : 720, height: 1280, duration: options.failure === "idle-zero" ? "0.000000" : "0.25" }] }) };
      if (command === "ffmpeg") return options.failure === "decode" ? { code: 1, stderr: "corrupt frame", stdout: "" } : { code: 0, stderr: "", stdout: "0, 0, 0, 1, 1024, d41d8cd98f00b204e9800998ecf8427e" };
      return { code: 0, stderr: "", stdout: "" };
    },
  };
  return { state, manifest, runner, calls, outputDir, path: join(outputDir, "manifest.json"), cleanup: () => fs.rm(outputDir, { recursive: true, force: true }) };
}

describe("video contracts and geometry", () => {
  it("scales down only and validates even/aspect-matched explicit dimensions", () => {
    assert.equal(chooseVideoSize(1344, 2992), "574x1280");
    assert.equal(chooseVideoSize(640, 480), "640x480");
    assert.equal(chooseVideoSize(1920, 1080, "1280x720"), "1280x720");
    for (const size of ["", "0x0", "1279x720", "1280x800", "abc"]) assert.throws(() => chooseVideoSize(1920, 1080, size));
  });
  it("requires explicit target and bounded integer duration", () => {
    for (const durationSeconds of [0, 181, 1.2, NaN]) assert.throws(() => validateVideoStart({ deviceId: "test", durationSeconds }));
    assert.throws(() => validateVideoStart({ durationSeconds: 10 }));
    assert.throws(() => validateVideoStart({ deviceId: "test", durationSeconds: 10, context: [] as any }));
    validateVideoStart({ deviceId: "test", durationSeconds: 180, label: "" });
  });
  it("fails closed when screenrecord duration support is not advertised", () => {
    verifyScreenrecordHelp("--size --time-limit Default is 180. Set to 0 to remove the time limit.", 180);
    verifyScreenrecordHelp("--size --time-limit Maximum is 60", 60);
    assert.throws(() => verifyScreenrecordHelp("--size --time-limit Maximum is 60", 61));
    assert.throws(() => verifyScreenrecordHelp("--size --time-limit", 10));
    assert.throws(() => verifyScreenrecordHelp("unsupported", 10));
  });
  it("does not authorize a reused recorder PID", async () => {
    const f = await videoFixture({ failure: "identity" });
    try { await assert.rejects(verifyRemote(f.runner, { ...f.state, remotePid: 123 }), (e: any) => e.code === "EVIDENCE_RECOVERY_REQUIRED"); assert.ok(!f.calls.some(a => a.some(v => v.includes("kill")))); }
    finally { await f.cleanup(); }
  });
  it("requires decoding and matching dimensions", async () => {
    for (const failure of ["dimensions", "decode"]) {
      const f = await videoFixture({ failure });
      try { await assert.rejects(verifyVideo(f.runner, "video.partial.mp4", f.state.size)); } finally { await f.cleanup(); }
    }
  });
});

describe("video worker and persistent lifecycle", () => {
  for (const stopped of [false, true]) it(`finalizes ${stopped ? "explicit stop" : "duration cap"} and repeated stop is immutable`, async () => {
    const f = await videoFixture({ stopped });
    try {
      await runVideoWorker(f.outputDir, f.runner);
      const before = await fs.readFile(f.path, "utf8");
      const manifest = evidenceManifestSchema.parse(JSON.parse(before));
      assert.equal(manifest.status, "complete");
      assert.equal(manifest.video!.mediaDurationMs, 250);
      assert.notEqual(manifest.video!.hostDurationMs, manifest.video!.mediaDurationMs);
      assert.equal(manifest.video!.stopReason, stopped ? "requested" : "duration_cap");
      assert.equal((await stopVideo({ session: f.path })).ok, true);
      assert.equal(await fs.readFile(f.path, "utf8"), before);
      assert.equal(manifest.context.originalVerdict, "failed");
      await assert.rejects(fs.stat(f.state.lockPath));
    } finally { await f.cleanup(); }
  });
  for (const failure of ["startup", "disconnect", "pull", "dimensions", "decode", "identity", "idle-zero", "stderr-limit"]) it(`retains truthful failure for ${failure}`, async () => {
    const f = await videoFixture({ failure });
    try {
      await runVideoWorker(f.outputDir, f.runner);
      const manifest = evidenceManifestSchema.parse(JSON.parse(await fs.readFile(f.path, "utf8")));
      assert.notEqual(manifest.status, "complete");
      assert.ok(manifest.errors.length);
      if (failure === "stderr-limit") {
        const artifact = manifest.artifacts.find(a => a.kind === "encoder_stderr")!;
        assert.equal(artifact.bytes, 1024 * 1024);
        assert.equal(artifact.status, "partial");
      }
      if (failure === "idle-zero") {
        assert.equal(manifest.video!.mediaDurationMs, 0);
        assert.equal(manifest.video!.actualSize, f.state.size);
        assert.equal(manifest.status, "partial");
      }
      assert.ok(!f.calls.some(a => a.includes("rm")), "Never delete remote evidence after failed media verification");
      if (["dimensions", "decode"].includes(failure)) assert.equal(manifest.artifacts[0].path, "video.partial.mp4");
      if (["startup", "disconnect", "identity"].includes(failure)) await fs.stat(f.state.lockPath);
    } finally { await f.cleanup(); }
  });
  it("reports a dead worker without deleting its lock or modifying the manifest", async () => {
    const f = await videoFixture();
    try {
      await atomicJson(join(f.outputDir, "session.json"), { ...f.state, updatedAt: Date.now() - 10000 });
      const before = await fs.readFile(f.path, "utf8");
      const result = await videoStatus({ session: f.path });
      assert.equal(result.code, "EVIDENCE_RECOVERY_REQUIRED");
      assert.equal(result.ok, false);
      await fs.stat(f.state.lockPath);
      assert.equal(await fs.readFile(f.path, "utf8"), before);
      await assert.rejects(videoStatus({ session: f.path, deviceId: "different-device" }));
      await assert.rejects(managedVideoSession(f.state.sessionId, { baseDir: f.outputDir }));
    } finally { await f.cleanup(); }
  });
  it("MCP lifecycle tools reject path and target overrides", async () => {
    for (const tool of getVideoMcpTools()) {
      const valid = tool.name.endsWith("start") ? { durationSeconds: 10, deviceId: "test" } : { sessionId: randomUUID() };
      for (const extra of [{ outputDir: "/tmp/unsafe" }, { session: "/tmp/manifest.json" }, ...(tool.name.endsWith("start") ? [] : [{ deviceId: "different" }])]) {
        await assert.rejects(async () => tool.handler({ ...valid, ...extra }));
      }
    }
  });
});


describe("video start preflight and CLI", () => {
  it("rejects an occupied device lock after accepting screenrecord help from stderr", async () => {
    const root = await fs.mkdtemp(join(tmpdir(), "video-start-test-"));
    const calls: string[][] = [];
    const runner: ProcessRunner = {
      spawn: () => { throw new Error("Must not spawn while locked"); }, runShell: async () => { throw new Error("No shell"); },
      run: async (command, args) => {
        calls.push([command, ...args]);
        const action = args.slice(args[0] === "-s" ? 2 : 0).join(" ");
        let stdout = "", stderr = "";
        if (action === "devices") stdout = "List of devices attached\ntest-device\tdevice\n";
        if (action === "shell screenrecord --help") stderr = "--size --time-limit Default is 180.";
        if (action === "shell getprop") stdout = "[ro.build.version.sdk]: [36]\n[ro.build.version.release]: [16]\n[ro.product.model]: [test]\n[ro.product.manufacturer]: [test]\n[ro.kernel.qemu]: [1]\n";
        if (action === "shell wm size") stdout = "Physical size: 720x1280";
        if (action === "shell wm density") stdout = "Physical density: 320";
        if (action === "shell dumpsys input") stdout = "SurfaceOrientation: 0";
        if (action.startsWith("shell dumpsys package")) stdout = "versionName=0.10.0-d";
        return { code: 0, stdout, stderr };
      },
    };
    try {
      await fs.mkdir(join(root, "locks"));
      const lock = join(root, "locks", lockName("test-device"));
      await fs.writeFile(lock, "existing ownership");
      const config = getDefaultRuntimeConfig({ runner, deviceId: "test-device", operatorPackage: "com.example.operator" });
      await assert.rejects(startVideo({ deviceId: "test-device", durationSeconds: 10 }, { config, baseDir: root }), (e: any) => e.code === "EVIDENCE_RECORDING_ACTIVE");
      assert.equal(await fs.readFile(lock, "utf8"), "existing ownership");
      assert.ok(calls.some(a => a.includes("--help")));
      await fs.unlink(lock);
      await assert.rejects(startVideo({ deviceId: "test-device", durationSeconds: 10, outputDir: root }, { config, baseDir: root }), (e: any) => e.code === "EVIDENCE_OUTPUT_EXISTS");
      await assert.rejects(fs.stat(lock));
      const originalRun = runner.run;
      for (const missingTool of ["ffprobe", "ffmpeg"]) {
        runner.run = async (command, args) => command === missingTool
          ? { code: 127, stdout: "", stderr: "missing prerequisite" }
          : originalRun(command, args);
        await assert.rejects(startVideo({ deviceId: "test-device", durationSeconds: 10 }, { config, baseDir: root }), (e: any) => e.code === "EVIDENCE_CAPTURE_FAILED" && e.message.includes(missingTool));
        await assert.rejects(fs.stat(lock));
      }
      runner.run = originalRun;
      for (const synchronous of [false, true]) {
        runner.spawn = () => {
          const error = Object.assign(new Error("Worker spawn resource exhausted"), { code: "EAGAIN" });
          if (synchronous) throw error;
          const child = Object.assign(new EventEmitter(), { unref: () => undefined });
          queueMicrotask(() => child.emit("error", error));
          return child;
        };
        const result = await startVideo({ deviceId: "test-device", durationSeconds: 10 }, { config, baseDir: root });
        assert.equal(result.status, "failed");
        assert.equal(result.code, "EVIDENCE_CAPTURE_FAILED");
        assert.equal((await videoStatus({ session: result.manifestPath })).status, "failed");
        const manifest = JSON.parse(await fs.readFile(result.manifestPath, "utf8"));
        assert.equal(manifest.errors.at(-1).code, "EAGAIN");
        await assert.rejects(fs.stat(lock), "A known spawn failure must not reserve the device");
      }
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });
  it("enforces a hard subprocess timeout even when SIGTERM is ignored", async () => {
    const result = await new VideoProcessRunner().run(process.execPath, ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], { timeoutMs: 100 });
    assert.equal(result.code, null);
    assert.match(result.stderr, /timed out/);
  });
  it("CLI validates missing and invalid values, target placement, status and exit codes", async () => {
    const f = await videoFixture();
    const cli = (args: string[]) => spawnSync(process.execPath, ["dist/cli/index.js", ...args], { encoding: "utf8" });
    try {
      await runVideoWorker(f.outputDir, f.runner);
      for (const args of [
        ["evidence", "video", "start"], ["evidence", "video", "start", "--duration-seconds"],
        ["evidence", "video", "start", "--output-dir", "/tmp/example", "--duration-seconds", "1.5"],
        ["evidence", "video", "start", "--output-dir", "/tmp/example", "--duration-seconds", "181"],
        ["evidence", "video", "status", "--session"], ["evidence", "video", "stop", "--session", ""],
        ["evidence", "video", "status", "--session", f.path, "--size", "720x1280"],
        ["evidence", "video", "start", "--session", f.path],
      ]) {
        const result = cli(args); assert.notEqual(result.status, 0, args.join(" ")); assert.ok(JSON.parse(result.stdout).code);
      }
      for (const placement of [0, 5]) {
        const args = ["evidence", "video", "status", "--session", f.path];
        args.splice(placement, 0, "--device", f.state.deviceId);
        const result = cli(args); assert.equal(result.status, 0, result.stdout); assert.equal(JSON.parse(result.stdout).status, "complete");
      }
      const stopped = cli(["evidence", "video", "stop", "--session", f.path]);
      assert.equal(stopped.status, 0); assert.equal(JSON.parse(stopped.stdout).status, "complete");
      const conflict = cli(["evidence", "video", "status", "--session", f.path, "--device", "other"]);
      assert.equal(conflict.status, 1); assert.equal(JSON.parse(conflict.stdout).code, "EXECUTION_VALIDATION_FAILED");
    } finally { await f.cleanup(); }
  });
});

it("a recorder that outlives its cap requires recovery without broad process termination", async () => {
  const f = await videoFixture({ stopped: true });
  let now = Date.now();
  try {
    await fs.unlink(join(f.outputDir, "stop.json"));
    await runVideoWorker(f.outputDir, f.runner, { now: () => now, monotonic: () => now, sleep: async ms => { now += ms; await new Promise<void>(resolve => setImmediate(resolve)); } });
    const manifest = JSON.parse(await fs.readFile(f.path, "utf8"));
    assert.equal(manifest.status, "failed");
    assert.ok(manifest.errors.some((e: any) => e.code === "EVIDENCE_RECOVERY_REQUIRED"));
    await fs.stat(f.state.lockPath);
    assert.ok(!f.calls.some(a => a.some(v => /killall|pkill/.test(v))));
  } finally { await f.cleanup(); }
});


for (const failure of ["stop-cap-race", "stop-signal-race"]) {
  it(`finalizes an observed normal recorder exit during ${failure}`, async () => {
    const f = await videoFixture({ failure, stopped: true });
    try {
      await runVideoWorker(f.outputDir, f.runner);
      const manifest = JSON.parse(await fs.readFile(f.path, "utf8"));
      assert.equal(manifest.status, "complete");
      assert.equal(manifest.video.stopReason, "duration_cap");
      assert.ok(f.calls.some(args => args.includes("pull")));
      assert.ok(f.calls.filter(args => args.some(arg => arg.includes("kill -2"))).length <= 1);
      await assert.rejects(fs.stat(f.state.lockPath));
    } finally { await f.cleanup(); }
  });
}
for (const filename of ["video.mp4", "encoder.stderr.txt", "captures.json"]) {
  it(`never reports complete when final ${filename} cannot be read`, async () => {
    const f = await videoFixture();
    try {
      const readArtifact = (async (path: Parameters<typeof fs.readFile>[0]) => {
        if (String(path).endsWith(filename)) throw Object.assign(new Error("Artifact read denied"), { code: "EACCES" });
        return fs.readFile(path);
      }) as typeof fs.readFile;
      await runVideoWorker(f.outputDir, f.runner, undefined, readArtifact);
      const manifest = JSON.parse(await fs.readFile(f.path, "utf8"));
      assert.equal(manifest.status, filename === "video.mp4" ? "failed" : "partial");
      assert.ok(manifest.errors.some((error: any) => error.code === "EACCES" && error.stage === "artifact"));
      assert.equal((await videoStatus({ session: f.path })).ok, false);
      assert.equal((await stopVideo({ session: f.path })).ok, false);
    } finally { await f.cleanup(); }
  });
}
