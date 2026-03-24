import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolveElementMatcherFromCli,
  resolveContainerMatcherFromCli,
  hasElementSelectorFlag,
  makeMissingSelectorError,
} from "../../cli/selectorFlags.js";

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

// ---------------------------------------------------------------------------
// resolveElementMatcherFromCli - simple flag tests
// ---------------------------------------------------------------------------

describe("resolveElementMatcherFromCli - simple flags", () => {
  it("--text produces textEquals", () => {
    const result = resolveElementMatcherFromCli(["--text", "Login"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textEquals: "Login" });
  });

  it("--id produces resourceId", () => {
    const result = resolveElementMatcherFromCli(["--id", "com.foo:id/bar"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { resourceId: "com.foo:id/bar" });
  });

  it("--desc produces contentDescEquals", () => {
    const result = resolveElementMatcherFromCli(["--desc", "Submit"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { contentDescEquals: "Submit" });
  });

  it("--text-contains produces textContains", () => {
    const result = resolveElementMatcherFromCli(["--text-contains", "Log"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textContains: "Log" });
  });

  it("--desc-contains produces contentDescContains", () => {
    const result = resolveElementMatcherFromCli(["--desc-contains", "Wi"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { contentDescContains: "Wi" });
  });

  it("--role produces role", () => {
    const result = resolveElementMatcherFromCli(["--role", "button"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { role: "button" });
  });

  it("--text and --role combine to both fields set", () => {
    const result = resolveElementMatcherFromCli(["--text", "Login", "--role", "button"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textEquals: "Login", role: "button" });
  });

  it("all simple flags combine", () => {
    const result = resolveElementMatcherFromCli([
      "--text", "Login",
      "--text-contains", "Log",
      "--id", "com.foo:id/btn",
      "--desc", "Submit button",
      "--desc-contains", "Sub",
      "--role", "button",
    ]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, {
      textEquals: "Login",
      textContains: "Log",
      resourceId: "com.foo:id/btn",
      contentDescEquals: "Submit button",
      contentDescContains: "Sub",
      role: "button",
    });
  });

  it("no selector flags returns empty matcher", () => {
    const result = resolveElementMatcherFromCli([]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, {});
  });

  it("other flags in rest are ignored", () => {
    const result = resolveElementMatcherFromCli(["--device", "emulator-5554", "--text", "Wi-Fi"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textEquals: "Wi-Fi" });
  });
});

// ---------------------------------------------------------------------------
// resolveElementMatcherFromCli - --selector JSON path
// ---------------------------------------------------------------------------

describe("resolveElementMatcherFromCli - --selector JSON", () => {
  it("--selector parses JSON object", () => {
    const result = resolveElementMatcherFromCli(["--selector", '{"textEquals":"Wi-Fi"}']);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textEquals: "Wi-Fi" });
  });

  it("--selector with multiple fields", () => {
    const result = resolveElementMatcherFromCli([
      "--selector", '{"textEquals":"Login","role":"button"}',
    ]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.matcher, { textEquals: "Login", role: "button" });
  });
});

// ---------------------------------------------------------------------------
// resolveElementMatcherFromCli - error cases
// ---------------------------------------------------------------------------

describe("resolveElementMatcherFromCli - errors", () => {
  it("--selector combined with --text returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli([
      "--text", "Login",
      "--selector", '{"textEquals":"x"}',
    ]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /use --selector OR the simple flags, not both/);
  });

  it("--selector combined with --role returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli([
      "--selector", '{"textEquals":"x"}',
      "--role", "button",
    ]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("--text with blank value returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--text", ""]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /blank/);
  });

  it("--text followed by another flag returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--text", "--json"]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /requires a value/);
  });

  it("--id with blank value returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--id", ""]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("--role with blank value returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--role", ""]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("--selector with blank value returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--selector", ""]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("--selector with invalid JSON returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--selector", "not-json"]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("--selector with JSON array returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--selector", "[1,2,3]"]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /JSON object/);
  });

  it("flag with missing following token returns error", () => {
    const result = resolveElementMatcherFromCli(["--text"]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("duplicate --text returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli(["--text", "a", "--text", "b"]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /--text must not appear more than once/);
  });

  it("duplicate --selector returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveElementMatcherFromCli([
      "--selector",
      "{}",
      "--selector",
      "{}",
    ]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /--selector must not appear more than once/);
  });
});

