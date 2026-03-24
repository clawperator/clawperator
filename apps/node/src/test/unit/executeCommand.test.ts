import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdExecute } from "../../cli/commands/execute.js";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(packageRoot, "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: packageRoot,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe("cmdExecute --validate-only", () => {
  it("validates a payload without requiring a device", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      execution: JSON.stringify({
        commandId: "cmd-1",
        taskId: "task-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.validated, true);
    assert.strictEqual(result.execution.commandId, "cmd-1");
    assert.strictEqual(result.execution.timeoutMs, 5000);
  });

  it("applies timeout override during validate-only checks", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      timeoutMs: 12000,
      execution: JSON.stringify({
        commandId: "cmd-1",
        taskId: "task-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.execution.timeoutMs, 12000);
  });

  it("returns validation error for invalid payloads without dispatch", async () => {
    const output = await cmdExecute({
      format: "json",
      validateOnly: true,
      execution: JSON.stringify({
        commandId: "cmd-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.code, "EXECUTION_VALIDATION_FAILED");
  });
});

describe("cmdExecute --dry-run", () => {
  it("returns a plan summary without requiring a device", async () => {
    const output = await cmdExecute({
      format: "json",
      dryRun: true,
      execution: JSON.stringify({
        commandId: "cmd-dry-1",
        taskId: "task-dry-1",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 10000,
        actions: [
          { id: "sleep-1", type: "sleep", params: { durationMs: 500 } },
        ],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.dryRun, true);
    assert.strictEqual(result.plan.commandId, "cmd-dry-1");
    assert.strictEqual(result.plan.timeoutMs, 10000);
    assert.strictEqual(result.plan.actionCount, 1);
    assert.deepStrictEqual(result.plan.actions[0], {
      id: "sleep-1",
      type: "sleep",
      params: { durationMs: 500 },
    });
  });

  it("applies timeout override during dry-run", async () => {
    const output = await cmdExecute({
      format: "json",
      dryRun: true,
      timeoutMs: 12000,
      execution: JSON.stringify({
        commandId: "cmd-dry-2",
        taskId: "task-dry-2",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [
          { id: "sleep-1", type: "sleep", params: { durationMs: 500 } },
        ],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.plan.timeoutMs, 12000);
  });

  it("returns schema error for invalid payloads and surfaces offending path", async () => {
    const output = await cmdExecute({
      format: "json",
      dryRun: true,
      execution: JSON.stringify({
        // missing taskId
        commandId: "cmd-dry-3",
        source: "test",
        expectedFormat: "android-ui-automator",
        timeoutMs: 5000,
        actions: [{ id: "snap-1", type: "snapshot_ui" }],
      }),
    });

    const result = JSON.parse(output);
    assert.strictEqual(result.code, "EXECUTION_VALIDATION_FAILED");
    assert.ok(typeof result.details?.path === "string");
  });
});

describe("clawperator exec CLI", () => {
  it("surfaces action context for invalid fixture files before device contact", async () => {
    const fixturePath = join(packageRoot, "src", "test", "fixtures", "execution-invalid-action-0.json");
    const { stdout, code } = await runCli(["exec", "--execution", fixturePath]);

    assert.notStrictEqual(code, 0);
    assert.match(stdout, /actionId/);
    assert.match(stdout, /snapshot_ui/);
  });

  it("accepts execute as a synonym for exec", async () => {
    const fixturePath = join(packageRoot, "src", "test", "fixtures", "execution-invalid-action-0.json");
    const { stdout, code } = await runCli(["execute", "--execution", fixturePath]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /actionId/);
  });

  const minimalInline = JSON.stringify({
    commandId: "pos-1",
    taskId: "pos-1",
    source: "test",
    expectedFormat: "android-ui-automator",
    timeoutMs: 30000,
    actions: [{ id: "a1", type: "sleep", params: { durationMs: 1 } }],
  });

  it("accepts positional inline JSON with --validate-only", async () => {
    const { stdout, code } = await runCli(["exec", minimalInline, "--validate-only", "--json"]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.execution.commandId, "pos-1");
  });

  it("accepts --payload with --validate-only", async () => {
    const { stdout, code } = await runCli(["exec", "--payload", minimalInline, "--validate-only", "--json"]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
  });

  it("accepts positional file path with --validate-only", async () => {
    const fixturePath = join(packageRoot, "src", "test", "fixtures", "execution-sleep-minimal.json");
    const { stdout, code } = await runCli(["exec", fixturePath, "--validate-only", "--json"]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.execution.commandId, "cli-test-cmd");
  });

  it("returns MISSING_ARGUMENT when exec has no payload", async () => {
    const { stdout, code } = await runCli(["exec", "--json"]);
    assert.notStrictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.code, "MISSING_ARGUMENT");
  });
});

describe("clawperator wait-for-nav CLI", () => {
  it("builds wait_for_navigation with --app and --timeout (validate-only)", async () => {
    const { stdout, code } = await runCli([
      "wait-for-nav",
      "--app",
      "com.android.settings",
      "--timeout",
      "5000",
      "--validate-only",
      "--json",
    ]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
    const action = result.execution.actions[0];
    assert.strictEqual(action.type, "wait_for_navigation");
    assert.strictEqual(action.params.expectedPackage, "com.android.settings");
    assert.strictEqual(action.params.timeoutMs, 5000);
  });

  it("returns MISSING_ARGUMENT when --timeout is missing", async () => {
    const { stdout, code } = await runCli(["wait-for-nav", "--app", "com.android.settings", "--json"]);
    assert.notStrictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.code, "MISSING_ARGUMENT");
  });
});

describe("clawperator read-value CLI", () => {
  it("builds read_key_value_pair with --label (validate-only)", async () => {
    const { stdout, code } = await runCli(["read-value", "--label", "Battery", "--validate-only", "--json"]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
    const action = result.execution.actions[0];
    assert.strictEqual(action.type, "read_key_value_pair");
    assert.deepStrictEqual(action.params.labelMatcher, { textEquals: "Battery" });
  });

  it("accepts read-kv synonym", async () => {
    const { stdout, code } = await runCli(["read-kv", "--label", "Battery", "--validate-only", "--json"]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.execution.actions[0].type, "read_key_value_pair");
  });

  it("sets all:true when --all and --json", async () => {
    const { stdout, code } = await runCli([
      "read-value",
      "--label",
      "X",
      "--all",
      "--validate-only",
      "--json",
    ]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.execution.actions[0].params.all, true);
  });

  it("errors when --all is used without --json", async () => {
    const { stdout, code } = await runCli(["read-value", "--label", "X", "--all"]);
    assert.notStrictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.code, "EXECUTION_VALIDATION_FAILED");
    assert.match(result.message, /--json/);
  });

  it("returns MISSING_ARGUMENT when no label flags", async () => {
    const { stdout, code } = await runCli(["read-value", "--json"]);
    assert.notStrictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.code, "MISSING_ARGUMENT");
  });

  it("accepts --timeout flag and applies override just like exec", async () => {
    const { stdout, code } = await runCli([
      "read-value",
      "--label",
      "Battery",
      "--timeout",
      "5000",
      "--validate-only",
      "--json",
    ]);
    assert.strictEqual(code, 0);
    const result = JSON.parse(stdout);
    assert.strictEqual(result.ok, true);
    // read-value respects --timeout override, just like exec and snapshot do
    assert.strictEqual(result.execution.timeoutMs, 5000);
  });
});
