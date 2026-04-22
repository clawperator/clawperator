import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { chmod, mkdtemp, mkdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getCliVersion } from "../../domain/version/compatibility.js";
import { cmdBundledSkillsInstall, cmdBundledSkillsList } from "../../cli/commands/bundledSkills.js";
import { copyBundledSkills, listPackagedBundledSkills } from "../../domain/skills/copyBundledSkills.js";

const tempRoots: string[] = [];
const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "clawperator-bundled-skills-"));
  tempRoots.push(root);
  return root;
}

async function createSourceSkill(root: string, skillName: string): Promise<string> {
  return createSourceSkills(root, [skillName]);
}

async function createSourceSkills(root: string, skillNames: string[]): Promise<string> {
  const sourceDir = join(root, "source");
  for (const skillName of skillNames) {
    const skillDir = join(sourceDir, skillName);
    await mkdir(skillDir, { recursive: true });
    await mkdir(join(skillDir, "agents"), { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), `# ${skillName}\n`, "utf8");
    await writeFile(join(skillDir, "agents", "openai.yaml"), "name: demo\n", "utf8");
  }
  return sourceDir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("copyBundledSkills", () => {
  it("discovers multiple skills by finding subdirectories with SKILL.md and copies them to the install target", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkills(root, [
      "clawperator-agent-orientation",
      "clawperator-upgrade",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
    ]);
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyBundledSkills result");
    }
    assert.deepEqual(result.skills, [
      "clawperator-agent-orientation",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
      "clawperator-upgrade",
    ]);
    assert.equal(await readFile(join(installedDir, "clawperator-agent-orientation", "SKILL.md"), "utf8"), "# clawperator-agent-orientation\n");
    assert.equal(await readFile(join(installedDir, "clawperator-upgrade", "SKILL.md"), "utf8"), "# clawperator-upgrade\n");
    assert.equal(await readFile(join(installedDir, "clawperator-skill-author-by-agent-discovery", "SKILL.md"), "utf8"), "# clawperator-skill-author-by-agent-discovery\n");
    assert.equal(await readFile(join(installedDir, "clawperator-skill-author-by-recording", "SKILL.md"), "utf8"), "# clawperator-skill-author-by-recording\n");
    assert.equal(await readFile(join(installedDir, "clawperator-agent-orientation", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readFile(join(installedDir, "clawperator-upgrade", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readFile(join(installedDir, "clawperator-skill-author-by-agent-discovery", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readFile(join(installedDir, "clawperator-skill-author-by-recording", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-agent-orientation")), join(installedDir, "clawperator-agent-orientation"));
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-upgrade")), join(installedDir, "clawperator-upgrade"));
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-agent-discovery")), join(installedDir, "clawperator-skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-recording")), join(installedDir, "clawperator-skill-author-by-recording"));
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-agent-orientation")), join(installedDir, "clawperator-agent-orientation"));
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-upgrade")), join(installedDir, "clawperator-upgrade"));
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-skill-author-by-agent-discovery")), join(installedDir, "clawperator-skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-skill-author-by-recording")), join(installedDir, "clawperator-skill-author-by-recording"));
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-agent-orientation")), join(installedDir, "clawperator-agent-orientation"));
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-upgrade")), join(installedDir, "clawperator-upgrade"));
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-skill-author-by-agent-discovery")), join(installedDir, "clawperator-skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-skill-author-by-recording")), join(installedDir, "clawperator-skill-author-by-recording"));
  });

  it("ignores subdirectories without SKILL.md", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(join(sourceDir, "missing-skill-file"), { recursive: true });
    await mkdir(join(sourceDir, "real-skill"), { recursive: true });
    await writeFile(join(sourceDir, "real-skill", "SKILL.md"), "# real-skill\n", "utf8");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyBundledSkills result");
    }
    assert.deepEqual(result.skills, ["real-skill"]);
    await assert.rejects(() => stat(join(installedDir, "missing-skill-file")));
  });

  it("writes version.txt with the current CLI version", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
    });

    assert.equal(result.ok, true);
    assert.equal(await readFile(join(installedDir, "version.txt"), "utf8"), `${getCliVersion()}\n`);
  });

  it("creates ~/.claude/skills even when it does not exist", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir,
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(claudeSkillsDir)).isDirectory(), true);
  });

  it("creates the Codex skills dir at the default path when it does not exist", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const homeDir = join(root, "home");

    const result = await copyBundledSkills({
      sourceDir,
      homeDir,
      installedDir: join(homeDir, ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(homeDir, ".claude", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(join(homeDir, ".codex", "skills"))).isDirectory(), true);
  });

  it("creates the Codex skills dir when CODEX_HOME is set", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const codexHome = join(root, "custom-codex-home");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      env: { ...process.env, CODEX_HOME: codexHome },
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(join(codexHome, "skills"))).isDirectory(), true);
  });

  it("places a symlink in ~/.claude/skills/<skill-name> pointing to the installed skill dir", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(
      await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-recording")),
      join(installedDir, "clawperator-skill-author-by-recording")
    );
  });

  it("is idempotent - running twice does not error and result is the same as running once", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const options = {
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    };

    const first = await copyBundledSkills(options);
    const second = await copyBundledSkills(options);

    assert.deepEqual(second, first);
    assert.equal(await readFile(join(options.installedDir, "clawperator-skill-author-by-recording", "SKILL.md"), "utf8"), "# clawperator-skill-author-by-recording\n");
  });

  it("normalizes relative directory overrides so managed symlinks remain idempotent", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const options = {
      sourceDir: relative(process.cwd(), sourceDir),
      installedDir: relative(process.cwd(), installedDir),
      claudeSkillsDir: relative(process.cwd(), claudeSkillsDir),
      codexSkillsDir: relative(process.cwd(), codexSkillsDir),
      agentsSkillsDir: relative(process.cwd(), agentsSkillsDir),
      cliVersion: "1.2.3",
    };

    const first = await copyBundledSkills(options);
    const second = await copyBundledSkills(options);

    assert.equal(first.ok, true);
    assert.deepEqual(second, first);
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-recording")), resolve(installedDir, "clawperator-skill-author-by-recording"));
  });

  it("returns an error result when the npm package source dir does not exist", async () => {
    const root = await makeTempRoot();

    const result = await copyBundledSkills({
      sourceDir: join(root, "missing-source"),
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "BUNDLED_SKILLS_SOURCE_NOT_FOUND",
      message: `Bundled-skills source directory not found: ${join(root, "missing-source")}`,
    });
  });

  it("returns an error when the packaged bundled-skills tree is empty", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(sourceDir, { recursive: true });

    const result = await copyBundledSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "BUNDLED_SKILLS_SOURCE_EMPTY",
      message: `No packaged bundled-skills with SKILL.md were found in ${sourceDir}`,
    });
  });

  it("removes stale installed skills that are no longer present in the packaged source", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const staleSkillDir = join(installedDir, "old-skill");
    await mkdir(staleSkillDir, { recursive: true });
    await writeFile(join(staleSkillDir, "SKILL.md"), "# old-skill\n", "utf8");

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    await assert.rejects(() => stat(staleSkillDir));
  });

  it("removes stale pre-rename skill installs and managed discovery symlinks", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkills(root, [
      "clawperator-agent-orientation",
      "clawperator-upgrade",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
    ]);
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const oldDiscoveryDir = join(installedDir, "skill-author-by-agent-discovery");
    const oldRecordingDir = join(installedDir, "skill-author-by-recording");

    await mkdir(oldDiscoveryDir, { recursive: true });
    await mkdir(oldRecordingDir, { recursive: true });
    await writeFile(join(oldDiscoveryDir, "SKILL.md"), "# skill-author-by-agent-discovery\n", "utf8");
    await writeFile(join(oldRecordingDir, "SKILL.md"), "# skill-author-by-recording\n", "utf8");

    for (const dir of [claudeSkillsDir, codexSkillsDir, agentsSkillsDir]) {
      await mkdir(dir, { recursive: true });
      await symlink(oldDiscoveryDir, join(dir, "skill-author-by-agent-discovery"), directorySymlinkType);
      await symlink(oldRecordingDir, join(dir, "skill-author-by-recording"), directorySymlinkType);
    }

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    await assert.rejects(() => stat(oldDiscoveryDir));
    await assert.rejects(() => stat(oldRecordingDir));

    for (const dir of [claudeSkillsDir, codexSkillsDir, agentsSkillsDir]) {
      await assert.rejects(() => stat(join(dir, "skill-author-by-agent-discovery")));
      await assert.rejects(() => stat(join(dir, "skill-author-by-recording")));
      assert.equal(
        await readlink(join(dir, "clawperator-skill-author-by-agent-discovery")),
        join(installedDir, "clawperator-skill-author-by-agent-discovery")
      );
      assert.equal(
        await readlink(join(dir, "clawperator-skill-author-by-recording")),
        join(installedDir, "clawperator-skill-author-by-recording")
      );
    }
  });

  it("does not delete unrelated user-managed symlinks from shared agent skill directories", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const unrelatedTarget = join(root, "user-skills", "other-skill");
    await mkdir(unrelatedTarget, { recursive: true });
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await symlink(unrelatedTarget, join(claudeSkillsDir, "other-skill"), directorySymlinkType);
    await symlink(unrelatedTarget, join(codexSkillsDir, "other-skill"), directorySymlinkType);
    await symlink(unrelatedTarget, join(agentsSkillsDir, "other-skill"), directorySymlinkType);

    const result = await copyBundledSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "other-skill")), unrelatedTarget);
    assert.equal(await readlink(join(codexSkillsDir, "other-skill")), unrelatedTarget);
    assert.equal(await readlink(join(agentsSkillsDir, "other-skill")), unrelatedTarget);
  });

  it("refuses to overwrite an existing non-Clawperator skill entry with the same basename", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    await mkdir(join(claudeSkillsDir, "clawperator-skill-author-by-recording"), { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });

    const result = await copyBundledSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result, {
      ok: false,
      code: "BUNDLED_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(claudeSkillsDir, "clawperator-skill-author-by-recording")}`,
    });
    assert.equal((await stat(join(claudeSkillsDir, "clawperator-skill-author-by-recording"))).isDirectory(), true);
  });

  it("replaces a broken managed symlink instead of failing with EEXIST", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const targetSkillDir = join(installedDir, "clawperator-skill-author-by-recording");

    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await symlink(targetSkillDir, join(claudeSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);
    await symlink(targetSkillDir, join(codexSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);
    await symlink(targetSkillDir, join(agentsSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# clawperator-skill-author-by-recording\n");
  });

  it("replaces legacy managed symlinks that still point at the old install dir", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const legacyInstalledDir = join(root, "home", ".clawperator", "agent-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const legacyTargetSkillDir = join(legacyInstalledDir, "clawperator-skill-author-by-recording");
    const targetSkillDir = join(installedDir, "clawperator-skill-author-by-recording");

    await mkdir(legacyTargetSkillDir, { recursive: true });
    await writeFile(join(legacyTargetSkillDir, "SKILL.md"), "# old-clawperator-skill-author-by-recording\n", "utf8");
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await symlink(legacyTargetSkillDir, join(claudeSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);
    await symlink(legacyTargetSkillDir, join(codexSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);
    await symlink(legacyTargetSkillDir, join(agentsSkillsDir, "clawperator-skill-author-by-recording"), directorySymlinkType);

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(codexSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(agentsSkillsDir, "clawperator-skill-author-by-recording")), targetSkillDir);
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# clawperator-skill-author-by-recording\n");
    assert.equal(await readFile(join(legacyTargetSkillDir, "SKILL.md"), "utf8"), "# old-clawperator-skill-author-by-recording\n");
  });

  it("preflights discovery conflicts before replacing an already installed skill", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "clawperator-skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const targetSkillDir = join(installedDir, "clawperator-skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    await mkdir(targetSkillDir, { recursive: true });
    await writeFile(join(targetSkillDir, "SKILL.md"), "# existing-installed-version\n", "utf8");
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await mkdir(join(codexSkillsDir, "clawperator-skill-author-by-recording"), { recursive: true });

    const result = await copyBundledSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "BUNDLED_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(codexSkillsDir, "clawperator-skill-author-by-recording")}`,
    });
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# existing-installed-version\n");
  });
  it("honors CLAWPERATOR_BUNDLED_SKILLS when deriving the packaged source dir", async () => {
    const root = await makeTempRoot();
    const customSourceDir = await createSourceSkill(root, "custom-bundled-skill");

    const result = await copyBundledSkills({
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      env: { ...process.env, CLAWPERATOR_BUNDLED_SKILLS: customSourceDir },
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: true,
      skills: ["custom-bundled-skill"],
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      agentDiscoveryDirs: [
        { label: "claude", dir: join(root, "home", ".claude", "skills") },
        { label: "codex", dir: join(root, "home", ".codex", "skills") },
        { label: "agents", dir: join(root, "home", ".agents", "skills") },
      ],
    });
  });

  it("does not honor CLAWPERATOR_AGENT_SKILLS as a packaged source override", async () => {
    const root = await makeTempRoot();

    const result = await copyBundledSkills({
      installedDir: join(root, "home", ".clawperator", "bundled-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      env: { ...process.env, CLAWPERATOR_AGENT_SKILLS: join(root, "missing-source") },
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
  });
});

describe("cmdBundledSkillsInstall", () => {
  it("preserves legacy top-level discovery dirs alongside agentDiscoveryDirs in json output", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkills(root, [
      "clawperator-agent-orientation",
      "clawperator-upgrade",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
    ]);
    const installedDir = join(root, "home", ".clawperator", "bundled-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    const rendered = await cmdBundledSkillsInstall({
      format: "json",
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    const parsed = JSON.parse(rendered) as {
      skills: string[];
      installedDir: string;
      claudeSkillsDir: string;
      codexSkillsDir: string;
      agentDiscoveryDirs: Array<{ label: string; dir: string }>;
    };

    assert.deepEqual(parsed.skills, [
      "clawperator-agent-orientation",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
      "clawperator-upgrade",
    ]);
    assert.equal(parsed.installedDir, installedDir);
    assert.equal(parsed.claudeSkillsDir, claudeSkillsDir);
    assert.equal(parsed.codexSkillsDir, codexSkillsDir);
    assert.deepEqual(parsed.agentDiscoveryDirs, [
      { label: "claude", dir: claudeSkillsDir },
      { label: "codex", dir: codexSkillsDir },
      { label: "agents", dir: agentsSkillsDir },
    ]);
  });
});

describe("cmdBundledSkillsList", () => {
  it("returns a helpful message when install dir does not exist", async () => {
    const root = await makeTempRoot();
    const output = await cmdBundledSkillsList({
      format: "json",
      installDir: join(root, "missing-install-dir"),
    });

    assert.deepEqual(JSON.parse(output), {
      skills: [],
      count: 0,
      installedDir: join(root, "missing-install-dir"),
      message: "No installed bundled-skills found. Run clawperator bundled-skills install to get clawperator-agent-orientation, clawperator-upgrade, clawperator-skill-author-by-agent-discovery, and clawperator-skill-author-by-recording.",
    });
  });

  it("returns the documented json shape for installed bundled-skills", async () => {
    const root = await makeTempRoot();
    const installDir = join(root, "home", ".clawperator", "bundled-skills");
    const orientationDir = join(installDir, "clawperator-agent-orientation");
    const upgradeDir = join(installDir, "clawperator-upgrade");
    const discoveryDir = join(installDir, "clawperator-skill-author-by-agent-discovery");
    const skillDir = join(installDir, "clawperator-skill-author-by-recording");
    await mkdir(orientationDir, { recursive: true });
    await mkdir(upgradeDir, { recursive: true });
    await mkdir(discoveryDir, { recursive: true });
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(orientationDir, "SKILL.md"), "# clawperator-agent-orientation\n", "utf8");
    await writeFile(join(upgradeDir, "SKILL.md"), "# clawperator-upgrade\n", "utf8");
    await writeFile(join(discoveryDir, "SKILL.md"), "# clawperator-skill-author-by-agent-discovery\n", "utf8");
    await writeFile(join(skillDir, "SKILL.md"), "# clawperator-skill-author-by-recording\n", "utf8");

    const output = await cmdBundledSkillsList({
      format: "json",
      installDir,
    });

    assert.deepEqual(JSON.parse(output), {
      skills: [
        {
          name: "clawperator-agent-orientation",
          skillPath: join(orientationDir, "SKILL.md"),
        },
        {
          name: "clawperator-skill-author-by-agent-discovery",
          skillPath: join(discoveryDir, "SKILL.md"),
        },
        {
          name: "clawperator-skill-author-by-recording",
          skillPath: join(skillDir, "SKILL.md"),
        },
        {
          name: "clawperator-upgrade",
          skillPath: join(upgradeDir, "SKILL.md"),
        },
      ],
      count: 4,
      installedDir: installDir,
    });
  });

  it("surfaces filesystem errors instead of reporting an empty install", async () => {
    const root = await makeTempRoot();
    const installDir = join(root, "unreadable-install-dir");
    await mkdir(installDir, { recursive: true });
    await chmod(installDir, 0o000);

    try {
      const output = await cmdBundledSkillsList({
        format: "json",
        installDir,
      });
      const parsed = JSON.parse(output);
      assert.equal(parsed.code, "BUNDLED_SKILLS_LIST_FAILED");
    } finally {
      await chmod(installDir, 0o755);
    }
  });
});

describe("listPackagedBundledSkills", () => {
  it("lists all packaged first-party bundled skills from the repo tree", async () => {
    const skills = await listPackagedBundledSkills();
    assert.deepEqual(skills, [
      "clawperator-agent-orientation",
      "clawperator-skill-author-by-agent-discovery",
      "clawperator-skill-author-by-recording",
      "clawperator-upgrade",
    ]);
  });
});
