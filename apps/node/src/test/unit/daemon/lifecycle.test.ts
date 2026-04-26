import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  getDaemonLogPath,
  getDaemonPidPath,
  getDaemonSocketPath,
  isDaemonRunning,
  sanitizeDaemonKey,
  stopDaemon,
  type DaemonPathsOptions,
} from "../../../domain/daemon/lifecycle.js";
import {
  cmdDaemonStart,
  cmdDaemonStatus,
  cmdDaemonStop,
} from "../../../cli/commands/daemon.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { shouldCliStdoutForceExitCode1 } from "../../../cli/stdoutExitCode.js";

const tempDirs: string[] = [];

async function makeTempBaseDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clawperator-daemon-test-"));
  tempDirs.push(dir);
  return dir;
}

async function writePidMetadata(baseDir: string, pid: number, startedAt = Date.now()): Promise<void> {
  await writeFile(getDaemonPidPath(undefined, { baseDir }), `${JSON.stringify({ pid, startedAt })}\n`, "utf8");
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("daemon lifecycle paths", () => {
  it("sanitizes TCP adb serials", () => {
    assert.equal(sanitizeDaemonKey("192.168.1.1:5555"), "192.168.1.1-5555");
  });

  it("uses default for empty or omitted device ids", () => {
    assert.equal(sanitizeDaemonKey(""), "default");
    assert.equal(sanitizeDaemonKey(undefined), "default");
  });

  it("builds socket, PID, and log paths from the sanitized key", async () => {
    const baseDir = await makeTempBaseDir();

    assert.equal(getDaemonSocketPath("192.168.1.1:5555", { baseDir }), join(baseDir, "daemon-192.168.1.1-5555.sock"));
    assert.equal(getDaemonPidPath("192.168.1.1:5555", { baseDir }), join(baseDir, "daemon-192.168.1.1-5555.pid"));
    assert.equal(getDaemonLogPath("192.168.1.1:5555", { baseDir }), join(baseDir, "daemon-192.168.1.1-5555.log"));
  });
});

describe("daemon process state", () => {
  it("reports not running when the PID file does not exist", async () => {
    const baseDir = await makeTempBaseDir();

    assert.equal(await isDaemonRunning(undefined, { baseDir }), false);
  });

  it("reports not running when the PID file exists but the process is not alive", async () => {
    const baseDir = await makeTempBaseDir();
    await writePidMetadata(baseDir, 12345);

    const options: DaemonPathsOptions = {
      baseDir,
      processController: {
        isAlive: () => false,
        kill: () => undefined,
      },
    };

    assert.equal(await isDaemonRunning(undefined, options), false);
  });

  it("stopDaemon returns not_running when the PID file does not exist", async () => {
    const baseDir = await makeTempBaseDir();

    assert.equal(await stopDaemon(undefined, { baseDir }), "not_running");
  });

  it("stopDaemon sends SIGTERM and removes PID and socket files", async () => {
    const baseDir = await makeTempBaseDir();
    await writePidMetadata(baseDir, 9876);
    await writeFile(getDaemonSocketPath(undefined, { baseDir }), "", "utf8");
    let alive = true;
    let signal: NodeJS.Signals | undefined;
    const options: DaemonPathsOptions = {
      baseDir,
      terminationTimeoutMs: 20,
      terminationPollIntervalMs: 1,
      processController: {
        isAlive: () => alive,
        kill: (_pid, sentSignal) => {
          signal = sentSignal;
          alive = false;
        },
      },
    };

    assert.equal(await stopDaemon(undefined, options), "stopped");
    assert.equal(signal, "SIGTERM");
    assert.equal(await isDaemonRunning(undefined, options), false);
  });
});

describe("daemon command output", () => {
  it("returns valid JSON for status in default mode", async () => {
    const baseDir = await makeTempBaseDir();
    const raw = await cmdDaemonStatus({ format: "json", baseDir });
    const parsed = JSON.parse(raw) as { ok?: boolean; daemon?: { status?: string } };

    assert.equal(parsed.ok, true);
    assert.equal(parsed.daemon?.status, "not_running");
  });

  it("start timeout returns DAEMON_START_FAILED and forces exit code 1", async () => {
    const baseDir = await makeTempBaseDir();
    const raw = await cmdDaemonStart({
      format: "json",
      baseDir,
      pollTimeoutMs: 1,
      pollIntervalMs: 1,
      spawnDaemonRunImpl: () => undefined,
    });
    const parsed = JSON.parse(raw) as { code?: string };

    assert.equal(parsed.code, ERROR_CODES.DAEMON_START_FAILED);
    assert.equal(shouldCliStdoutForceExitCode1(raw, false), true);
  });

  it("removes a stale socket before spawning daemon run", async () => {
    const baseDir = await makeTempBaseDir();
    const socketPath = getDaemonSocketPath(undefined, { baseDir });
    await writeFile(socketPath, "", "utf8");
    let socketExistedAtSpawn = true;

    const raw = await cmdDaemonStart({
      format: "json",
      baseDir,
      pollTimeoutMs: 1,
      pollIntervalMs: 1,
      spawnDaemonRunImpl: () => {
        socketExistedAtSpawn = existsSync(socketPath);
      },
    });
    const parsed = JSON.parse(raw) as { code?: string };

    assert.equal(socketExistedAtSpawn, false);
    assert.equal(parsed.code, ERROR_CODES.DAEMON_START_FAILED);
  });

  it("stop failures return DAEMON_STOP_FAILED and force exit code 1", async () => {
    const baseDir = await makeTempBaseDir();
    await writePidMetadata(baseDir, 12345);
    const raw = await cmdDaemonStop({
      format: "json",
      baseDir,
      processController: {
        isAlive: () => true,
        kill: () => {
          throw new Error("cannot signal");
        },
      },
    });
    const parsed = JSON.parse(raw) as { code?: string };

    assert.equal(parsed.code, ERROR_CODES.DAEMON_STOP_FAILED);
    assert.equal(shouldCliStdoutForceExitCode1(raw, false), true);
  });
});
