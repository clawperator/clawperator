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

  it("legacy nested `observe snapshot --help` falls back to top-level help", async () => {
    // Nested observe is removed; --help with an unknown command falls back to top-level help.
    const { stdout, code } = await runCli(["observe", "snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /Clawperator CLI/);
    assert.match(stdout, /Commands:/);
  });

  it("legacy nested `observe screenshot --help` falls back to top-level help", async () => {
    // Nested observe is removed; --help with an unknown command falls back to top-level help.
    const { stdout, code } = await runCli(["observe", "screenshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /Clawperator CLI/);
    assert.match(stdout, /Commands:/);
  });

  it("shows validate-only in top-level exec help", async () => {
    const { stdout, code } = await runCli(["--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /exec <json-or-file> \[--validate-only\]/);
  });

  it("exec best-effort points at flat `snapshot`, not nested `observe snapshot` (exit 0)", async () => {
    const { stdout, code } = await runCli(["exec", "best-effort", "--goal", "test-goal"]);
    assert.strictEqual(code, 0, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string; goal?: string };
    assert.strictEqual(obj.code, "NOT_IMPLEMENTED");
    assert.strictEqual(obj.goal, "test-goal");
    assert.match(obj.message ?? "", /snapshot/);
    assert.doesNotMatch(obj.message ?? "", /observe snapshot/);
  });

  it("shows skills sync help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "sync", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills sync/);
    assert.match(stdout, /--ref <git-ref>/);
    assert.doesNotMatch(stdout, /action open-app/);
  });

  it("shows skills validate help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "validate", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills validate/);
    assert.match(stdout, /skills validate --all/);
    assert.match(stdout, /integrity check, not a live device test/i);
    assert.doesNotMatch(stdout, /action open-app/);
  });

  it("shows skills compile-artifact help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "compile-artifact", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills compile-artifact/);
    assert.match(stdout, /--artifact <name>/);
    assert.match(stdout, /--skill-id <id>/);
    assert.match(stdout, /--vars <json>/);
    assert.doesNotMatch(stdout, /action open-app/);
  });

  it("shows skills run help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "run", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills run/);
    assert.match(stdout, /--timeout <ms>/);
    assert.match(stdout, /--expect-contains <text>/);
    assert.match(stdout, /SKILL_OUTPUT_ASSERTION_FAILED/);
    assert.doesNotMatch(stdout, /action open-app/);
  });

  it("inspect ui --help falls back to top-level help", async () => {
    // inspect ui is removed; --help with an unknown command falls back to top-level help.
    const { stdout, code } = await runCli(["inspect", "ui", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /Clawperator CLI/);
    assert.match(stdout, /Commands:/);
  });

  it("forwards invalid timeout to EXECUTION_VALIDATION_FAILED", async () => {
    // skills run validates the effective timeout before attempting device dispatch.
    const { stdout, code } = await runCli(["skills", "run", "some-skill", "--timeout", "nope"]);
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
    // --format is a global alias for --output; validated via timeout error through skills run.
    const jsonResult = await runCli(["skills", "run", "some-skill", "--timeout", "nope", "--format", "json"]);
    assert.notStrictEqual(jsonResult.code, 0);
    const json = JSON.parse(jsonResult.stdout);
    assert.strictEqual(json.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(json.message, "timeoutMs must be a finite number");

    const prettyResult = await runCli(["skills", "run", "some-skill", "--timeout", "nope", "--format", "pretty"]);
    assert.notStrictEqual(prettyResult.code, 0);
    const pretty = JSON.parse(prettyResult.stdout);
    assert.strictEqual(pretty.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(pretty.message, "timeoutMs must be a finite number");
  });

  it("lists --json under Global options in top-level help", async () => {
    const { stdout, code } = await runCli(["--help"]);
    assert.strictEqual(code, 0);
    const globalIdx = stdout.indexOf("Global options:\n");
    assert.notStrictEqual(globalIdx, -1, "expected Global options section");
    const notesIdx = stdout.indexOf("\n\nNotes:", globalIdx);
    const globalBlock =
      notesIdx === -1 ? stdout.slice(globalIdx) : stdout.slice(globalIdx, notesIdx);
    assert.match(
      globalBlock,
      /\n  --json\s+/,
      "expected --json as an indented global option line",
    );
  });

  it("shows recording as canonical command in top-level help", async () => {
    const { stdout, code } = await runCli(["--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /recording start/);
    assert.match(stdout, /recording stop/);
    assert.match(stdout, /recording pull/);
    assert.match(stdout, /recording parse/);
    assert.match(stdout, /'record' is an alias/);
  });

  it("returns USAGE for bare recording command", async () => {
    const { stdout, code } = await runCli(["recording"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /recording start\|stop\|pull\|parse/);
    assert.match(obj.message, /'record' is an alias/);
  });

  it("returns USAGE for bare record alias", async () => {
    const { stdout, code } = await runCli(["record"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /recording start\|stop\|pull\|parse/);
    assert.match(obj.message, /'record' is an alias/);
  });

  it("returns USAGE for recording parse without --input", async () => {
    const { stdout, code } = await runCli(["recording", "parse"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--input/);
  });

  it("returns USAGE for record parse without --input", async () => {
    const { stdout, code } = await runCli(["record", "parse"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--input/);
  });

  it("returns USAGE when --out flag has no value for recording pull", async () => {
    const { stdout, code } = await runCli(["recording", "pull", "--out"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /--out requires a value/);
  });

  it("returns USAGE when --out flag has no value for record pull", async () => {
    const { stdout, code } = await runCli(["record", "pull", "--out"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /--out requires a value/);
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

  it("passes --operator-package through to output on failure", async () => {
    const { stdout } = await runCli([
      "operator", "setup",
      "--apk", NONEXISTENT_APK,
      "--operator-package", "com.clawperator.operator.dev",
    ]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.operatorPackage, "com.clawperator.operator.dev");
  });

  it("accepts --operator-package as alias for --operator-package", async () => {
    const { stdout } = await runCli([
      "operator", "setup",
      "--apk", NONEXISTENT_APK,
      "--operator-package", "com.clawperator.operator.dev",
    ]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.operatorPackage, "com.clawperator.operator.dev");
  });

  it("uses CLAWPERATOR_OPERATOR_PACKAGE env var when --operator-package is omitted", async () => {
    const { stdout } = await runCli(
      ["operator", "setup", "--apk", NONEXISTENT_APK],
      { CLAWPERATOR_OPERATOR_PACKAGE: "com.clawperator.operator.dev" }
    );
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.operatorPackage, "com.clawperator.operator.dev");
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

  it("nested `observe screenshot` returns UNKNOWN_COMMAND redirect to `screenshot`", async () => {
    // Nested observe is removed; any invocation (including with flags) gets the migration message.
    const { stdout, code } = await runCli(["observe", "screenshot", "--path"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.match(obj.message ?? "", /'observe screenshot' has been removed/);
    assert.strictEqual(obj.suggestion, "screenshot");
  });

  it("nested `action click` returns UNKNOWN_COMMAND redirect to `click`", async () => {
    const { stdout, code } = await runCli(["action", "click", "--selector"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.match(obj.message ?? "", /'action click' has been removed/);
    assert.match(obj.message ?? "", /Use 'click' instead/);
    assert.strictEqual(obj.suggestion, "click");
  });
});

describe("promoted flat commands - help and missing-arg errors", () => {
  it("snapshot --help shows snapshot help", async () => {
    const { stdout, code } = await runCli(["snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator snapshot/);
    assert.match(stdout, /--timeout <ms>/);
  });

  it("screenshot --help shows screenshot help", async () => {
    const { stdout, code } = await runCli(["screenshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator screenshot/);
    assert.match(stdout, /--path <file>/);
  });

  it("click --help shows click help", async () => {
    const { stdout, code } = await runCli(["click", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator click/);
    assert.match(stdout, /--selector/);
  });

  it("click with no selector returns MISSING_SELECTOR with exit code 1", async () => {
    const { stdout, code } = await runCli(["click"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /click requires a selector/);
  });

  it("click --coordinate with invalid values returns EXECUTION_VALIDATION_FAILED with exit 1", async () => {
    const { stdout, code } = await runCli(["click", "--coordinate", "100", "pagedown"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /--coordinate requires two non-negative integers/);
  });

  it("click --coordinate with negative coordinates returns EXECUTION_VALIDATION_FAILED with exit 1", async () => {
    const { stdout, code } = await runCli(["click", "--coordinate", "-10", "20"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /--coordinate requires two non-negative integers/);
  });

  it("click --coordinate with fractional coordinates returns EXECUTION_VALIDATION_FAILED with exit 1", async () => {
    const { stdout, code } = await runCli(["click", "--coordinate", "10.5", "20"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /--coordinate requires two non-negative integers/);
  });

  it("click --coordinate rejects mixing with text selector (exit 1)", async () => {
    const { stdout, code } = await runCli(["click", "--coordinate", "100", "200", "--text", "Login"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /use --coordinate OR a selector, not both/);
  });

  it("click rejects unsupported execution flags like --all (exit 1)", async () => {
    const { stdout, code } = await runCli(["click", "--text", "Wi-Fi", "--all"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /unrecognized flag '--all'/);
  });

  it("open accepts --app without unknown-flag rejection", async () => {
    const { stdout, code } = await runCli(["open", "--app"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.doesNotMatch(obj.message ?? "", /unrecognized flag/);
  });

  it("close accepts --app without unknown-flag rejection", async () => {
    const { stdout, code } = await runCli(["close", "--app"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.doesNotMatch(obj.message ?? "", /unrecognized flag/);
  });

  it("exec best-effort accepts --goal without unknown-flag rejection", async () => {
    const { stdout, code } = await runCli(["exec", "best-effort", "--goal", "wifi settings"]);
    assert.strictEqual(code, 0, stdout);
    const obj = JSON.parse(stdout) as { code?: string; goal?: string; message?: string };
    assert.strictEqual(obj.code, "NOT_IMPLEMENTED");
    assert.strictEqual(obj.goal, "wifi settings");
    assert.doesNotMatch(obj.message ?? "", /unrecognized flag/);
  });

  it("recording pull accepts --out without unknown-flag rejection", async () => {
    const { stdout, code } = await runCli(["recording", "pull", "--out"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /--out requires a value/);
    assert.doesNotMatch(obj.message ?? "", /unrecognized flag/);
  });

  it("open --help shows open help", async () => {
    const { stdout, code } = await runCli(["open", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator open/);
    assert.match(stdout, /package-id/);
  });

  it("open with no target returns MISSING_ARGUMENT with exit code 1", async () => {
    const { stdout, code } = await runCli(["open"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.match(obj.message ?? "", /open requires a target/);
    assert.match(obj.message ?? "", /com.android.settings/);
    assert.match(obj.message ?? "", /https:\/\/example.com/);
  });

  it("press --help shows press help", async () => {
    const { stdout, code } = await runCli(["press", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator press/);
    assert.match(stdout, /back/);
  });

  it("press with no key returns MISSING_ARGUMENT with exit code 1", async () => {
    const { stdout, code } = await runCli(["press"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.match(obj.message ?? "", /press requires a key/);
    assert.match(obj.message ?? "", /back/);
  });

  it("scroll --help shows scroll help", async () => {
    const { stdout, code } = await runCli(["scroll", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator scroll/);
    assert.match(stdout, /down/);
  });

  it("scroll with no direction returns MISSING_ARGUMENT with exit code 1", async () => {
    const { stdout, code } = await runCli(["scroll"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.match(obj.message ?? "", /scroll requires a direction/);
  });

  it("scroll with invalid direction returns MISSING_ARGUMENT with exit code 1", async () => {
    const { stdout, code } = await runCli(["scroll", "sideways"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_ARGUMENT");
    assert.match(obj.message ?? "", /scroll requires a direction/);
  });

  it("type with no selector returns MISSING_SELECTOR with exit code 1", async () => {
    const { stdout, code } = await runCli(["type", "hello"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /type requires a selector/);
  });

  it("read with no selector returns MISSING_SELECTOR with exit code 1", async () => {
    const { stdout, code } = await runCli(["read"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /read requires a selector/);
  });

  it("wait with no selector returns MISSING_SELECTOR with exit code 1", async () => {
    const { stdout, code } = await runCli(["wait"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /wait requires a selector/);
  });

  it("screenshot --path with missing value returns USAGE with exit code 1", async () => {
    const { stdout, code } = await runCli(["screenshot", "--path"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.strictEqual(obj.message, "--path requires a value");
  });

  it("tap synonym dispatches to click handler (missing selector returns MISSING_SELECTOR)", async () => {
    const { stdout, code } = await runCli(["tap"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /click requires a selector/);
  });

  it("type rejects positional text together with --text (exit 1)", async () => {
    const { stdout, code } = await runCli([
      "type",
      "hello",
      "--text",
      "world",
      "--selector",
      "{}",
    ]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /not both/);
  });

  it("press rejects positional key together with --key (exit 1)", async () => {
    const { stdout, code } = await runCli(["press", "back", "--key", "home"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /not both/);
  });

  it("scroll rejects positional direction together with --direction (exit 1)", async () => {
    const { stdout, code } = await runCli(["scroll", "down", "--direction", "up"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /not both/);
  });

  it("open rejects positional target together with --app (exit 1)", async () => {
    const { stdout, code } = await runCli(["open", "com.android.settings", "--app", "com.example.foo"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /not both/);
  });
});
