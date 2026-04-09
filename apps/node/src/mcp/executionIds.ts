export interface McpExecutionIds {
  commandId: string;
  taskId: string;
}

export function createMcpExecutionIds(toolName: string): McpExecutionIds {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const id = `mcp-${toolName}-${suffix}`;
  return {
    commandId: id,
    taskId: id,
  };
}
