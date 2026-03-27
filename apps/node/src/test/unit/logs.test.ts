import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

describe("logs command path resolution", () => {
  let tempRoot: string;
  let originalStderrWrite: typeof process.stderr.write;
  let originalStdoutWrite: typeof process.stdout.write;
  let stderrOutput: string[];
  let stdoutOutput: string[];

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-logs-test-"));
    stderrOutput = [];
    stdoutOutput = [];
    originalStderrWrite = process.stderr.write.bind(process.stderr);
    originalStdoutWrite = process.stdout.write.bind(process.stdout);
  });

  afterEach(async () => {
    process.stderr.write = originalStderrWrite;
    process.stdout.write = originalStdoutWrite;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("writes message to stderr when log file does not exist", async () => {
    // Mock stderr
    process.stderr.write = (chunk: string | Buffer) => {
      stderrOutput.push(chunk.toString());
      return true;
    };

    const nonExistentDir = join(tempRoot, "nonexistent");
    const { cmdLogs } = await import("../../cli/commands/logs.js");
    await cmdLogs({ logDir: nonExistentDir });

    const stderr = stderrOutput.join("");
    assert.ok(stderr.includes("No log file found at"), `Expected "No log file found" in stderr, got: ${stderr}`);
    assert.ok(stderr.includes(nonExistentDir), `Expected path in stderr, got: ${stderr}`);
  });

  it("dumps existing log content to stdout", async () => {
    // Mock stdout and stderr
    process.stdout.write = (chunk: string | Buffer) => {
      stdoutOutput.push(chunk.toString());
      return true;
    };
    process.stderr.write = () => true;

    const logDir = join(tempRoot, "logs");
    const today = new Date();
    const year = String(today.getFullYear());
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const dateStr = `${year}-${month}-${day}`;
    const logPath = join(logDir, `clawperator-${dateStr}.log`);

    // Create log directory and write some content
    await mkdir(logDir, { recursive: true });
    const logLines = [
      '{"ts":"2026-03-28T00:00:00Z","level":"info","event":"test.start","message":"Test started"}',
      '{"ts":"2026-03-28T00:00:01Z","level":"info","event":"test.end","message":"Test ended"}',
    ].join("\n") + "\n";
    await writeFile(logPath, logLines);

    // Verify file exists
    assert.ok(existsSync(logPath), "Log file should exist");

    const { cmdLogs } = await import("../../cli/commands/logs.js");

    // Start logs command - it will stream until we stop it
    const logsPromise = cmdLogs({ logDir });

    // Wait a bit for the dump to complete
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Trigger SIGINT to stop streaming
    process.emit("SIGINT" as any);

    // Wait for the command to finish with timeout
    await Promise.race([logsPromise, new Promise((resolve) => setTimeout(resolve, 500))]);

    const stdout = stdoutOutput.join("");
    assert.ok(stdout.includes('"event":"test.start"'), `Expected test.start event in stdout, got: ${stdout}`);
    assert.ok(stdout.includes('"event":"test.end"'), `Expected test.end event in stdout, got: ${stdout}`);
  });

  it("uses CLAWPERATOR_LOG_DIR environment variable", async () => {
    // Mock stderr
    process.stderr.write = (chunk: string | Buffer) => {
      stderrOutput.push(chunk.toString());
      return true;
    };

    const envLogDir = join(tempRoot, "env-logs");
    const originalEnv = process.env.CLAWPERATOR_LOG_DIR;
    process.env.CLAWPERATOR_LOG_DIR = envLogDir;

    try {
      const { cmdLogs } = await import("../../cli/commands/logs.js");
      await cmdLogs({});
      const stderr = stderrOutput.join("");
      assert.ok(stderr.includes("No log file found at"), `Expected "No log file found" in stderr, got: ${stderr}`);
      assert.ok(stderr.includes(envLogDir), `Expected envLogDir in stderr, got: ${stderr}`);
    } finally {
      if (originalEnv) {
        process.env.CLAWPERATOR_LOG_DIR = originalEnv;
      } else {
        delete process.env.CLAWPERATOR_LOG_DIR;
      }
    }
  });
});

describe("logs command log path format", () => {
  it("matches the expected daily filename format", () => {
    const today = new Date();
    const year = String(today.getFullYear());
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const expectedDate = `${year}-${month}-${day}`;
    const expectedFilename = `clawperator-${expectedDate}.log`;

    // The log file should be named clawperator-YYYY-MM-DD.log
    assert.ok(/clawperator-\d{4}-\d{2}-\d{2}\.log/.test(expectedFilename));
  });
});
