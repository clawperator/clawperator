import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { DoctorService } from "../../../domain/doctor/DoctorService.js";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { createClawperatorLogger } from "../../../adapters/logger.js";
import {
  getCliVersion,
  getOperatorApkDownloadUrl,
  getOperatorApkSha256Url,
} from "../../../domain/version/compatibility.js";

function withTempAgentSkillsDir<T>(config: T, baseDir: string): T {
  (config as T & { agentSkillsDir?: string }).agentSkillsDir = join(baseDir, "agent-skills");
  return config;
}

describe("DoctorService", () => {
  let fakeAgentCliDir: string;
  let fakeRegistryDir: string;
  let originalPath: string | undefined;
  let originalRegistryPath: string | undefined;

  beforeEach(async () => {
    originalPath = process.env.PATH;
    originalRegistryPath = process.env.CLAWPERATOR_SKILLS_REGISTRY;
    fakeAgentCliDir = await mkdtemp(join(tmpdir(), "clawperator-doctor-agent-cli-"));
    fakeRegistryDir = await mkdtemp(join(tmpdir(), "clawperator-doctor-registry-"));
    const fakeAgentPath = join(fakeAgentCliDir, "codex");
    const registryPath = join(fakeRegistryDir, "skills", "skills-registry.json");
    await mkdir(join(fakeRegistryDir, "skills"), { recursive: true });
    await writeFile(fakeAgentPath, "#!/bin/sh\nexit 0\n", "utf8");
    // Keep DoctorService tests isolated from any developer-local skills registry so
    // host.skill-agent-cli.skills assertions stay deterministic across machines.
    await writeFile(registryPath, `${JSON.stringify({ schemaVersion: "1.0", generatedAt: "2026-04-16T00:00:00Z", skills: [] }, null, 2)}\n`, "utf8");
    await chmod(fakeAgentPath, 0o755);
    process.env.PATH = `${fakeAgentCliDir}${delimiter}${originalPath ?? ""}`;
    process.env.CLAWPERATOR_SKILLS_REGISTRY = registryPath;
  });

  afterEach(async () => {
    await rm(fakeAgentCliDir, { recursive: true, force: true });
    await rm(fakeRegistryDir, { recursive: true, force: true });
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
    if (originalRegistryPath === undefined) {
      delete process.env.CLAWPERATOR_SKILLS_REGISTRY;
    } else {
      process.env.CLAWPERATOR_SKILLS_REGISTRY = originalRegistryPath;
    }
  });

  it("treats missing APK as a critical failure and skips the handshake", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), fakeRegistryDir);

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
    assert.strictEqual(apkPresence.code, ERROR_CODES.OPERATOR_NOT_INSTALLED);

    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
    assert.deepStrictEqual(report.nextActions, [
      "If you do not already have a local debug APK copy, rebuild the debug app from the same checkout before rerunning setup.",
      "clawperator operator setup --apk ~/.clawperator/downloads/operator-debug.apk --device test-device-1 --operator-package com.clawperator.operator.dev",
    ]);
  });

  it("fails when the installed APK is version-incompatible and skips the handshake", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), fakeRegistryDir);

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

  it("still reports the orchestrated agent CLI advisory when adb server startup fails", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), fakeRegistryDir);

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 1, stdout: "", stderr: "cannot start adb server" });

    const report = await new DoctorService().run({ config });

    const defaultAgentCliCheck = report.checks.find(check => check.id === "host.skill-agent-cli.default");
    assert.ok(defaultAgentCliCheck);
    assert.strictEqual(defaultAgentCliCheck.status, "pass");

    const installedAgentCliCheck = report.checks.find(check => check.id === "host.skill-agent-cli.skills");
    assert.ok(installedAgentCliCheck);
    assert.strictEqual(installedAgentCliCheck.status, "pass");

    const adbServer = report.checks.find(check => check.id === "host.adb.server");
    assert.ok(adbServer);
    assert.strictEqual(adbServer.status, "fail");
    assert.strictEqual(adbServer.code, ERROR_CODES.ADB_SERVER_FAILED);
  });

  it("fails clearly when the installed APK version cannot be read", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), fakeRegistryDir);

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

  it("exits cleanly with warn when multiple devices are connected and no --device is given", async () => {
    // Regression: when checkDeviceDiscovery returns "warn" (not "fail") for
    // MULTIPLE_DEVICES_DEVICE_ID_REQUIRED, shouldHaltOnFailure returns false and
    // execution continues. resolveDevice then throws due to ambiguity. The catch
    // block must finalize early; without this fix it would silently swallow the
    // exception and run all subsequent checks without a -s flag, causing adb errors.
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner }), fakeRegistryDir);

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
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator" }), fakeRegistryDir);

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
    assert.strictEqual(apkPresence.code, ERROR_CODES.OPERATOR_VARIANT_MISMATCH);
    assert.ok(!report.checks.some(check => check.id === "readiness.version.compatibility"));
    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
  });

  it("treats package query failures as critical and skips the handshake", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), fakeRegistryDir);

    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Android Debug Bridge version 1.0.41", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\ntest-device-1\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "33\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical size: 1080x2400\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Physical density: 420\n", stderr: "" });
    runner.queueResult({ code: 1, stdout: "", stderr: "cmd: Can't find service: package" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const report = await new DoctorService().run({ config });

    assert.strictEqual(report.criticalOk, false);
    assert.strictEqual(report.ok, false);

    const apkPresence = report.checks.find(check => check.id === "readiness.apk.presence");
    assert.ok(apkPresence);
    assert.strictEqual(apkPresence.status, "fail");
    assert.strictEqual(apkPresence.code, ERROR_CODES.DEVICE_SHELL_UNAVAILABLE);
    assert.ok(!report.checks.some(check => check.id === "readiness.handshake"));
  });

  it("lists the release download instructions before the install command", async () => {
    const runner = new FakeProcessRunner();
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator" }), fakeRegistryDir);

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

    const apkPresence = report.checks.find(check => check.id === "readiness.apk.presence");
    assert.ok(apkPresence);
    const cliVersion = getCliVersion();
    assert.deepStrictEqual(apkPresence.fix?.steps.map(step => step.value), [
      `Download the exact release APK from ${getOperatorApkDownloadUrl(cliVersion)} and the checksum from ${getOperatorApkSha256Url(cliVersion)}.`,
      "clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device test-device-1",
    ]);
  });
});

