import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getAlternateReceiverVariant,
  isVersionCompatible,
  normalizeCompatibilityVersion,
  parseCompatibilityVersion,
  parseInstalledApkVersion,
  readCliVersion,
} from "../../domain/version/compatibility.js";

describe("version compatibility", () => {
  it("normalizes the debug suffix before compatibility parsing", () => {
    assert.strictEqual(normalizeCompatibilityVersion("0.1.4-d"), "0.1.4");
    assert.strictEqual(normalizeCompatibilityVersion("0.1.4-rc.1-d"), "0.1.4-rc.1");
  });

  it("removes only a trailing debug suffix when deriving the alternate package", () => {
    assert.strictEqual(getAlternateReceiverVariant("com.clawperator.operator.dev"), "com.clawperator.operator");
    assert.strictEqual(
      getAlternateReceiverVariant("com.example.devtools.operator.dev"),
      "com.example.devtools.operator"
    );
    assert.strictEqual(
      getAlternateReceiverVariant("com.example.devtools.operator"),
      "com.example.devtools.operator.dev"
    );
  });

  it("throws when the CLI package metadata has no version", () => {
    assert.throws(() => readCliVersion({}), /package\.json version is missing/);
    assert.throws(() => readCliVersion({ version: "   " }), /package\.json version is missing/);
  });

  it("parses release and prerelease versions", () => {
    assert.deepStrictEqual(parseCompatibilityVersion("0.1.4-rc.1"), {
      raw: "0.1.4-rc.1",
      normalized: "0.1.4-rc.1",
      major: 0,
      minor: 1,
      patch: 4,
      prereleaseLabel: "rc",
      prereleaseNumber: 1,
    });
  });

  it("considers matching major.minor versions compatible", () => {
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.4"), true);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.9"), true);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.4-d"), true);
    assert.strictEqual(isVersionCompatible("0.1.4-rc.1", "0.1.4-d"), true);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.2.1"), false);
  });

  it("parses installed APK metadata from dumpsys output", () => {
    const parsed = parseInstalledApkVersion(`
      Package [com.clawperator.operator] (abcd):
        versionCode=104900 minSdk=21 targetSdk=35
        versionName=0.1.4-d
    `);

    assert.deepStrictEqual(parsed, { versionName: "0.1.4-d", versionCode: 104900 });
  });

  it("throws when versionName is missing from dumpsys output", () => {
    assert.throws(() => parseInstalledApkVersion("Package [com.clawperator.operator]"), /versionName/);
  });
});
