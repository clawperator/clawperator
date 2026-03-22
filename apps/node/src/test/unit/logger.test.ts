import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createLogger } from "../../adapters/logger.js";

describe("createLogger", () => {
  let tempRoot: string;
  let stderrWrite: typeof process.stderr.write;
  const stderrLines: string[] = [];

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-logger-"));
    stderrWrite = process.stderr.write.bind(process.stderr);
    stderrLines.length = 0;
    process.stderr.write = ((chunk: unknown) => {
      stderrLines.push(String(chunk));
      return true;
    }) as typeof process.stderr.write;
  });

  afterEach(async () => {
    process.stderr.write = stderrWrite;
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("writes parseable NDJSON entries", async () => {
    const logDir = join(tempRoot, "logs");
    const logger = createLogger({ logDir, logLevel: "info" });

    logger.log({
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "test.event",
      commandId: "cmd-1",
      taskId: "task-1",
      deviceId: "device-1",
      message: "hello",
    });

    const path = logger.logPath();
    assert.ok(path);
    const contents = await readFile(path, "utf8");
    const lines = contents.trimEnd().split("\n");
    assert.strictEqual(lines.length, 1);
    assert.deepStrictEqual(JSON.parse(lines[0]), {
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "test.event",
      commandId: "cmd-1",
      taskId: "task-1",
      deviceId: "device-1",
      message: "hello",
    });
  });

  it("appends entries instead of overwriting the file", async () => {
    const logDir = join(tempRoot, "logs");
    const logger = createLogger({ logDir, logLevel: "info" });

    logger.log({
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "test.first",
      message: "first",
    });
    logger.log({
      ts: "2026-03-22T00:00:01.000Z",
      level: "warn",
      event: "test.second",
      message: "second",
    });

    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n");
    assert.strictEqual(lines.length, 2);
    assert.deepStrictEqual(JSON.parse(lines[0]), {
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "test.first",
      message: "first",
    });
    assert.deepStrictEqual(JSON.parse(lines[1]), {
      ts: "2026-03-22T00:00:01.000Z",
      level: "warn",
      event: "test.second",
      message: "second",
    });
  });

  it("creates the missing log directory on first write", async () => {
    const logDir = join(tempRoot, "nested", "logs", "deep");
    const logger = createLogger({ logDir, logLevel: "info" });

    logger.log({
      ts: "2026-03-22T00:00:00.000Z",
      level: "info",
      event: "test.mkdir",
      message: "mkdir",
    });

    const contents = await readFile(logger.logPath()!, "utf8");
    assert.match(contents, /test\.mkdir/);
  });

  it("warns once and fails open when log directory creation fails", async () => {
    const logDir = join(tempRoot, "blocked");
    await writeFile(logDir, "not a directory", "utf8");
    const logger = createLogger({ logDir, logLevel: "info" });

    assert.doesNotThrow(() => {
      logger.log({
        ts: "2026-03-22T00:00:00.000Z",
        level: "info",
        event: "test.fail-open",
        message: "blocked",
      });
      logger.log({
        ts: "2026-03-22T00:00:01.000Z",
        level: "info",
        event: "test.fail-open-2",
        message: "blocked again",
      });
    });

    assert.strictEqual(stderrLines.length, 1);
    assert.match(stderrLines[0], /logging disabled after write failure/);
  });
});
