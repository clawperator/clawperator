import { describe, it, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { spawn } from "node:child_process";
import { chmod, mkdtemp, mkdir, copyFile, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";
import {
  CLAWPERATOR_BIN_ENV_VAR,
  CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR,
  DEFAULT_RECEIVER_PACKAGE,
  formatSkillBinCommand,
  resolveSkillBin,
  resolveSkillBinCommand,
  resolveOperatorPackage,
} from "../../domain/skills/skillsConfig.js";

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
import { cmdSkillsRun } from "../../cli/commands/skills.js";
import { createLogger } from "../../adapters/logger.js";
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
const TEST_SKILL_VALID_ARTIFACT = "test-skill-valid-artifact";
const TEST_SKILL_INVALID_ARTIFACT = "test-skill-invalid-artifact";
const TEST_SKILL_SCRIPT_ONLY = "test-skill-script-only";
const TEST_SKILL_EMPTY_ARTIFACTS = "test-skill-empty-artifacts";
const TEST_SKILL_PROGRESS = "com.test.progress";
const TEST_FIXTURE_CHUNKED_OUTPUT = "test-fixture-chunked-output";
const TEST_FIXTURE_MIXED_STREAMS = "test-fixture-mixed-streams";
const TEST_FIXTURE_SPLIT_WORD = "test-fixture-split-word";
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

async function getPackageVersion(): Promise<string> {
  const pkg = await readFile(join(packageRoot, "package.json"), "utf8");
  const parsed = JSON.parse(pkg) as { version?: string };
  return parsed.version ?? "0.0.0";
}

function getTodayLogPath(): string {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return join(homedir(), ".clawperator", "logs", `clawperator-${yyyy}-${mm}-${dd}.log`);
}

async function createFakeAdb(options: {
  installed: boolean;
  operatorPackage: string;
  installedPackage?: string;
  packageListCode?: number;
  packageListStderr?: string;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "clawperator-fake-adb-"));
  const scriptPath = join(dir, "adb");
  const script = [
    "#!/bin/sh",
    "if [ \"$1\" = \"-s\" ]; then",
    "  shift 2",
    "fi",
    "if [ \"$1\" = \"shell\" ] && [ \"$2\" = \"pm\" ] && [ \"$3\" = \"list\" ] && [ \"$4\" = \"packages\" ]; then",
    `  if [ ${JSON.stringify(options.packageListCode ?? 0)} -ne 0 ]; then`,
    `    printf '%s\\n' ${JSON.stringify(options.packageListStderr ?? "package query failed")} 1>&2`,
    `    exit ${JSON.stringify(options.packageListCode ?? 1)}`,
    "  fi",
    `  if [ ${JSON.stringify(options.installed ? 0 : 1)} -eq 0 ] && [ \"$5\" = ${JSON.stringify(options.installedPackage ?? options.operatorPackage)} ]; then`,
    `    printf 'package:%s\\n' \"$5\"`,
    "  fi",
    "  exit 0",
    "fi",
    "if [ \"$1\" = \"version\" ]; then",
    "  printf 'Android Debug Bridge version 1.0.41\\n'",
    "  exit 0",
    "fi",
    "exit 0",
  ].join("\n");
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
  return dir;
}

describe("listSkills", () => {
  it("returns skills from registry when available", async () => {
    const result = await listSkills();
    if (!result.ok) {
      assert.fail(`Expected listSkills to succeed when registry present: ${result.message}`);
    }
    assert.ok(Array.isArray(result.skills));
    const chromecast = result.skills.find((s) => s.id === "com.google.android.apps.chromecast.app.get-climate");
    assert.ok(chromecast);
    assert.strictEqual(chromecast.artifacts.length, 1);
    assert.ok(chromecast.artifacts[0].endsWith("climate-status.recipe.json"));
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
    const result = await getSkill("com.google.android.apps.chromecast.app.get-climate");
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.skill.id, "com.google.android.apps.chromecast.app.get-climate");
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

  it("still passes invalid artifact payloads without dry-run", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-artifact-"));
    const skillsDir = join(tempRoot, "skills");
    const skillDir = join(skillsDir, "com.test.artifact");
    const registryPath = join(skillsDir, "skills-registry.json");
    const entry = {
      id: "com.test.artifact",
      applicationId: "com.test",
      intent: "artifact",
      summary: "Artifact-backed skill",
      path: "skills/com.test.artifact",
      skillFile: "skills/com.test.artifact/SKILL.md",
      scripts: ["skills/com.test.artifact/scripts/run.js"],
      artifacts: ["skills/com.test.artifact/artifacts/bad.json"],
    };

    await mkdir(join(skillDir, "scripts"), { recursive: true });
    await mkdir(join(skillDir, "artifacts"), { recursive: true });
    await copyFile(
      join(packageRoot, "src", "test", "fixtures", "skills", "com.test.echo", "scripts", "echo.js"),
      join(skillDir, "scripts", "run.js")
    );
    await writeFile(join(skillDir, "SKILL.md"), "# Artifact Skill\n", "utf8");
    await writeFile(
      join(skillDir, "artifacts", "bad.json"),
      `${JSON.stringify({
        commandId: "cmd",
        taskId: "task",
        source: "skill",
        expectedFormat: "android-ui-automator",
        timeoutMs: 1000,
        actions: [
          { id: "snap", type: "snapshot_ui", params: { format: "ascii" } },
        ],
      }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(registryPath, `${JSON.stringify({ skills: [entry] }, null, 2)}\n`, "utf8");
    await writeFile(join(skillDir, "skill.json"), `${JSON.stringify(entry, null, 2)}\n`, "utf8");

    try {
      const result = await validateSkill("com.test.artifact", registryPath);
      if (!result.ok) assert.fail(result.message);
      assert.ok(result.checks.artifactPaths.some((file) => file.endsWith("/bad.json")));
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

  it("rejects registry entries that omit the scripts array", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-validate-missing-scripts-"));
    const skillsDir = join(tempRoot, "skills");
    const skillDir = join(skillsDir, "com.test.missing-scripts");
    const registryPath = join(skillsDir, "skills-registry.json");
    const entry = {
      id: "com.test.missing-scripts",
      applicationId: "com.test",
      intent: "missing-scripts",
      summary: "Broken skill",
      path: "skills/com.test.missing-scripts",
      skillFile: "skills/com.test.missing-scripts/SKILL.md",
      artifacts: [],
    };

    await mkdir(skillDir, { recursive: true });
    await writeFile(registryPath, `${JSON.stringify({ skills: [entry] }, null, 2)}\n`, "utf8");
    await writeFile(
      join(skillDir, "skill.json"),
      `${JSON.stringify({
        id: "com.test.missing-scripts",
        applicationId: "com.test",
        intent: "missing-scripts",
        summary: "Broken skill",
        path: "skills/com.test.missing-scripts",
        skillFile: "skills/com.test.missing-scripts/SKILL.md",
        artifacts: [],
      }, null, 2)}\n`,
      "utf8"
    );
    await writeFile(join(skillDir, "SKILL.md"), "# Broken Skill\n", "utf8");

    try {
      const result = await validateSkill("com.test.missing-scripts", registryPath);
      assert.ok(!result.ok);
      assert.strictEqual(result.code, SKILL_VALIDATION_FAILED);
      assert.deepStrictEqual(result.details?.missingFields, ["scripts"]);
      assert.strictEqual(result.details?.mismatchFields, undefined);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});

describe("skills validate dry-run", () => {
  it("passes a valid artifact-backed skill", async () => {
    const { stdout, stderr, code } = await runCli([
      "skills",
      "validate",
      TEST_SKILL_VALID_ARTIFACT,
      "--dry-run",
      "--output",
      "json",
    ]);
    assert.strictEqual(code, 0, stdout);
    assert.strictEqual(stderr, "");
    const parsed = JSON.parse(stdout) as { valid?: boolean; dryRun?: unknown };
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.dryRun, undefined);
  });

  it("fails an invalid artifact-backed skill with PRD-2 details", async () => {
    const { stdout, code } = await runCli([
      "skills",
      "validate",
      TEST_SKILL_INVALID_ARTIFACT,
      "--dry-run",
      "--output",
      "json",
    ]);
    assert.strictEqual(code, 1, stdout);
    const parsed = JSON.parse(stdout) as {
      code?: string;
      message?: string;
      details?: {
        artifact?: string;
        actionId?: string;
        actionType?: string;
        invalidKeys?: string[];
        hint?: string;
      };
    };
    assert.strictEqual(parsed.code, SKILL_VALIDATION_FAILED);
    assert.match(parsed.message ?? "", /artifact payload schema violation/);
    assert.strictEqual(parsed.details?.artifact, "artifact.json");
    assert.strictEqual(parsed.details?.actionId, "snap");
    assert.strictEqual(parsed.details?.actionType, "snapshot_ui");
    assert.deepStrictEqual(parsed.details?.invalidKeys, ["format"]);
    assert.match(parsed.details?.hint ?? "", /removed from snapshot_ui/);
  });

  it("skips payload validation for script-only skills and logs the reason in pretty mode", async () => {
    for (const skillId of [TEST_SKILL_SCRIPT_ONLY, TEST_SKILL_EMPTY_ARTIFACTS]) {
      const { stdout, stderr, code } = await runCli([
        "skills",
        "validate",
        skillId,
        "--dry-run",
        "--output",
        "pretty",
      ]);
      assert.strictEqual(code, 0, stdout);
      assert.match(stderr, /Payload validation skipped: no pre-compiled artifacts/);
      const parsed = JSON.parse(stdout) as {
        valid?: boolean;
        dryRun?: { payloadValidation?: string; reason?: string };
      };
      assert.strictEqual(parsed.valid, true);
      assert.strictEqual(parsed.dryRun?.payloadValidation, "skipped");
      assert.strictEqual(
        parsed.dryRun?.reason,
        "skill has no pre-compiled artifacts; payload is generated at runtime by the skill script"
      );
    }
  });

  it("emits JSON-parseable output for dry-run success and failure", async () => {
    const success = await runCli([
      "skills",
      "validate",
      TEST_SKILL_VALID_ARTIFACT,
      "--dry-run",
      "--output",
      "json",
    ]);
    const failure = await runCli([
      "skills",
      "validate",
      TEST_SKILL_INVALID_ARTIFACT,
      "--dry-run",
      "--output",
      "json",
    ]);

    assert.doesNotThrow(() => JSON.parse(success.stdout));
    assert.doesNotThrow(() => JSON.parse(failure.stdout));
  });

  it("passes dry-run for a real bundled artifact-backed skill without a device", async () => {
    const { stdout, code } = await runCli([
      "skills",
      "validate",
      "com.google.android.apps.chromecast.app.get-climate",
      "--dry-run",
      "--output",
      "json",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { valid?: boolean; skill?: { id?: string } };
    assert.strictEqual(parsed.valid, true);
    assert.strictEqual(parsed.skill?.id, "com.google.android.apps.chromecast.app.get-climate");
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
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, COMPILE_VAR_MISSING);
    assert.ok(result.details && result.details.placeholder === "CLIMATE_TILE_NAME");
  });

  it("returns valid execution when vars include required placeholder", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      '{"CLIMATE_TILE_NAME":"Master"}'
    );
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.execution.mode, "artifact_compiled");
    assert.ok(result.execution.commandId);
    assert.ok(result.execution.actions.length > 0);
  });

  it("escapes vars safely so quoted values keep compiled JSON valid", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      "{\"CLIMATE_TILE_NAME\":\"Master \\\"Quoted\\\"\"}"
    );
    if (!result.ok) assert.fail(result.message);
    const openController = result.execution.actions.find((a) => a.id === "openController");
    assert.ok(openController);
    assert.strictEqual(openController.params?.matcher?.textContains, 'Master "Quoted"');
  });

  it("returns ARTIFACT_NOT_FOUND for wrong artifact name", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "nonexistent-artifact",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, ARTIFACT_NOT_FOUND);
  });

  it("compile failure returns nested details (not flattened top-level)", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      "{}"
    );
    assert.ok(!result.ok);
    assert.strictEqual(result.code, COMPILE_VAR_MISSING);
    assert.strictEqual(typeof result.message, "string");
    assert.ok(result.details && typeof result.details === "object");
    assert.strictEqual(result.details.placeholder, "CLIMATE_TILE_NAME");
    assert.ok("skillId" in result.details);
    assert.ok("artifactName" in result.details);
    const topLevelKeys = Object.keys(result as object).filter((k) => k !== "ok" && k !== "code" && k !== "message" && k !== "details");
    assert.strictEqual(topLevelKeys.length, 0, "diagnostic fields must be under details, not top-level");
  });

  it("accepts artifact name with .recipe.json suffix (same as bare name)", async () => {
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      '{"CLIMATE_TILE_NAME":"Master"}'
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status.recipe.json",
      '{"CLIMATE_TILE_NAME":"Master"}'
    );
    if (!r1.ok || !r2.ok) assert.fail("Expected both to succeed");
    assert.strictEqual(JSON.stringify(r1.execution), JSON.stringify(r2.execution));
  });

  it("produces deterministic execution for identical inputs", async () => {
    const varsJson = '{"CLIMATE_TILE_NAME":"Master"}';
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      varsJson
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
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
    const varsJson = '{"CLIMATE_TILE_NAME":"Master","COMMAND_ID":"cmd-user-1","TASK_ID":"task-user-1"}';
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      varsJson
    );
    if (!result.ok) assert.fail(result.message);
    assert.strictEqual(result.execution.commandId, "cmd-user-1");
    assert.strictEqual(result.execution.taskId, "task-user-1");
    assert.strictEqual(result.execution.mode, "artifact_compiled");
  });

  it("is insensitive to vars key order", async () => {
    const v1 = '{"CLIMATE_TILE_NAME":"Master","EXTRA":"1"}';
    const v2 = '{"EXTRA":"1","CLIMATE_TILE_NAME":"Master"}';
    const r1 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      v1
    );
    const r2 = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      v2
    );
    if (!r1.ok || !r2.ok) assert.fail("Expected both compileArtifact calls to succeed");
    const e1 = JSON.stringify(r1.execution);
    const e2 = JSON.stringify(r2.execution);
    assert.strictEqual(e1, e2);
  });

  it("CLI compile-artifact accepts --skill-id (same result as positional skill_id)", async () => {
    const skillId = "com.google.android.apps.chromecast.app.get-climate";
    const varsJson = '{"CLIMATE_TILE_NAME":"Master"}';
    const { stdout, code } = await runCli([
      "skills", "compile-artifact", "--skill-id", skillId, "--artifact", "climate-status", "--vars", varsJson, "--output", "json",
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
      "skills", "compile-artifact", "com.google.android.apps.chromecast.app.get-climate", "--output", "json",
    ]);
    const parsed = JSON.parse(stdout) as { code?: string; message?: string };
    assert.strictEqual(parsed.code, "USAGE");
    assert.ok(parsed.message?.includes("--artifact"));
  });

  it("compile-artifact output is valid execution input (e2e: compile → execute contract)", async () => {
    const result = await compileArtifact(
      "com.google.android.apps.chromecast.app.get-climate",
      "climate-status",
      '{"CLIMATE_TILE_NAME":"Master"}',
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
      assert.ok(result.files.some((file) => file.endsWith("/scripts/run.sh")));

      const registryRaw = await readFile(registryPath, "utf8");
      const registry = JSON.parse(registryRaw);
      const entry = registry.skills.find((skill: { id: string }) => skill.id === skillId);
      assert.ok(entry);
      assert.strictEqual(entry.applicationId, "com.example.demo");
      assert.strictEqual(entry.intent, "capture-state");
      assert.deepStrictEqual(entry.scripts, [
        `skills/${skillId}/scripts/run.js`,
        `skills/${skillId}/scripts/run.sh`,
      ]);
      assert.deepStrictEqual(entry.artifacts, []);

      const runShPath = join(tempRoot, "skills", skillId, "scripts", "run.sh");
      const runShContent = await readFile(runShPath, "utf8");
      const runShStats = await stat(runShPath);
      assert.match(runShContent, /node "\$DIR\/run\.js" "\$@"/);
      assert.ok((runShStats.mode & 0o111) !== 0, `Expected run.sh to be executable, mode=${runShStats.mode.toString(8)}`);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses a provided summary in skill.json and SKILL.md", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-summary-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.notes.capture-summary";
      const summary = "Capture the current Notes screen summary";
      const result = await scaffoldSkill(skillId, { registryPath, summary });
      if (!result.ok) assert.fail(result.message);

      const skillJson = JSON.parse(await readFile(join(tempRoot, "skills", skillId, "skill.json"), "utf8"));
      const skillMarkdown = await readFile(join(tempRoot, "skills", skillId, "SKILL.md"), "utf8");

      assert.strictEqual(skillJson.summary, summary);
      assert.match(skillMarkdown, /description: \|-\n/);
      assert.match(
        skillMarkdown,
        new RegExp(`\\n  ${summary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n---\\n`)
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("uses the default summary when one is not provided", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-default-summary-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.camera.capture-default";
      const expectedSummary = `TODO: describe ${skillId}`;
      const result = await scaffoldSkill(skillId, { registryPath });
      if (!result.ok) assert.fail(result.message);

      const skillJson = JSON.parse(await readFile(join(tempRoot, "skills", skillId, "skill.json"), "utf8"));
      const skillMarkdown = await readFile(join(tempRoot, "skills", skillId, "SKILL.md"), "utf8");

      assert.strictEqual(skillJson.summary, expectedSummary);
      assert.match(skillMarkdown, /description: \|-\n/);
      assert.match(
        skillMarkdown,
        new RegExp(`\\n  ${expectedSummary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n---\\n`)
      );
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("supports multi-line summaries without breaking YAML frontmatter", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-multiline-summary-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.multiline.capture";
      const summary = "Line1\nLine2: has colon\n- list-looking line\n# looks like a comment";
      const result = await scaffoldSkill(skillId, { registryPath, summary });
      if (!result.ok) assert.fail(result.message);

      const skillMarkdown = await readFile(join(tempRoot, "skills", skillId, "SKILL.md"), "utf8");

      // Ensure YAML uses a block scalar and preserves lines with indentation.
      assert.match(skillMarkdown, /description: \|-\n/);
      assert.match(skillMarkdown, /\n  Line1\n  Line2: has colon\n  - list-looking line\n  # looks like a comment\n---\n/);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("does not indent empty lines in YAML block scalars", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-empty-lines-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.empty-lines.capture";
      const summary = "Line1\n\nLine3";
      const result = await scaffoldSkill(skillId, { registryPath, summary });
      if (!result.ok) assert.fail(result.message);

      const skillMarkdown = await readFile(join(tempRoot, "skills", skillId, "SKILL.md"), "utf8");

      // Empty line should remain empty, not contain indentation spaces.
      assert.ok(skillMarkdown.includes("description: |-\n  Line1\n\n  Line3\n---\n"), skillMarkdown);
      assert.ok(!skillMarkdown.includes("\n  \n"), "Expected no trailing spaces on empty lines");
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it("treats null summary like an omitted summary", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-scaffold-null-summary-"));
    const registryDir = join(tempRoot, "skills");
    const registryPath = join(registryDir, "skills-registry.json");
    await mkdir(registryDir, { recursive: true });
    await copyFile(TEST_REGISTRY_PATH, registryPath);

    try {
      const skillId = "com.example.null-summary.capture";
      const expectedSummary = `TODO: describe ${skillId}`;
      const result = await scaffoldSkill(skillId, { registryPath, summary: null as unknown as string });
      if (!result.ok) assert.fail(result.message);

      const skillJson = JSON.parse(await readFile(join(tempRoot, "skills", skillId, "skill.json"), "utf8"));
      const skillMarkdown = await readFile(join(tempRoot, "skills", skillId, "SKILL.md"), "utf8");

      assert.strictEqual(skillJson.summary, expectedSummary);
      assert.match(skillMarkdown, /description: \|-\n/);
      assert.match(
        skillMarkdown,
        new RegExp(`\\n  ${expectedSummary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n---\\n`)
      );
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
        ["skills", "new", skillId, "--summary", "Read the current weather summary", "--output", "json"],
        {
          env: {
            ...process.env,
            CLAWPERATOR_SKILLS_REGISTRY: registryPath,
          },
        }
      );

      assert.strictEqual(code, 0, stdout);
      const parsed = JSON.parse(stdout) as { created?: boolean; skillId?: string; skillPath?: string; next?: string; files?: string[] };
      assert.strictEqual(parsed.created, true);
      assert.strictEqual(parsed.skillId, skillId);
      assert.ok(parsed.skillPath?.endsWith(`/skills/${skillId}`));
      assert.ok(parsed.files?.some((file) => file.endsWith("/scripts/run.sh")));
      assert.strictEqual(
        parsed.next,
        "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>"
      );

      const registryRaw = await readFile(registryPath, "utf8");
      const registry = JSON.parse(registryRaw);
      const entry = registry.skills.find((skill: { id: string }) => skill.id === skillId);
      assert.ok(entry);
      assert.strictEqual(entry.summary, "Read the current weather summary");
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
    const result = await searchSkills({ intent: "get-climate" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 1);
    assert.strictEqual(result.skills[0].id, "com.google.android.apps.chromecast.app.get-climate");
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
    const result = await searchSkills({ app: "com.android.settings", intent: "get-climate" });
    assert.ok(result.ok);
    assert.strictEqual(result.skills.length, 0);
  });
});

describe("runSkill", () => {
  it("accumulates chunked stdout without callbacks", async () => {
    const result = await runSkill(TEST_FIXTURE_CHUNKED_OUTPUT, []);
    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.strictEqual(result.output, "chunk1\nchunk2\n");
  });

  it("streams each stdout chunk to onOutput before resolution", async () => {
    const chunks: Array<{ chunk: string; stream: "stdout" | "stderr" }> = [];
    let resolved = false;
    const resultPromise = runSkill(TEST_FIXTURE_CHUNKED_OUTPUT, [], undefined, undefined, undefined, {
      onOutput: (chunk, stream) => {
        chunks.push({ chunk, stream });
        assert.strictEqual(resolved, false, "callback should fire before the promise resolves");
      },
    });

    const result = await resultPromise.then((value) => {
      resolved = true;
      return value;
    });

    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.deepStrictEqual(chunks, [
      { chunk: "chunk1\n", stream: "stdout" },
      { chunk: "chunk2\n", stream: "stdout" },
    ]);
  });

  it("keeps result.output as the full accumulated stdout when onOutput is provided", async () => {
    const result = await runSkill(TEST_FIXTURE_CHUNKED_OUTPUT, [], undefined, undefined, undefined, {
      onOutput: () => undefined,
    });

    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.strictEqual(result.output, "chunk1\nchunk2\n");
  });

  it("tags stderr chunks as stderr", async () => {
    const chunks: Array<{ chunk: string; stream: "stdout" | "stderr" }> = [];
    const result = await runSkill(TEST_FIXTURE_MIXED_STREAMS, [], undefined, undefined, undefined, {
      onOutput: (chunk, stream) => {
        chunks.push({ chunk, stream });
      },
    });

    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.deepStrictEqual(chunks, [
      { chunk: "stdout-line\n", stream: "stdout" },
      { chunk: "stderr-line\n", stream: "stderr" },
    ]);
  });

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

  it("keeps progress lines before the result line in result.output", async () => {
    const result = await runSkill(TEST_SKILL_PROGRESS, []);
    assert.ok(result.ok, `Expected progress fixture to succeed: ${"message" in result ? result.message : ""}`);

    const lines = result.output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const resultIndex = lines.findIndex((line) => line.startsWith("✅"));
    const progressLines = lines.filter((line) => line.startsWith("[skill:"));

    assert.ok(progressLines.length > 0, "expected at least one progress line");
    assert.ok(resultIndex >= 0, "expected a canonical result line");
    assert.strictEqual(lines[lines.length - 1].startsWith("✅"), true, "✅ line must be last");
    assert.ok(progressLines.every((line) => lines.indexOf(line) < resultIndex), "progress must precede result");
    assert.ok(!lines.slice(resultIndex + 1).some((line) => line.startsWith("[skill:")), "no progress after result");
  });

  it("preserves progress lines in JSON mode result.output", async () => {
    const { stdout, stderr, code } = await runCli([
      "skills",
      "run",
      TEST_SKILL_PROGRESS,
      "--output",
      "json",
    ]);

    assert.strictEqual(code, 0, stderr);
    const parsed = JSON.parse(stdout) as { output?: string };
    assert.ok(typeof parsed.output === "string");

    const outputLines = parsed.output!.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    assert.ok(outputLines.some((line) => line.startsWith("[skill:")), "expected progress lines in result.output");
    const resultLines = outputLines.filter((line) => line.startsWith("✅"));
    assert.strictEqual(resultLines.length, 1, "expected exactly one canonical result line");
    assert.ok(resultLines[0].includes("Progress fixture complete"));
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

  it("CLI skills run accepts --timeout as a local timeout flag", async () => {
    // Verifies that --timeout is recognised in the command-local segment.
    // Note: getGlobalOpts scans all argv linearly so the second --timeout (3210)
    // overwrites the first (9000) at the global level too. Both paths resolve to
    // 3210; this test confirms the flag is not silently dropped.
    const { stdout, code } = await runCli([
      "--timeout", "9000",
      "skills", "run", "com.test.echo", "--timeout", "3210", "--output", "json", "--", "hello",
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

  it("CLI skills run expects substrings across chunk boundaries", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_SPLIT_WORD, "--expect-contains", "hello", "--output", "json",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { skillId?: string; expectedSubstring?: string; output?: string };
    assert.strictEqual(parsed.skillId, TEST_FIXTURE_SPLIT_WORD);
    assert.strictEqual(parsed.expectedSubstring, "hello");
    assert.strictEqual(parsed.output, "hello\n");
  });

  it("CLI skills run keeps json output parseable without live skill output", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator.dev", "--output", "json",
    ], {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { output?: string; skillId?: string };
    assert.strictEqual(parsed.skillId, TEST_FIXTURE_CHUNKED_OUTPUT);
    assert.ok(parsed.output?.includes("chunk1"));
    assert.ok(parsed.output?.includes("chunk2"));
    assert.ok(!stdout.includes("[Clawperator]"));
  });

  it("CLI skills run prints a banner first in pretty mode", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator.dev", "--output", "pretty",
    ], {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(code, 0, stdout);
    const version = await getPackageVersion();
    const logPath = getTodayLogPath();
    const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
    assert.ok(lines[0]?.startsWith(`[Clawperator] v${version}  APK: OK (com.clawperator.operator.dev)`), lines[0]);
    assert.ok(lines[0]?.includes(`Logs: ${logPath}`), lines[0]);
    assert.ok(lines[0]?.includes(`Hint: tail -f ${logPath}`), lines[0]);
    assert.ok(lines[0]?.includes("Docs: https://docs.clawperator.com/llms.txt"), lines[0]);
  });

  it("CLI skills run banner reflects CLAWPERATOR_LOG_DIR overrides", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const tempLogDir = await mkdtemp(join(tmpdir(), "clawperator-logs-"));
    try {
      const now = new Date();
      const yyyy = String(now.getFullYear());
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const expectedLogPath = join(tempLogDir, `clawperator-${yyyy}-${mm}-${dd}.log`);
      const { stdout, code } = await runCli([
        "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator.dev", "--output", "pretty",
      ], {
        env: {
          ...process.env,
          PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
          CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
          CLAWPERATOR_LOG_DIR: tempLogDir,
        },
      });
      assert.strictEqual(code, 0, stdout);
      const lines = stdout.split(/\r?\n/).filter((line) => line.length > 0);
      assert.ok(lines[0]?.includes(`Logs: ${expectedLogPath}`), lines[0]);
      assert.ok(lines[0]?.includes(`Hint: tail -f ${expectedLogPath}`), lines[0]);
    } finally {
      await rm(tempLogDir, { recursive: true, force: true });
    }
  });

  it("CLI skills run preserves variant mismatch details in the pretty banner", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator",
      installedPackage: "com.clawperator.operator.dev",
    });
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator", "--output", "pretty",
    ], {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(code, 0, stdout);
    const firstLine = stdout.split(/\r?\n/, 1)[0] ?? "";
    assert.match(firstLine, /Wrong Operator variant installed/);
    assert.match(firstLine, /Expected com\.clawperator\.operator but found com\.clawperator\.operator\.dev/);
    assert.match(firstLine, /Use --operator-package com\.clawperator\.operator\.dev/);
  });

  it("CLI skills run preserves adb failure details in the pretty banner", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: false,
      operatorPackage: "com.clawperator.operator",
      packageListCode: 1,
      packageListStderr: "adb: device offline",
    });
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator", "--output", "pretty",
    ], {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(code, 0, stdout);
    const firstLine = stdout.split(/\r?\n/, 1)[0] ?? "";
    assert.match(firstLine, /Could not query installed packages on the device/);
    assert.match(firstLine, /adb: device offline/);
    assert.ok(!firstLine.includes("MISSING - run `clawperator operator setup --apk <path>`"));
  });

  it("CLI skills run suppresses the banner in json mode", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const { stdout, code } = await runCli([
      "skills", "run", TEST_FIXTURE_CHUNKED_OUTPUT, "--receiver-package", "com.clawperator.operator.dev", "--output", "json",
    ], {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(code, 0, stdout);
    assert.doesNotThrow(() => JSON.parse(stdout));
    assert.ok(!stdout.includes("[Clawperator]"));
  });
});

describe("cmdSkillsRun preflight gate", () => {
  it("aborts invalid artifact skills before runSkill is called", async () => {
    let runCalls = 0;
    const fakeRunSkill = async () => {
      runCalls += 1;
      return {
        ok: true,
        skillId: TEST_SKILL_INVALID_ARTIFACT,
        output: "should-not-run",
        exitCode: 0,
        durationMs: 1,
      } as const;
    };

    const stdout = await cmdSkillsRun(
      TEST_SKILL_INVALID_ARTIFACT,
      [],
      undefined,
      undefined,
      undefined,
      { format: "json", runSkillImpl: fakeRunSkill as typeof runSkill }
    );
    const parsed = JSON.parse(stdout) as { code?: string; details?: { artifact?: string } };
    assert.strictEqual(runCalls, 0);
    assert.strictEqual(parsed.code, SKILL_VALIDATION_FAILED);
    assert.strictEqual(parsed.details?.artifact, "artifact.json");
  });

  it("proceeds for valid artifact skills and calls runSkill", async () => {
    let runCalls = 0;
    const fakeRunSkill = async () => {
      runCalls += 1;
      return {
        ok: true,
        skillId: TEST_SKILL_VALID_ARTIFACT,
        output: "RUN_OK",
        exitCode: 0,
        durationMs: 1,
      } as const;
    };

    const stdout = await cmdSkillsRun(
      TEST_SKILL_VALID_ARTIFACT,
      [],
      undefined,
      undefined,
      undefined,
      { format: "json", runSkillImpl: fakeRunSkill as typeof runSkill }
    );
    const parsed = JSON.parse(stdout) as { skillId?: string; output?: string };
    assert.strictEqual(runCalls, 1);
    assert.strictEqual(parsed.skillId, TEST_SKILL_VALID_ARTIFACT);
    assert.strictEqual(parsed.output, "RUN_OK");
  });

  it("ignores pipe errors from live pretty-mode streaming", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const cmdModulePath = join(packageRoot, "dist", "cli", "commands", "skills.js");
    const script = `
      import { cmdSkillsRun } from ${JSON.stringify(cmdModulePath)};
      const originalWrite = process.stdout.write.bind(process.stdout);
      let writes = 0;
      process.stdout.write = ((chunk) => {
        writes += 1;
        if (writes > 1) {
          const error = new Error("broken pipe");
          error.code = "EPIPE";
          throw error;
        }
        return originalWrite(String(chunk));
      });
      const result = await cmdSkillsRun(
        ${JSON.stringify(TEST_FIXTURE_CHUNKED_OUTPUT)},
        [],
        undefined,
        undefined,
        ${JSON.stringify("com.clawperator.operator.dev")},
        {
          format: "pretty",
          skipValidate: true,
          runSkillImpl: async (_skillId, _args, _registryPath, _timeoutMs, _env, callbacks) => {
            callbacks?.onOutput?.("chunk1\\n", "stdout");
            callbacks?.onOutput?.("chunk2\\n", "stdout");
            return {
              ok: true,
              skillId: ${JSON.stringify(TEST_FIXTURE_CHUNKED_OUTPUT)},
              output: "chunk1\\nchunk2\\n",
              exitCode: 0,
              durationMs: 1,
            };
          }
        }
      );
      process.stderr.write(JSON.stringify({ result }));
    `;

    const child = await runNodeSnippet(script, {
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
    });
    assert.strictEqual(child.code, 0, child.stderr);
    const jsonLine = child.stderr.trim().split(/\r?\n/).reverse().find((line) => line.startsWith("{") && line.includes("\"result\""));
    assert.ok(jsonLine, child.stdout);
    const parsed = JSON.parse(jsonLine) as { result?: string };
    const rendered = JSON.parse(parsed.result ?? "{}") as { skillId?: string; output?: string };
    assert.strictEqual(rendered.skillId, TEST_FIXTURE_CHUNKED_OUTPUT);
    assert.strictEqual(rendered.output, "chunk1\nchunk2\n");
  });

  it("bypasses validation when --skip-validate is set", async () => {
    let runCalls = 0;
    const fakeRunSkill = async () => {
      runCalls += 1;
      return {
        ok: true,
        skillId: TEST_SKILL_INVALID_ARTIFACT,
        output: "RUN_OK",
        exitCode: 0,
        durationMs: 1,
      } as const;
    };

    const stdout = await cmdSkillsRun(
      TEST_SKILL_INVALID_ARTIFACT,
      [],
      undefined,
      undefined,
      undefined,
      { format: "json", skipValidate: true, runSkillImpl: fakeRunSkill as typeof runSkill }
    );
    const parsed = JSON.parse(stdout) as { skillId?: string; output?: string };
    assert.strictEqual(runCalls, 1);
    assert.strictEqual(parsed.skillId, TEST_SKILL_INVALID_ARTIFACT);
    assert.strictEqual(parsed.output, "RUN_OK");
  });
});


describe("resolveSkillBin", () => {
  const ORIGINAL_CLAWPERATOR_BIN = process.env[CLAWPERATOR_BIN_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_CLAWPERATOR_BIN === undefined) {
      delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_BIN_ENV_VAR] = ORIGINAL_CLAWPERATOR_BIN;
    }
  });

  it("returns explicit CLAWPERATOR_BIN when set", () => {
    process.env[CLAWPERATOR_BIN_ENV_VAR] = "/custom/path/to/clawperator";
    const result = resolveSkillBin();
    assert.strictEqual(result.cmd, "/custom/path/to/clawperator");
    assert.deepStrictEqual(result.args, []);
  });

  it("prefers explicit CLAWPERATOR_BIN over sibling build", () => {
    process.env[CLAWPERATOR_BIN_ENV_VAR] = "/explicit/clawperator";
    const result = resolveSkillBin();
    assert.strictEqual(result.cmd, "/explicit/clawperator");
    assert.deepStrictEqual(result.args, []);
  });

  it("falls back to global clawperator when no env var and no sibling build", () => {
    delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    const result = resolveSkillBin();
    // When running in test environment, the sibling build may or may not exist
    // The function should return either the sibling build or global binary
    assert.ok(result.cmd === "clawperator" || result.args.length === 1);
  });
});

describe("resolveSkillBinCommand", () => {
  const ORIGINAL_CLAWPERATOR_BIN = process.env[CLAWPERATOR_BIN_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_CLAWPERATOR_BIN === undefined) {
      delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_BIN_ENV_VAR] = ORIGINAL_CLAWPERATOR_BIN;
    }
  });

  it("returns explicit CLAWPERATOR_BIN when set", () => {
    process.env[CLAWPERATOR_BIN_ENV_VAR] = "/custom/path/to/clawperator";
    const result = resolveSkillBinCommand();
    assert.strictEqual(result, "/custom/path/to/clawperator");
  });

  it("returns full command with args for sibling build", () => {
    delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    const result = resolveSkillBinCommand();
    // When sibling build exists, should return "node "/path/to/cli/index.js""
    // When it doesn't exist, should return "clawperator"
    if (result !== "clawperator") {
      assert.ok(result.includes(" "), "Expected command with args for sibling build");
      assert.ok(result.startsWith(process.execPath), "Expected command to start with node executable");
    }
  });

  it("quotes command parts that contain spaces", () => {
    assert.strictEqual(
      formatSkillBinCommand({
        cmd: "C:\\Program Files\\nodejs\\node.exe",
        args: ["C:\\clawperator apps\\node\\dist\\cli\\index.js"],
      }),
      '"C:\\Program Files\\nodejs\\node.exe" "C:\\clawperator apps\\node\\dist\\cli\\index.js"'
    );
  });
});

describe("resolveOperatorPackage", () => {
  const ORIGINAL_RECEIVER_PACKAGE = process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_RECEIVER_PACKAGE === undefined) {
      delete process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR] = ORIGINAL_RECEIVER_PACKAGE;
    }
  });

  it("returns CLAWPERATOR_OPERATOR_PACKAGE env var when set", () => {
    process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR] = "com.clawperator.operator.dev";
    const result = resolveOperatorPackage();
    assert.strictEqual(result, "com.clawperator.operator.dev");
  });

  it("returns default release package when env var is not set", () => {
    delete process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];
    const result = resolveOperatorPackage();
    assert.strictEqual(result, DEFAULT_RECEIVER_PACKAGE);
  });

  it("returns default when env var is empty string", () => {
    process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR] = "";
    const result = resolveOperatorPackage();
    assert.strictEqual(result, DEFAULT_RECEIVER_PACKAGE);
  });
});

describe("runSkill env vars", () => {
  const ORIGINAL_BIN = process.env[CLAWPERATOR_BIN_ENV_VAR];
  const ORIGINAL_RECEIVER_PACKAGE = process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_BIN === undefined) {
      delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_BIN_ENV_VAR] = ORIGINAL_BIN;
    }
    if (ORIGINAL_RECEIVER_PACKAGE === undefined) {
      delete process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR] = ORIGINAL_RECEIVER_PACKAGE;
    }
  });

  it("injects CLAWPERATOR_BIN and CLAWPERATOR_OPERATOR_PACKAGE into skill env", async () => {
    // Test that runSkill accepts and passes the env parameter correctly
    const customEnv = {
      [CLAWPERATOR_BIN_ENV_VAR]: "/custom/bin/clawperator",
      [CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR]: "com.test.package",
    };
    const result = await runSkill("com.test.env-echo", [], undefined, undefined, customEnv);
    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    assert.ok(result.output.includes("CLAWPERATOR_BIN:/custom/bin/clawperator"), `Expected CLAWPERATOR_BIN in output, got: ${result.output}`);
    assert.ok(result.output.includes("CLAWPERATOR_OPERATOR_PACKAGE:com.test.package"), `Expected CLAWPERATOR_OPERATOR_PACKAGE in output, got: ${result.output}`);
  });

  it("uses default values when env parameter is not provided", async () => {
    // When no env is passed, the skill script won't receive the env vars
    // because runSkill no longer sets defaults internally (CLI layer does)
    const result = await runSkill("com.test.env-echo", []);
    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    // Without env parameter, these should be undefined (not injected by runSkill)
    assert.ok(result.output.includes("CLAWPERATOR_BIN:undefined"), `Expected CLAWPERATOR_BIN to be undefined when not passed, got: ${result.output}`);
    assert.ok(result.output.includes("CLAWPERATOR_OPERATOR_PACKAGE:undefined"), `Expected CLAWPERATOR_OPERATOR_PACKAGE to be undefined when not passed, got: ${result.output}`);
  });
});

describe("CLI skills run env vars", () => {
  const ORIGINAL_BIN = process.env[CLAWPERATOR_BIN_ENV_VAR];
  const ORIGINAL_RECEIVER_PACKAGE = process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];

  afterEach(() => {
    if (ORIGINAL_BIN === undefined) {
      delete process.env[CLAWPERATOR_BIN_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_BIN_ENV_VAR] = ORIGINAL_BIN;
    }
    if (ORIGINAL_RECEIVER_PACKAGE === undefined) {
      delete process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR];
    } else {
      process.env[CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR] = ORIGINAL_RECEIVER_PACKAGE;
    }
  });

  it("CLI skills run passes CLAWPERATOR_OPERATOR_PACKAGE via --operator-package flag", async () => {
    const { stdout, code } = await runCli([
      "skills", "run", "com.test.env-echo", "--receiver-package", "com.clawperator.operator.dev", "--output", "json",
    ]);
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { output?: string };
    assert.ok(parsed.output?.includes("CLAWPERATOR_OPERATOR_PACKAGE:com.clawperator.operator.dev"), `Expected dev package in output, got: ${parsed.output}`);
  });

  it("CLI skills run uses CLAWPERATOR_OPERATOR_PACKAGE env var when flag is not provided", async () => {
    const { stdout, code } = await runCli(
      ["skills", "run", "com.test.env-echo", "--output", "json"],
      {
        env: {
          ...process.env,
          CLAWPERATOR_OPERATOR_PACKAGE: "com.custom.operator.package",
        },
      }
    );
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { output?: string };
    assert.ok(parsed.output?.includes("CLAWPERATOR_OPERATOR_PACKAGE:com.custom.operator.package"), `Expected custom package in output, got: ${parsed.output}`);
  });

  it("CLI skills run --operator-package flag takes precedence over env var", async () => {
    const { stdout, code } = await runCli(
      ["skills", "run", "com.test.env-echo", "--receiver-package", "flag.package.value", "--output", "json"],
      {
        env: {
          ...process.env,
          CLAWPERATOR_OPERATOR_PACKAGE: "env.package.value",
        },
      }
    );
    assert.strictEqual(code, 0, stdout);
    const parsed = JSON.parse(stdout) as { output?: string };
    assert.ok(parsed.output?.includes("CLAWPERATOR_OPERATOR_PACKAGE:flag.package.value"), `Expected flag value in output, got: ${parsed.output}`);
    assert.ok(!parsed.output?.includes("env.package.value"), `Should not contain env value, got: ${parsed.output}`);
  });
});

describe("CLI skills run streaming", () => {
  it("prints the banner first and then streams incremental skill output in pretty mode", async () => {
    const fakeAdbDir = await createFakeAdb({
      installed: true,
      operatorPackage: "com.clawperator.operator.dev",
    });
    const cliPath = join(packageRoot, "dist", "cli", "index.js");
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    const proc = spawn(process.execPath, [
      cliPath,
      "skills",
      "run",
      TEST_FIXTURE_CHUNKED_OUTPUT,
      "--receiver-package",
      "com.clawperator.operator.dev",
      "--output",
      "pretty",
    ], {
      cwd: packageRoot,
      env: {
        ...process.env,
        PATH: `${fakeAdbDir}${process.env.PATH ? `:${process.env.PATH}` : ""}`,
        CLAWPERATOR_SKILLS_REGISTRY: TEST_REGISTRY_PATH,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    proc.stdout.on("data", (chunk) => {
      stdoutChunks.push(chunk.toString());
    });
    proc.stderr.on("data", (chunk) => {
      stderrChunks.push(chunk.toString());
    });

    const code = await new Promise<number>((resolve) => {
      proc.on("close", (exitCode) => resolve(exitCode ?? -1));
    });

    assert.strictEqual(code, 0, `stderr: ${stderrChunks.join("")}`);
    assert.ok(stdoutChunks[0]?.startsWith("[Clawperator]"), stdoutChunks[0]);
    assert.ok(
      stdoutChunks.some((chunk, index) =>
        chunk.includes("chunk1") && stdoutChunks.slice(index + 1).some((later) => later.includes("chunk2"))
      ),
      stdoutChunks.join("")
    );
  });
});

describe("runSkill logging", () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-skill-log-"));
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
  });

  it("logs start and complete without leaking sentinel args", async () => {
    const sentinel = "CLAWPERATOR_TEST_SENTINEL_X9Z";
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "debug" });

    const result = await runSkill("com.test.echo", [sentinel], undefined, undefined, undefined, {
      logger,
    });

    assert.ok(result.ok, `Expected runSkill to succeed: ${"message" in result ? result.message : ""}`);
    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string; message?: string });
    assert.ok(lines.some(line => line.event === "skills.run.start"));
    assert.ok(lines.some(line => line.event === "skills.run.complete"));
    for (const line of lines) {
      assert.strictEqual(line.message?.includes(sentinel), false, `sentinel leaked into log line: ${JSON.stringify(line)}`);
      assert.strictEqual(JSON.stringify(line).includes(sentinel), false, `sentinel leaked into log payload: ${JSON.stringify(line)}`);
    }
  });

  it("logs start and timeout but not complete when the skill times out", async () => {
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });

    const result = await runSkill("com.test.partial-timeout", [], undefined, 150, undefined, {
      logger,
    });

    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_EXECUTION_TIMEOUT);
    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string });
    assert.ok(lines.some(line => line.event === "skills.run.start"));
    assert.ok(lines.some(line => line.event === "skills.run.timeout"));
    assert.ok(!lines.some(line => line.event === "skills.run.complete"));
  });

  it("logs a failure event when the skill exits non-zero", async () => {
    const logger = createLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });

    const result = await runSkill("com.test.fail", [], undefined, undefined, undefined, {
      logger,
    });

    assert.ok(!result.ok);
    assert.strictEqual(result.code, SKILL_EXECUTION_FAILED);
    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string });
    assert.ok(lines.some(line => line.event === "skills.run.start"));
    assert.ok(lines.some(line => line.event === "skills.run.failed"));
    assert.ok(lines.some(line => line.event === "skills.run.complete"));
  });
});
