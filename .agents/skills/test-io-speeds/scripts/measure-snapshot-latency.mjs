import http from "node:http";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { performance } from "node:perf_hooks";

const repo = process.cwd();
const defaultApps = [
  { id: "settings", name: "Android Settings", packageName: "com.android.settings" },
  { id: "youtube", name: "YouTube", packageName: "com.google.android.youtube" },
  { id: "play-store", name: "Google Play Store", packageName: "com.android.vending" },
];

function parseArgs(argv) {
  const options = {
    device: process.env.CLAWPERATOR_MEASURE_DEVICE ?? "emulator-5554",
    outDir: process.env.CLAWPERATOR_MEASURE_OUT_DIR ?? `tasks/node/io-optimizations/${new Date().toISOString().slice(0, 10)}-timing-artifacts`,
    cli: process.env.CLAWPERATOR_MEASURE_CLI ?? "apps/node/dist/cli/index.js",
    operatorPackage: process.env.CLAWPERATOR_MEASURE_OPERATOR_PACKAGE ?? "com.clawperator.operator",
    warmups: Number(process.env.CLAWPERATOR_MEASURE_WARMUPS ?? 3),
    measured: Number(process.env.CLAWPERATOR_MEASURE_CALLS ?? 10),
    apps: defaultApps,
    keepRawLogs: process.env.CLAWPERATOR_MEASURE_KEEP_RAW_LOGS === "1",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const readValue = () => {
      i += 1;
      if (i >= argv.length || argv[i].startsWith("--")) {
        throw new Error(`Missing value for ${arg}`);
      }
      return argv[i];
    };
    if (arg === "--device") options.device = readValue();
    else if (arg === "--out-dir") options.outDir = readValue();
    else if (arg === "--cli") options.cli = readValue();
    else if (arg === "--operator-package") options.operatorPackage = readValue();
    else if (arg === "--warmups") options.warmups = Number(readValue());
    else if (arg === "--measured") options.measured = Number(readValue());
    else if (arg === "--apps-json") options.apps = JSON.parse(readValue());
    else if (arg === "--apps-file") options.apps = JSON.parse(readFileSync(readValue(), "utf8"));
    else if (arg === "--keep-raw-logs") options.keepRawLogs = true;
    else if (arg === "--help") {
      console.log(`Usage: node .agents/skills/test-io-speeds/scripts/measure-snapshot-latency.mjs [options]

Options:
  --device <serial>              adb device serial
  --operator-package <package>   Operator package, default com.clawperator.operator
  --cli <path>                   branch-local CLI path, default apps/node/dist/cli/index.js
  --out-dir <path>               output directory
  --warmups <n>                  warmup calls per app, default 3
  --measured <n>                 measured calls per app, default 10
  --apps-file <path>             JSON array of app specs
  --apps-json <json>             JSON array of app specs
  --keep-raw-logs                keep logcat and host logs in output

App spec shape:
  {"id":"play-store","name":"Google Play Store","packageName":"com.android.vending"}`);
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.warmups) || options.warmups < 0) throw new Error("--warmups must be a non-negative integer");
  if (!Number.isInteger(options.measured) || options.measured < 1) throw new Error("--measured must be a positive integer");
  for (const app of options.apps) {
    for (const key of ["id", "name", "packageName"]) {
      if (typeof app[key] !== "string" || app[key].trim() === "") {
        throw new Error(`Each app spec must include nonblank ${key}`);
      }
    }
  }
  return {
    ...options,
    outDir: isAbsolute(options.outDir) ? options.outDir : join(repo, options.outDir),
    cli: isAbsolute(options.cli) ? options.cli : join(repo, options.cli),
  };
}

const { device, outDir, cli, operatorPackage, warmups, measured, apps, keepRawLogs } = parseArgs(process.argv.slice(2));

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    cwd: repo,
    encoding: "utf8",
    env: { ...process.env, ...(options.env ?? {}) },
    maxBuffer: 100 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  }
  return result.stdout;
}

function adb(args) {
  return run("adb", ["-s", device, ...args]);
}

function openApp(app, logDir) {
  const stdout = run("node", [
    cli,
    "open",
    "--app", app.packageName,
    "--device", device,
    "--operator-package", operatorPackage,
    "--navigation-timeout-ms", "15000",
    "--format", "json",
  ], {
    env: {
      CLAWPERATOR_LOG_DIR: logDir,
      CLAWPERATOR_LOG_LEVEL: "debug",
    },
  });
  const parsed = JSON.parse(stdout);
  const status = parsed.envelope?.status;
  if (status !== "success") {
    throw new Error(`open app failed for ${app.packageName}: ${stdout.slice(0, 1000)}`);
  }
  return parsed;
}

