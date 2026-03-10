import { describe, it } from "node:test";
import assert from "node:assert";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { DEFAULT_EMULATOR_AVD_NAME, DEFAULT_EMULATOR_DEVICE_PROFILE, DEFAULT_EMULATOR_SYSTEM_IMAGE, SUPPORTED_EMULATOR_API_LEVEL } from "../../domain/android-emulators/constants.js";
import { assertRequiredEmulatorTools, checkRequiredEmulatorTools } from "../../domain/android-emulators/hostRequirements.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

describe("android emulator foundation", () => {
  it("defines deterministic emulator defaults", () => {
    assert.strictEqual(DEFAULT_EMULATOR_AVD_NAME, "clawperator-pixel");
    assert.strictEqual(DEFAULT_EMULATOR_DEVICE_PROFILE, "pixel_7");
    assert.strictEqual(SUPPORTED_EMULATOR_API_LEVEL, 35);
    assert.strictEqual(
      DEFAULT_EMULATOR_SYSTEM_IMAGE,
      "system-images;android-35;google_apis_playstore;arm64-v8a"
    );
  });

  it("checks required Android SDK host tools", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "adb help", stderr: "" });
    runner.queueResult({ code: 0, stdout: "emulator help", stderr: "" });
    runner.queueResult({ code: 0, stdout: "sdkmanager help", stderr: "" });
    runner.queueResult({ code: 0, stdout: "avdmanager help", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    const results = await checkRequiredEmulatorTools(config);

    assert.deepStrictEqual(results, [
      { tool: "adb", available: true },
      { tool: "emulator", available: true },
      { tool: "sdkmanager", available: true },
      { tool: "avdmanager", available: true },
    ]);
  });

  it("throws a structured error when a required tool is missing", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "adb help", stderr: "" });
    runner.queueError(127, "ENOENT");
    runner.queueResult({ code: 0, stdout: "sdkmanager help", stderr: "" });
    runner.queueResult({ code: 0, stdout: "avdmanager help", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });

    await assert.rejects(
      () => assertRequiredEmulatorTools(config),
      (error: unknown) => {
        const typed = error as { code: string; details?: { missingTools?: string[] } };
        assert.strictEqual(typed.code, ERROR_CODES.ANDROID_SDK_TOOL_MISSING);
        assert.deepStrictEqual(typed.details?.missingTools, ["emulator"]);
        return true;
      }
    );
  });
});
