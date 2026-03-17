#!/usr/bin/env node
process.stdout.write('{"partial":true,"stage":"before-timeout"}\n');
setTimeout(() => {
  process.stdout.write('{"partial":false,"stage":"completed"}\n');
  process.exit(0);
}, 500);
