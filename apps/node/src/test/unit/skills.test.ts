import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, copyFile, rm } from "node:fs/promises";
import { join, normalize } from "node:path";
import { tmpdir } from "node:os";
import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { compileArtifact } from "../../domain/skills/compileArtifact.js";
import { searchSkills } from "../../domain/skills/searchSkills.js";
import { runSkill } from "../../domain/skills/runSkill.js";
import { getRegistryPath, loadRegistry } from "../../adapters/skills-repo/localSkillsRegistry.js";
import { validateExecution, validatePayloadSize } from "../../domain/executions/validateExecution.js";
import { SKILL_NOT_FOUND, ARTIFACT_NOT_FOUND, COMPILE_VAR_MISSING, SKILL_SCRIPT_NOT_FOUND, SKILL_EXECUTION_FAILED } from "../../contracts/skills.js";

function resolveTestRegistryPath(): string {
  const candidates = [
    join(process.cwd(), "src", "test", "fixtures", "skills", "skills-registry.json"),
    join(process.cwd(), "apps", "node", "src", "test", "fixtures", "skills", "skills-registry.json"),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    throw new Error(`Test skills registry fixture not found. Checked: ${candidates.join(", ")}`);
  }
  return found;
}

const TEST_REGISTRY_PATH = resolveTestRegistryPath();
const ORIGINAL_REGISTRY_PATH = process.env.CLAWPERATOR_SKILLS_REGISTRY;

before(() => {
  process.env.CLAWPERATOR_SKILLS_REGISTRY = TEST_REGISTRY_PATH;
});

after(() => {
  if (ORIGINAL_REGISTRY_PATH === undefined) {
    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
  } else {
    process.env.CLAWPERATOR_SKILLS_REGISTRY = ORIGINAL_REGISTRY_PATH;
  }
});

function runCli(args: string[]): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(process.cwd(), "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

function runNodeSnippet(
  script: string,
  options?: { cwd?: string; env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, ["--input-type=module", "-e", script], {
      cwd: options?.cwd ?? process.cwd(),
      env: options?.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => (stdout += d.toString()));
    proc.stderr?.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => resolve({ stdout, stderr, code: code ?? -1 }));
  });
}

describe("listSkills", () => {
  it("returns skills from registry when available", async () => {
    const result = await listSkills();
    if (!result.ok) {
      assert.fail(`Expected listSkills to succeed when registry present: ${result.message}`);
    }
    assert.ok(Array.isArray(result.skills));
    const chromecast = result.skills.find((s) => s.id === "com.google.android.apps.chromecast.app.get-aircon-status");
    assert.ok(chromecast);
    assert.strictEqual(chromecast.artifacts.length, 1);
    assert.ok(chromecast.artifacts[0].endsWith("ac-status.recipe.json"));
  });
});

