import { describe, it, before, after, afterEach } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, copyFile, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { compileArtifact } from "../../domain/skills/compileArtifact.js";
import { searchSkills } from "../../domain/skills/searchSkills.js";
import { runSkill } from "../../domain/skills/runSkill.js";
import { scaffoldSkill } from "../../domain/skills/scaffoldSkill.js";
import { validateAllSkills, validateSkill } from "../../domain/skills/validateSkill.js";
import { loadRegistry } from "../../adapters/skills-repo/localSkillsRegistry.js";
import { validateExecution, validatePayloadSize } from "../../domain/executions/validateExecution.js";
import {
  SKILL_NOT_FOUND,
  ARTIFACT_NOT_FOUND,
  COMPILE_VAR_MISSING,
  SKILL_SCRIPT_NOT_FOUND,
  SKILL_EXECUTION_FAILED,
  SKILL_EXECUTION_TIMEOUT,
  SKILL_OUTPUT_ASSERTION_FAILED,
  SKILL_ALREADY_EXISTS,
  SKILL_ID_INVALID,
  SKILL_VALIDATION_FAILED,
} from "../../contracts/skills.js";

const TEST_REGISTRY_PATH = join(packageRoot, "src", "test", "fixtures", "skills", "skills-registry.json");
const ORIGINAL_REGISTRY_PATH = process.env.CLAWPERATOR_SKILLS_REGISTRY;
const ORIGINAL_STDERR_WRITE = process.stderr.write.bind(process.stderr);

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

afterEach(() => {
  process.stderr.write = ORIGINAL_STDERR_WRITE;
  process.exitCode = undefined;
  process.env.CLAWPERATOR_SKILLS_REGISTRY = TEST_REGISTRY_PATH;
});

