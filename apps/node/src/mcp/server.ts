import { createRequire } from "node:module";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { getMcpTools } from "./tools/index.js";

const require = createRequire(import.meta.url);

function createServerInfo(): { name: string; version: string } {
  const pkg = require("../../package.json") as { version?: string };
  return {
    name: "clawperator",
    version: pkg.version ?? "0.0.0",
  };
}

export function createMcpServer(): Server {
  const tools = getMcpTools();
  const toolsByName = new Map(tools.map(tool => [tool.name, tool]));
  const server = new Server(createServerInfo(), {
    capabilities: {
      tools: {
        listChanged: false,
      },
    },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request): Promise<CallToolResult> => {
    const tool = toolsByName.get(request.params.name);
    if (!tool) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    return await tool.handler((request.params.arguments ?? {}) as Record<string, unknown>);
  });

  return server;
}

export async function runMcpStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();

  let resolveClosed!: () => void;
  const closed = new Promise<void>((resolve) => {
    resolveClosed = resolve;
  });

  transport.onerror = (error) => {
    process.stderr.write(`[clawperator:mcp] transport error: ${error.message}\n`);
  };
  transport.onclose = () => {
    resolveClosed();
  };

  await server.connect(transport);

  const shutdown = async (exitCode?: number) => {
    try {
      await server.close();
    } finally {
      if (exitCode !== undefined) {
        process.exit(exitCode);
      }
    }
  };

  process.once("SIGINT", () => {
    void shutdown(0);
  });
  process.once("SIGTERM", () => {
    void shutdown(0);
  });

  await closed;
  await server.close();
}
