#!/usr/bin/env node
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log("TEST_OUTPUT:no-args");
  process.exit(0);
}
for (const arg of args) {
  console.log(`TEST_OUTPUT:${arg}`);
}
