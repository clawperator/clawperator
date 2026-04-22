import { describe, it } from "node:test";
import assert from "node:assert";
import { lstat, readFile, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("bundled skill packaging", () => {
  it("ships bundled-skills directly from package.json without prepack or postpack shims", async () => {
    const packageJson = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as {
      files?: string[];
      scripts?: Record<string, string>;
    };

    assert.deepEqual(packageJson.files, [
      "dist/",
      "!dist/test/**",
      "!dist/**/*.map",
      "README.md",
      "LICENSE",
      "bundled-skills/",
    ]);
    assert.equal(packageJson.scripts?.prepack, undefined);
    assert.equal(packageJson.scripts?.postpack, undefined);
  });

  it("keeps the packaged bundled-skills tree as real directories with SKILL.md files", async () => {
    const bundledSkillsDir = join(packageRoot, "bundled-skills");
    const entries = (await readdir(bundledSkillsDir)).sort((left, right) => left.localeCompare(right));

    assert.deepEqual(entries, [
      "clawperator-agent-orientation",
      "clawperator-upgrade",
      "skill-author-by-agent-discovery",
      "skill-author-by-recording",
    ]);

    for (const entry of entries) {
      const entryPath = join(bundledSkillsDir, entry);
      const entryStat = await lstat(entryPath);
      assert.equal(entryStat.isDirectory(), true);
      assert.equal(entryStat.isSymbolicLink(), false);

      const skillFileStat = await lstat(join(entryPath, "SKILL.md"));
      assert.equal(skillFileStat.isFile(), true);
    }
  });
});