describe("loadRegistry", () => {
  it("reports the configured registry path when CLAWPERATOR_SKILLS_REGISTRY is invalid", async () => {
    const original = process.env.CLAWPERATOR_SKILLS_REGISTRY;
    process.env.CLAWPERATOR_SKILLS_REGISTRY = "/tmp/does-not-exist/skills-registry.json";
    try {
      await assert.rejects(
        () => loadRegistry(),
        /Registry not found at configured path: \/tmp\/does-not-exist\/skills-registry\.json/
      );
    } finally {
      if (original === undefined) {
        delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
      } else {
        process.env.CLAWPERATOR_SKILLS_REGISTRY = original;
      }
    }
  });

  it("falls back when the caller passes the derived default path", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-registry-"));
    const appNodeDir = join(tempRoot, "apps", "node");
    const fallbackDir = join(tempRoot, "skills");
    const fallbackPath = join(fallbackDir, "skills-registry.json");

    await mkdir(appNodeDir, { recursive: true });
    await mkdir(fallbackDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, fallbackPath);

    try {
      const modulePath = join(process.cwd(), "dist", "adapters", "skills-repo", "localSkillsRegistry.js");
      const script = `
        import { loadRegistry, getRegistryPath } from ${JSON.stringify(modulePath)};
        process.chdir(${JSON.stringify(appNodeDir)});
        delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
        const result = await loadRegistry(getRegistryPath());
        console.log(JSON.stringify({
          resolvedPath: result.resolvedPath,
          skillCount: result.registry.skills.length,
        }));
      `;
      const child = await runNodeSnippet(script, {
        env: { ...process.env },
      });
      assert.strictEqual(child.code, 0, child.stderr);
      const parsed = JSON.parse(child.stdout);
      assert.strictEqual(normalize(parsed.resolvedPath), normalize(fallbackPath));
      assert.ok(parsed.skillCount > 0);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("getSkill", () => {
  it("returns skill for known id", async () => {
    const result = await getSkill("com.google.android.apps.chromecast.app.get-aircon-status");
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.skill.id, "com.google.android.apps.chromecast.app.get-aircon-status");
    assert.strictEqual(result.skill.applicationId, "com.google.android.apps.chromecast.app");
  });

  it("returns SKILL_NOT_FOUND for unknown id", async () => {
    const result = await getSkill("nonexistent.skill.id");
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_NOT_FOUND);
  });
});

describe("compileArtifact", () => {
  it("returns COMPILE_VAR_MISSING when required placeholder missing", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, COMPILE_VAR_MISSING);
    assert.ok(result.details && result.details.placeholder === "AC_TILE_NAME");
  });

  it("returns valid execution when vars include required placeholder", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      '{"AC_TILE_NAME":"Master"}'
    );
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.execution.mode, "artifact_compiled");
    assert.ok(result.execution.commandId);
    assert.ok(result.execution.actions.length > 0);
  });

  it("escapes vars safely so quoted values keep compiled JSON valid", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      "{\"AC_TILE_NAME\":\"Master \\\"Quoted\\\"\"}"
    );
    if (!result.ok) assert.fail(result.message);
    const openController = result.execution.actions.find((a) => a.id === "openController");
    assert.ok(openController);
    assert.strictEqual(openController.params?.target?.textContains, 'Master "Quoted"');
  });

  it("returns ARTIFACT_NOT_FOUND for wrong artifact name", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "nonexistent-artifact",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, ARTIFACT_NOT_FOUND);
  });

  it("compile failure returns nested details (not flattened top-level)", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, COMPILE_VAR_MISSING);
    assert.strictEqual(typeof result.message, "string");
    assert.ok(result.details && typeof result.details === "object");
    assert.strictEqual(result.details.placeholder, "AC_TILE_NAME");
    assert.ok("skillId" in result.details);
    assert.ok("artifactName" in result.details);
    const topLevelKeys = Object.keys(result as object).filter((k) => k !== "ok" && k !== "code" && k !== "message" && k !== "details");
    assert.strictEqual(topLevelKeys.length, 0, "diagnostic fields must be under details, not top-level");
  });

  it("accepts artifact name with .recipe.json suffix (same as bare name)", async () => {
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      '{"AC_TILE_NAME":"Master"}'
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status.recipe.json",
      '{"AC_TILE_NAME":"Master"}'
    );
    if (!r1.ok || !r2.ok) assert.fail("Expected both to succeed");
    assert.strictEqual(JSON.stringify(r1.execution), JSON.stringify(r2.execution));
  });

  it("produces deterministic execution for identical inputs", async () => {
    const varsJson = '{"AC_TILE_NAME":"Master"}';
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      varsJson
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      varsJson
    );

    if (!r1.ok || !r2.ok) {
      assert.fail(`Expected both compileArtifact calls to succeed (codes: ${!r1.ok ? r1.code : ""}, ${!r2.ok ? r2.code : ""})`);
    }

    const e1 = JSON.stringify(r1.execution);
    const e2 = JSON.stringify(r2.execution);
    assert.strictEqual(e1, e2);
  });

  it("preserves user-provided COMMAND_ID and TASK_ID", async () => {
    const varsJson = '{"AC_TILE_NAME":"Master","COMMAND_ID":"cmd-user-1","TASK_ID":"task-user-1"}';
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      varsJson
    );
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.execution.commandId, "cmd-user-1");
    assert.strictEqual(result.execution.taskId, "task-user-1");
    assert.strictEqual(result.execution.mode, "artifact_compiled");
  });

  it("is insensitive to vars key order", async () => {
    const v1 = '{"AC_TILE_NAME":"Master","EXTRA":"1"}';
    const v2 = '{"EXTRA":"1","AC_TILE_NAME":"Master"}';
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      v1
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      v2
    );
    if (!r1.ok || !r2.ok) assert.fail("Expected both compileArtifact calls to succeed");
    const e1 = JSON.stringify(r1.execution);
    const e2 = JSON.stringify(r2.execution);
    assert.strictEqual(e1, e2);
  });

  it("CLI compile-artifact accepts --skill-id (same result as positional skill_id)", async () => {
    const skillId = "com.google.android.apps.chromecast.app.get-aircon-status";
    const varsJson = '{"AC_TILE_NAME":"Master"}';
    const { stdout, code } = await runCli([
      "skills", "compile-artifact", "--skill-id", skillId, "--artifact", "ac-status", "--vars", varsJson, "--output", "json",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { execution?: { mode?: string; commandId?: string }; code?: string };
    assert.ok(parsed.execution, "CLI with --skill-id should return execution");
    assert.strictEqual(parsed.execution!.mode, "artifact_compiled");
    assert.ok(parsed.execution!.commandId);
    assert.strictEqual(parsed.code, undefined, "should not be an error response");
  });

  it("CLI compile-artifact returns USAGE when both skill_id and --artifact missing", async () => {
    const { stdout } = await runCli(["skills", "compile-artifact", "--output", "json"]);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.ok(parsed.message?.includes("skill_id") || parsed.message?.includes("--skill-id") || parsed.message?.includes("--artifact"));
  });

  it("CLI compile-artifact returns USAGE when --artifact missing", async () => {
    const { stdout } = await runCli([
      "skills", "compile-artifact", "com.google.android.apps.chromecast.app.get-aircon-status", "--output", "json",
    ]);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.ok(parsed.message?.includes("--artifact"));
  });

  it("compile-artifact output is valid execution input (e2e: compile → execute contract)", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-aircon-status",
      "ac-status",
      '{"AC_TILE_NAME":"Master"}',
      undefined
    );
    assert.ok(result.ok, result.ok ? "" : (result as { message?: string }).message);
    const execution = result.execution!;
    const validated = validateExecution(execution);
    assert.strictEqual(validated.commandId, execution.commandId);
    assert.ok(Array.isArray(validated.actions) && validated.actions.length > 0);
    validatePayloadSize(JSON.stringify(execution));
  });
});

