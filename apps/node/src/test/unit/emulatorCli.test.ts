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

describe("emulator CLI help and usage", () => {
  it("shows emulator help topic", async () => {
    const { stdout, code } = await runCli(["emulator", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator emulator/);
    assert.match(stdout, /emulator inspect <name>/);
    assert.match(stdout, /provision emulator/);
  });

  it("shows usage for missing inspect name", async () => {
    const { stdout, code } = await runCli(["emulator", "inspect"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /emulator inspect <name>/);
  });

  it("shows usage for missing provision target", async () => {
    const { stdout, code } = await runCli(["provision"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /provision emulator/);
  });
});
