import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { chmod, mkdtemp, mkdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { getCliVersion } from "../../domain/version/compatibility.js";
import { cmdAuthoringSkillsList } from "../../cli/commands/authoringSkills.js";
import { copyAuthoringSkills } from "../../domain/skills/copyAuthoringSkills.js";

const tempRoots: string[] = [];

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "clawperator-authoring-skills-"));
  tempRoots.push(root);
  return root;
}

async function createSourceSkill(root: string, skillName: string): Promise<string> {
  const sourceDir = join(root, "source");
  const skillDir = join(sourceDir, skillName);
  await mkdir(skillDir, { recursive: true });
  await writeFile(join(skillDir, "SKILL.md"), `# ${skillName}\n`, "utf8");
  await writeFile(join(skillDir, "agents.openai.yaml"), "name: demo\n", "utf8");
  return sourceDir;
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("copyAuthoringSkills", () => {
  it("discovers a skill by finding a subdirectory with SKILL.md and copies it to the install target", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyAuthoringSkills result");
    }
    assert.deepEqual(result.skills, ["skill-author-by-recording"]);
    assert.equal(await readFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
  });

  it("ignores subdirectories without SKILL.md", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(join(sourceDir, "missing-skill-file"), { recursive: true });
    await mkdir(join(sourceDir, "real-skill"), { recursive: true });
    await writeFile(join(sourceDir, "real-skill", "SKILL.md"), "# real-skill\n", "utf8");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyAuthoringSkills result");
    }
    assert.deepEqual(result.skills, ["real-skill"]);
    await assert.rejects(() => stat(join(installedDir, "missing-skill-file")));
  });

  it("writes version.txt with the current CLI version", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
    });

    assert.equal(result.ok, true);
    assert.equal(await readFile(join(installedDir, "version.txt"), "utf8"), `${getCliVersion()}\n`);
  });

  it("creates ~/.claude/skills even when it does not exist", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir,
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(claudeSkillsDir)).isDirectory(), true);
  });

  it("creates the Codex skills dir at the default path when it does not exist", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const homeDir = join(root, "home");

    const result = await copyAuthoringSkills({
      sourceDir,
      homeDir,
      installedDir: join(homeDir, ".clawperator", "authoring-skills"),
      claudeSkillsDir: join(homeDir, ".claude", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(join(homeDir, ".codex", "skills"))).isDirectory(), true);
  });

  it("creates the Codex skills dir when CODEX_HOME is set", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const codexHome = join(root, "custom-codex-home");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      env: { ...process.env, CODEX_HOME: codexHome },
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal((await stat(join(codexHome, "skills"))).isDirectory(), true);
  });

  it("places a symlink in ~/.claude/skills/<skill-name> pointing to the installed skill dir", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(
      await readlink(join(claudeSkillsDir, "skill-author-by-recording")),
      join(installedDir, "skill-author-by-recording")
    );
  });

  it("is idempotent - running twice does not error and result is the same as running once", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const options = {
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    };

    const first = await copyAuthoringSkills(options);
    const second = await copyAuthoringSkills(options);

    assert.deepEqual(second, first);
    assert.equal(await readFile(join(options.installedDir, "skill-author-by-recording", "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
  });

  it("returns an error result when the npm package source dir does not exist", async () => {
    const root = await makeTempRoot();

    const result = await copyAuthoringSkills({
      sourceDir: join(root, "missing-source"),
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AUTHORING_SKILLS_SOURCE_NOT_FOUND",
      message: `Authoring skills source directory not found: ${join(root, "missing-source")}`,
    });
  });

  it("returns an error when the packaged authoring skills tree is empty", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(sourceDir, { recursive: true });

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AUTHORING_SKILLS_SOURCE_EMPTY",
      message: `No packaged authoring skills with SKILL.md were found in ${sourceDir}`,
    });
  });

  it("does not delete unrelated user-managed symlinks from shared agent skill directories", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const unrelatedTarget = join(root, "user-skills", "other-skill");
    await mkdir(unrelatedTarget, { recursive: true });
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await symlink(unrelatedTarget, join(claudeSkillsDir, "other-skill"));
    await symlink(unrelatedTarget, join(codexSkillsDir, "other-skill"));

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir,
      codexSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "other-skill")), unrelatedTarget);
    assert.equal(await readlink(join(codexSkillsDir, "other-skill")), unrelatedTarget);
  });

  it("refuses to overwrite an existing non-Clawperator skill entry with the same basename", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    await mkdir(join(claudeSkillsDir, "skill-author-by-recording"), { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "authoring-skills"),
      claudeSkillsDir,
      codexSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result, {
      ok: false,
      code: "AUTHORING_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(claudeSkillsDir, "skill-author-by-recording")}`,
    });
    assert.equal((await stat(join(claudeSkillsDir, "skill-author-by-recording"))).isDirectory(), true);
  });

  it("replaces a broken managed symlink instead of failing with EEXIST", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const targetSkillDir = join(installedDir, "skill-author-by-recording");

    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await symlink(targetSkillDir, join(claudeSkillsDir, "skill-author-by-recording"));
    await symlink(targetSkillDir, join(codexSkillsDir, "skill-author-by-recording"));

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(codexSkillsDir, "skill-author-by-recording")), targetSkillDir);
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
  });

  it("preflights discovery conflicts before replacing an already installed skill", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "authoring-skills");
    const targetSkillDir = join(installedDir, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");

    await mkdir(targetSkillDir, { recursive: true });
    await writeFile(join(targetSkillDir, "SKILL.md"), "# existing-installed-version\n", "utf8");
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(join(codexSkillsDir, "skill-author-by-recording"), { recursive: true });

    const result = await copyAuthoringSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AUTHORING_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(codexSkillsDir, "skill-author-by-recording")}`,
    });
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# existing-installed-version\n");
  });
});

describe("cmdAuthoringSkillsList", () => {
  it("returns a helpful message when install dir does not exist", async () => {
    const root = await makeTempRoot();
    const output = await cmdAuthoringSkillsList({
      format: "json",
      installDir: join(root, "missing-install-dir"),
    });

    assert.deepEqual(JSON.parse(output), {
      skills: [],
      count: 0,
      installedDir: join(root, "missing-install-dir"),
      message: "No installed authoring skills found. Run clawperator authoring-skills install.",
    });
  });

  it("surfaces filesystem errors instead of reporting an empty install", async () => {
    const root = await makeTempRoot();
    const installDir = join(root, "unreadable-install-dir");
    await mkdir(installDir, { recursive: true });
    await chmod(installDir, 0o000);

    try {
      const output = await cmdAuthoringSkillsList({
        format: "json",
        installDir,
      });
      const parsed = JSON.parse(output);
      assert.equal(parsed.code, "AUTHORING_SKILLS_LIST_FAILED");
    } finally {
      await chmod(installDir, 0o755);
    }
  });
});
