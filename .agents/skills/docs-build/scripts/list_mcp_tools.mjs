#!/usr/bin/env node

// Imports the compiled MCP tool registry and prints [[name, description], ...] as JSON.
// Called by generate_mcp_tool_summary.py so that docs generation reads from compiled
// output rather than parsing TypeScript source with a regex.
//
// Run from the repo root. Requires apps/node to be built first.

import { fileURLToPath } from "node:url";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const { getMcpTools } = await import(path.join(repoRoot, "apps/node/dist/mcp/tools/index.js"));

const tools = getMcpTools();
process.stdout.write(JSON.stringify(tools.map((t) => [t.name, t.description])));
