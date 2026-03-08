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
      stdout: "    versionCode=200000 minSdk=21 targetSdk=35\n    versionName=0.2.0-d\n",
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
    assert.strictEqual(parsed.apkVersion, "0.2.0-d");
    assert.strictEqual(parsed.apkVersionCode, 200000);
  });

  it("returns a non-compatible payload when the APK is missing", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
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
    assert.deepStrictEqual(parsed.remediation, [
      "Install the Operator APK from https://clawperator.com/operator.apk",
      "If you need a specific build, use the install script: curl -fsSL https://clawperator.com/install.sh | bash",
      "If a different variant is installed, rerun with --receiver-package <package>",
    ]);
  });

  it("reports a variant mismatch when the alternate receiver package is installed", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator\n", stderr: "" });

    const output = await cmdVersion({
      format: "json",
      checkCompat: true,
      receiverPackage: "com.clawperator.operator.dev",
      runner,
    });
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.compatible, false);
    assert.strictEqual(parsed.error.code, ERROR_CODES.RECEIVER_VARIANT_MISMATCH);
    assert.match(parsed.error.message, /Expected com\.clawperator\.operator\.dev/);
  });

  it("treats the debug APK as an alternate variant when the release package is requested", async () => {
    const runner = new FakeProcessRunner();

    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });

    const output = await cmdVersion({
      format: "json",
      checkCompat: true,
      receiverPackage: "com.clawperator.operator",
      runner,
    });
    const parsed = JSON.parse(output);

    assert.strictEqual(parsed.compatible, false);
    assert.strictEqual(parsed.error.code, ERROR_CODES.RECEIVER_VARIANT_MISMATCH);
    assert.match(parsed.error.message, /Expected com\.clawperator\.operator but found installed variant com\.clawperator\.operator\.dev/);
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
  it("returns variant mismatch when only the alternate receiver package is installed", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({
      runner,
      deviceId: "test-device-1",
      receiverPackage: "com.clawperator.operator.dev",
    });

    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator\n", stderr: "" });

    const result = await probeVersionCompatibility(config);

    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.error?.code, ERROR_CODES.RECEIVER_VARIANT_MISMATCH);
    assert.ok(result.remediation?.includes("Use --receiver-package com.clawperator.operator"));
  });

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

  it("returns variant mismatch when only the debug APK matches a release package substring", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({
      runner,
      deviceId: "test-device-1",
      receiverPackage: "com.clawperator.operator",
    });

    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });

    const result = await probeVersionCompatibility(config);

    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.error?.code, ERROR_CODES.RECEIVER_VARIANT_MISMATCH);
    assert.ok(result.remediation?.includes("Use --receiver-package com.clawperator.operator.dev"));
  });

  it("returns a shell error when package queries fail", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({
      runner,
      deviceId: "test-device-1",
      receiverPackage: "com.clawperator.operator",
    });

    runner.queueResult({ code: 1, stdout: "", stderr: "cmd: Can't find service: package", error: new Error("shell failed") });

    const result = await probeVersionCompatibility(config);

    assert.strictEqual(result.compatible, false);
    assert.strictEqual(result.error?.code, ERROR_CODES.DEVICE_SHELL_UNAVAILABLE);
    assert.match(result.error?.message ?? "", /Could not query installed packages/);
    assert.deepStrictEqual(result.remediation, [
      "Verify adb shell access with: adb shell pm list packages",
      "Reconnect the device or restart adb if shell commands are failing",
    ]);
  });
});
