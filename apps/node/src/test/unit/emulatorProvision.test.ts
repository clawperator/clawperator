import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { provisionEmulator } from "../../domain/android-emulators/provision.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

async function writeAvd(homeDir: string, name: string, configIni: string): Promise<void> {
  const avdRoot = join(homeDir, ".android", "avd");
  await mkdir(join(avdRoot, `${name}.avd`), { recursive: true });
  await writeFile(join(avdRoot, `${name}.avd`, "config.ini"), configIni, "utf8");
  await writeFile(join(avdRoot, `${name}.ini`), "target=android-35\n", "utf8");
}

describe("emulator provisioning", () => {
  const originalHome = process.env.HOME;
  let testHome: string;

  beforeEach(async () => {
    testHome = await mkdtemp(join(tmpdir(), "clawperator-emulator-provision-test-"));
    process.env.HOME = testHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it("reuses a running supported emulator immediately", async () => {
    await writeAvd(
      testHome,
      "clawperator-pixel",
      [
        "PlayStore.enabled=true",
        "abi.type=arm64-v8a",
        "image.sysdir.1=system-images/android-35/google_apis_playstore/arm64-v8a/",
        "hw.device.name=pixel_7",
      ].join("\n")
    );

    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "OK\nclawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    const result = await provisionEmulator(config);

    assert.deepStrictEqual(result, {
      type: "emulator",
      avdName: "clawperator-pixel",
      serial: "emulator-5554",
      booted: true,
      created: false,
      started: false,
      reused: true,
    });
  });

  it("starts a supported configured AVD when none are running", async () => {
    await writeAvd(
      testHome,
      "clawperator-pixel",
      [
        "PlayStore.enabled=true",
        "abi.type=arm64-v8a",
        "image.sysdir.1=system-images/android-35/google_apis_playstore/arm64-v8a/",
        "hw.device.name=pixel_7",
      ].join("\n")
    );

    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "clawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "OK\nclawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "0\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "0\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "OK\nclawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    const result = await provisionEmulator(config);

    assert.strictEqual(result.avdName, "clawperator-pixel");
    assert.strictEqual(result.serial, "emulator-5554");
    assert.strictEqual(result.created, false);
    assert.strictEqual(result.started, true);
    assert.strictEqual(result.reused, true);
  });

  it("creates a new supported AVD when none exist", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "Installed packages:\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "licenses accepted", stderr: "" });
    runner.queueResult({ code: 0, stdout: "installed", stderr: "" });
    runner.queueResult({ code: 0, stdout: "created", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "OK\nclawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    const result = await provisionEmulator(config);

    assert.strictEqual(result.created, true);
    assert.strictEqual(result.started, true);
    assert.strictEqual(result.reused, false);
    assert.strictEqual(result.avdName, "clawperator-pixel");
  });

  it("refuses to auto-provision an existing unsupported default AVD", async () => {
    await writeAvd(
      testHome,
      "clawperator-pixel",
      [
        "PlayStore.enabled=false",
        "abi.type=x86_64",
        "image.sysdir.1=system-images/android-34/google_apis/x86_64/",
        "hw.device.name=pixel_9",
      ].join("\n")
    );

    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await assert.rejects(
      () => provisionEmulator(config),
      (error: unknown) => {
        const typed = error as { code: string };
        assert.strictEqual(typed.code, ERROR_CODES.EMULATOR_UNSUPPORTED);
        return true;
      }
    );
  });
});
