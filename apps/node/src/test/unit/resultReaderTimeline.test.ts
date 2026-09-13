import assert from "node:assert/strict";
import { it } from "node:test";
import { buildMcpErrorResult } from "../../mcp/errors.js";
import { ResultReaderTimeline } from "../../adapters/android-bridge/resultReaderTimeline.js";

it("bounds events independently of output volume and retains immutable snapshots", () => {
  const timeline = new ResultReaderTimeline();
  timeline.spawned(undefined);
  timeline.observe("stdout", 0);
  assert.equal(timeline.snapshot().lastStdoutElapsedMs, null);
  for (let i = 0; i < 10000; i++) timeline.observe("stdout", 2);
  const original = timeline.snapshot();
  assert.equal(original.events.length, 2);
  assert.equal(original.stdoutBytes, 20000);
  for (let i = 0; i < 100; i++) timeline.record("test");
  const bounded = timeline.snapshot();
  assert.equal(bounded.events.length, 32);
  assert.equal(bounded.droppedEvents, 70);
  assert.equal(original.events.length, 2);
  assert.ok(bounded.events.every((event, i) => i === 0 || Number(event.elapsedMs) >= Number(bounded.events[i - 1].elapsedMs)));
});


it("preserves stream counts through MCP while raw output remains redacted", () => {
  const timeline = new ResultReaderTimeline();
  timeline.observe("stdout", 12);
  timeline.observe("stderr", 34);
  const result = buildMcpErrorResult({ code: "RESULT_TRANSPORT_EXITED", message: "reader exited",
    details: { stdout: "private UI", stderr: "private stderr", reader: timeline.snapshot() } });
  const details = JSON.parse(result.content[0].text).details;
  assert.equal(details.reader.stdoutBytes, 12);
  assert.equal(details.reader.stderrBytes, 34);
  assert.equal(typeof details.reader.lastStdoutElapsedMs, "number");
  assert.equal(typeof details.reader.lastStderrElapsedMs, "number");
  assert.ok(!("stdout" in details));
  assert.ok(!("stderr" in details));
  assert.ok(!result.content[0].text.includes("private"));
});
