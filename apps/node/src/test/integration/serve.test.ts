import { test, describe, after, before } from "node:test";
import assert from "node:assert";
import { startServer } from "../../cli/commands/serve.js";
import { Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createClawperatorLogger } from "../../adapters/logger.js";
import { ERROR_CODES } from "../../contracts/errors.js";

async function createTempRegistryWithSkill(options: {
  skillId: string;
  scriptSourcePath: string;
  skillJsonContents: string;
  registrySkillEntry: Record<string, unknown>;
}): Promise<{ registryPath: string; cleanup: () => Promise<void> }> {
  const root = await mkdtemp(join(tmpdir(), "clawperator-serve-skill-registry-"));
  const skillDir = join(root, "skills", options.skillId);
  const scriptsDir = join(skillDir, "scripts");
  await mkdir(scriptsDir, { recursive: true });
  await copyFile(options.scriptSourcePath, join(scriptsDir, "run.js"));
  await writeFile(join(skillDir, "SKILL.md"), `# ${options.skillId}\n`, "utf8");
  await writeFile(join(skillDir, "skill.json"), options.skillJsonContents, "utf8");

  const registryPath = join(root, "skills", "skills-registry.json");
  await writeFile(
    registryPath,
    `${JSON.stringify({
      schemaVersion: "1.0",
      generatedAt: "2026-04-13T00:00:00Z",
      skills: [options.registrySkillEntry],
    }, null, 2)}\n`,
    "utf8"
  );

  return {
    registryPath,
    cleanup: async () => {
      await rm(root, { recursive: true, force: true });
    },
  };
}