// ---------------------------------------------------------------------------
// hasElementSelectorFlag
// ---------------------------------------------------------------------------

describe("hasElementSelectorFlag", () => {
  it("returns true when --text is present", () => {
    assert.strictEqual(hasElementSelectorFlag(["--text", "x"]), true);
  });

  it("returns true when --id is present", () => {
    assert.strictEqual(hasElementSelectorFlag(["--id", "x"]), true);
  });

  it("returns true when --selector is present", () => {
    assert.strictEqual(hasElementSelectorFlag(["--selector", "{}"]), true);
  });

  it("returns false when no selector flag present", () => {
    assert.strictEqual(hasElementSelectorFlag(["--device", "emulator-5554"]), false);
  });

  it("returns false for empty array", () => {
    assert.strictEqual(hasElementSelectorFlag([]), false);
  });
});

// ---------------------------------------------------------------------------
// resolveContainerMatcherFromCli
// ---------------------------------------------------------------------------

describe("resolveContainerMatcherFromCli", () => {
  it("returns undefined container when no container flags", () => {
    const result = resolveContainerMatcherFromCli(["down", "--device", "emulator-5554"]);
    assert.ok(result.ok);
    assert.strictEqual(result.container, undefined);
  });

  it("--container-text populates textEquals on container", () => {
    const result = resolveContainerMatcherFromCli(["--container-text", "list"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.container, { textEquals: "list" });
  });

  it("--container-id populates resourceId on container", () => {
    const result = resolveContainerMatcherFromCli(["--container-id", "com.foo:id/scroll"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.container, { resourceId: "com.foo:id/scroll" });
  });

  it("--container-role populates role on container", () => {
    const result = resolveContainerMatcherFromCli(["--container-role", "list"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.container, { role: "list" });
  });

  it("--container-text-contains populates textContains on container", () => {
    const result = resolveContainerMatcherFromCli(["--container-text-contains", "scroll"]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.container, { textContains: "scroll" });
  });

  it("--container-selector parses JSON object", () => {
    const result = resolveContainerMatcherFromCli([
      "--container-selector", '{"textEquals":"x"}',
    ]);
    assert.ok(result.ok);
    assert.deepStrictEqual(result.container, { textEquals: "x" });
  });

  it("--container-selector + --container-text returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveContainerMatcherFromCli([
      "--container-selector", '{"textEquals":"x"}',
      "--container-text", "y",
    ]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /not both/);
  });

  it("--container-text with blank value returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveContainerMatcherFromCli(["--container-text", ""]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("container flags are independent of element flags", () => {
    const result = resolveContainerMatcherFromCli([
      "--text", "Login",
      "--container-id", "com.foo:id/list",
    ]);
    assert.ok(result.ok);
    // container only contains the --container-id field
    assert.deepStrictEqual(result.container, { resourceId: "com.foo:id/list" });
  });

  it("duplicate --container-id returns EXECUTION_VALIDATION_FAILED", () => {
    const result = resolveContainerMatcherFromCli([
      "--container-id",
      "a",
      "--container-id",
      "b",
    ]);
    assert.ok(!result.ok);
    assert.strictEqual(result.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.error.message, /--container-id must not appear more than once/);
  });
});

// ---------------------------------------------------------------------------
// makeMissingSelectorError
// ---------------------------------------------------------------------------

