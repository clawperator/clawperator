import { describe, it } from "node:test";
import assert from "node:assert";
import { DoctorService } from "../../../domain/doctor/DoctorService.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";
import { ERROR_CODES } from "../../../contracts/errors.js";

describe("DoctorService", () => {
  it("treats missing APK as a warning and skips the handshake", async () => {
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

    assert.strictEqual(report.criticalOk, true);
    assert.strictEqual(report.ok, true);
    assert.strictEqual(report.deviceId, "test-device-1");

    const apkPresence = report.checks.find(check => check.id === "readiness.apk.presence");
    assert.ok(apkPresence);
    assert.strictEqual(apkPresence.status, "warn");
    assert.strictEqual(apkPresence.code, ERROR_CODES.RECEIVER_NOT_INSTALLED);

    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
    assert.ok(report.nextActions?.includes("Download and install the APK from https://github.com/clawpilled/clawperator/releases/latest"));
  });
});
