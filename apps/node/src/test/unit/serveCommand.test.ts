import { describe, it } from "node:test";
import assert from "node:assert";
import { buildServeSkillRunOptions, mapServeErrorCodeToStatus } from "../../cli/commands/serve.js";
import { ERROR_CODES } from "../../contracts/errors.js";

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

  it("preserves an explicitly provided blank deviceId so the boundary can reject it", () => {
    const result = buildServeSkillRunOptions("", ["40"]);

    assert.deepStrictEqual(result.scriptArgs, ["40"]);
    assert.deepStrictEqual(result.skillEnv, {
      CLAWPERATOR_DEVICE_ID: "",
    });
  });
});

describe("mapServeErrorCodeToStatus", () => {
  it("maps DEVICE_NOT_INTERACTIVE to 409 Conflict for direct execution routes", () => {
    assert.strictEqual(mapServeErrorCodeToStatus(ERROR_CODES.DEVICE_NOT_INTERACTIVE), 409);
  });
});
