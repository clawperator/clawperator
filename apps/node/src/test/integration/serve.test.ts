import { test, describe, after, before } from "node:test";
import assert from "node:assert";
import { startServer } from "../../cli/commands/serve.js";
import { Server } from "node:http";

describe("serve API integration", () => {
  let server: Server;
  const port = 3002;

  before(async () => {
    server = await startServer({ port, verbose: false });
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });

  test("GET /devices returns success", async () => {
    const res = await fetch(`http://localhost:${port}/devices`);
    assert.strictEqual(res.status, 200);
    const body = await res.json() as { ok: boolean };
    assert.strictEqual(body.ok, true);
  });

  test("POST /execute with no body returns 400", async () => {
    const res = await fetch(`http://localhost:${port}/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
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
});