describe("makeMissingSelectorError", () => {
  it("returns JSON with MISSING_SELECTOR code", () => {
    const json = makeMissingSelectorError("click");
    const obj = JSON.parse(json);
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message, /click requires a selector/);
    assert.match(obj.message, /--text/);
    assert.match(obj.message, /--id/);
    assert.match(obj.message, /--desc-contains/);
    assert.match(obj.message, /--role/);
  });

  it("includes command name in message", () => {
    const json = makeMissingSelectorError("read");
    const obj = JSON.parse(json);
    assert.match(obj.message, /read requires a selector/);
  });

  it("pretty format indents JSON for terminal readability", () => {
    const out = makeMissingSelectorError("wait", "pretty");
    assert.ok(out.includes("\n"), "expected pretty-printed multiline JSON");
    const obj = JSON.parse(out) as { code: string };
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
  });
});

// ---------------------------------------------------------------------------
// CLI-level: MISSING_SELECTOR with Phase 3 help text
// ---------------------------------------------------------------------------

describe("CLI: missing selector returns Phase 3 help text", () => {
  it("click with no selector returns MISSING_SELECTOR with flag list", async () => {
    const { stdout, code } = await runCli(["click", "--json"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message, /--text/);
    assert.match(obj.message, /--id/);
    assert.match(obj.message, /--role/);
  });

  it("read with no selector returns MISSING_SELECTOR with flag list", async () => {
    const { stdout, code } = await runCli(["read", "--json"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message, /--text/);
  });

  it("wait with no selector returns MISSING_SELECTOR with flag list", async () => {
    const { stdout, code } = await runCli(["wait", "--json"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message, /--text/);
  });

  it("type with text but no selector returns MISSING_SELECTOR", async () => {
    const { stdout, code } = await runCli(["type", "hello", "--json"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "MISSING_SELECTOR");
    assert.match(obj.message, /--role/);
    assert.match(obj.message, /--desc-contains/);
  });

  it("type rejects a selector flag token where --text value should be", async () => {
    const { stdout, code } = await runCli(["type", "--text", "--role", "textfield", "--json"]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message ?? "", /--text requires a value/);
  });
});

// ---------------------------------------------------------------------------
// CLI-level: mutual exclusion error
// ---------------------------------------------------------------------------

describe("CLI: --selector combined with simple flag returns EXECUTION_VALIDATION_FAILED", () => {
  it("click --text + --selector returns EXECUTION_VALIDATION_FAILED", async () => {
    const { stdout, code } = await runCli([
      "click",
      "--text", "Login",
      "--selector", '{"textEquals":"x"}',
      "--json",
    ]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message, /not both/);
  });
});

describe("CLI: duplicate selector flags return EXECUTION_VALIDATION_FAILED", () => {
  it("click with duplicate --text returns EXECUTION_VALIDATION_FAILED", async () => {
    const { stdout, code } = await runCli([
      "click",
      "--text",
      "a",
      "--text",
      "b",
      "--json",
    ]);
    assert.strictEqual(code, 1);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(obj.message, /--text must not appear more than once/);
  });
});

// ---------------------------------------------------------------------------
// CLI-level: click --help shows Phase 3 flags
// ---------------------------------------------------------------------------

describe("CLI: click --help shows Phase 3 selector flags", () => {
  it("click --help documents --text and --id flags", async () => {
    const { stdout, code } = await runCli(["click", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /--text/);
    assert.match(stdout, /--id/);
    assert.match(stdout, /--role/);
    assert.match(stdout, /--selector/);
  });

  it("scroll --help documents --container flags", async () => {
    const { stdout, code } = await runCli(["scroll", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /--container-text/);
    assert.match(stdout, /--container-id/);
    assert.match(stdout, /--container-role/);
  });

  it("type --help documents --role and --id flags for selector", async () => {
    const { stdout, code } = await runCli(["type", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /--role/);
    assert.match(stdout, /--id/);
    assert.match(stdout, /--submit/);
    assert.match(stdout, /--clear/);
  });
});