function runCli(
  args: string[],
  options?: { env?: NodeJS.ProcessEnv }
): Promise<{ stdout: string; stderr: string; code: number }> {
  const cliPath = join(packageRoot, "dist", "cli", "index.js");
  return new Promise((resolve) => {
    const proc = spawn(process.execPath, [cliPath, ...args], {
      cwd: packageRoot,
      env: options?.env ?? {
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
      cwd: options?.cwd ?? packageRoot,
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

function normalizeMacTmpPath(path: string): string {
  return normalize(path).replace(/^\/private(?=\/var\/)/, "");
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
  it("warns to stderr when CLAWPERATOR_SKILLS_REGISTRY is unset and the default path is missing", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-registry-unset-"));
    const originalCwd = process.cwd();
    delete process.env.CLAWPERATOR_SKILLS_REGISTRY;

    const stderrOutput: string[] = [];
    process.stderr.write = (chunk: unknown) => {
      stderrOutput.push(String(chunk));
      return true;
    };

    try {
      process.chdir(tempRoot);

      await assert.rejects(() => loadRegistry(), /Registry not found at default path:/);
      assert.ok(
        stderrOutput.some(line => line.includes("CLAWPERATOR_SKILLS_REGISTRY")),
        `Expected stderr to mention CLAWPERATOR_SKILLS_REGISTRY, got: ${stderrOutput.join("")}`
      );
    } finally {
      process.chdir(originalCwd);
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("writes the configured path to stderr when CLAWPERATOR_SKILLS_REGISTRY points to a missing file", async () => {
    process.env.CLAWPERATOR_SKILLS_REGISTRY = "/tmp/does-not-exist/skills-registry.json";

    const stderrOutput: string[] = [];
    process.stderr.write = (chunk: unknown) => {
      stderrOutput.push(String(chunk));
      return true;
    };

    await assert.rejects(
      () => loadRegistry(),
      /Registry not found at configured path: \/tmp\/does-not-exist\/skills-registry\.json/
    );
    assert.ok(
      stderrOutput.some(line => line.includes("/tmp/does-not-exist/skills-registry.json")),
      `Expected stderr to include the missing path, got: ${stderrOutput.join("")}`
    );
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
      const modulePath = join(packageRoot, "dist", "adapters", "skills-repo", "localSkillsRegistry.js");
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
      assert.strictEqual(normalizeMacTmpPath(parsed.resolvedPath), normalizeMacTmpPath(fallbackPath));
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

describe("validateSkill", () => {
  it("returns validation details for a known valid skill", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-valid-"));
    const skillsDir = join(tempRoot, "skills");
    const skillDir = join(skillsDir, "com.test.valid");
    const registryPath = join(skillsDir, "skills-registry.json");
    const entry = {
      id: "com.test.valid",
      applicationId: "com.test",
      intent: "valid",
      summary: "Valid skill",
      path: "skills/com.test.valid",
      skillFile: "skills/com.test.valid/SKILL.md",
      scripts: ["skills/com.test.valid/scripts/run.js"],
      artifacts: [],
    };

    await mkdir(join(skillDir, "scripts"), { recursive: true });
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(skillDir, "scripts", "run.js")
    );
    await writeFile(registryPath, `${JSON.stringify({ skills: [entry] }, null, 2)}\n`, "utf8");
    await writeFile(join(skillDir, "skill.json"), `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    await writeFile(join(skillDir, "SKILL.md"), "# Valid Skill\n", "utf8");

    try {
      const result = await validateSkill("com.test.valid", registryPath);
      if (!result.ok) assert.fail(result.message);
      assert.ok(result.checks.skillJsonPath.endsWith("/skill.json"));
      assert.ok(result.checks.skillFilePath.endsWith("/SKILL.md"));
      assert.ok(result.checks.scriptPaths.some((file) => file.endsWith("/run.js")));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns SKILL_VALIDATION_FAILED when a referenced file is missing", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-"));
    const skillsDir = join(tempRoot, "skills");
    const skillDir = join(skillsDir, "com.test.invalid");
    const registryPath = join(skillsDir, "skills-registry.json");
    const entry = {
      id: "com.test.invalid",
      applicationId: "com.test",
      intent: "invalid",
      summary: "Broken skill",
      path: "skills/com.test.invalid",
      skillFile: "skills/com.test.invalid/SKILL.md",
      scripts: ["skills/com.test.invalid/scripts/run.js"],
      artifacts: [],
    };

    await mkdir(join(skillDir, "scripts"), { recursive: true });
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(skillDir, "scripts", "run.js")
    );
    await writeFile(registryPath, `${JSON.stringify({ skills: [entry] }, null, 2)}\n`, "utf8");
    await writeFile(join(skillDir, "skill.json"), `${JSON.stringify(entry, null, 2)}\n`, "utf8");

    try {
      const result = await validateSkill("com.test.invalid", registryPath);
      assert.ok(!result.ok);
      assert.strictEqual(result.code, SKILL_VALIDATION_FAILED);
      assert.ok(result.details?.missingFiles?.some((file) => file.endsWith("/SKILL.md")));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("validateAllSkills", () => {
  it("returns a full success summary when every registry skill is valid", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-validate-all-valid-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    const alphaDir = join(registryDir, "com.example.alpha.capture");
    const betaDir = join(registryDir, "com.example.beta.capture");
    const alphaEntry = {
      id: "com.example.alpha.capture",
      applicationId: "com.example.alpha",
      intent: "capture",
      summary: "Capture alpha",
      path: "skills/com.example.alpha.capture",
      skillFile: "skills/com.example.alpha.capture/SKILL.md",
      scripts: ["skills/com.example.alpha.capture/scripts/run.js"],
      artifacts: [],
    };
    const betaEntry = {
      id: "com.example.beta.capture",
      applicationId: "com.example.beta",
      intent: "capture",
      summary: "Capture beta",
      path: "skills/com.example.beta.capture",
      skillFile: "skills/com.example.beta.capture/SKILL.md",
      scripts: ["skills/com.example.beta.capture/scripts/run.js"],
      artifacts: [],
    };

    await mkdir(join(alphaDir, "scripts"), { recursive: true });
    await mkdir(join(betaDir, "scripts"), { recursive: true });
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(alphaDir, "scripts", "run.js")
    );
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(betaDir, "scripts", "run.js")
    );
    await writeFile(join(alphaDir, "SKILL.md"), "# Alpha\n", "utf8");
    await writeFile(join(betaDir, "SKILL.md"), "# Beta\n", "utf8");
    await writeFile(join(alphaDir, "skill.json"), `${JSON.stringify(alphaEntry, null, 2)}\n`, "utf8");
    await writeFile(join(betaDir, "skill.json"), `${JSON.stringify(betaEntry, null, 2)}\n`, "utf8");
    await writeFile(
      registryPath,
      `${JSON.stringify({ schemaVersion: "1", skills: [alphaEntry, betaEntry] }, null, 2)}\n`,
      "utf8"
    );

    try {
      const result = await validateAllSkills(registryPath);
      if (!result.ok) assert.fail(result.message);
      assert.strictEqual(result.totalSkills, 2);
      assert.strictEqual(result.validSkills.length, 2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("returns a summary of broken entries when one registry skill is invalid", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-validate-all-invalid-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    const validDir = join(registryDir, "com.example.valid.capture");
    const invalidDir = join(registryDir, "com.example.invalid.capture");
    const validEntry = {
      id: "com.example.valid.capture",
      applicationId: "com.example.valid",
      intent: "capture",
      summary: "Valid skill",
      path: "skills/com.example.valid.capture",
      skillFile: "skills/com.example.valid.capture/SKILL.md",
      scripts: ["skills/com.example.valid.capture/scripts/run.js"],
      artifacts: [],
    };
    const invalidEntry = {
      id: "com.example.invalid.capture",
      applicationId: "com.example.invalid",
      intent: "capture",
      summary: "Invalid skill",
      path: "skills/com.example.invalid.capture",
      skillFile: "skills/com.example.invalid.capture/SKILL.md",
      scripts: ["skills/com.example.invalid.capture/scripts/run.js"],
      artifacts: [],
    };

    await mkdir(join(validDir, "scripts"), { recursive: true });
    await mkdir(join(invalidDir, "scripts"), { recursive: true });
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(validDir, "scripts", "run.js")
    );
    await writeFile(join(validDir, "SKILL.md"), "# Valid\n", "utf8");
    await writeFile(join(validDir, "skill.json"), `${JSON.stringify(validEntry, null, 2)}\n`, "utf8");
    await writeFile(join(invalidDir, "skill.json"), `${JSON.stringify(invalidEntry, null, 2)}\n`, "utf8");
    await writeFile(
      registryPath,
      `${JSON.stringify({ schemaVersion: "1", skills: [validEntry, invalidEntry] }, null, 2)}\n`,
      "utf8"
    );

    try {
      const result = await validateAllSkills(registryPath);
      assert.ok(!result.ok);
      assert.strictEqual(result.code, SKILL_VALIDATION_FAILED);
      assert.strictEqual(result.details?.totalSkills, 2);
      assert.strictEqual(result.details?.validCount, 1);
      assert.strictEqual(result.details?.invalidCount, 1);
      assert.strictEqual(result.details?.failures[0]?.skillId, invalidEntry.id);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
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
    assert.strictEqual(openController.params?.matcher?.textContains, 'Master "Quoted"');
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

describe("scaffoldSkill", () => {
  it("creates a new skill folder and registry entry", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.demo.capture-state";
      const result = await scaffoldSkill(skillId, registryPath);
      if (!result.ok) assert.fail(result.message);

      assert.strictEqual(result.skillId, skillId);
      assert.ok(result.files.some((file) => file.endsWith("/skill.json")));
      assert.ok(result.files.some((file) => file.endsWith("/SKILL.md")));
      assert.ok(result.files.some((file) => file.endsWith("/scripts/run.js")));

      const registryRaw = await readFile(registryPath, "utf8");
      const registry = JSON.parse(registryRaw);
      const entry = registry.skills.find((skill: { id: string }) => skill.id === skillId);
      assert.ok(entry);
      assert.strictEqual(entry.applicationId, "com.example.demo");
      assert.strictEqual(entry.intent, "capture-state");
      assert.deepStrictEqual(entry.artifacts, []);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects invalid skill ids", async () => {
    const result = await scaffoldSkill("invalid-skill-id", TEST_REGISTRY_PATH);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_ID_INVALID);
  });

  it("rejects duplicate skill ids", async () => {
    const result = await scaffoldSkill("com.android.settings.capture-overview", TEST_REGISTRY_PATH);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_ALREADY_EXISTS);
  });

  it("CLI skills new scaffolds a local skill into the configured registry", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-cli-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.weather.read-summary";
      const { stdout, code } = await runCli(
        ["skills", "new", skillId, "--output", "json"],
        {
          env: {
            ...process.env,
            CLAWPERATOR_SKILLS_REGISTRY: registryPath,
          },
        }
      );

      assert.strictEqual(code, 0, stdout);
      const parsed = JSON.parse(stdout) as { created?: boolean; skillId?: string; skillPath?: string };
      assert.strictEqual(parsed.created, true);
      assert.strictEqual(parsed.skillId, skillId);
      assert.ok(parsed.skillPath?.endsWith(`/skills/${skillId}`));

      const registryRaw = await readFile(registryPath, "utf8");
      const registry = JSON.parse(registryRaw);
      assert.ok(registry.skills.some((skill: { id: string }) => skill.id === skillId));
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("CLI skills validate reports a valid scaffolded skill", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-cli-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: "1", skills: [] }, null, 2)}\n`, "utf8");

    try {
      const skillId = "com.example.capture-overview";
      const createResult = await runCli(["skills", "new", skillId, "--output", "json"], {
        env: {
          ...process.env,
          CLAWPERATOR_SKILLS_REGISTRY: registryPath,
        },
      });
      assert.strictEqual(createResult.code, 0, createResult.stderr);

      const validateResult = await runCli(["skills", "validate", skillId, "--output", "json"], {
        env: {
          ...process.env,
          CLAWPERATOR_SKILLS_REGISTRY: registryPath,
        },
      });
      assert.strictEqual(validateResult.code, 0, validateResult.stderr);

      const parsed = JSON.parse(validateResult.stdout) as {
        valid?: boolean;
        skill?: { id?: string };
      };
      assert.strictEqual(parsed.valid, true);
      assert.strictEqual(parsed.skill?.id, skillId);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("CLI skills validate --all reports registry-wide success for scaffolded skills", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-all-cli-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: "1", skills: [] }, null, 2)}\n`, "utf8");

    try {
      const firstSkillId = "com.example.capture-one";
      const secondSkillId = "com.example.capture-two";
      const createFirst = await runCli(["skills", "new", firstSkillId, "--output", "json"], {
        env: {
          ...process.env,
          CLAWPERATOR_SKILLS_REGISTRY: registryPath,
        },
      });
      assert.strictEqual(createFirst.code, 0, createFirst.stderr);

      const createSecond = await runCli(["skills", "new", secondSkillId, "--output", "json"], {
        env: {
          ...process.env,
          CLAWPERATOR_SKILLS_REGISTRY: registryPath,
        },
      });
      assert.strictEqual(createSecond.code, 0, createSecond.stderr);

      const validateResult = await runCli(["skills", "validate", "--all", "--output", "json"], {
        env: {
          ...process.env,
          CLAWPERATOR_SKILLS_REGISTRY: registryPath,
        },
      });
      assert.strictEqual(validateResult.code, 0, validateResult.stderr);

      const parsed = JSON.parse(validateResult.stdout) as {
        valid?: boolean;
        totalSkills?: number;
        validSkills?: Array<{ skill?: { id?: string } }>;
      };
      assert.strictEqual(parsed.valid, true);
      assert.strictEqual(parsed.totalSkills, 2);
      assert.strictEqual(parsed.validSkills?.length, 2);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
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
    assert.ok(result.stdout?.includes('"stage":"before-failure"'));
    assert.ok(result.stderr?.includes("FAIL_OUTPUT:intentional"));
  });

  it("returns partial stdout when a skill times out", async () => {
    const result = await runSkill("com.test.partial-timeout", [], undefined, 150);
    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_EXECUTION_TIMEOUT);
    assert.ok(result.stdout?.includes('"stage":"before-timeout"'));
  });

  it("CLI skills run includes partial stdout on failure", async () => {
    const { stdout, code } = await runCli(["skills", "run", "com.test.fail", "--output", "json"]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; stdout?: string; stderr?: string };
    assert.strictEqual(parsed.code, SKILL_EXECUTION_FAILED);
    assert.ok(parsed.stdout?.includes('"stage":"before-failure"'));
    assert.ok(parsed.stderr?.includes("FAIL_OUTPUT:intentional"));
  });

  it("CLI skills run accepts --timeout-ms and returns it in the success payload", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--timeout-ms", "3210", "--output", "json", "--", "hello", "world",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { skillId?: string; output?: string; timeoutMs?: number };
    assert.strictEqual(parsed.skillId, "com.test.echo");
    assert.strictEqual(parsed.timeoutMs, 3210);
    assert.ok(parsed.output?.includes("TEST_OUTPUT:hello"));
  });

  it("CLI skills run prefers local --timeout-ms over the global flag", async () => {
    const { stdout, code } = await runCli([
      "--timeout-ms", "9000",
      "skills", "run", "com.test.echo", "--timeout-ms", "3210", "--output", "json", "--", "hello",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { skillId?: string; timeoutMs?: number };
    assert.strictEqual(parsed.skillId, "com.test.echo");
    assert.strictEqual(parsed.timeoutMs, 3210);
  });

  it("CLI skills run rejects a non-numeric local --timeout-ms", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--timeout-ms", "abc", "--output", "json", "--", "hello",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(parsed.message, "timeoutMs must be a finite number");
  });

  it("CLI skills run rejects a non-numeric global --timeout-ms", async () => {
    const { stdout, code } = await runCli([
      "--timeout-ms", "abc",
      "skills", "run", "com.test.echo", "--output", "json", "--", "hello",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(parsed.message, "timeoutMs must be a finite number");
  });

  it("CLI skills run returns USAGE when local --timeout-ms is missing a value", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--timeout-ms",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.strictEqual(parsed.message, "--timeout-ms requires a value");
  });

  it("CLI skills run returns USAGE when --expect-contains is missing a value", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--expect-contains",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.strictEqual(parsed.message, "--expect-contains requires a value");
  });

  it("CLI skills run returns usage when skill_id is missing even with --timeout-ms", async () => {
    const { stdout } = await runCli(["skills", "run", "--timeout-ms", "5000", "--output", "json"]);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.ok(parsed.message?.includes("--timeout-ms"));
  });

  it("CLI skills run can assert output content", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--expect-contains", "TEST_OUTPUT:hello", "--output", "json", "--", "hello",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { expectedSubstring?: string; output?: string };
    assert.strictEqual(parsed.expectedSubstring, "TEST_OUTPUT:hello");
    assert.ok(parsed.output?.includes("TEST_OUTPUT:hello"));
  });

  it("CLI skills run returns assertion failure when expected text is missing", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.echo", "--expect-contains", "missing-value", "--output", "json", "--", "hello",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as { code?: string; expectedSubstring?: string; output?: string };
    assert.strictEqual(parsed.code, SKILL_OUTPUT_ASSERTION_FAILED);
    assert.strictEqual(parsed.expectedSubstring, "missing-value");
    assert.ok(parsed.output?.includes("TEST_OUTPUT:hello"));
  });
});
