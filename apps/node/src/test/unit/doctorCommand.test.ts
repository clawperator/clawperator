import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { cmdDoctor } from "../../cli/commands/doctor.js";
import { ERROR_CODES } from "../../contracts/errors.js";

afterEach(() => {
  process.exitCode = undefined;
});

describe("cmdDoctor", () => {
  it("keeps exit code 0 under --check-only even when the APK is missing", async () => {
    const output = await cmdDoctor(
      {
        format: "json",
        checkOnly: true,
        deviceId: "test-device-1",
        operatorPackage: "com.test.operator",
      },
      {
        doctorService: {
          run: async () => ({
            ok: false,
            criticalOk: false,
            deviceId: "test-device-1",
            operatorPackage: "com.test.operator",
            checks: [
              {
                id: "readiness.apk.presence",
                status: "fail",
                code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
                summary: "Operator APK not installed.",
              },
            ],
            nextActions: ["clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device-id test-device-1"],
          }),
        },
      }
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.criticalOk, false);
    assert.strictEqual(parsed.checks[0].code, ERROR_CODES.RECEIVER_NOT_INSTALLED);
    assert.strictEqual(process.exitCode, 0);
  });

  it("returns a non-zero exit code without --check-only when the APK is missing", async () => {
    const output = await cmdDoctor(
      {
        format: "json",
        deviceId: "test-device-1",
        operatorPackage: "com.test.operator",
      },
      {
        doctorService: {
          run: async () => ({
            ok: false,
            criticalOk: false,
            deviceId: "test-device-1",
            operatorPackage: "com.test.operator",
            checks: [
              {
                id: "readiness.apk.presence",
                status: "fail",
                code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
                summary: "Operator APK not installed.",
              },
            ],
          }),
        },
      }
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.criticalOk, false);
    assert.strictEqual(process.exitCode, 1);
  });
});
