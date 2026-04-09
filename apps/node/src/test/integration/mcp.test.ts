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

interface ToolCallResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
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

  async callTool(name: string, args?: Record<string, unknown>): Promise<ToolCallResult> {
    const response = await this.request("tools/call", {
      name,
      arguments: args ?? {},
    });

    if (!response.result) {
      throw new Error(`Missing tool result for ${name}`);
    }

    return response.result as ToolCallResult;
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

    const tools = (response.result as { tools?: Array<{ name: string }> }).tools ?? [];
    assert.ok(Array.isArray(tools));
    assert.deepStrictEqual(
      tools.map(tool => tool.name),
      ["devices", "snapshot", "execute"],
    );
  });

  it("calls devices over the stdio protocol", async () => {
    await client.initialize();

    const result = await client.callTool("devices");
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as { devices?: unknown[]; code?: string };

    if (result.isError) {
      assert.ok(typeof payload.code === "string");
      return;
    }

    assert.ok(Array.isArray(payload.devices));
  });

  it("calls snapshot over the stdio protocol", async () => {
    await client.initialize();

    const result = await client.callTool("snapshot");
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as {
      snapshot?: string;
      code?: string;
      envelope?: unknown;
    };

    if (result.isError) {
      assert.ok(
        payload.code === "NO_DEVICES"
        || payload.code === "ADB_NOT_FOUND"
        || payload.code === "DEVICE_NOT_FOUND"
        || payload.code === "MULTIPLE_DEVICES_DEVICE_ID_REQUIRED"
      );
      return;
    }

    assert.strictEqual(typeof payload.snapshot, "string");
    assert.ok(payload.envelope);
  });

  it("calls execute over the stdio protocol", async () => {
    await client.initialize();

    const result = await client.callTool("execute", {
      actions: [
        {
          id: "sleep-1",
          type: "sleep",
          params: { durationMs: 1 },
        },
      ],
    });
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as { code?: string; envelope?: unknown };

    if (result.isError) {
      assert.ok(typeof payload.code === "string");
      return;
    }

    assert.ok(payload.envelope);
  });

  it("rejects execute when actions is missing", async () => {
    await client.initialize();

    const result = await client.callTool("execute", {});
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as { code?: string };

    assert.strictEqual(result.isError, true);
    assert.strictEqual(payload.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("rejects execute when an action is missing type", async () => {
    await client.initialize();

    const result = await client.callTool("execute", {
      actions: [{ id: "broken" }],
    });
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as { code?: string };

    assert.strictEqual(result.isError, true);
    assert.strictEqual(payload.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("rejects execute when operatorPackage is blank", async () => {
    await client.initialize();

    const result = await client.callTool("execute", {
      operatorPackage: "",
      actions: [{ id: "sleep-1", type: "sleep", params: { durationMs: 1 } }],
    });
    const payload = JSON.parse(result.content[0]?.text ?? "{}") as { code?: string };

    assert.strictEqual(result.isError, true);
    assert.strictEqual(payload.code, "EXECUTION_VALIDATION_FAILED");
  });

  it("returns an MCP error for an unknown tool name", async () => {
    await client.initialize();

    const response = await client.request("tools/call", {
      name: "missing_tool",
      arguments: {},
    });

    assert.ok(response.error);
    assert.strictEqual(response.error?.code, -32601);
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