function snapshot(logDir) {
  let stdout = "";
  let wallMs = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const start = performance.now();
    try {
      stdout = run("node", [
        cli,
        "snapshot",
        "--device", device,
        "--operator-package", operatorPackage,
        "--timeout", "30000",
        "--format", "json",
      ], {
        env: {
          CLAWPERATOR_LOG_DIR: logDir,
          CLAWPERATOR_LOG_LEVEL: "debug",
        },
      });
      wallMs = performance.now() - start;
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  const parsed = JSON.parse(stdout);
  const step = parsed.envelope?.stepResults?.[0];
  const text = step?.data?.text;
  if (parsed.envelope?.status !== "success" || typeof text !== "string" || text.length === 0) {
    throw new Error(`invalid snapshot result: ${stdout.slice(0, 1000)}`);
  }
  return {
    commandId: parsed.envelope.commandId,
    wallMs,
    payloadChars: text.length,
    payloadBytes: Buffer.byteLength(text, "utf8"),
    foregroundPackage: step.data.foreground_package,
    windowCount: step.data.window_count,
    nodeCount: (text.match(/<node /g) ?? []).length,
    rawOutputBytes: Buffer.byteLength(stdout, "utf8"),
  };
}

function daemonPost(socketPath, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      method: "POST",
      socketPath,
      path: "/execute",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
      timeout: 35000,
    }, (res) => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
    req.on("timeout", () => req.destroy(new Error("daemon POST timed out")));
    req.on("error", reject);
    req.end(payload);
  });
}

async function directDaemonSnapshot(socketPath, appId, index) {
  const commandId = `direct-${appId}-${Date.now()}-${index}`;
  const execution = {
    commandId,
    taskId: commandId,
    source: "direct-daemon-measure",
    expectedFormat: "android-ui-automator",
    mode: "direct",
    timeoutMs: 30000,
    actions: [{ id: "snap", type: "snapshot" }],
  };
  let raw = "";
  let wallMs = 0;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const start = performance.now();
    try {
      raw = await daemonPost(socketPath, { execution, deviceId: device, operatorPackage });
      wallMs = performance.now() - start;
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  const parsed = JSON.parse(raw);
  const step = parsed.envelope?.stepResults?.[0];
  const text = step?.data?.text;
  if (!parsed.ok || typeof text !== "string" || text.length === 0) {
    throw new Error(`invalid direct daemon snapshot result: ${raw.slice(0, 1000)}`);
  }
  return {
    commandId,
    wallMs,
    payloadBytes: Buffer.byteLength(text, "utf8"),
    foregroundPackage: step.data.foreground_package,
    nodeCount: (text.match(/<node /g) ?? []).length,
  };
}

function parseLogcatTimeMs(line) {
  const match = line.match(/^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!match) return undefined;
  const [, month, day, hh, mm, ss, ms] = match;
  return Date.UTC(new Date().getUTCFullYear(), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss), Number(ms));
}

function parseHostLogs(logDir, commandId) {
  const events = {};
  if (!existsSync(logDir)) return events;
  const files = readdirSync(logDir).filter(file => /^clawperator-\d{4}-\d{2}-\d{2}\.log$/.test(file));
  for (const file of files) {
    for (const line of readFileSync(join(logDir, file), "utf8").trim().split("\n")) {
      if (!line.includes(commandId)) continue;
      const event = JSON.parse(line);
      if (event.event && events[event.event] === undefined) {
        events[event.event] = Date.parse(event.ts);
      }
    }
  }
  return events;
}

function parseLogcat(logcat, commandId) {
  const lines = logcat.split("\n").filter(line => line.includes(commandId));
  const findTime = (needle) => parseLogcatTimeMs(lines.find(line => line.includes(needle)) ?? "");
  const timingLine = lines.find(line => line.includes("[SnapshotTiming]"));
  const timing = {};
  if (timingLine) {
    for (const key of ["hierarchyBytes", "hierarchyBuildUs", "logCallUs", "metadataAndStatsUs", "operatorSnapshotUs"]) {
      const match = timingLine.match(new RegExp(`${key}=([0-9]+)`));
      if (match) timing[key] = Number(match[1]);
    }
  }
  const stageLine = lines.find(line => line.includes("stage-success") && line.includes("id=logUiTree"));
  const stageElapsedMatch = stageLine?.match(/elapsed_ms=([0-9]+)/);
  return {
    androidStartMs: findTime("[Clawperator-Command] start"),
    stageStartMs: findTime("stage-start"),
    hierarchyMarkerMs: findTime("[TaskScope] UI Hierarchy"),
    timingLogMs: parseLogcatTimeMs(timingLine ?? ""),
    stageSuccessMs: parseLogcatTimeMs(stageLine ?? ""),
    androidEnvelopeMs: findTime("[Clawperator-Result]"),
    stageElapsedMs: stageElapsedMatch ? Number(stageElapsedMatch[1]) : undefined,
    ...timing,
  };
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
  return { mean, median, min: sorted[0], max: sorted[sorted.length - 1], p95 };
}

