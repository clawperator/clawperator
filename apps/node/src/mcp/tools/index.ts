import type { Logger } from "../../adapters/logger.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getCoreMcpTools } from "./core.js";
import { getNamedMcpTools } from "./named.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult;
}

export function getMcpTools(logger?: Logger): McpToolDefinition[] {
  return [
    ...getCoreMcpTools(logger),
    ...getNamedMcpTools(logger),
  ];
}
