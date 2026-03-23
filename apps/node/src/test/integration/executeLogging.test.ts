import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("CLI execute logging integration", () => {
  let tempRoot: string;
  let adbPath: string;
  let executionPath: string;

  before(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-exec-log-"));
    adbPath = join(tempRoot, "adb");
    executionPath = join(tempRoot, "execution.json");

    const commandId = "cmd-cli-log";
    const taskId = "task-cli-log";
    const envelopeLine = `[Clawperator-Result] ${JSON.stringify({
      commandId,
      taskId,
      status: "success",
      stepResults: [{ id: "a1", actionType: "enter_text", success: true, data: {} }],
      error: null,
    })}`;

    await writeFile(
      adbPath,
      [
        "#!/bin/sh",
        "if [ \"$1\" = \"-s\" ]; then",
        "  shift 2",
        "fi",
        "if [ \"$1\" = \"devices\" ]; then",
        "  printf 'List of devices attached\\ndevice-123\\tdevice\\n'",
        "  exit 0",
        "fi",
        "if [ \"$1\" = \"shell\" ] && [ \"$2\" = \"pm\" ] && [ \"$3\" = \"list\" ] && [ \"$4\" = \"packages\" ]; then",
        "  printf 'package:%s\\n' \"$5\"",
        "  exit 0",
        "fi",
        "if [ \"$1\" = \"logcat\" ] && [ \"$2\" = \"-c\" ]; then",
        "  exit 0",
        "fi",
        "if [ \"$1\" = \"logcat\" ]; then",
        "  sleep 0.4",
        `  printf '%s\\n' ${JSON.stringify(envelopeLine)}`,
        "  exit 0",
        "fi",
        "if [ \"$1\" = \"shell\" ]; then",
        "  exit 0",
        "fi",
        "exit 0",
      ].join("\n"),
      "utf8"
    );
    await chmod(adbPath, 0o755);

    await writeFile(
      executionPath,
      `${JSON.stringify({
        commandId,
        taskId,
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 1000,
        actions: [
          {
            id: "a1",
            type: "enter_text",
            params: {
              matcher: { textEquals: "input" },
              text: "CLAWPERATOR_TEST_SENTINEL_X9Z",
            },
          },
        ],
      }, null, 2)}\n`,
      "utf8"
    );
  });

  after(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("writes command lifecycle events to the daily NDJSON log", async () => {
    const logDir = join(tempRoot, "logs");
    const cliPath = join(packageRoot, "dist", "cli", "index.js");
    const proc = spawn(process.execPath, [
      cliPath,
      "execute",
      "--execution",
      executionPath,
      "--device-id",
      "device-123",
      "--operator-package",
      "com.test.operator.dev",
      "--output",
      "json",
    ], {
      cwd: packageRoot,
      env: {
        ...process.env,
        ADB_PATH: adbPath,
        CLAWPERATOR_LOG_DIR: logDir,
        CLAWPERATOR_LOG_LEVEL: "info",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    const code = await new Promise<number>((resolve) => {
      proc.on("close", (exitCode) => resolve(exitCode ?? -1));
    });

    assert.strictEqual(code, 0, stderr || stdout);
    const now = new Date();
    const logPath = join(
      logDir,
      `clawperator-${String(now.getFullYear())}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}.log`
    );
    const contents = await readFile(logPath, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string; commandId?: string; message?: string });
    const broadcastLine = lines.find(line => line.event === "broadcast.dispatched");
    const envelopeLine = lines.find(line => line.event === "envelope.received");

    assert.strictEqual(broadcastLine?.commandId, "cmd-cli-log");
    assert.strictEqual(envelopeLine?.commandId, "cmd-cli-log");
    assert.ok(contents.includes("broadcast.dispatched"));
    assert.ok(contents.includes("envelope.received"));
    assert.ok(!contents.includes("CLAWPERATOR_TEST_SENTINEL_X9Z"));
  });
});
