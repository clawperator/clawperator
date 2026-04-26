import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getDaemonPostTimeoutMs, tryDaemonExecution, type DaemonHttpFailure, type DaemonHttpSuccess } from "../../../cli/daemonProxy.js";
import { formatRunExecutionResultForCli } from "../../../cli/output.js";
import { getDaemonSocketPath } from "../../../domain/daemon/lifecycle.js";
import { DEFAULT_OPERATOR_PACKAGE } from "../../../domain/config/resolveOperatorPackage.js";
import { getCliVersion } from "../../../domain/version/compatibility.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import type { RunExecutionResult } from "../../../domain/executions/runExecution.js";

const tempDirs: string[] = [];
let originalNoDaemon: string | undefined;
let originalOperatorPackage: string | undefined;

const execution = {
  commandId: "daemon-proxy-test",
  taskId: "daemon-proxy-test",
  source: "test",
  expectedFormat: "android-ui-automator",
  timeoutMs: 30000,
  actions: [{ id: "snap", type: "snapshot_ui" }],
};

const successResult: RunExecutionResult = {
  ok: true,
  deviceId: "device-1",
  terminalSource: "clawperator_result",
  envelope: {
    commandId: "daemon-proxy-test",
    taskId: "daemon-proxy-test",
    status: "success",
    stepResults: [],
    error: null,
  },
};

async function makeBaseDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clawperator-daemon-proxy-test-"));
  tempDirs.push(dir);
  return dir;
}

function makeAliveGet(version = getCliVersion()): (socketPath: string, path: string) => Promise<string> {
  return async (_socketPath, path) => {
    if (path === "/ping") return JSON.stringify({ ok: true });
    if (path === "/version") return JSON.stringify({ version });
    throw new Error(`unexpected path ${path}`);
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  if (originalNoDaemon === undefined) {
    delete process.env.CLAWPERATOR_NO_DAEMON;
  } else {
    process.env.CLAWPERATOR_NO_DAEMON = originalNoDaemon;
  }
  if (originalOperatorPackage === undefined) {
    delete process.env.CLAWPERATOR_OPERATOR_PACKAGE;
  } else {
    process.env.CLAWPERATOR_OPERATOR_PACKAGE = originalOperatorPackage;
  }
});

