import { describe, it } from "node:test";
import assert from "node:assert";
import {
  getAlternateReceiverVariant,
  getOperatorApkDownloadUrl,
  getOperatorApkSha256Url,
  getReceiverPackageApkPath,
  isVersionCompatible,
  normalizeCompatibilityVersion,
  parseCompatibilityVersion,
  parseInstalledApkVersion,
  readCliVersion,
} from "../../domain/version/compatibility.js";

describe("version compatibility", () => {
  it("normalizes the debug suffix before compatibility parsing", () => {
    assert.strictEqual(normalizeCompatibilityVersion("0.1.4-d"), "0.1.4");
  });

  it("maps receiver packages to their APK download paths", () => {
    assert.strictEqual(getReceiverPackageApkPath("com.clawperator.operator.dev"), "~/.clawperator/downloads/operator-debug.apk");
    assert.strictEqual(getReceiverPackageApkPath("com.clawperator.operator"), "~/.clawperator/downloads/operator.apk");
  });

  it("builds versioned APK download URLs", () => {
    assert.strictEqual(
      getOperatorApkDownloadUrl("0.1.4"),
      "https://downloads.clawperator.com/operator/v0.1.4/operator-v0.1.4.apk"
    );
    assert.strictEqual(
      getOperatorApkSha256Url("0.1.4"),
      "https://downloads.clawperator.com/operator/v0.1.4/operator-v0.1.4.apk.sha256"
    );
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

  it("rejects non-simple versions", () => {
    assert.throws(() => parseCompatibilityVersion("0.1.4.1"), /Unsupported Clawperator version format/);
  });

  it("requires the same normalized version", () => {
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.4"), true);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.4-d"), true);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.1.9"), false);
    assert.strictEqual(isVersionCompatible("0.1.4", "0.2.1"), false);
  });

  it("rejects prerelease-style versions in compatibility checks", () => {
    assert.throws(() => parseCompatibilityVersion("0.1.4-alpha"), /Unsupported Clawperator version format/);
    assert.throws(() => parseCompatibilityVersion("0.1.4-rc.1"), /Unsupported Clawperator version format/);
    assert.throws(() => isVersionCompatible("0.1.4-alpha", "0.1.4"), /Unsupported Clawperator version format/);
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
