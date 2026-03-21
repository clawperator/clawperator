#!/usr/bin/env node
console.log('{"partial":true,"stage":"before-failure"}');
console.error("FAIL_OUTPUT:intentional");
process.exit(2);
