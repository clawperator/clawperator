import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function runCli(
  args: string[],
  env?: NodeJS.ProcessEnv
): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(packageRoot, "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: packageRoot,
      env: { ...process.env, ...env },
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
  it("shows operator setup help for operator setup --help", async () => {
    const { stdout, code } = await runCli(["operator", "setup", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator operator setup/);
    assert.match(stdout, /--apk <path>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("shows operator setup help for operator --help", async () => {
    const { stdout, code } = await runCli(["operator", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator operator setup/);
    assert.match(stdout, /--apk <path>/);
  });

  it("shows operator setup guidance for setup --help", async () => {
    const { stdout, code } = await runCli(["setup", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator operator setup/);
    assert.match(stdout, /--apk <path>/);
  });

  it("shows operator setup guidance for install --help", async () => {
    const { stdout, code } = await runCli(["install", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator operator setup/);
    assert.match(stdout, /--apk <path>/);
  });

  it("shows operator setup help for operator install --help alias", async () => {
    const { stdout, code } = await runCli(["operator", "install", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator operator setup/);
    assert.match(stdout, /operator install remains a compatibility alias/);
  });

  it("falls back to top-level help for operator unknown --help", async () => {
    const { stdout, code } = await runCli(["operator", "unknown", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /Clawperator CLI/);
    assert.match(stdout, /Commands:/);
    assert.doesNotMatch(stdout, /^clawperator operator setup$/m);
  });

  it("returns structured guidance for bare clawperator install", async () => {
    // USAGE from switch cases exits 0 per CLI convention (not a runtime error).
    const { stdout } = await runCli(["install"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /clawperator operator setup/);
    assert.ok(obj.canonical);
    assert.match(obj.canonical, /operator setup/);
  });

  it("returns structured guidance for bare clawperator setup", async () => {
    const { stdout } = await runCli(["setup"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /clawperator operator setup/);
    assert.ok(obj.canonical);
    assert.match(obj.canonical, /operator setup/);
  });

  it("returns USAGE when operator setup is missing --apk", async () => {
    // USAGE from switch cases exits 0 per CLI convention (not a runtime error).
    const { stdout } = await runCli(["operator", "setup"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--apk/);
  });

  it("returns USAGE when operator install alias is missing --apk", async () => {
    const { stdout } = await runCli(["operator", "install"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--apk/);
  });

  it("returns USAGE for unknown operator subcommand", async () => {
    // USAGE from switch cases exits 0 per CLI convention (not a runtime error).
    const { stdout } = await runCli(["operator", "unknown"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /operator setup/);
  });

  it("shows observe snapshot help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["observe", "snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator observe snapshot/);
    assert.match(stdout, /--timeout-ms <number>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("shows observe screenshot help with path option", async () => {
    const { stdout, code } = await runCli(["observe", "screenshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator observe screenshot/);
    assert.match(stdout, /--path <file>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("shows validate-only in top-level execute help", async () => {
    const { stdout, code } = await runCli(["--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /execute --execution <json-or-file> \[--validate-only\]/);
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

  it("accepts --format as an alias for --output", async () => {
    const jsonResult = await runCli(["inspect", "ui", "--timeout-ms", "nope", "--format", "json"]);
    assert.notStrictEqual(jsonResult.code, 0);
    const json = JSON.parse(jsonResult.stdout);
    assert.strictEqual(json.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(json.message, "timeoutMs must be a finite number");

    const prettyResult = await runCli(["inspect", "ui", "--timeout-ms", "nope", "--format", "pretty"]);
    assert.notStrictEqual(prettyResult.code, 0);
    const pretty = JSON.parse(prettyResult.stdout);
    assert.strictEqual(pretty.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(pretty.message, "timeoutMs must be a finite number");
  });
});

describe("operator setup CLI output", () => {
  const NONEXISTENT_APK = "/nonexistent/clawperator-test-operator.apk";

  it("returns OPERATOR_APK_NOT_FOUND with exit code 1 when APK path does not exist", async () => {
    const { stdout, code } = await runCli(["operator", "setup", "--apk", NONEXISTENT_APK]);
    assert.notStrictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "OPERATOR_APK_NOT_FOUND");
    assert.ok(obj.message, "error message should be present");
  });

  it("includes install.ok: false in output on APK not found", async () => {
    const { stdout } = await runCli(["operator", "setup", "--apk", NONEXISTENT_APK]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.install?.ok, false);
  });

  it("passes --receiver-package through to output on failure", async () => {
    const { stdout } = await runCli([
      "operator", "setup",
      "--apk", NONEXISTENT_APK,
      "--receiver-package", "com.clawperator.operator.dev",
    ]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.receiverPackage, "com.clawperator.operator.dev");
  });

  it("uses CLAWPERATOR_RECEIVER_PACKAGE on failure when --receiver-package is omitted", async () => {
    const { stdout } = await runCli(
      ["operator", "setup", "--apk", NONEXISTENT_APK],
      { CLAWPERATOR_RECEIVER_PACKAGE: "com.clawperator.operator.dev" }
    );
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.receiverPackage, "com.clawperator.operator.dev");
  });

  it("operator install alias still returns OPERATOR_APK_NOT_FOUND", async () => {
    const { stdout, code } = await runCli(["operator", "install", "--apk", NONEXISTENT_APK]);
    assert.notStrictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "OPERATOR_APK_NOT_FOUND");
  });

  it("--output pretty still produces parseable JSON on failure", async () => {
    const { stdout, code } = await runCli([
      "operator", "setup",
      "--apk", NONEXISTENT_APK,
      "--output", "pretty",
    ]);
    assert.notStrictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "OPERATOR_APK_NOT_FOUND");
  });
});