describe("searchSkills", () => {
  it("filters by applicationId", async () => {
    const result = await searchSkills({ app: "com.android.settings" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.skills[0].id, "com.android.settings.capture-overview");
  });

  it("filters by intent", async () => {
    const result = await searchSkills({ intent: "get-aircon-status" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.skills[0].id, "com.google.android.apps.chromecast.app.get-aircon-status");
  });

  it("filters by keyword in summary", async () => {
    const result = await searchSkills({ keyword: "screenshot" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.skills[0].id, "com.android.settings.capture-overview");
  });

  it("returns empty array for no matches", async () => {
    const result = await searchSkills({ app: "com.nonexistent.app" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 0);
  });

  it("combines app and intent filters", async () => {
    const result = await searchSkills({ app: "com.android.settings", intent: "get-aircon-status" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 0);
  });
});

describe("runSkill", () => {
  it("returns SKILL_NOT_FOUND for unknown skill", async () => {
    const result = await runSkill("nonexistent.skill", []);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_NOT_FOUND);
  });

  it("returns SKILL_SCRIPT_NOT_FOUND when script file missing", async () => {
    // The fixture registry has a script path that doesn't exist on disk
    const result = await runSkill("com.android.settings.capture-overview", []);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_SCRIPT_NOT_FOUND);
  });

  it("runs script and captures output on success", async () => {
    const result = await runSkill("com.test.echo", ["hello"]);
    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.strictEqual(result.skillId, "com.test.echo");
    assert.strictEqual(result.exitCode, 0);
    assert.ok(result.output.includes("TEST_OUTPUT:hello"));
    assert.ok(typeof result.durationMs === "number" && result.durationMs >= 0);
  });

  it("runs script with no args", async () => {
    const result = await runSkill("com.test.echo", []);
    assert.ok(result.ok);
    assert.ok(result.output.includes("TEST_OUTPUT:no-args"));
  });

  it("returns SKILL_EXECUTION_FAILED for non-zero exit", async () => {
    const result = await runSkill("com.test.fail", []);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_EXECUTION_FAILED);
    assert.ok(result.stderr?.includes("FAIL_OUTPUT:intentional"));
  });
});
