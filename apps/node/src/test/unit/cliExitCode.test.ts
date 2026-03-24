import { describe, it } from "node:test";
import assert from "node:assert";
import { shouldCliStdoutForceExitCode1 } from "../../cli/stdoutExitCode.js";

describe("shouldCliStdoutForceExitCode1", () => {
  it("forces exit 1 when usageParseError is true", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":"USAGE"}', true), true);
    assert.strictEqual(shouldCliStdoutForceExitCode1("", true), true);
  });

  it("does not force exit 1 for success-shaped envelope payloads", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"envelope":{},"code":"OK"}', false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"envelope":{}}', false), false);
  });

  it("does not force exit 1 for USAGE or NOT_IMPLEMENTED", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":"USAGE","message":"x"}', false), false);
    assert.strictEqual(
      shouldCliStdoutForceExitCode1('{"code":"NOT_IMPLEMENTED","message":"x"}', false),
      false,
    );
  });

  it("forces exit 1 for other string error codes", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":"MISSING_SELECTOR"}', false), true);
    assert.strictEqual(
      shouldCliStdoutForceExitCode1('{"code":"EXECUTION_VALIDATION_FAILED","message":"x"}', false),
      true,
    );
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":"UNKNOWN_COMMAND"}', false), true);
  });

  it("does not force exit 1 when code is empty or non-string", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":""}', false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":1}', false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1("{}", false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"message":"no code"}', false), false);
  });

  it("does not force exit 1 for non-object JSON roots", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1("[1,2]", false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('"string"', false), false);
  });

  it("does not force exit 1 when trimmed stdout does not start with {", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1("plain text", false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('prefix {"code":"MISSING_SELECTOR"}', false), false);
  });

  it("trims whitespace so a lone JSON object still parses", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1('  \n{"code":"MISSING_SELECTOR"}  \n', false), true);
  });

  it("does not force exit 1 for invalid or ambiguous JSON (no substring heuristic)", () => {
    assert.strictEqual(shouldCliStdoutForceExitCode1("{", false), false);
    assert.strictEqual(shouldCliStdoutForceExitCode1('{"code":', false), false);
    assert.strictEqual(
      shouldCliStdoutForceExitCode1('{"code":"A"}{"code":"B"}', false),
      false,
    );
  });

  it("accepts pretty-printed single object JSON", () => {
    const pretty = `{
  "code": "MISSING_SELECTOR",
  "message": "click requires a selector"
}`;
    assert.strictEqual(shouldCliStdoutForceExitCode1(pretty, false), true);
  });

  it("forces exit 1 when envelope.status is failed", () => {
    assert.strictEqual(
      shouldCliStdoutForceExitCode1(
        '{"envelope":{"status":"failed","stepResults":[],"error":"boom"},"deviceId":"d"}',
        false,
      ),
      true,
    );
  });

  it("forces exit 1 when envelope has a failed step", () => {
    assert.strictEqual(
      shouldCliStdoutForceExitCode1(
        '{"envelope":{"status":"success","stepResults":[{"id":"a1","actionType":"read_text","success":false,"data":{}}],"error":null},"deviceId":"d"}',
        false,
      ),
      true,
    );
  });

  it("does not force exit 1 when envelope steps all succeeded", () => {
    assert.strictEqual(
      shouldCliStdoutForceExitCode1(
        '{"envelope":{"status":"success","stepResults":[{"id":"a1","actionType":"sleep","success":true,"data":{}}],"error":null},"deviceId":"d"}',
        false,
      ),
      false,
    );
  });
});