describe("serve API integration", () => {
  let server: Server;
  let port: number;
  const previousRegistryPath = process.env.CLAWPERATOR_SKILLS_REGISTRY;
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const testRegistryPath = join(packageRoot, "src", "test", "fixtures", "skills", "skills-registry.json");

  before(async () => {
    process.env.CLAWPERATOR_SKILLS_REGISTRY = testRegistryPath;
    server = await startServer({
      port: 0,
      host: "localhost",
      verbose: false,
      resolveInteractiveSkillTargetImpl: async (_operatorPackage, options) => ({
        ok: true,
        deviceId: options?.deviceId ?? "resolved-device-123",
        apkPresence: {
          id: "readiness.apk.presence",
          status: "pass",
          summary: "Operator APK is installed.",
        },
      }),
    });
    const addr = server.address();
    if (addr && typeof addr === "object") {
      port = addr.port;
    } else {
      throw new Error("Failed to get ephemeral port");
    }
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
    if (previousRegistryPath === undefined) {
      delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
    } else {
      process.env.CLAWPERATOR_SKILLS_REGISTRY = previousRegistryPath;
    }
  });

  test("GET /devices returns success", async () => {
    const res = await fetch(`http://localhost:${port}/devices`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.strictEqual(body.ok, true);
  });

  test("GET /android/emulators returns a structured response", async () => {
    const res = await fetch(`http://localhost:${port}/android/emulators`);
    assert.ok(res.status === 200 || res.status === 500);
    const body = await res.json() as { ok: boolean; avds?: unknown[]; error?: { code?: string } };
    assert.strictEqual(typeof body.ok, "boolean");
    assert.ok(body.ok ? Array.isArray(body.avds) : body.error !== undefined);
  });

  test("GET /android/emulators/running returns a structured response", async () => {
    const res = await fetch(`http://localhost:${port}/android/emulators/running`);
    assert.ok(res.status === 200 || res.status === 500);
    const body = await res.json() as { ok: boolean; devices?: unknown[]; error?: { code?: string } };
    assert.strictEqual(typeof body.ok, "boolean");
    assert.ok(body.ok ? Array.isArray(body.devices) : body.error !== undefined);
  });

  test("POST /android/provision/emulator returns a structured response", async () => {
    const res = await fetch(`http://localhost:${port}/android/provision/emulator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.ok(res.status === 200 || res.status === 400 || res.status === 409 || res.status === 500);
    const body = await res.json() as { ok: boolean; serial?: string; error?: { code?: string } };
    assert.strictEqual(typeof body.ok, "boolean");
    assert.ok(body.ok ? typeof body.serial === "string" : body.error !== undefined);
  });

  test("POST /execute with no body returns 400", async () => {
    const res = await fetch(`http://localhost:${port}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
  });

  test("POST /execute rejects press_key without params.key", async () => {
    const executionInput = {
      commandId: "test-press-key-missing",
      taskId: "test-task",
      source: "test-suite",
      expectedFormat: "android-ui-automator",
      timeoutMs: 1000,
      actions: [{ id: "k1", type: "press_key", params: {} }],
    };

    const res = await fetch(`http://localhost:${port}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution: executionInput }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: { code: string; details?: { path?: string } };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "EXECUTION_VALIDATION_FAILED");
    assert.strictEqual(body.error.details?.path, "actions.0.params.key");
  });

  test("POST /execute accepts key_press alias and reaches device resolution", async () => {
    const executionInput = {
      commandId: "test-key-press-alias",
      taskId: "test-task",
      source: "test-suite",
      expectedFormat: "android-ui-automator",
      timeoutMs: 1000,
      actions: [{ id: "k1", type: "key_press", params: { key: "home" } }],
    };

    const res = await fetch(`http://localhost:${port}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execution: executionInput, deviceId: "non-existent" }),
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "DEVICE_NOT_FOUND");
  });

  test("GET /events returns SSE stream", async () => {
    const res = await fetch(`http://localhost:${port}/events`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get("Content-Type"), "text/event-stream");
    
    const reader = res.body?.getReader();
    try {
      // Read the first chunk (heartbeat)
      const { value } = await reader!.read();
      const text = new TextDecoder().decode(value);
      assert.ok(text.includes("CONNECTED"));
    } finally {
      await reader?.cancel();
    }
  });

  test("POST /snapshot returns success structure (dry-run)", async () => {
    // This will likely fail with NO_DEVICES in CI, but we test the structure/404/400 logic
    const res = await fetch(`http://localhost:${port}/snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "non-existent" }),
    });
    // Should be 404 (DEVICE_NOT_FOUND) or 400 (if validation fails)
    assert.ok(res.status === 404 || res.status === 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.ok(body.error.code !== undefined);
  });

  test("POST /screenshot returns success structure (dry-run)", async () => {
    const res = await fetch(`http://localhost:${port}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "non-existent" }),
    });
    assert.ok(res.status === 404 || res.status === 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.ok(body.error.code !== undefined);
  });

  test("POST /screenshot rejects non-string path", async () => {
    const res = await fetch(`http://localhost:${port}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: 123 }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "INVALID_PATH");
  });

  test("POST /screenshot rejects empty path", async () => {
    const res = await fetch(`http://localhost:${port}/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: "" }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as { ok: boolean; error: { code: string; message: string } };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "INVALID_PATH");
    assert.strictEqual(body.error.message, "'path' must be a non-empty string");
  });

  test("POST /skills/:skillId/run preserves partial output on failure", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.fail/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: { code: string; stdout?: string; stderr?: string };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "SKILL_EXECUTION_FAILED");
    assert.ok(body.error.stdout?.includes('"stage":"before-failure"'));
    assert.ok(body.error.stderr?.includes("FAIL_OUTPUT:intentional"));
  });

  test("POST /skills/:skillId/run rejects blank deviceId", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.fail/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "" }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: { code: string; message: string };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "INVALID_DEVICE_ID");
    assert.match(body.error.message, /non-empty string/i);
  });

  test("POST /skills/:skillId/run fails before spawn when the device is not interactive", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-serve-skill-no-spawn-"));
    const markerPath = join(tempRoot, "spawned.txt");
    const scriptPath = join(tempRoot, "run.js");
    await writeFile(
      scriptPath,
      `import { writeFileSync } from "node:fs";\nwriteFileSync(${JSON.stringify(markerPath)}, "spawned\\n");\nconsole.log("should-not-run");\n`,
      "utf8"
    );
    const skillId = "com.test.no-spawn";
    const skillEntry = {
      id: skillId,
      applicationId: "com.test",
      intent: "no-spawn",
      summary: "No spawn proof",
      path: `skills/${skillId}`,
      skillFile: `skills/${skillId}/SKILL.md`,
      scripts: [`skills/${skillId}/scripts/run.js`],
      artifacts: [],
    };
    const registry = await createTempRegistryWithSkill({
      skillId,
      scriptSourcePath: scriptPath,
      skillJsonContents: JSON.stringify(skillEntry, null, 2),
      registrySkillEntry: skillEntry,
    });
    await writeFile(
      join(dirname(registry.registryPath), skillId, "SKILL.md"),
      `---\nname: ${skillId}\nclawperator-skill-type: replay\ndescription: |-\n  No spawn proof\n---\n\n# ${skillId}\n`,
      "utf8"
    );

    const originalRegistryPath = process.env.CLAWPERATOR_SKILLS_REGISTRY;
    process.env.CLAWPERATOR_SKILLS_REGISTRY = registry.registryPath;

    const blockingServer = await startServer({
      port: 0,
      host: "localhost",
      verbose: false,
      resolveInteractiveSkillTargetImpl: async () => ({
        ok: false,
        error: {
          code: ERROR_CODES.DEVICE_NOT_INTERACTIVE,
          message: "Device is not interactive. screenOn=false",
        },
      }),
    });
    const blockingAddr = blockingServer.address();
    const blockingPort = blockingAddr && typeof blockingAddr === "object" ? blockingAddr.port : 0;

    try {
      const res = await fetch(`http://localhost:${blockingPort}/skills/${skillId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 409);
      const body = await res.json() as {
        ok: boolean;
        error: { code: string; message?: string; details?: { screenOn?: boolean; deviceLocked?: boolean; userUnlocked?: boolean } };
      };
      assert.strictEqual(body.ok, false);
      assert.strictEqual(body.error.code, ERROR_CODES.DEVICE_NOT_INTERACTIVE);
      assert.strictEqual(body.error.details, undefined);
      assert.strictEqual(body.error.message, "Device is not interactive. Interactive automation requires an awake, usable device state.");
      await assert.rejects(readFile(markerPath, "utf8"));
    } finally {
      await new Promise<void>((resolve, reject) => {
        blockingServer.close((err) => (err ? reject(err) : resolve()));
      });
      if (originalRegistryPath === undefined) {
        delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
      } else {
        process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistryPath;
      }
      await registry.cleanup();
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  test("POST /skills/:skillId/run forwards ADB_PATH into wrapper preflight", async () => {
    const originalAdbPath = process.env.ADB_PATH;
    process.env.ADB_PATH = "/custom/platform-tools/adb";

    let capturedAdbPath: string | undefined;
    const adbAwareServer = await startServer({
      port: 0,
      host: "localhost",
      verbose: false,
      resolveInteractiveSkillTargetImpl: async (_operatorPackage, options) => {
        capturedAdbPath = options?.adbPath;
        return {
          ok: false,
          error: {
            code: ERROR_CODES.DEVICE_NOT_INTERACTIVE,
            message: "Device is not interactive.",
          },
        };
      },
    });

    const adbAwareAddr = adbAwareServer.address();
    const adbAwarePort = adbAwareAddr && typeof adbAwareAddr === "object" ? adbAwareAddr.port : 0;

    try {
      const res = await fetch(`http://localhost:${adbAwarePort}/skills/com.test.skill-result/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      assert.strictEqual(res.status, 409);
      assert.strictEqual(capturedAdbPath, "/custom/platform-tools/adb");
    } finally {
      await new Promise<void>((resolve, reject) => {
        adbAwareServer.close((err) => (err ? reject(err) : resolve()));
      });
      if (originalAdbPath === undefined) {
        delete process.env.ADB_PATH;
      } else {
        process.env.ADB_PATH = originalAdbPath;
      }
    }
  });

  test("POST /skills/:skillId/run returns skillResult on framed success", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: ["valid", "40"] }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as {
      ok: boolean;
      skillId?: string;
      skillResult?: {
        skillId?: string;
        status?: string;
        source?: { kind?: string };
      } | null;
    };
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.skillId, "com.test.skill-result");
    assert.strictEqual(body.skillResult?.skillId, "com.test.skill-result");
    assert.strictEqual(body.skillResult?.status, "success");
    assert.strictEqual(body.skillResult?.source?.kind, "script");
  });

  test("POST /skills/:skillId/run shares the CLI validation gate for stale registry contract mismatches", async () => {
    const temp = await createTempRegistryWithSkill({
      skillId: "com.test.serve-stale-registry-contract",
      scriptSourcePath: join(
        packageRoot,
        "src",
        "test",
        "fixtures",
        "skills",
        "com.test.skill-result",
        "scripts",
        "emit_skill_result.js"
      ),
      skillJsonContents: `${JSON.stringify({
        id: "com.test.serve-stale-registry-contract",
        applicationId: "com.test",
        intent: "temp",
        summary: "Temporary serve stale-registry contract mismatch test skill",
        path: "skills/com.test.serve-stale-registry-contract",
        skillFile: "skills/com.test.serve-stale-registry-contract/SKILL.md",
        scripts: ["skills/com.test.serve-stale-registry-contract/scripts/run.js"],
        artifacts: [],
        contract: {
          inputs: {
            percent: "integer[0,100]",
          },
          goal: {
            kind: "set_discharge_limit",
          },
          verification: {
            kind: "node_text_matches",
            matcher: "Discharge to {percent}%",
          },
        },
      }, null, 2)}\n`,
      registrySkillEntry: {
        id: "com.test.serve-stale-registry-contract",
        applicationId: "com.test",
        intent: "temp",
        summary: "Temporary serve stale-registry contract mismatch test skill",
        path: "skills/com.test.serve-stale-registry-contract",
        skillFile: "skills/com.test.serve-stale-registry-contract/SKILL.md",
        scripts: ["skills/com.test.serve-stale-registry-contract/scripts/run.js"],
        artifacts: [],
      },
    });

    const previousRegistryPathForTest = process.env.CLAWPERATOR_SKILLS_REGISTRY;
    process.env.CLAWPERATOR_SKILLS_REGISTRY = temp.registryPath;
    try {
      const res = await fetch(`http://localhost:${port}/skills/com.test.serve-stale-registry-contract/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args: ["valid", "40"] }),
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json() as {
        ok?: boolean;
        status?: string;
        error?: { code?: string; message?: string };
      };
      assert.strictEqual(body.ok, false);
      assert.strictEqual(body.status, "failed");
      assert.strictEqual(body.error?.code, "SKILL_VALIDATION_FAILED");
      assert.match(body.error?.message ?? "", /metadata does not match the registry entry/i);
    } finally {
      if (previousRegistryPathForTest === undefined) {
        delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
      } else {
        process.env.CLAWPERATOR_SKILLS_REGISTRY = previousRegistryPathForTest;
      }
      await temp.cleanup();
    }
  });

  test("POST /skills/:skillId/run returns indeterminate for declared-but-unproved verification", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: ["legacy"] }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as {
      status?: string;
      code?: string;
      ok?: null;
      skillId?: string;
      skillResult?: unknown;
    };
    assert.strictEqual(body.status, "indeterminate");
    assert.strictEqual(body.code, "SKILL_VERIFICATION_INDETERMINATE");
    assert.strictEqual(body.ok, null);
    assert.strictEqual(body.skillId, "com.test.skill-result");
    assert.strictEqual(body.skillResult, null);
  });

  test("POST /skills/:skillId/run passes device selection via env for agent-driven skills", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.agent-skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "device-123",
        args: ["env-check", "40"],
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as {
      ok: boolean;
      skillId?: string;
      skillResult?: {
        skillId?: string;
        status?: string;
        source?: { kind?: string; agentCli?: string };
      } | null;
    };
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.skillId, "com.test.agent-skill-result");
    assert.strictEqual(body.skillResult?.skillId, "com.test.agent-skill-result");
    assert.strictEqual(body.skillResult?.status, "success");
    assert.strictEqual(body.skillResult?.source?.kind, "agent");
    assert.strictEqual(body.skillResult?.source?.agentCli, "codex");
  });

  test("POST /skills/:skillId/run returns skillResult on framed non-zero failure", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: ["fail"] }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: {
        code: string;
        skillResult?: {
          skillId?: string;
          status?: string;
          source?: { kind?: string };
        } | null;
      };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "SKILL_EXECUTION_FAILED");
    assert.strictEqual(body.error.skillResult?.skillId, "com.test.skill-result");
    assert.strictEqual(body.error.skillResult?.status, "failed");
    assert.strictEqual(body.error.skillResult?.source?.kind, "script");
  });

  test("POST /skills/:skillId/run returns parse failure for malformed framed output", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: ["malformed-json"] }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: {
        code: string;
        skillResult?: unknown;
        stdout?: string;
      };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "SKILL_RESULT_PARSE_FAILED");
    assert.strictEqual(body.error.skillResult, null);
    assert.ok(body.error.stdout?.includes("[Clawperator-Skill-Result]"));
  });

  test("POST /skills/:skillId/run reports timeout instead of parse failure for a partial framed result", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.skill-result/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ args: ["partial-frame-timeout"], timeoutMs: 150 }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: {
        code: string;
        skillResult?: unknown;
        stdout?: string;
      };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "SKILL_EXECUTION_TIMEOUT");
    assert.strictEqual(body.error.skillResult, null);
    assert.ok(body.error.stdout?.includes("progress:before-frame"));
  });

  test("POST /skills/:skillId/run accepts timeoutMs override", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.echo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        args: ["hello", "api"],
        timeoutMs: 4321,
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as {
      ok: boolean;
      output?: string;
      timeoutMs?: number;
    };
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.timeoutMs, 4321);
    assert.ok(body.output?.includes("TEST_OUTPUT:hello"));
  });

  test("POST /skills/:skillId/run rejects invalid timeoutMs", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.echo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeoutMs: "slow" }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "INVALID_TIMEOUT_MS");
  });

  test("POST /skills/:skillId/run can assert output content", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.echo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        args: ["hello"],
        expectContains: "TEST_OUTPUT:hello",
      }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json() as {
      ok: boolean;
      expectedSubstring?: string;
      output?: string;
    };
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.expectedSubstring, "TEST_OUTPUT:hello");
    assert.ok(body.output?.includes("TEST_OUTPUT:hello"));
  });

  test("POST /skills/:skillId/run returns assertion failure when expected text is missing", async () => {
    const res = await fetch(`http://localhost:${port}/skills/com.test.echo/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        args: ["hello"],
        expectContains: "missing-value",
      }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as {
      ok: boolean;
      error: { code: string; expectedSubstring?: string; output?: string };
    };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "SKILL_OUTPUT_ASSERTION_FAILED");
    assert.strictEqual(body.error.expectedSubstring, "missing-value");
    assert.ok(body.error.output?.includes("TEST_OUTPUT:hello"));
  });

  test("Execution emits SSE events", async () => {
    // 1. Connect to SSE
    const sseRes = await fetch(`http://localhost:${port}/events`);
    const reader = sseRes.body!.getReader();
    const decoder = new TextDecoder();

    try {
      // 2. Trigger an execution (even a failing one)
      const executionInput = {
        commandId: `test-sse-${Date.now()}`,
        taskId: "test-task",
        source: "test-suite",
        expectedFormat: "android-ui-automator",
        timeoutMs: 1000,
        actions: [{ id: "s1", type: "sleep", params: { durationMs: 10 } }],
      };

      // We don't await the full execution here to avoid blocking, 
      // but we need it to start to trigger events.
      fetch(`http://localhost:${port}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ execution: executionInput, deviceId: "non-existent" }),
      }).catch(() => {});

      // 3. Look for 'clawperator:execution' in the stream
      let foundEvent = false;
      const startTime = Date.now();
      while (Date.now() - startTime < 3000) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        if (chunk.includes("event: clawperator:execution")) {
          foundEvent = true;
          break;
        }
      }
      assert.ok(foundEvent, "Did not receive clawperator:execution event in SSE stream");
    } finally {
      await reader.cancel();
    }
  });

  test("serve.server.started appears in log file when logger is provided", async () => {
    const tempRoot = await mkdtemp(join(tmpdir(), "clawperator-serve-log-"));
    const logger = createClawperatorLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });

    const testServer = await startServer({ port: 0, host: "localhost", verbose: false, logger });
    const addr = testServer.address();
    const testPort = addr && typeof addr === "object" ? addr.port : 0;

    try {
      // Verify server is running
      assert.ok(testPort > 0, "Server should have started on an ephemeral port");

      // Read the log file and verify serve.server.started event
      const logPath = logger.logPath();
      assert.ok(logPath, "Logger should have a log path");

      const contents = await readFile(logPath, "utf8");
      const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string; message?: string });

      const startedEvent = lines.find(line => line.event === "serve.server.started");
      assert.ok(startedEvent, "Log should contain serve.server.started event");
      assert.ok(startedEvent.message?.includes("listening"), "Message should indicate server is listening");
    } finally {
      await new Promise<void>((resolve, reject) => {
        testServer.close((err) => (err ? reject(err) : resolve()));
      });
      await rm(tempRoot, { recursive: true, force: true });
    }
  });
});
