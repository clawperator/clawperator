import { describe, it } from "node:test";
import assert from "node:assert";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

describe("getDefaultRuntimeConfig", () => {
  it("returns required fields with defaults", () => {
    const config = getDefaultRuntimeConfig();
    assert.strictEqual(typeof config.adbPath, "string");
    assert.strictEqual(typeof config.receiverPackage, "string");
    assert.strictEqual(typeof config.actionAgentCommand, "string");
    assert.strictEqual(typeof config.payloadExtraKey, "string");
    assert.ok(config.adbPath.length > 0);
    assert.ok(config.receiverPackage.length > 0);
  });

  it("merges overrides", () => {
    const config = getDefaultRuntimeConfig({
      deviceId: "device-1",
      receiverPackage: "custom.receiver",
    });
    assert.strictEqual(config.deviceId, "device-1");
    assert.strictEqual(config.receiverPackage, "custom.receiver");
  });
});
