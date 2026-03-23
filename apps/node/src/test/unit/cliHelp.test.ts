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

  it("shows snapshot help for snapshot --help", async () => {
    const { stdout, code } = await runCli(["snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator snapshot/);
    assert.match(stdout, /--timeout <ms>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("shows screenshot help with path option", async () => {
    const { stdout, code } = await runCli(["screenshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator screenshot/);
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
    assert.doesNotMatch(stdout, /clawperator action/);
  });

  it("shows skills validate help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "validate", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills validate/);
    assert.match(stdout, /skills validate --all/);
    assert.match(stdout, /integrity check, not a live device test/i);
    assert.doesNotMatch(stdout, /clawperator action/);
  });

  it("shows skills compile-artifact help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "compile-artifact", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills compile-artifact/);
    assert.match(stdout, /--artifact <name>/);
    assert.match(stdout, /--skill-id <id>/);
    assert.match(stdout, /--vars <json>/);
    assert.doesNotMatch(stdout, /clawperator action/);
  });

  it("shows skills run help instead of top-level help", async () => {
    const { stdout, code } = await runCli(["skills", "run", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator skills run/);
    assert.match(stdout, /--timeout <ms>/);
    assert.match(stdout, /--expect-contains <text>/);
    assert.match(stdout, /SKILL_OUTPUT_ASSERTION_FAILED/);
    assert.doesNotMatch(stdout, /clawperator action/);
  });

  it("shows snapshot help for snapshot --help (replaces inspect ui)", async () => {
    const { stdout, code } = await runCli(["snapshot", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator snapshot/);
    assert.match(stdout, /--timeout <ms>/);
    assert.doesNotMatch(stdout, /skills compile-artifact/);
  });

  it("forwards timeout parsing through snapshot", async () => {
    const { stdout, code } = await runCli(["snapshot", "--timeout-ms", "nope"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /EXECUTION_VALIDATION_FAILED/);
    assert.match(stdout, /timeoutMs must be a finite number/);
  });

  it("returns usage when timeout value is missing", async () => {
    const { stdout, code } = await runCli(["snapshot", "--timeout-ms"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /"code":"USAGE"/);
    assert.match(stdout, /--timeout-ms requires a value/);
  });

  it("accepts --format as an alias for --output", async () => {
    const jsonResult = await runCli(["snapshot", "--timeout-ms", "nope", "--format", "json"]);
    assert.notStrictEqual(jsonResult.code, 0);
    const json = JSON.parse(jsonResult.stdout);
    assert.strictEqual(json.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(json.message, "timeoutMs must be a finite number");

    const prettyResult = await runCli(["snapshot", "--timeout-ms", "nope", "--format", "pretty"]);
    assert.notStrictEqual(prettyResult.code, 0);
    const pretty = JSON.parse(prettyResult.stdout);
    assert.strictEqual(pretty.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(pretty.message, "timeoutMs must be a finite number");
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

  it("screenshot returns USAGE when --path is missing a value", async () => {
    const { stdout, code } = await runCli(["screenshot", "--path"]);
    assert.strictEqual(code, 1, stdout);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.strictEqual(obj.message, "--path requires a value");
  });
});

describe("Phase 2 promoted commands", () => {
  it("returns UNKNOWN_COMMAND with specific suggestion for 'observe snapshot'", async () => {
    const { stdout, code } = await runCli(["observe", "snapshot"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; message?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "snapshot");
    assert.match(obj.message ?? "", /snapshot/);
  });

  it("returns UNKNOWN_COMMAND with specific suggestion for 'observe screenshot'", async () => {
    const { stdout, code } = await runCli(["observe", "screenshot"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "screenshot");
  });

  it("returns UNKNOWN_COMMAND with snapshot suggestion for 'inspect ui'", async () => {
    const { stdout, code } = await runCli(["inspect", "ui"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "snapshot");
  });

  it("returns UNKNOWN_COMMAND with click suggestion for 'action click'", async () => {
    const { stdout, code } = await runCli(["action", "click", "--selector", "{}"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "click");
  });

  it("returns UNKNOWN_COMMAND with open suggestion for 'action open-app'", async () => {
    const { stdout, code } = await runCli(["action", "open-app", "--app", "com.example"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "open");
  });

  it("returns UNKNOWN_COMMAND with press suggestion for 'action press-key'", async () => {
    const { stdout, code } = await runCli(["action", "press-key", "--key", "back"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.strictEqual(obj.suggestion, "press");
  });

  it("returns MISSING_SELECTOR when click has no --selector", async () => {
    const { stdout, code } = await runCli(["click"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /--selector/);
  });

  it("returns USAGE when open has no target", async () => {
    const { stdout } = await runCli(["open"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /open requires a target/);
    // Plan spec: error message must include usage lines with descriptions and examples.
    assert.match(obj.message ?? "", /Open an Android app/);
    assert.match(obj.message ?? "", /Open a URL in browser/);
    assert.match(obj.message ?? "", /clawperator open com\.android\.settings/);
    assert.match(obj.message ?? "", /clawperator open https:\/\/example\.com/);
  });

  it("returns USAGE when open has both positional and --app flag", async () => {
    const { stdout } = await runCli(["open", "com.example", "--app", "com.example"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /positional argument or --app/);
  });

  it("returns USAGE when open has both --app and --uri flags", async () => {
    const { stdout } = await runCli(["open", "--app", "com.example", "--uri", "https://example.com"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /mutually exclusive/);
  });

  it("returns USAGE when press has no key", async () => {
    const { stdout } = await runCli(["press"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /press requires a key name/);
  });

  it("returns USAGE when press has both positional and --key flag", async () => {
    const { stdout } = await runCli(["press", "back", "--key", "back"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /positional argument or --key/);
  });

  it("returns USAGE when scroll has no direction", async () => {
    const { stdout } = await runCli(["scroll"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /scroll requires a direction/);
  });

  it("returns USAGE for invalid scroll direction", async () => {
    const { stdout } = await runCli(["scroll", "sideways"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /sideways/);
    assert.match(obj.message ?? "", /down, up, left, right/);
  });

  it("returns USAGE when scroll has both positional and --direction flag", async () => {
    const { stdout } = await runCli(["scroll", "down", "--direction", "up"]);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message ?? "", /positional argument or --direction/);
  });

  it("returns MISSING_SELECTOR when type has no --selector", async () => {
    const { stdout, code } = await runCli(["type", "hello"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message ?? "", /--selector/);
  });

  it("shows click --help with selector usage", async () => {
    const { stdout, code } = await runCli(["click", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator click/);
    assert.match(stdout, /--selector/);
  });

  it("shows press --help with key usage", async () => {
    const { stdout, code } = await runCli(["press", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator press/);
    assert.match(stdout, /back.*home.*recents|back|home|recents/);
  });

  it("shows scroll --help with direction usage", async () => {
    const { stdout, code } = await runCli(["scroll", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator scroll/);
    assert.match(stdout, /down.*up.*left.*right|down|up|left|right/);
  });

  it("shows open --help with target detection notes", async () => {
    const { stdout, code } = await runCli(["open", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator open/);
    assert.match(stdout, /auto-detect/i);
  });

  it("shows back --help", async () => {
    const { stdout, code } = await runCli(["back", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator back/);
    assert.match(stdout, /back key/i);
  });

  it("shows tap as synonym for click in --help resolution", async () => {
    const { stdout, code } = await runCli(["tap", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /clawperator click/);
  });
});
