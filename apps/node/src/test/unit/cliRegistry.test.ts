import { describe, it } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COMMANDS, levenshtein } from "../../cli/registry.js";

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

describe("COMMANDS registry consistency", () => {
  it("every command has non-empty name, summary, help, and group", () => {
    for (const [key, def] of Object.entries(COMMANDS)) {
      assert.ok(def.name, `${key}: name must be non-empty`);
      assert.ok(def.summary, `${key}: summary must be non-empty`);
      assert.ok(def.help, `${key}: help must be non-empty`);
      assert.ok(def.group, `${key}: group must be non-empty`);
    }
  });

  it("every command has a handler that is a function", () => {
    for (const [key, def] of Object.entries(COMMANDS)) {
      assert.strictEqual(typeof def.handler, "function", `${key}: handler must be a function`);
    }
  });

  it("no synonym appears twice across all commands", () => {
    const seenSynonyms = new Map<string, string>();
    for (const def of Object.values(COMMANDS)) {
      for (const syn of def.synonyms ?? []) {
        const existing = seenSynonyms.get(syn);
        assert.ok(!existing, `Synonym '${syn}' appears in both '${existing}' and '${def.name}'`);
        seenSynonyms.set(syn, def.name);
      }
    }
  });

  it("no primary command name appears as another command's synonym", () => {
    const primaryNames = new Set(Object.values(COMMANDS).map((d) => d.name));
    for (const def of Object.values(COMMANDS)) {
      for (const syn of def.synonyms ?? []) {
        assert.ok(
          !primaryNames.has(syn),
          `Synonym '${syn}' of '${def.name}' is also a primary command name`
        );
      }
    }
  });
});

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    assert.strictEqual(levenshtein("observe", "observe"), 0);
  });

  it("returns correct distance for similar strings", () => {
    assert.strictEqual(levenshtein("observe", "observ"), 1);
    assert.strictEqual(levenshtein("recrd", "record"), 1);
  });
});

describe("flag aliases - --device works like --device-id", () => {
  it("--device alias passes device id (validated via timeout error output)", async () => {
    // Use --timeout nope which produces EXECUTION_VALIDATION_FAILED. The device alias is consumed
    // by getGlobalOpts, so the command should still run and fail on the timeout.
    const { stdout, code } = await runCli(["--device", "test-device-alias", "observe", "snapshot", "--timeout", "nope"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /EXECUTION_VALIDATION_FAILED/);
    assert.match(stdout, /timeoutMs must be a finite number/);
  });
});

describe("flag aliases - --json sets output to json", () => {
  it("--json flag is consumed without error and output remains json", async () => {
    // operator setup without --apk returns USAGE JSON regardless of format
    const { stdout } = await runCli(["--json", "operator", "setup"]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--apk/);
  });
});

describe("missing command after global flags", () => {
  it("returns USAGE instead of crashing when only global flags are supplied", async () => {
    const { stdout, code } = await runCli(["--json"]);
    assert.strictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "USAGE");
    assert.match(obj.message, /--help/);
  });
});

describe("flag aliases - --timeout works like --timeout-ms", () => {
  it("--timeout nope produces EXECUTION_VALIDATION_FAILED", async () => {
    const { stdout, code } = await runCli(["observe", "snapshot", "--timeout", "nope"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /EXECUTION_VALIDATION_FAILED/);
    assert.match(stdout, /timeoutMs must be a finite number/);
  });

  it("--timeout without value produces USAGE error with exit code 1", async () => {
    const { stdout, code } = await runCli(["--timeout"]);
    assert.notStrictEqual(code, 0);
    assert.match(stdout, /USAGE/);
    assert.match(stdout, /--timeout requires a value/);
  });
});

describe("flag aliases - --operator-package works like --receiver-package", () => {
  it("--operator-package is accepted by getGlobalOpts (passed through to operator setup failure)", async () => {
    const { stdout } = await runCli([
      "--operator-package", "com.clawperator.operator.dev",
      "operator", "setup",
      "--apk", "/nonexistent/test.apk",
    ]);
    const obj = JSON.parse(stdout);
    // Should fail with OPERATOR_APK_NOT_FOUND and echo back the receiverPackage
    assert.strictEqual(obj.receiverPackage, "com.clawperator.operator.dev");
  });

  it("--package alias is also accepted", async () => {
    const { stdout } = await runCli([
      "--package", "com.clawperator.operator.dev",
      "operator", "setup",
      "--apk", "/nonexistent/test.apk",
    ]);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.receiverPackage, "com.clawperator.operator.dev");
  });
});

describe("unknown command produces UNKNOWN_COMMAND", () => {
  it("completely unknown command returns UNKNOWN_COMMAND with exit code 1", async () => {
    const { stdout, code } = await runCli(["totally-unknown-command"]);
    assert.notStrictEqual(code, 0);
    const obj = JSON.parse(stdout);
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.match(obj.message, /Unknown command: totally-unknown-command/);
  });

  it("typo close to a real command includes did-you-mean suggestion", async () => {
    // levenshtein("recrod", "record") = 1; threshold = max(2, floor(6/2)) = 3.
    // The suggestion always fires for this input - assert it explicitly.
    const { stdout, code } = await runCli(["recrod"]);
    assert.notStrictEqual(code, 0);
    const obj = JSON.parse(stdout) as { code?: string; message?: string; suggestion?: string };
    assert.strictEqual(obj.code, "UNKNOWN_COMMAND");
    assert.match(obj.message ?? "", /Unknown command: recrod/);
    assert.strictEqual(obj.suggestion, "record");
  });
});

describe("record synonym dispatches to recording handler", () => {
  it("record with no subcommand returns USAGE (not UNKNOWN_COMMAND)", async () => {
    // Proves the synonym resolves to the recording handler rather than being
    // treated as an unknown command.
    const { stdout } = await runCli(["record"]);
    const obj = JSON.parse(stdout) as { code?: string };
    assert.strictEqual(obj.code, "USAGE");
    assert.notStrictEqual(obj.code, "UNKNOWN_COMMAND");
  });

  it("record --help resolves to recording help text", async () => {
    const { stdout, code } = await runCli(["record", "--help"]);
    assert.strictEqual(code, 0);
    assert.match(stdout, /recording start/);
  });
});
