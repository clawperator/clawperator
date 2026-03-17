#!/usr/bin/env node
process.stdout.write('{"partial":true,"stage":"before-timeout"}\n');
const interval = setInterval(() => {
  process.stdout.write('{"partial":true,"stage":"heartbeat"}\n');
}, 20);
setTimeout(() => {
  clearInterval(interval);
  process.stdout.write('{"partial":false,"stage":"completed"}\n');
  process.exit(0);
}, 1000);
