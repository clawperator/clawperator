import { describe, it } from "node:test";
import assert from "node:assert";
import { DoctorService } from "../../../domain/doctor/DoctorService.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";
import { ERROR_CODES } from "../../../contracts/errors.js";

describe("DoctorService", () => {
  it("treats missing APK as a critical failure and skips the handshake", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner, receiverPackage: "com.clawperator.operator.dev" });

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "33\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical size: 1080x2400\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical density: 420\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    assert.strictEqual(report.criticalOk, false);
    assert.strictEqual(report.ok, false);
    assert.strictEqual(report.deviceId, "test-device-1");

    const apkPresence = report.checks.find(check => check.id === "readiness.apk.presence");
    assert.ok(apkPresence);
    assert.strictEqual(apkPresence.status, "fail");
    assert.strictEqual(apkPresence.code, ERROR_CODES.RECEIVER_NOT_INSTALLED);

    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
    assert.ok(report.nextActions?.includes("clawperator operator setup --apk ~/.clawperator/downloads/operator-debug.apk --device-id test-device-1 --receiver-package com.clawperator.operator.dev"));
  });

  it("fails when the installed APK is version-incompatible and skips the handshake", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner, receiverPackage: "com.clawperator.operator.dev" });

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "33\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical size: 1080x2400\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical density: 420\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({
      code: 0,
      stdout: "    versionCode=200000 minSdk=21 targetSdk=35\n    versionName=0.1.4-d\n",
      stderr: "",
    });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    assert.strictEqual(report.criticalOk, false);
    assert.strictEqual(report.ok, false);

    const versionCheck = report.checks.find(check => check.id === "readiness.version.compatibility");
    assert.ok(versionCheck);
    assert.strictEqual(versionCheck.status, "fail");
    assert.strictEqual(versionCheck.code, ERROR_CODES.VERSION_INCOMPATIBLE);
    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
  });

  it("fails clearly when the installed APK version cannot be read", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner, receiverPackage: "com.clawperator.operator.dev" });

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "33\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical size: 1080x2400\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical density: 420\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Package [com.clawperator.operator.dev]\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    assert.strictEqual(report.criticalOk, false);
    const versionCheck = report.checks.find(check => check.id === "readiness.version.compatibility");
    assert.ok(versionCheck);
    assert.strictEqual(versionCheck.status, "fail");
    assert.strictEqual(versionCheck.code, ERROR_CODES.APK_VERSION_UNREADABLE);
    assert.strictEqual(versionCheck.summary, "Could not verify CLI and installed APK version compatibility.");
    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
  });

  it("exits cleanly with warn when multiple devices are connected and no --device-id is given", async () => {
    // Regression: when checkDeviceDiscovery returns "warn" (not "fail") for
    // MULTIPLE_DEVICES_DEVICE_ID_REQUIRED, shouldHaltOnFailure returns false and
    // execution continues. resolveDevice then throws due to ambiguity. The catch
    // block must finalize early; without this fix it would silently swallow the
    // exception and run all subsequent checks without a -s flag, causing adb errors.
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner });

    // checkAdbPresence: isAdbAvailable → adb version
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    // checkAdbPresence: runAdb version (evidence)
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    // checkAdbServer: adb start-server
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    // checkDeviceDiscovery: adb devices (two devices → warn)
    runner.queueResult({ code: 0, stdout: "List of devices attached\nserial1\tdevice\nserial2\tdevice\n", stderr: "" });
    // resolveDevice: adb devices (two devices → throws → caught → early finalize)
    runner.queueResult({ code: 0, stdout: "List of devices attached\nserial1\tdevice\nserial2\tdevice\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    // Should exit 0: warn is not a failure for criticalOk
    assert.strictEqual(report.criticalOk, true);
    assert.strictEqual(report.ok, true);

    // Discovery check must be present as a warn
    const discovery = report.checks.find(c => c.id === "device.discovery");
    assert.ok(discovery);
    assert.strictEqual(discovery.status, "warn");
    assert.strictEqual(discovery.code, ERROR_CODES.MULTIPLE_DEVICES_DEVICE_ID_REQUIRED);

    // No device-specific checks should have run
    assert.ok(!report.checks.some(c => c.id === "device.capability"), "device.capability should not run");
    assert.ok(!report.checks.some(c => c.id === "readiness.apk.presence"), "readiness.apk.presence should not run");
    assert.ok(!report.checks.some(c => c.id === "readiness.handshake"), "readiness.handshake should not run");

    // deviceId must remain unresolved
    assert.strictEqual(report.deviceId, undefined);
  });

  it("warns when the release package is requested but only debug is installed", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner, receiverPackage: "com.clawperator.operator" });

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "33\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical size: 1080x2400\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical density: 420\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    assert.strictEqual(report.criticalOk, true);
    const apkPresence = report.checks.find(check => check.id === "readiness.apk.presence");
    assert.ok(apkPresence);
    assert.strictEqual(apkPresence.status, "warn");
    assert.strictEqual(apkPresence.code, ERROR_CODES.RECEIVER_VARIANT_MISMATCH);
    assert.ok(!report.checks.some(check => check.id === "readiness.version.compatibility"));
    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
  });
});
