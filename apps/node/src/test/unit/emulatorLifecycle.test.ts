import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import {
  createAvd,
  deleteAvd,
  enableEmulatorDeveloperSettings,
  ensureSystemImageInstalled,
  startAvd,
  stopAvd,
  waitForBootCompletion,
  waitForEmulatorRegistration,
} from "../../domain/android-emulators/lifecycle.js";
import { FakeProcessRunner } from "./fakes/FakeProcessRunner.js";

async function writeAvd(homeDir: string, name: string, configIni: string): Promise<void> {
  const avdRoot = join(homeDir, ".android", "avd");
  await mkdir(join(avdRoot, `${name}.avd`), { recursive: true });
  await writeFile(join(avdRoot, `${name}.avd`, "config.ini"), configIni, "utf8");
  await writeFile(join(avdRoot, `${name}.ini`), "target=android-35\n", "utf8");
}

describe("emulator lifecycle", () => {
  const originalHome = process.env.HOME;
  let testHome: string;

  beforeEach(async () => {
    testHome = await mkdtemp(join(tmpdir(), "clawperator-emulator-lifecycle-test-"));
    process.env.HOME = testHome;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
  });

  it("installs a missing system image after accepting licenses", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "Installed packages:\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "licenses accepted", stderr: "" });
    runner.queueResult({ code: 0, stdout: "installed", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await ensureSystemImageInstalled(config, "system-images;android-35;google_apis_playstore;arm64-v8a");

    assert.strictEqual(runner.calls[0].command, "sdkmanager");
    assert.deepStrictEqual(runner.calls[0].args, ["--list_installed"]);
    assert.strictEqual(runner.calls[1].command, "bash");
    assert.match(runner.calls[1].args[1], /sdkmanager" --licenses/);
    assert.strictEqual(runner.calls[2].command, "sdkmanager");
  });

  it("creates an AVD with a deterministic avdmanager command", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({
      code: 0,
      stdout: "system-images;android-35;google_apis_playstore;arm64-v8a\n",
      stderr: "",
    });
    runner.queueResult({ code: 0, stdout: "created", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await createAvd(config, { name: "clawperator-pixel" });

    assert.strictEqual(runner.calls[1].command, "bash");
    assert.match(runner.calls[1].args[1], /avdmanagerPath|avdmanager/);
    assert.match(runner.calls[1].args[1], /create avd --force --name "clawperator-pixel"/);
    assert.match(runner.calls[1].args[1], /--device "pixel_7"/);
  });

  it("starts an AVD detached with fully ignored stdio", () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner });

    startAvd(config, "clawperator-pixel");

    assert.strictEqual(runner.calls[0].command, config.emulatorPath);
    assert.deepStrictEqual(runner.calls[0].args, ["@clawperator-pixel", "-no-snapshot-load", "-no-boot-anim"]);
    assert.deepStrictEqual(runner.calls[0].options, {
      detached: true,
      stdio: ["ignore", "ignore", "ignore"],
      shell: false,
    });
  });

  it("waits for emulator registration by polling adb devices and emulator console naming", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "List of devices attached\nemulator-5554\tdevice\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "OK\nclawperator-pixel\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "0\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "0\n", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    const serial = await waitForEmulatorRegistration(config, "clawperator-pixel", 2_500);
    assert.strictEqual(serial, "emulator-5554");
  });

  it("times out when boot completion never reaches both properties", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "1\n", stderr: "" });
    runner.queueResult({ code: 0, stdout: "0\n", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await assert.rejects(
      () => waitForBootCompletion(config, "emulator-5554", 5),
      (error: unknown) => {
        const typed = error as { code: string };
        assert.strictEqual(typed.code, ERROR_CODES.EMULATOR_BOOT_TIMEOUT);
        return true;
      }
    );
  });

  it("stops and deletes by AVD name", async () => {
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
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await stopAvd(config, "clawperator-pixel");
    assert.deepStrictEqual(runner.calls[4].args, ["-s", "emulator-5554", "emu", "kill"]);

    const deleteRunner = new FakeProcessRunner();
    deleteRunner.queueResult({ code: 0, stdout: "List of devices attached\n", stderr: "" });
    deleteRunner.queueResult({ code: 0, stdout: "", stderr: "" });
    const deleteConfig = getDefaultRuntimeConfig({ runner: deleteRunner });
    await deleteAvd(deleteConfig, "clawperator-pixel");
    assert.deepStrictEqual(deleteRunner.calls[1].args, ["delete", "avd", "--name", "clawperator-pixel"]);
  });

  it("enables developer settings and adb on a booted emulator", async () => {
    const runner = new FakeProcessRunner();
    runner.queueResult({ code: 0, stdout: "", stderr: "" });
    runner.queueResult({ code: 0, stdout: "", stderr: "" });

    const config = getDefaultRuntimeConfig({ runner });
    await enableEmulatorDeveloperSettings(config, "emulator-5554");

    assert.deepStrictEqual(runner.calls[0].args, [
      "-s", "emulator-5554", "shell", "settings", "put", "global", "development_settings_enabled", "1",
    ]);
    assert.deepStrictEqual(runner.calls[1].args, [
      "-s", "emulator-5554", "shell", "settings", "put", "global", "adb_enabled", "1",
    ]);
  });
});