mkdirSync(outDir, { recursive: true });

for (const app of apps) {
  const logDir = join(outDir, `${app.id}-host-logs`);
  rmSync(logDir, { recursive: true, force: true });
  mkdirSync(logDir, { recursive: true });

  run("node", [cli, "daemon", "stop", "--device", device, "--operator-package", operatorPackage, "--format", "json"], {
    env: { CLAWPERATOR_LOG_DIR: logDir, CLAWPERATOR_LOG_LEVEL: "debug" },
  });
  run("node", [cli, "daemon", "start", "--device", device, "--operator-package", operatorPackage, "--format", "json"], {
    env: { CLAWPERATOR_LOG_DIR: logDir, CLAWPERATOR_LOG_LEVEL: "debug" },
  });
  const daemonStatus = JSON.parse(run("node", [cli, "daemon", "status", "--device", device, "--operator-package", operatorPackage, "--format", "json"], {
    env: { CLAWPERATOR_LOG_DIR: logDir, CLAWPERATOR_LOG_LEVEL: "debug" },
  }));
  const socketPath = daemonStatus.daemon?.socketPath;
  if (typeof socketPath !== "string" || socketPath.length === 0) {
    throw new Error(`daemon status did not include socketPath: ${JSON.stringify(daemonStatus)}`);
  }

  openApp(app, logDir);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  const focusedBefore = adb(["shell", "dumpsys", "window"]).split("\n").filter(line => /mCurrentFocus|mFocusedApp/.test(line)).join("\n");

  const warmupResults = [];
  for (let i = 0; i < warmups; i += 1) {
    warmupResults.push(snapshot(logDir));
  }

  adb(["logcat", "-c"]);
  const calls = [];
  for (let i = 0; i < measured; i += 1) {
    calls.push(snapshot(logDir));
  }
  const logcat = adb(["logcat", "-d", "-v", "time"]);
  if (keepRawLogs) {
    writeFileSync(join(outDir, `${app.id}-logcat.txt`), logcat);
  }

  const enriched = calls.map((call) => {
    const host = parseHostLogs(logDir, call.commandId);
    const android = parseLogcat(logcat, call.commandId);
    return {
      ...call,
      host,
      android,
      hostBroadcastToEnvelopeMs: host["envelope.received"] && host["broadcast.dispatched"]
        ? host["envelope.received"] - host["broadcast.dispatched"]
        : undefined,
      androidCommandMs: android.androidEnvelopeMs && android.androidStartMs
        ? android.androidEnvelopeMs - android.androidStartMs
        : undefined,
      hostPostEnvelopeOverheadMs: host["envelope.received"]
        ? call.wallMs - (host["envelope.received"] - host["broadcast.dispatched"] ?? 0)
        : undefined,
    };
  });

  const result = {
    app,
    device,
    operatorPackage,
    focusedBefore,
    warmups: warmupResults,
    calls: enriched,
    stats: {
      wallMs: summarize(enriched.map(call => call.wallMs)),
      payloadBytes: summarize(enriched.map(call => call.payloadBytes)),
      hierarchyBuildUs: summarize(enriched.map(call => call.android.hierarchyBuildUs).filter(Number.isFinite)),
      operatorSnapshotUs: summarize(enriched.map(call => call.android.operatorSnapshotUs).filter(Number.isFinite)),
      hostBroadcastToEnvelopeMs: summarize(enriched.map(call => call.hostBroadcastToEnvelopeMs).filter(Number.isFinite)),
      androidCommandMs: summarize(enriched.map(call => call.androidCommandMs).filter(Number.isFinite)),
    },
  };
  writeFileSync(join(outDir, `${app.id}.json`), `${JSON.stringify(result, null, 2)}\n`);

  const directCalls = [];
  for (let i = 0; i < warmups + measured; i += 1) {
    const direct = await directDaemonSnapshot(socketPath, app.id, i);
    if (i >= warmups) {
      directCalls.push(direct);
    }
  }
  const directResult = {
    app,
    device,
    operatorPackage,
    calls: directCalls,
    stats: {
      wallMs: summarize(directCalls.map(call => call.wallMs)),
      payloadBytes: summarize(directCalls.map(call => call.payloadBytes)),
    },
  };
  writeFileSync(join(outDir, `${app.id}-direct-daemon.json`), `${JSON.stringify(directResult, null, 2)}\n`);
  if (!keepRawLogs) {
    rmSync(logDir, { recursive: true, force: true });
  }
  console.log(`${app.name}: mean=${result.stats.wallMs.mean.toFixed(1)}ms median=${result.stats.wallMs.median.toFixed(1)}ms`);
  console.log(`${app.name} direct daemon: mean=${directResult.stats.wallMs.mean.toFixed(1)}ms median=${directResult.stats.wallMs.median.toFixed(1)}ms`);
}
