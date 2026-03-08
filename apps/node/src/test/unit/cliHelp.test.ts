import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { join } from "node:path";

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(process.cwd(), "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe("CLI help", () => {
  it("shows observe snapshot help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["observe", "snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator observe snapshot/);
    assert.match(stdout, /--timeout-ms <number>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("shows skills sync help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "sync", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills sync/);
    assert.match(stdout, /--ref <git-ref>/);
    assert.doesNotMatch(stdout, /action open-app/);
  });

  it("shows inspect ui help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["inspect", "ui", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator observe snapshot/);
    assert.match(stdout, /--timeout-ms <number>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("forwards timeout parsing through inspect ui", async () => {
    const { stdout, code } = await runCli(["inspect", "ui", "--timeout-ms", "nope"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /EXECUTION_VALIDATION_FAILED/);
    assert.match(stdout, /timeoutMs must be a finite number/);
  });

  it("returns usage when timeout value is missing", async () => {
    const { stdout, code } = await runCli(["inspect", "ui", "--timeout-ms"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /--timeout-ms requires a value/);
  });
});
