import type { Logger } from "../../adapters/logger.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createSessionDefaults, type SessionDefaults } from "../session.js";
import { getCoreMcpTools } from "./core.js";
import { getNamedMcpTools } from "./named.js";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<CallToolResult> | CallToolResult;
}

export function getMcpTools(logger?: Logger, session: SessionDefaults = createSessionDefaults()): McpToolDefinition[] {
  return [
    ...getCoreMcpTools(logger, session),
    ...getNamedMcpTools(logger, session),
  ];
}
