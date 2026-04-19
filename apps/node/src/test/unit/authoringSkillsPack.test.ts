import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, lstat, readFile, readlink, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const sourceScriptPath = join(packageRoot, "scripts", "authoringSkillsPack.mjs");
const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

function normalizeDirectorySymlinkTarget(baseDir: string, target: string): string {
  return resolve(baseDir, target);
}

const tempRoots: string[] = [];

function runNodeScript(scriptPath: string, mode: string, cwd: string): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(process.execPath, [scriptPath, mode], { cwd }, (error) => {
      if (error) {
        rejectPromise(error);
        return;
      }
      resolvePromise();
    });
  });
}

async function makeTempPackage(): Promise<{
  root: string;
  scriptPath: string;
  authoringSkillsDir: string;
}> {
  const root = await mkdtemp(join(tmpdir(), "clawperator-authoring-skills-pack-"));
  tempRoots.push(root);

  const scriptsDir = join(root, "scripts");
  const authoringSkillsDir = join(root, "authoring-skills");
  await mkdir(scriptsDir, { recursive: true });
  await mkdir(authoringSkillsDir, { recursive: true });
  const scriptPath = join(scriptsDir, "authoringSkillsPack.mjs");
  const scriptContents = await readFile(sourceScriptPath, "utf8");
  await writeFile(scriptPath, scriptContents, "utf8");

  return { root, scriptPath, authoringSkillsDir };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("authoringSkillsPack.mjs", () => {
  it("prepack materializes multiple authoring skill symlinks into directories and writes state for restoration", async () => {
    const { root, scriptPath, authoringSkillsDir } = await makeTempPackage();
    const sourceSkillsRoot = join(root, "sources");
    const skillNames = ["skill-author-by-agent-discovery", "skill-author-by-recording"];
    for (const skillName of skillNames) {
      const sourceSkillDir = join(sourceSkillsRoot, skillName);
      await mkdir(sourceSkillDir, { recursive: true });
      await mkdir(join(sourceSkillDir, "agents"), { recursive: true });
      await writeFile(join(sourceSkillDir, "SKILL.md"), `# ${skillName}\n`, "utf8");
      await writeFile(join(sourceSkillDir, "agents", "openai.yaml"), "name: demo\n", "utf8");

      const symlinkPath = join(authoringSkillsDir, skillName);
      const linkedTarget = process.platform === "win32"
        ? sourceSkillDir
        : `../sources/${skillName}`;
      await import("node:fs/promises").then(({ symlink }) => symlink(linkedTarget, symlinkPath, directorySymlinkType));
    }

    await runNodeScript(scriptPath, "prepack", root);

    for (const skillName of skillNames) {
      const symlinkPath = join(authoringSkillsDir, skillName);
      const entryStat = await lstat(symlinkPath);
      assert.equal(entryStat.isDirectory(), true);
      assert.equal(entryStat.isSymbolicLink(), false);
      assert.equal(await readFile(join(symlinkPath, "SKILL.md"), "utf8"), `# ${skillName}\n`);
      assert.equal(await readFile(join(symlinkPath, "agents", "openai.yaml"), "utf8"), "name: demo\n");
    }

    const statePath = join(root, ".authoring-skills-pack-state.json");
    const state = JSON.parse(await readFile(statePath, "utf8")) as {
      symlinks: Array<{ entry: string; target: string }>;
    };
    state.symlinks.sort((left, right) => left.entry.localeCompare(right.entry));
    assert.deepEqual(state, {
      symlinks: [
        {
          entry: "skill-author-by-agent-discovery",
          target: process.platform === "win32"
            ? join(sourceSkillsRoot, "skill-author-by-agent-discovery")
            : "../sources/skill-author-by-agent-discovery",
        },
        {
          entry: "skill-author-by-recording",
          target: process.platform === "win32"
            ? join(sourceSkillsRoot, "skill-author-by-recording")
            : "../sources/skill-author-by-recording",
        },
      ],
    });
  });

  it("postpack restores multiple symlinks from saved state and removes the temporary state file", async () => {
    const { root, scriptPath, authoringSkillsDir } = await makeTempPackage();
    const restoredTargets = [
      {
        entry: "skill-author-by-agent-discovery",
        target: process.platform === "win32"
          ? join(root, "sources", "skill-author-by-agent-discovery")
          : "../sources/skill-author-by-agent-discovery",
      },
      {
        entry: "skill-author-by-recording",
        target: process.platform === "win32"
          ? join(root, "sources", "skill-author-by-recording")
          : "../sources/skill-author-by-recording",
      },
    ];
    for (const { entry } of restoredTargets) {
      const skillDir = join(authoringSkillsDir, entry);
      await mkdir(skillDir, { recursive: true });
      await writeFile(join(skillDir, "SKILL.md"), "# materialized\n", "utf8");
    }
    await writeFile(
      join(root, ".authoring-skills-pack-state.json"),
      `${JSON.stringify({
        symlinks: restoredTargets,
      }, null, 2)}\n`,
      "utf8"
    );

    await runNodeScript(scriptPath, "postpack", root);

    for (const { entry, target } of restoredTargets) {
      const skillDir = join(authoringSkillsDir, entry);
      const entryStat = await lstat(skillDir);
      assert.equal(entryStat.isSymbolicLink(), true);
      assert.equal(
        normalizeDirectorySymlinkTarget(authoringSkillsDir, await readlink(skillDir)),
        normalizeDirectorySymlinkTarget(authoringSkillsDir, target)
      );
    }
    await assert.rejects(() => readFile(join(root, ".authoring-skills-pack-state.json"), "utf8"));
  });

  it("postpack is a no-op when no state file exists", async () => {
    const { root, scriptPath, authoringSkillsDir } = await makeTempPackage();
    await mkdir(join(authoringSkillsDir, "plain-directory"), { recursive: true });

    await runNodeScript(scriptPath, "postpack", root);

    const entryStat = await lstat(join(authoringSkillsDir, "plain-directory"));
    assert.equal(entryStat.isDirectory(), true);
    await assert.rejects(() => readFile(join(root, ".authoring-skills-pack-state.json"), "utf8"));
  });
});
