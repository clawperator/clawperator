#!/usr/bin/env node

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

console.log("[skill:com.test.progress] Opening fixture skill...");
await sleep(25);
console.log("[skill:com.test.progress] Reading fixture state...");
await sleep(25);
console.log("✅ Progress fixture complete");
