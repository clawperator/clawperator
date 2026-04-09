import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { getCoreMcpTools } from "./core.js";
import { getNamedMcpTools } from "./named.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult;
}

export function getMcpTools(): McpToolDefinition[] {
  return [
    ...getCoreMcpTools(),
    ...getNamedMcpTools(),
  ];
}
