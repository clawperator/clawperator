import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { cmdVersion } from "../../cli/commands/version.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { probeVersionCompatibility } from "../../domain/version/compatibility.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";
import { ERROR_CODES } from "../../contracts/errors.js";

afterEach(() => {
  process.exitCode = undefined;
});

describe("cmdVersion", () => {
  it("returns the CLI version without touching adb", async () => {
    const output = await cmdVersion({ format: "json" });
    const parsed = JSON.parse(output);

    assert.match(parsed.cliVersion, /^\d+\.\d+\.\d+/);
  });

  it("reports compatibility details for an installed compatible APK", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator\n", stderr: "" });
    runner.queueResult({
      code: 0,
      stdout: "    versionCode=104900 minSdk=21 targetSdk=35\n    versionName=0.1.4-d\n",
      stderr: "",
    });

    const output = await cmdVersion({
      format: "json",
      checkCompat: true,
      receiverPackage: "com.clawperator.operator",
      runner,
    });
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.compatible, true);
    assert.strictEqual(parsed.receiverPackage, "com.clawperator.operator");
    assert.strictEqual(parsed.apkVersion, "0.1.4-d");
    assert.strictEqual(parsed.apkVersionCode, 104900);
  });

  it("returns a non-compatible payload when the APK is missing", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const output = await cmdVersion({
      format: "json",
      checkCompat: true,
      receiverPackage: "com.clawperator.operator.dev",
      runner,
    });
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.compatible, false);
    assert.strictEqual(parsed.error.code, ERROR_CODES.RECEIVER_NOT_INSTALLED);
  });

  it("sets a non-zero exit code when device resolution fails", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });

    const output = await cmdVersion({
      format: "json",
      checkCompat: true,
      receiverPackage: "com.clawperator.operator.dev",
      runner,
    });
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.code, ERROR_CODES.NO_DEVICES);
    assert.strictEqual(process.exitCode, 1);
  });
});

describe("probeVersionCompatibility", () => {
  it("returns invalid when the installed APK version is malformed", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({
      runner,
      deviceId: "test-device-1",
      receiverPackage: "com.clawperator.operator",
    });

    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator\n", stderr: "" });
    runner.queueResult({
      code: 0,
      stdout: "    versionCode=104900 minSdk=21 targetSdk=35\n    versionName=build-main\n",
      stderr: "",
    });

    const result = await probeVersionCompatibility(config);

    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.error?.code, ERROR_CODES.APK_VERSION_INVALID);
  });
});
