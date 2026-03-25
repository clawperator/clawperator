import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdDoctor } from "../../cli/commands/doctor.js";
import { ERROR_CODES } from "../../contracts/errors.js";
import { DOCTOR_DOCS_URLS } from "../../domain/doctor/docsUrls.js";

afterEach(() => {
  process.exitCode = undefined;
});

describe("cmdDoctor", () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../../../../..");

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
                code: ERROR_CODES.OPERATOR_NOT_INSTALLED,
                summary: "Operator APK not installed.",
              },
            ],
            nextActions: ["clawperator operator setup --apk ~/.clawperator/downloads/operator.apk --device test-device-1"],
          }),
        },
      }
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.criticalOk, false);
    assert.strictEqual(parsed.checks[0].code, ERROR_CODES.OPERATOR_NOT_INSTALLED);
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
                code: ERROR_CODES.OPERATOR_NOT_INSTALLED,
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

  it("includes docsUrl in JSON output when a fix provides one", async () => {
    const output = await cmdDoctor(
      {
        format: "json",
      },
      {
        doctorService: {
          run: async () => ({
            ok: false,
            criticalOk: false,
            checks: [
              {
                id: "host.node.version",
                status: "fail",
                code: ERROR_CODES.NODE_TOO_OLD,
                summary: "Node is too old.",
                fix: {
                  title: "Upgrade Node.js",
                  platform: "any",
                  steps: [{ kind: "shell", value: "nvm install 22" }],
                  docsUrl: DOCTOR_DOCS_URLS.setup,
                },
              },
            ],
          }),
        },
      }
    );

    const parsed = JSON.parse(output);
    assert.strictEqual(parsed.checks[0].fix.docsUrl, DOCTOR_DOCS_URLS.setup);
  });

  it("omits docsUrl in JSON output when a fix does not provide one", async () => {
    const output = await cmdDoctor(
      {
        format: "json",
      },
      {
        doctorService: {
          run: async () => ({
            ok: false,
            criticalOk: false,
            checks: [
              {
                id: "host.adb.presence",
                status: "fail",
                code: ERROR_CODES.ADB_NOT_FOUND,
                summary: "adb not found.",
                fix: {
                  title: "Install adb",
                  platform: "any",
                  steps: [{ kind: "manual", value: "Install platform tools" }],
                },
              },
            ],
          }),
        },
      }
    );

    const parsed = JSON.parse(output);
    assert.ok(!("docsUrl" in parsed.checks[0].fix));
  });

  it("renders docsUrl in pretty output", async () => {
    const output = await cmdDoctor(
      {
        format: "pretty",
      },
      {
        doctorService: {
          run: async () => ({
            ok: false,
            criticalOk: false,
            checks: [
              {
                id: "readiness.handshake",
                status: "fail",
                code: ERROR_CODES.RESULT_ENVELOPE_TIMEOUT,
                summary: "Handshake timed out.",
                fix: {
                  title: "Grant accessibility permissions via adb",
                  platform: "any",
                  steps: [{ kind: "shell", value: "clawperator grant-device-permissions --device test-device" }],
                  docsUrl: DOCTOR_DOCS_URLS.operator,
                },
              },
            ],
          }),
        },
      }
    );

    assert.match(output, /Docs: https:\/\/docs\.clawperator\.com\/troubleshooting\/operator\//);
  });

  it("uses docsUrl values that map to pages present in mkdocs nav", async () => {
    const mkdocsText = await readFile(join(repoRoot, "sites/docs/mkdocs.yml"), "utf8");
    const docsUrlToNavPath = new Map<string, string>([
      [DOCTOR_DOCS_URLS.setup, "setup.md"],
      [DOCTOR_DOCS_URLS.devices, "api/devices.md"],
      [DOCTOR_DOCS_URLS.operator, "troubleshooting/operator.md"],
      [DOCTOR_DOCS_URLS.compatibility, "troubleshooting/compatibility.md"],
    ]);

    for (const [docsUrl, navPath] of docsUrlToNavPath) {
      assert.match(mkdocsText, new RegExp(navPath.replace("/", "\\/")));
      assert.match(docsUrl, /^https:\/\/docs\.clawperator\.com\/.+\/$/);
    }
  });
});
