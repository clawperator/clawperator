import { releaseLock, readState } from "../../domain/evidence/videoSupport.js";
import { it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execute = promisify(execFile);

for (const [flags, deviceType] of [["", "physical"], ["\\n[ro.kernel.qemu]: [1]", "emulator"], ["\\n[ro.kernel.qemu]: [unexpected]", "unknown"]] as const) {
it(`classification ${deviceType}: real detached worker survives its initiating process and concurrent stops finalize once`, { skip: process.platform === "win32" ? "Executable fixtures use POSIX shebangs" : false }, async () => {
  const root = await fs.mkdtemp(join(tmpdir(), "video-worker-process-test-"));
  // Video locks are host-wide, even across worktrees and evidence directories.
  const deviceId = `test-device-${randomUUID()}`;
  const secondDeviceId = `second-${deviceId}`;
  const binary = async (name: string, body: string) => {
    const path = join(root, name);
    await fs.writeFile(path, '#!/usr/bin/env node\n' + body, { mode: 0o700 });
    return path;
  };
  const adb = await binary("adb", `
const fs=require('node:fs'),path=require('node:path');const root=__dirname;
const args=process.argv.slice(2);const action=args.slice(args[0]==='-s'?2:0).join(' ');
const recorder=path.join(root,"recorder-"+(args[1]||"none")+".json");
const read=()=>JSON.parse(fs.readFileSync(recorder,'utf8'));
if(action==='devices') console.log(${JSON.stringify(`List of devices attached\n${deviceId}\tdevice\n${secondDeviceId}\tdevice`)});
else if(action==='shell screenrecord --help') console.error('--size --time-limit Default is 180.');
else if(action==='shell getprop') console.log('[ro.build.version.sdk]: [36]\\n[ro.build.version.release]: [16]\\n[ro.product.model]: [test]\\n[ro.product.manufacturer]: [test]${flags}');
else if(action==='shell wm size') console.log('Physical size: 720x1280');
else if(action==='shell wm density') console.log('Physical density: 320');
else if(action==='shell dumpsys input') console.log('SurfaceOrientation: 0');
else if(action.startsWith('shell dumpsys package')) console.log('versionName=0.10.0-d');
else if(action.includes('echo $$; exec screenrecord')) {
 const script=args.at(-1);const remote=script.match(/(\\/data\\/local\\/tmp\\/clawperator-video-[a-f0-9-]+\\.mp4)/)[1];
 const size=script.match(/--size (\\d+x\\d+)/)[1];const duration=script.match(/--time-limit (\\d+)/)[1];
 fs.writeFileSync(recorder,JSON.stringify({pid:process.pid,remote,size,duration}));
 console.log(process.pid);const finish=()=>{fs.writeFileSync(path.join(root,'media-'+args[1]),'simulated video');process.exit(0)};
 process.on('SIGINT',finish);setTimeout(finish,Number(duration)*1000);
} else if(action.includes('/cmdline') && !action.includes('kill -2')) {const r=read();process.stdout.write(['screenrecord','--size',r.size,'--time-limit',r.duration,r.remote,''].join('\\0'));}
else if(action.includes('/proc/') && action.includes('/stat') && !action.includes('kill -2')) console.log('123 (screenrecord) '+[...Array(19).fill('0'),'456'].join(' '));
else if(action.includes('kill -2')) {const r=read();if(!action.includes('kill -2 '+r.pid))process.exit(1);process.kill(r.pid,'SIGINT');}
else if(action.startsWith('pull ')) fs.copyFileSync(path.join(root,'media-'+args[1]),args.at(-1));
else if(action.startsWith('shell rm ')) fs.unlinkSync(path.join(root,'media-'+args[1]));
else {console.error('Unexpected fake adb operation: '+action);process.exit(1)}
`);
  await binary("ffprobe", "console.log(JSON.stringify({streams:[{codec_name:'h264',width:720,height:1280,duration:'0.25'}]}));");
  await binary("ffmpeg", "console.log('frame=6\\nprogress=end\\n');");
  const parent = join(root, "start.mjs");
  await fs.writeFile(parent, `import {startVideo} from ${JSON.stringify(pathToFileURL(resolve("dist/domain/evidence/video.js")).href)};console.log(JSON.stringify(await startVideo({deviceId:process.argv[2]||${JSON.stringify(deviceId)},operatorPackage:'com.example.operator',durationSeconds:20}).catch(error=>error)));`);
  const env = { ...process.env, ADB_PATH: adb, PATH: root + ":" + process.env.PATH, CLAWPERATOR_EVIDENCE_DIR: relative(process.cwd(), join(root, "state with spaces")) };
  let manifestPath: string | undefined;
  try {
    // execFile resolves only when the initiating process has exited.
    const started = JSON.parse((await execute(process.execPath, [parent], { env, timeout: 8000 })).stdout);
    assert.equal(started.status, "recording", JSON.stringify(started));
    manifestPath = started.manifestPath;
    const cli = (operation: string) => execute(process.execPath, ["dist/cli/index.js", "evidence", "video", operation, "--session", manifestPath!], { env, timeout: 17000 }).then(result => ({ ...result, exitCode: 0 })).catch(error => {
      if (deviceType !== "unknown" || error.code !== 1) throw error;
      return { stdout: error.stdout as string, exitCode: error.code as number };
    });
    assert.equal(JSON.parse((await cli("status")).stdout).status, "recording");
    for (const evidenceDir of [env.CLAWPERATOR_EVIDENCE_DIR, join(root, "other-state")]) {
      const competing = JSON.parse((await execute(process.execPath, [parent], { env: { ...env, CLAWPERATOR_EVIDENCE_DIR: evidenceDir, TMPDIR: root }, timeout: 8000 })).stdout);
      assert.equal(competing.code, "EVIDENCE_RECORDING_ACTIVE");
    }
    const changedEnv = { ...env, CLAWPERATOR_EVIDENCE_DIR: "" };
    const changedStatus = await execute(process.execPath, ["dist/cli/index.js", "evidence", "video", "status", "--session", manifestPath!], { env: changedEnv });
    assert.equal(JSON.parse(changedStatus.stdout).status, "recording");
    const stopped = await Promise.all([cli("stop"), cli("stop")]);
    for (const result of stopped) {
      assert.equal(JSON.parse(result.stdout).status, deviceType === "unknown" ? "partial" : "complete");
      assert.equal(result.exitCode, deviceType === "unknown" ? 1 : 0);
    }
    const original = await fs.readFile(manifestPath!, "utf8");
    assert.equal(JSON.parse(original).device.deviceType, deviceType);
    assert.deepEqual(JSON.parse(original).device.deviceTypeProperties, { "ro.kernel.qemu": deviceType === "physical" ? null : deviceType === "emulator" ? "1" : "unexpected", "ro.boot.qemu": null });
    assert.equal(JSON.parse(original).errors.some((error: { component?: string }) => error.component === "deviceType"), deviceType === "unknown");
    assert.equal(JSON.parse(original).video.stopReason, "requested");
    assert.ok(JSON.parse(original).video.hostDurationMs < 19000, "Explicit stop must finish before the cap");
    assert.equal(JSON.parse((await cli("stop")).stdout).status, deviceType === "unknown" ? "partial" : "complete");
    assert.equal(await fs.readFile(manifestPath!, "utf8"), original);
    const state = JSON.parse(await fs.readFile(join(resolve(manifestPath!, ".."), "session.json"), "utf8"));
    await assert.rejects(fs.stat(state.lockPath));
    const independent = JSON.parse((await execute(process.execPath, [parent, secondDeviceId], { env, timeout: 8000 })).stdout);
    assert.equal(independent.status, "recording", JSON.stringify(independent));
    const firstDevice = JSON.parse((await execute(process.execPath, [parent], { env, timeout: 8000 })).stdout);
    assert.equal(firstDevice.status, "recording");
    for (const session of [independent, firstDevice]) {
      manifestPath = session.manifestPath;
      assert.equal(JSON.parse((await cli("stop")).stdout).status, deviceType === "unknown" ? "partial" : "complete");
    }
    const blockedRoot = join(root, "blocked");
    await fs.writeFile(blockedRoot, "preserve");
    for (const invalidRoot of ["", "  ", blockedRoot]) {
      const failed = JSON.parse((await execute(process.execPath, [parent], { env: { ...env, CLAWPERATOR_EVIDENCE_DIR: invalidRoot }, timeout: 8000 })).stdout);
      assert.equal(failed.code, invalidRoot === blockedRoot ? "EVIDENCE_STORAGE_UNWRITABLE" : "EXECUTION_VALIDATION_FAILED");
      if (invalidRoot === blockedRoot) { assert.equal(failed.path, blockedRoot); assert.ok(failed.recovery); }
    }
    const defaultEnv: NodeJS.ProcessEnv = { ...env, HOME: join(root, "default-home") };
    delete defaultEnv.CLAWPERATOR_EVIDENCE_DIR;
    const defaultStarted = JSON.parse((await execute(process.execPath, [parent], { env: defaultEnv, timeout: 8000 })).stdout);
    assert.equal(defaultStarted.status, "recording");
    assert.ok(defaultStarted.manifestPath.startsWith(join(root, "default-home", ".clawperator", "evidence", "bundles")));
    manifestPath = defaultStarted.manifestPath;
    assert.equal(JSON.parse((await cli("stop")).stdout).status, deviceType === "unknown" ? "partial" : "complete");
    for (const differentRoots of [false, true]) {
      const raced = await Promise.all([0, 1].map(index => execute(process.execPath, [parent], {
        env: { ...env, CLAWPERATOR_EVIDENCE_DIR: join(root, `race-${differentRoots}-${differentRoots ? index : 0}`) }, timeout: 8000,
      }).then(value => JSON.parse(value.stdout))));
      assert.equal(raced.filter(value => value.status === "recording").length, 1);
      assert.equal(raced.filter(value => value.code === "EVIDENCE_RECORDING_ACTIVE").length, 1);
      manifestPath = raced.find(value => value.status === "recording").manifestPath;
      assert.equal(JSON.parse((await cli("stop")).stdout).status, deviceType === "unknown" ? "partial" : "complete");
    }
    const doomed = JSON.parse((await execute(process.execPath, [parent], { env, timeout: 8000 })).stdout);
    assert.equal(doomed.status, "recording");
    manifestPath = doomed.manifestPath;
    const doomedState = await readState(resolve(manifestPath!, ".."));
    const recorder = JSON.parse(await fs.readFile(join(root, `recorder-${deviceId}.json`), "utf8"));
    assert.equal(recorder.remote, doomedState.remotePath, "Only terminate processes created by this fixture");
    assert.ok(doomedState.hostPid && doomedState.hostStartedAt);
    try {
      process.kill(doomedState.hostPid!, "SIGKILL");
      const retained = await fs.readFile(manifestPath!, "utf8");
      await new Promise(resolve => setTimeout(resolve, 5500));
      const unavailable = await cli("status").catch(error => error);
      assert.equal(JSON.parse(unavailable.stdout).code, "EVIDENCE_RECOVERY_REQUIRED");
      const blocked = JSON.parse((await execute(process.execPath, [parent], {
        env: { ...env, CLAWPERATOR_EVIDENCE_DIR: join(root, "after-worker-death") }, timeout: 8000,
      })).stdout);
      assert.equal(blocked.code, "EVIDENCE_RECORDING_ACTIVE");
      assert.equal(await fs.readFile(manifestPath!, "utf8"), retained);
      await fs.stat(doomedState.lockPath);
    } finally {
      // The fixture's fake recorder is a local process; production never signals saved host PIDs.
      process.kill(recorder.pid, "SIGKILL");
      await releaseLock(doomedState);
    }
  } finally {
    if (manifestPath) {
      const state = JSON.parse(await fs.readFile(join(resolve(manifestPath, ".."), "session.json"), "utf8"));
      await fs.writeFile(join(state.outputDir, "stop.json"), JSON.stringify({ nonce: state.nonce }));
    }
    await fs.rm(root, { recursive: true, force: true });
  }
});

}
