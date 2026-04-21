import { describe, it } from "node:test";
import assert from "node:assert";
import { buildServeSkillRunOptions, mapServeErrorCodeToStatus } from "../../cli/commands/serve.js";
import { ERROR_CODES } from "../../contracts/errors.js";

describe("buildServeSkillRunOptions", () => {
  it("passes explicit device selection via env without prepending it to skill args", () => {
    const result = buildServeSkillRunOptions("device-123", "com.test.operator", ["40", "--dry-run"]);

    assert.deepStrictEqual(result.scriptArgs, ["40", "--dry-run"]);
    assert.deepStrictEqual(result.skillEnv, {
      CLAWPERATOR_OPERATOR_PACKAGE: "com.test.operator",
      CLAWPERATOR_DEVICE_ID: "device-123",
    });
  });

  it("always passes the resolved operator package even when no deviceId is provided", () => {
    const result = buildServeSkillRunOptions(undefined, "com.test.operator", ["40"]);

    assert.deepStrictEqual(result.scriptArgs, ["40"]);
    assert.deepStrictEqual(result.skillEnv, {
      CLAWPERATOR_DEVICE_ID: undefined,
      CLAWPERATOR_OPERATOR_PACKAGE: "com.test.operator",
    });
  });

  it("preserves an explicitly provided blank deviceId so the boundary can reject it", () => {
    const result = buildServeSkillRunOptions("", "com.test.operator", ["40"]);

    assert.deepStrictEqual(result.scriptArgs, ["40"]);
    assert.deepStrictEqual(result.skillEnv, {
      CLAWPERATOR_OPERATOR_PACKAGE: "com.test.operator",
      CLAWPERATOR_DEVICE_ID: "",
    });
  });
});

describe("mapServeErrorCodeToStatus", () => {
  it("maps DEVICE_NOT_INTERACTIVE to 409 Conflict for direct execution routes", () => {
    assert.strictEqual(mapServeErrorCodeToStatus(ERROR_CODES.DEVICE_NOT_INTERACTIVE), 409);
  });
});