describe("tryDaemonExecution", () => {
  it("derives POST timeout from execution timeout plus buffer", () => {
    assert.equal(getDaemonPostTimeoutMs({ execution: { timeoutMs: 30000 } }), 35000);
    assert.equal(getDaemonPostTimeoutMs({ execution: { timeoutMs: 12000 } }), 17000);
    assert.equal(getDaemonPostTimeoutMs({ execution: { timeoutMs: "30000" } }), 35000);
  });

  it("returns null when CLAWPERATOR_NO_DAEMON=1 is set", async () => {
    originalNoDaemon = process.env.CLAWPERATOR_NO_DAEMON;
    process.env.CLAWPERATOR_NO_DAEMON = "1";

    const result = await tryDaemonExecution(execution, {}, {
      httpPostFn: async () => {
        throw new Error("should not post");
      },
    });

    assert.equal(result, null);
  });

  it("returns null when noDaemon is passed", async () => {
    const result = await tryDaemonExecution(execution, { noDaemon: true }, {
      httpPostFn: async () => {
        throw new Error("should not post");
      },
    });

    assert.equal(result, null);
  });

  it("returns null when auto-start times out", async () => {
    const baseDir = await makeBaseDir();
    let spawned = false;

    const result = await tryDaemonExecution(execution, { baseDir, startTimeoutMs: 1, pollIntervalMs: 1 }, {
      httpGetFn: async () => {
        const error = new Error("missing socket") as NodeJS.ErrnoException;
        error.code = "ENOENT";
        throw error;
      },
      spawnDaemonRunFn: () => {
        spawned = true;
      },
      isDaemonAliveFn: async () => false,
    });

    assert.equal(spawned, true);
    assert.equal(result, null);
  });

  it("returns a daemon result when version matches", async () => {
    let postedBody: unknown;

    const result = await tryDaemonExecution(execution, { rawDeviceId: "device-1" }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async (_socketPath, _path, body): Promise<DaemonHttpSuccess> => {
        postedBody = body;
        return { ok: true, body: JSON.stringify(successResult) };
      },
    });

    assert.deepEqual(result, successResult);
    assert.deepEqual(postedBody, {
      execution,
      deviceId: "device-1",
      operatorPackage: DEFAULT_OPERATOR_PACKAGE,
    });
  });

  it("stops and restarts when daemon version mismatches", async () => {
    const versions = ["0.0.0", getCliVersion(), getCliVersion()];
    let stopped = false;
    let spawned = false;

    const result = await tryDaemonExecution(execution, { startTimeoutMs: 5, pollIntervalMs: 1 }, {
      httpGetFn: async (_socketPath, path) => {
        if (path === "/ping") return JSON.stringify({ ok: true });
        return JSON.stringify({ version: versions.shift() ?? getCliVersion() });
      },
      stopDaemonFn: async () => {
        stopped = true;
        return "stopped";
      },
      spawnDaemonRunFn: () => {
        spawned = true;
      },
      httpPostFn: async (): Promise<DaemonHttpSuccess> => ({ ok: true, body: JSON.stringify(successResult) }),
    });

    assert.equal(stopped, true);
    assert.equal(spawned, true);
    assert.deepEqual(result, successResult);
  });

  it("deletes a stale socket and restarts on ECONNREFUSED", async () => {
    const baseDir = await makeBaseDir();
    const socketPath = getDaemonSocketPath("stale", { baseDir });
    await writeFile(socketPath, "", "utf8");
    let firstPing = true;
    let spawned = false;

    const result = await tryDaemonExecution(execution, { rawDeviceId: "stale", baseDir, startTimeoutMs: 5, pollIntervalMs: 1 }, {
      httpGetFn: async (_socketPath, path) => {
        if (firstPing && path === "/ping") {
          firstPing = false;
          const error = new Error("refused") as NodeJS.ErrnoException;
          error.code = "ECONNREFUSED";
          throw error;
        }
        if (path === "/ping") return JSON.stringify({ ok: true });
        return JSON.stringify({ version: getCliVersion() });
      },
      spawnDaemonRunFn: () => {
        spawned = true;
      },
      httpPostFn: async (): Promise<DaemonHttpSuccess> => ({ ok: true, body: JSON.stringify(successResult) }),
    });

    await assert.rejects(stat(socketPath));
    assert.equal(spawned, true);
    assert.deepEqual(result, successResult);
  });

  it("passes effective operator package using explicit, env, blank env, and default precedence", async () => {
    originalOperatorPackage = process.env.CLAWPERATOR_OPERATOR_PACKAGE;
    const bodies: unknown[] = [];
    const deps = {
      httpGetFn: makeAliveGet(),
      httpPostFn: async (_socketPath: string, _path: string, body: unknown): Promise<DaemonHttpSuccess> => {
        bodies.push(body);
        return { ok: true, body: JSON.stringify(successResult) };
      },
    };

    process.env.CLAWPERATOR_OPERATOR_PACKAGE = "env.package";
    await tryDaemonExecution(execution, { operatorPackage: "explicit.package" }, deps);
    await tryDaemonExecution(execution, {}, deps);
    process.env.CLAWPERATOR_OPERATOR_PACKAGE = " ";
    await tryDaemonExecution(execution, {}, deps);
    delete process.env.CLAWPERATOR_OPERATOR_PACKAGE;
    await tryDaemonExecution(execution, {}, deps);

    assert.deepEqual(bodies.map((body) => (body as { operatorPackage: string }).operatorPackage), [
      "explicit.package",
      "env.package",
      DEFAULT_OPERATOR_PACKAGE,
      DEFAULT_OPERATOR_PACKAGE,
    ]);
  });

  it("allows idempotent post-dispatch fallback", async () => {
    const failure: DaemonHttpFailure = { ok: false, dispatched: true, error: new Error("lost") };
    const result = await tryDaemonExecution(execution, { allowPostDispatchFallback: true }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async () => failure,
    });

    assert.equal(result, null);
  });

  it("allows idempotent fallback when the daemon response body is malformed", async () => {
    const result = await tryDaemonExecution(execution, { allowPostDispatchFallback: true }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async (): Promise<DaemonHttpSuccess> => ({ ok: true, body: "{" }),
    });

    assert.equal(result, null);
  });

  it("returns DAEMON_PROXY_ERROR for non-idempotent post-dispatch loss", async () => {
    const failure: DaemonHttpFailure = { ok: false, dispatched: true, error: new Error("lost") };
    const result = await tryDaemonExecution(execution, { allowPostDispatchFallback: false }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async () => failure,
    });

    assert.equal(result?.ok, false);
    if (result?.ok === false) {
      assert.equal(result.error.code, ERROR_CODES.DAEMON_PROXY_ERROR);
    }
  });

  it("returns DAEMON_PROXY_ERROR for non-idempotent malformed daemon responses", async () => {
    const result = await tryDaemonExecution(execution, { allowPostDispatchFallback: false }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async (): Promise<DaemonHttpSuccess> => ({ ok: true, body: "{" }),
    });

    assert.equal(result?.ok, false);
    if (result?.ok === false) {
      assert.equal(result.error.code, ERROR_CODES.DAEMON_PROXY_ERROR);
    }
  });

  it("falls back direct on a POST failure before dispatch", async () => {
    const failure: DaemonHttpFailure = { ok: false, dispatched: false, error: new Error("connect ECONNREFUSED") };
    const result = await tryDaemonExecution(execution, { allowPostDispatchFallback: false }, {
      httpGetFn: makeAliveGet(),
      httpPostFn: async () => failure,
    });

    assert.equal(result, null);
  });

  it("lets concurrent auto-start callers both receive results", async () => {
    let spawnCount = 0;
    let alive = false;
    const deps = {
      httpGetFn: async (_socketPath: string, path: string) => {
        if (path === "/ping" && !alive) {
          const error = new Error("missing") as NodeJS.ErrnoException;
          error.code = "ENOENT";
          throw error;
        }
        if (path === "/ping") return JSON.stringify({ ok: true });
        return JSON.stringify({ version: getCliVersion() });
      },
      spawnDaemonRunFn: () => {
        spawnCount += 1;
        alive = true;
      },
      httpPostFn: async (): Promise<DaemonHttpSuccess> => ({ ok: true, body: JSON.stringify(successResult) }),
    };

    const [first, second] = await Promise.all([
      tryDaemonExecution(execution, { startTimeoutMs: 10, pollIntervalMs: 1 }, deps),
      tryDaemonExecution(execution, { startTimeoutMs: 10, pollIntervalMs: 1 }, deps),
    ]);

    assert.equal(spawnCount, 2);
    assert.deepEqual(first, successResult);
    assert.deepEqual(second, successResult);
  });

  it("formats proxied and direct results identically for the same fixture", () => {
    assert.equal(
      formatRunExecutionResultForCli(successResult, { format: "json" }),
      formatRunExecutionResultForCli(successResult, { format: "json" }),
    );
  });
});
