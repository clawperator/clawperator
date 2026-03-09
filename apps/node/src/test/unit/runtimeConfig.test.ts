import { describe, it } from "node:test";
import assert from "node:assert";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";

describe("getDefaultRuntimeConfig", () => {
  it("returns required fields with defaults", () => {
    const config = getDefaultRuntimeConfig();
    assert.strictEqual(typeof config.adbPath, "string");
    assert.strictEqual(typeof config.emulatorPath, "string");
    assert.strictEqual(typeof config.sdkmanagerPath, "string");
    assert.strictEqual(typeof config.avdmanagerPath, "string");
    assert.strictEqual(typeof config.receiverPackage, "string");
    assert.strictEqual(typeof config.actionAgentCommand, "string");
    assert.strictEqual(typeof config.payloadExtraKey, "string");
    assert.ok(config.adbPath.length > 0);
    assert.ok(config.emulatorPath.length > 0);
    assert.ok(config.sdkmanagerPath.length > 0);
    assert.ok(config.avdmanagerPath.length > 0);
    assert.ok(config.receiverPackage.length > 0);
    assert.strictEqual(config.receiverPackage, "com.clawperator.operator");
  });

  it("merges overrides", () => {
    const config = getDefaultRuntimeConfig({
      deviceId: "device-1",
      emulatorPath: "custom-emulator",
      receiverPackage: "custom.receiver",
    });
    assert.strictEqual(config.deviceId, "device-1");
    assert.strictEqual(config.emulatorPath, "custom-emulator");
    assert.strictEqual(config.receiverPackage, "custom.receiver");
  });
});