describe("DoctorService logging", () => {
  let tempRoot: string;
  let fakeAgentCliDir: string;
  let originalPath: string | undefined;

  beforeEach(async () => {
    tempRoot = await mkdtemp(join(tmpdir(), "clawperator-doctor-log-"));
    originalPath = process.env.PATH;
    fakeAgentCliDir = await mkdtemp(join(tmpdir(), "clawperator-doctor-log-agent-cli-"));
    const fakeAgentPath = join(fakeAgentCliDir, "codex");
    await writeFile(fakeAgentPath, "#!/bin/sh\nexit 0\n", "utf8");
    await chmod(fakeAgentPath, 0o755);
    process.env.PATH = `${fakeAgentCliDir}${delimiter}${originalPath ?? ""}`;
  });

  afterEach(async () => {
    await rm(tempRoot, { recursive: true, force: true });
    await rm(fakeAgentCliDir, { recursive: true, force: true });
    if (originalPath === undefined) {
      delete process.env.PATH;
    } else {
      process.env.PATH = originalPath;
    }
  });

  it("logs one doctor.check entry per check", async () => {
    const runner = new FakeProcessRunner();
    const logger = createClawperatorLogger({ logDir: join(tempRoot, "logs"), logLevel: "info" });
    const config = withTempAgentSkillsDir(getDefaultRuntimeConfig({ runner, operatorPackage: "com.clawperator.operator.dev" }), tempRoot);

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

    const report = await new DoctorService().run({ config, logger });

    assert.strictEqual(report.ok, false);
    const contents = await readFile(logger.logPath()!, "utf8");
    const lines = contents.trimEnd().split("\n").map(line => JSON.parse(line) as { event: string; message?: string });
    assert.ok(lines.some(line => line.event === "doctor.check"));
    assert.ok(lines.some(line => line.message?.includes("readiness.apk.presence")));
  });
});
