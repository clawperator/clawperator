import assert from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { LATEST_PROTOCOL_VERSION } from "@modelcontextprotocol/sdk/types.js";

interface JsonRpcResponse {
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string };
}

class McpIntegrationClient {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly stdoutChunks: Buffer[] = [];
  private readonly stderrChunks: Buffer[] = [];
  private readBuffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly pending = new Map<number, {
    resolve: (value: JsonRpcResponse) => void;
    reject: (error: Error) => void;
  }>();

  constructor() {
    const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "../../..");
    this.child = spawn(process.execPath, ["dist/cli/index.js", "mcp", "serve"], {
      cwd: packageRoot,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.on("data", (chunk: Buffer) => {
      this.stdoutChunks.push(chunk);
      this.readBuffer = Buffer.concat([this.readBuffer, chunk]);
      this.drainMessages();
    });
    this.child.stderr.on("data", (chunk: Buffer) => {
      this.stderrChunks.push(chunk);
    });
    this.child.on("exit", () => {
      const error = new Error(`MCP server exited early.\nstderr:\n${this.stderrText}`);
      for (const pending of this.pending.values()) {
        pending.reject(error);
      }
      this.pending.clear();
    });
  }

  get stdoutBytes(): number {
    return this.stdoutChunks.reduce((total, chunk) => total + chunk.length, 0);
  }

  get stderrText(): string {
    return Buffer.concat(this.stderrChunks).toString("utf8");
  }

  async waitForSilence(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  async initialize(): Promise<JsonRpcResponse> {
    const response = await this.request("initialize", {
      protocolVersion: LATEST_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: {
        name: "clawperator-test",
        version: "1.0.0",
      },
    });

    this.notify("notifications/initialized", {});
    return response;
  }

  request(method: string, params?: unknown): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    const payload = {
      jsonrpc: "2.0" as const,
      id,
      method,
      ...(params !== undefined ? { params } : {}),
    };

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.writeMessage(payload);
    });
  }

  notify(method: string, params?: unknown): void {
    const payload = {
      jsonrpc: "2.0" as const,
      method,
      ...(params !== undefined ? { params } : {}),
    };
    this.writeMessage(payload);
  }

  async closeStdin(): Promise<number | null> {
    this.child.stdin.end();
    return await new Promise((resolve) => {
      this.child.once("exit", (code) => resolve(code));
    });
  }

  kill(): void {
    this.child.kill("SIGTERM");
  }

  private writeMessage(message: Record<string, unknown>): void {
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private drainMessages(): void {
    while (true) {
      const messageEnd = this.readBuffer.indexOf("\n");
      if (messageEnd === -1) {
        return;
      }

      const messageBuffer = this.readBuffer.subarray(0, messageEnd);
      this.readBuffer = this.readBuffer.subarray(messageEnd + 1);

      const message = JSON.parse(messageBuffer.toString("utf8")) as JsonRpcResponse;
      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        if (pending) {
          this.pending.delete(message.id);
          pending.resolve(message);
        }
      }
    }
  }
}

describe("mcp stdio integration", () => {
  let client: McpIntegrationClient;

  beforeEach(() => {
    client = new McpIntegrationClient();
  });

  afterEach(() => {
    client.kill();
  });

  it("emits zero stdout bytes before initialize", async () => {
    await client.waitForSilence(150);
    assert.strictEqual(client.stdoutBytes, 0, client.stderrText);
  });

  it("completes initialize and returns server info", async () => {
    const response = await client.initialize();

    assert.ok(response.result);
    assert.strictEqual(typeof (response.result as { serverInfo?: { name?: string } }).serverInfo?.name, "string");
  });

  it("lists tools over the stdio protocol", async () => {
    await client.initialize();

    const response = await client.request("tools/list", {});

    assert.ok(Array.isArray((response.result as { tools?: unknown[] }).tools));
  });

  it("returns a JSON-RPC error for an invalid request", async () => {
    await client.initialize();

    const response = await client.request("clawperator/not-a-real-method", {});

    assert.ok(response.error);
    assert.strictEqual(typeof response.error?.message, "string");
  });

  it("exits cleanly when stdin closes", async () => {
    await client.initialize();

    const exitCode = await client.closeStdin();

    assert.strictEqual(exitCode, 0);
  });
});
