import { UsageError } from "../registry.js";
import { runMcpStdioServer } from "../../mcp/server.js";

export async function cmdMcpServe(args: string[]): Promise<void> {
  if (args.length > 0) {
    throw new UsageError("mcp serve does not accept additional arguments");
  }

  await runMcpStdioServer();
}
