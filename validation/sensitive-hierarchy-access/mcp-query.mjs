import { createRequire } from 'node:module';
const require = createRequire(new URL('../../apps/node/package.json', import.meta.url));
const { Client } = await import(require.resolve('@modelcontextprotocol/sdk/client/index.js'));
const { StdioClientTransport } = await import(require.resolve('@modelcontextprotocol/sdk/client/stdio.js'));
const transport = new StdioClientTransport({command: process.execPath, args: ['apps/node/dist/cli/index.js', 'mcp', 'serve']});
const client = new Client({name: 'sensitive-hierarchy-regression', version: '1.0.0'});
try {
  await client.connect(transport);
  const result = await client.callTool({name: 'query_ui', arguments: {
    deviceId: process.argv[2], operatorPackage: process.argv[3], visibility: 'all', limit: 1000, timeoutMs: 15000,
  }});
  console.log(JSON.stringify(result));
  if (result.isError) process.exitCode = 1;
} finally {
  await client.close();
}
