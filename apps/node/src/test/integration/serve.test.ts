import { test, describe, after, before } from "node:test";
import assert from "node:assert";
import { startServer } from "../../cli/commands/serve.js";
import { Server } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

describe("serve API integration", () => {
  let server: Server;
  let port: number;
  const previousRegistryPath = process.env.CLAWPERATOR_SKILLS_REGISTRY;
  const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
  const testRegistryPath = join(packageRoot, "src", "test", "fixtures", "skills", "skills-registry.json");

  before(async () => {
    process.env.CLAWPERATOR_SKILLS_REGISTRY = testRegistryPath;
    server = await startServer({ port: 0, host: "localhost", verbose: false });
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

  test("POST /observe/snapshot returns success structure (dry-run)", async () => {
    // This will likely fail with NO_DEVICES in CI, but we test the structure/404/400 logic
    const res = await fetch(`http://localhost:${port}/observe/snapshot`, {
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

  test("POST /observe/screenshot returns success structure (dry-run)", async () => {
    const res = await fetch(`http://localhost:${port}/observe/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId: "non-existent" }),
    });
    assert.ok(res.status === 404 || res.status === 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.ok(body.error.code !== undefined);
  });

  test("POST /observe/screenshot rejects non-string path", async () => {
    const res = await fetch(`http://localhost:${port}/observe/screenshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: 123 }),
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json() as { ok: boolean; error: { code: string } };
    assert.strictEqual(body.ok, false);
    assert.strictEqual(body.error.code, "INVALID_PATH");
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
});
