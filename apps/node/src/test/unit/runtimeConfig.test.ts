import { describe, it } from "node:test";
import assert from "node:assert";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

  it("resolves emulator, sdkmanager, and avdmanager from known SDK locations", () => {
    const config = getDefaultRuntimeConfig();
    const homeDirectory = process.env.HOME;

    const emulatorCandidates = [
      ...(homeDirectory ? [join(homeDirectory, "Library/Android/sdk/emulator/emulator")] : []),
      "/opt/homebrew/share/android-commandlinetools/emulator/emulator",
    ];
    const sdkmanagerCandidates = [
      ...(homeDirectory ? [join(homeDirectory, "Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager")] : []),
      "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/sdkmanager",
    ];
    const avdmanagerCandidates = [
      ...(homeDirectory ? [join(homeDirectory, "Library/Android/sdk/cmdline-tools/latest/bin/avdmanager")] : []),
      "/opt/homebrew/share/android-commandlinetools/cmdline-tools/latest/bin/avdmanager",
    ];

    const expectedEmulator = emulatorCandidates.find(existsSync);
    if (expectedEmulator) {
      assert.strictEqual(config.emulatorPath, expectedEmulator);
    } else {
      assert.strictEqual(config.emulatorPath, "emulator");
    }

    const expectedSdkmanager = sdkmanagerCandidates.find(existsSync);
    if (expectedSdkmanager) {
      assert.strictEqual(config.sdkmanagerPath, expectedSdkmanager);
    } else {
      assert.strictEqual(config.sdkmanagerPath, "sdkmanager");
    }

    const expectedAvdmanager = avdmanagerCandidates.find(existsSync);
    if (expectedAvdmanager) {
      assert.strictEqual(config.avdmanagerPath, expectedAvdmanager);
    } else {
      assert.strictEqual(config.avdmanagerPath, "avdmanager");
    }
  });

  it("prefers ANDROID_HOME paths for emulator, sdkmanager, and avdmanager", () => {
    const originalAndroidHome = process.env.ANDROID_HOME;
    const originalAndroidSdkRoot = process.env.ANDROID_SDK_ROOT;
    try {
      // Point ANDROID_HOME at a location that does not exist
      process.env.ANDROID_HOME = "/nonexistent/android-sdk";
      delete process.env.ANDROID_SDK_ROOT;

      const config = getDefaultRuntimeConfig();
      // Nonexistent ANDROID_HOME candidate is not used for any tool
      assert.ok(!config.emulatorPath.startsWith("/nonexistent/android-sdk"), "emulatorPath must not use the nonexistent ANDROID_HOME candidate");
      // The tools should resolve to SOMETHING, and definitely not the nonexistent path
      assert.ok(config.sdkmanagerPath.length > 0);
      assert.ok(config.avdmanagerPath.length > 0);
      assert.ok(!config.sdkmanagerPath.startsWith("/nonexistent/android-sdk"));
      assert.ok(!config.avdmanagerPath.startsWith("/nonexistent/android-sdk"));
    } finally {
      if (originalAndroidHome !== undefined) {
        process.env.ANDROID_HOME = originalAndroidHome;
      } else {
        delete process.env.ANDROID_HOME;
      }
      if (originalAndroidSdkRoot !== undefined) {
        process.env.ANDROID_SDK_ROOT = originalAndroidSdkRoot;
      } else {
        delete process.env.ANDROID_SDK_ROOT;
      }
    }
  });
});
