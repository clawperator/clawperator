import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseResultEnvelope,
  parseTerminalEnvelope,
} from "../../adapters/android-bridge/envelopeParser.js";
import { RESULT_ENVELOPE_PREFIX } from "../../contracts/result.js";

const CMD_ID = "cmd-123";

describe("parseResultEnvelope", () => {
  /** Canonical regression: CI gate — logcat-formatted [Clawperator-Result] must parse. Do not remove. */
  it("canonical regression: logcat-formatted [Clawperator-Result] line parses to envelope (CI gate)", () => {
    const json = `{"commandId":"${CMD_ID}","taskId":"t1","status":"success","stepResults":[{"id":"s1","actionType":"snapshot_ui","success":true,"data":{}}],"error":null}`;
    const logcatLine = `02-19 12:00:00.000  1234  5678 I AgentCommandExecutorDefault: ${RESULT_ENVELOPE_PREFIX} ${json}`;
    const env = parseResultEnvelope(logcatLine, CMD_ID);
    assert.ok(env, "Canonical logcat line must parse; canonical-only mode depends on this");
    assert.strictEqual(env!.commandId, CMD_ID);
    assert.strictEqual(env!.status, "success");
    assert.strictEqual(env!.stepResults.length, 1);
  });

  it("parses [Clawperator-Result] JSON", () => {
    const line = `${RESULT_ENVELOPE_PREFIX} {"commandId":"${CMD_ID}","taskId":"t1","status":"success","stepResults":[],"error":null}`;
    const env = parseResultEnvelope(line, CMD_ID);
    assert.ok(env);
    assert.strictEqual(env!.commandId, CMD_ID);
    assert.strictEqual(env!.status, "success");
  });

  it("returns null for wrong commandId", () => {
    const line = `${RESULT_ENVELOPE_PREFIX} {"commandId":"other","taskId":"t1","status":"success","stepResults":[],"error":null}`;
    assert.strictEqual(parseResultEnvelope(line, CMD_ID), null);
  });

  it("parses canonical line in logcat format (tag prefix before [Clawperator-Result])", () => {
    const json = `{"commandId":"${CMD_ID}","taskId":"t1","status":"success","stepResults":[],"error":null}`;
    const line = `02-19 12:00:00.000  1234  5678 I ClawperatorResult: ${RESULT_ENVELOPE_PREFIX} ${json}`;
    const env = parseResultEnvelope(line, CMD_ID);
    assert.ok(env);
    assert.strictEqual(env!.commandId, CMD_ID);
    assert.strictEqual(env!.status, "success");
  });
});

describe("parseTerminalEnvelope", () => {
  it("returns [Clawperator-Result] with terminalSource clawperator_result", () => {
    const line = `${RESULT_ENVELOPE_PREFIX} {"commandId":"${CMD_ID}","taskId":"t1","status":"success","stepResults":[],"error":null}`;
    const parsed = parseTerminalEnvelope(line, CMD_ID);
    assert.ok(parsed);
    assert.strictEqual(parsed!.terminalSource, "clawperator_result");
    assert.strictEqual(parsed!.envelope.commandId, CMD_ID);
  });

  it("returns null for line without [Clawperator-Result]", () => {
    const line = `02-19 12:00:00.000 I SomeTag: [Operator-AgentEvent] command_success commandId=${CMD_ID} stepCount=0`;
    assert.strictEqual(parseTerminalEnvelope(line, CMD_ID), null);
  });

  it("accepts canonical line in logcat format", () => {
    const json = `{"commandId":"${CMD_ID}","taskId":"t1","status":"success","stepResults":[{"id":"s1","actionType":"snapshot_ui","success":true}],"error":null}`;
    const line = `02-19 12:00:00.000  1234  5678 I ClawperatorResult: ${RESULT_ENVELOPE_PREFIX} ${json}`;
    const parsed = parseTerminalEnvelope(line, CMD_ID);
    assert.ok(parsed);
    assert.strictEqual(parsed!.terminalSource, "clawperator_result");
    assert.strictEqual(parsed!.envelope.commandId, CMD_ID);
    assert.strictEqual(parsed!.envelope.stepResults.length, 1);
    assert.strictEqual(parsed!.envelope.stepResults[0].id, "s1");
  });
});
