import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installOperator } from "../../domain/device/installOperator.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

const TEST_APK_PATH = join(tmpdir(), "clawperator-test-operator.apk");

function makeConfig(runner: FakeProcessRunner) {
  return getDefaultRuntimeConfig({
    runner,
    deviceId: "test-device",
  });
}

describe("installOperator - domain", () => {
  before(() => {
    // Create a dummy APK file so existsSync passes.
    writeFileSync(TEST_APK_PATH, "fake-apk-content");
  });

  after(() => {
    try { rmSync(TEST_APK_PATH); } catch { /* ignore */ }
  });

  it("fails fast when APK path does not exist", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    const result = await installOperator(config, "/nonexistent/operator.apk");

    assert.strictEqual(result.install.ok, false);
    assert.match(result.install.error ?? "", /APK file not found/);
    assert.strictEqual(result.permissions, undefined);
    assert.strictEqual(result.verification, undefined);
  });

  it("returns install failure when adb install returns non-zero", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    // adb install fails
    runner.queueResult({ code: 1, stdout: "", stderr: "INSTALL_FAILED_ALREADY_EXISTS" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.install.ok, false);
    assert.match(result.install.error ?? "", /INSTALL_FAILED_ALREADY_EXISTS/);
    assert.strictEqual(result.install.exitCode, 1);
    assert.strictEqual(result.permissions, undefined);
  });

  it("returns grant failure when receiver package is detected but accessibility grant fails", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    // adb install succeeds
    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    // detectReceiverPackage: release pkg found
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator", stderr: "" });
    // grantAccessibilityPermission: settings get fails
    runner.queueResult({ code: 1, stdout: "", stderr: "settings: command failed" });
    // grantNotificationPermission: still called by grantDevicePermissions
    runner.queueResult({ code: 1, stdout: "", stderr: "Not a changeable permission type" });
    // grantNotificationListenerPermission: still called
    runner.queueResult({ code: 0, stdout: "null", stderr: "" });
    // set enabled_notification_listeners
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.install.ok, true);
    assert.ok(result.permissions);
    assert.strictEqual(result.permissions?.accessibility.ok, false);
    assert.strictEqual(result.verification, undefined);
  });

  it("reports verification failure when auto-detect cannot find the installed package", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.install.ok, true);
    assert.strictEqual(result.permissions, undefined);
    assert.ok(result.verification);
    assert.strictEqual(result.verification?.ok, false);
    assert.strictEqual(result.verification?.packageInstalled, false);
    assert.match(result.verification?.error ?? "", /Could not detect installed Operator package after install/);
  });

  it("does not mistake the debug package for the release package during auto-detect", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev", stderr: "" });
    runner.queueResult({ code: 0, stdout: "null", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 1, stdout: "", stderr: "Not a changeable permission type" });
    runner.queueResult({ code: 0, stdout: "null", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.receiverPackage, "com.clawperator.operator.dev");
    assert.strictEqual(result.verification?.ok, true);
  });

  it("returns full success result when all phases pass", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    // adb install succeeds
    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    // detectReceiverPackage: release pkg found
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator", stderr: "" });
    // grantAccessibilityPermission: read current (no existing)
    runner.queueResult({ code: 0, stdout: "null", stderr: "" });
    // set accessibility_enabled
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    // set enabled_accessibility_services
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    // grantNotificationPermission: already granted
    runner.queueResult({ code: 1, stdout: "", stderr: "Not a changeable permission type" });
    // grantNotificationListenerPermission: read current (no existing)
    runner.queueResult({ code: 0, stdout: "null", stderr: "" });
    // set enabled_notification_listeners
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    // verification: pm list packages
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.install.ok, true);
    assert.strictEqual(result.receiverPackage, "com.clawperator.operator");
    assert.ok(result.permissions);
    assert.strictEqual(result.permissions?.accessibility.ok, true);
    assert.strictEqual(result.permissions?.notification.ok, true);
    assert.strictEqual(result.permissions?.notificationListener.ok, true);
    assert.ok(result.verification);
    assert.strictEqual(result.verification?.ok, true);
    assert.strictEqual(result.verification?.packageInstalled, true);
  });

  it("respects explicit --receiver-package and skips auto-detect", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    // adb install succeeds
    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    // grantAccessibilityPermission: read current (already enabled)
    runner.queueResult({ code: 0, stdout: "com.clawperator.operator.dev/clawperator.operator.accessibilityservice.OperatorAccessibilityService", stderr: "" });
    // grantNotificationPermission: already granted
    runner.queueResult({ code: 1, stdout: "", stderr: "Not a changeable permission type" });
    // grantNotificationListenerPermission: already enabled
    runner.queueResult({ code: 0, stdout: "com.clawperator.operator.dev/action.notification.NotificationListenerService", stderr: "" });
    // verification: pm list packages
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator.dev", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH, "com.clawperator.operator.dev");

    assert.strictEqual(result.receiverPackage, "com.clawperator.operator.dev");
    assert.strictEqual(result.install.ok, true);
    assert.strictEqual(result.permissions?.accessibility.alreadyEnabled, true);
    assert.strictEqual(result.verification?.ok, true);

    // Should not have called detectReceiverPackage (no extra pm list call needed)
    const detectCalls = runner.calls.filter(c =>
      c.args.includes("pm") && c.args.includes("list") && c.args.includes("com.clawperator.operator")
    );
    // Only the final verification pm list should have been called for the dev package
    assert.ok(detectCalls.length === 0, "Should not auto-detect when explicit package provided");
  });

  it("fails verification gracefully when pm list does not find package", async () => {
    const runner = new FakeProcessRunner();
    const config = makeConfig(runner);

    // adb install succeeds
    runner.queueResult({ code: 0, stdout: "Success", stderr: "" });
    // detectReceiverPackage: release pkg found
    runner.queueResult({ code: 0, stdout: "package:com.clawperator.operator", stderr: "" });
    // grantAccessibilityPermission: already enabled
    runner.queueResult({ code: 0, stdout: "com.clawperator.operator/clawperator.operator.accessibilityservice.OperatorAccessibilityService", stderr: "" });
    // grantNotificationPermission: skip (not changeable)
    runner.queueResult({ code: 1, stdout: "", stderr: "Not a changeable permission type" });
    // grantNotificationListenerPermission: already enabled
    runner.queueResult({ code: 0, stdout: "com.clawperator.operator/action.notification.NotificationListenerService", stderr: "" });
    // verification: pm list returns nothing
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const result = await installOperator(config, TEST_APK_PATH);

    assert.strictEqual(result.install.ok, true);
    assert.ok(result.verification);
    assert.strictEqual(result.verification?.ok, false);
    assert.strictEqual(result.verification?.packageInstalled, false);
    assert.match(result.verification?.error ?? "", /not found after install/);
  });
});
