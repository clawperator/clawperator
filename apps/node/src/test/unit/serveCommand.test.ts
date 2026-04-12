import { describe, it } from "node:test";
import assert from "node:assert";
import { buildServeSkillRunOptions } from "../../cli/commands/serve.js";

describe("buildServeSkillRunOptions", () => {
  it("passes device selection via env without prepending it to skill args", () => {
    const result = buildServeSkillRunOptions("device-123", ["40", "--dry-run"]);

    assert.deepStrictEqual(result.scriptArgs, ["40", "--dry-run"]);
    assert.deepStrictEqual(result.skillEnv, {
      CLAWPERATOR_DEVICE_ID: "device-123",
    });
  });

  it("omits skill env when no deviceId is provided", () => {
    const result = buildServeSkillRunOptions(undefined, ["40"]);

    assert.deepStrictEqual(result.scriptArgs, ["40"]);
    assert.strictEqual(result.skillEnv, undefined);
  });
});
