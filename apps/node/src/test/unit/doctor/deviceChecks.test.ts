import assert from "node:assert";
import { describe, it } from "node:test";
import { getDefaultRuntimeConfig } from "../../../adapters/android-bridge/runtimeConfig.js";
import { ERROR_CODES } from "../../../contracts/errors.js";
import { checkDeviceDiscovery } from "../../../domain/doctor/checks/deviceChecks.js";
import { FakeProcessRunner } from "../fakes/FakeProcessRunner.js";

describe("checkDeviceDiscovery", () => {
  it("warns when multiple healthy devices are connected without a device id", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner });

    runner.queueResult({
      code: 0,
      stdout: "List of devices attached\nserial1\tdevice\nserial2\tdevice\n",
      stderr: "",
    });

    const result = await checkDeviceDiscovery(config);

    assert.strictEqual(result.status, "warn");
    assert.strictEqual(result.code, ERROR_CODES.MULTIPLE_DEVICES_DEVICE_ID_REQUIRED);
  });

  it("fails when no devices are connected", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner });

    runner.queueResult({
      code: 0,
      stdout: "List of devices attached\n",
      stderr: "",
    });

    const result = await checkDeviceDiscovery(config);

    assert.strictEqual(result.status, "fail");
    assert.strictEqual(result.code, ERROR_CODES.NO_DEVICES);
  });

  it("passes when exactly one healthy device is connected", async () => {
    const runner = new FakeProcessRunner();
    const config = getDefaultRuntimeConfig({ runner });

    runner.queueResult({
      code: 0,
      stdout: "List of devices attached\nserial1\tdevice\n",
      stderr: "",
    });

    const result = await checkDeviceDiscovery(config);

    assert.strictEqual(result.status, "pass");
    assert.strictEqual(result.summary, "Device serial1 is connected and reachable.");
  });
});
