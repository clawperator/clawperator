import { afterEach, describe, it } from "node:test";
import assert from "node:assert";
import { chmod, mkdtemp, mkdir, readFile, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { tmpdir } from "node:os";
import { getCliVersion } from "../../domain/version/compatibility.js";
import { cmdAgentSkillsInstall, cmdAgentSkillsList } from "../../cli/commands/agentSkills.js";
import { copyAgentSkills, listPackagedAgentSkills } from "../../domain/skills/copyAgentSkills.js";

const tempRoots: string[] = [];
const directorySymlinkType = process.platform === "win32" ? "junction" : "dir";

async function makeTempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "clawperator-agent-skills-"));
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

describe("copyAgentSkills", () => {
  it("discovers multiple skills by finding subdirectories with SKILL.md and copies them to the install target", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkills(root, [
      "skill-author-by-agent-discovery",
      "skill-author-by-recording",
    ]);
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    const result = await copyAgentSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyAgentSkills result");
    }
    assert.deepEqual(result.skills, ["skill-author-by-agent-discovery", "skill-author-by-recording"]);
    assert.equal(await readFile(join(installedDir, "skill-author-by-agent-discovery", "SKILL.md"), "utf8"), "# skill-author-by-agent-discovery\n");
    assert.equal(await readFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
    assert.equal(await readFile(join(installedDir, "skill-author-by-agent-discovery", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readFile(join(installedDir, "skill-author-by-recording", "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
    assert.equal(await readFile(join(installedDir, "skill-author-by-recording", "agents", "openai.yaml"), "utf8"), "name: demo\n");
    assert.equal(await readlink(join(claudeSkillsDir, "skill-author-by-agent-discovery")), join(installedDir, "skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(claudeSkillsDir, "skill-author-by-recording")), join(installedDir, "skill-author-by-recording"));
    assert.equal(await readlink(join(codexSkillsDir, "skill-author-by-agent-discovery")), join(installedDir, "skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(codexSkillsDir, "skill-author-by-recording")), join(installedDir, "skill-author-by-recording"));
    assert.equal(await readlink(join(agentsSkillsDir, "skill-author-by-agent-discovery")), join(installedDir, "skill-author-by-agent-discovery"));
    assert.equal(await readlink(join(agentsSkillsDir, "skill-author-by-recording")), join(installedDir, "skill-author-by-recording"));
  });

  it("ignores subdirectories without SKILL.md", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(join(sourceDir, "missing-skill-file"), { recursive: true });
    await mkdir(join(sourceDir, "real-skill"), { recursive: true });
    await writeFile(join(sourceDir, "real-skill", "SKILL.md"), "# real-skill\n", "utf8");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");

    const result = await copyAgentSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      assert.fail("expected successful copyAgentSkills result");
    }
    assert.deepEqual(result.skills, ["real-skill"]);
    await assert.rejects(() => stat(join(installedDir, "missing-skill-file")));
  });

  it("writes version.txt with the current CLI version", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");

    const result = await copyAgentSkills({
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
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyAgentSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
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
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const homeDir = join(root, "home");

    const result = await copyAgentSkills({
      sourceDir,
      homeDir,
      installedDir: join(homeDir, ".clawperator", "agent-skills"),
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

    const result = await copyAgentSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
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
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");

    const result = await copyAgentSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
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
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    };

    const first = await copyAgentSkills(options);
    const second = await copyAgentSkills(options);

    assert.deepEqual(second, first);
    assert.equal(await readFile(join(options.installedDir, "skill-author-by-recording", "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
  });

  it("normalizes relative directory overrides so managed symlinks remain idempotent", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
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

    const first = await copyAgentSkills(options);
    const second = await copyAgentSkills(options);

    assert.equal(first.ok, true);
    assert.deepEqual(second, first);
    assert.equal(await readlink(join(claudeSkillsDir, "skill-author-by-recording")), resolve(installedDir, "skill-author-by-recording"));
  });

  it("returns an error result when the npm package source dir does not exist", async () => {
    const root = await makeTempRoot();

    const result = await copyAgentSkills({
      sourceDir: join(root, "missing-source"),
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AGENT_SKILLS_SOURCE_NOT_FOUND",
      message: `Agent-skills source directory not found: ${join(root, "missing-source")}`,
    });
  });

  it("returns an error when the packaged agent-skills tree is empty", async () => {
    const root = await makeTempRoot();
    const sourceDir = join(root, "source");
    await mkdir(sourceDir, { recursive: true });

    const result = await copyAgentSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
      claudeSkillsDir: join(root, "home", ".claude", "skills"),
      codexSkillsDir: join(root, "home", ".codex", "skills"),
      agentsSkillsDir: join(root, "home", ".agents", "skills"),
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AGENT_SKILLS_SOURCE_EMPTY",
      message: `No packaged agent-skills with SKILL.md were found in ${sourceDir}`,
    });
  });

  it("removes stale installed skills that are no longer present in the packaged source", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const staleSkillDir = join(installedDir, "old-skill");
    await mkdir(staleSkillDir, { recursive: true });
    await writeFile(join(staleSkillDir, "SKILL.md"), "# old-skill\n", "utf8");

    const result = await copyAgentSkills({
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

  it("does not delete unrelated user-managed symlinks from shared agent skill directories", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
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

    const result = await copyAgentSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
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
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    await mkdir(join(claudeSkillsDir, "skill-author-by-recording"), { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });

    const result = await copyAgentSkills({
      sourceDir,
      installedDir: join(root, "home", ".clawperator", "agent-skills"),
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, false);
    assert.deepEqual(result, {
      ok: false,
      code: "AGENT_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(claudeSkillsDir, "skill-author-by-recording")}`,
    });
    assert.equal((await stat(join(claudeSkillsDir, "skill-author-by-recording"))).isDirectory(), true);
  });

  it("replaces a broken managed symlink instead of failing with EEXIST", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");
    const targetSkillDir = join(installedDir, "skill-author-by-recording");

    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await symlink(targetSkillDir, join(claudeSkillsDir, "skill-author-by-recording"), directorySymlinkType);
    await symlink(targetSkillDir, join(codexSkillsDir, "skill-author-by-recording"), directorySymlinkType);
    await symlink(targetSkillDir, join(agentsSkillsDir, "skill-author-by-recording"), directorySymlinkType);

    const result = await copyAgentSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.equal(result.ok, true);
    assert.equal(await readlink(join(claudeSkillsDir, "skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(codexSkillsDir, "skill-author-by-recording")), targetSkillDir);
    assert.equal(await readlink(join(agentsSkillsDir, "skill-author-by-recording")), targetSkillDir);
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# skill-author-by-recording\n");
  });

  it("preflights discovery conflicts before replacing an already installed skill", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkill(root, "skill-author-by-recording");
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const targetSkillDir = join(installedDir, "skill-author-by-recording");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    await mkdir(targetSkillDir, { recursive: true });
    await writeFile(join(targetSkillDir, "SKILL.md"), "# existing-installed-version\n", "utf8");
    await mkdir(claudeSkillsDir, { recursive: true });
    await mkdir(codexSkillsDir, { recursive: true });
    await mkdir(agentsSkillsDir, { recursive: true });
    await mkdir(join(codexSkillsDir, "skill-author-by-recording"), { recursive: true });

    const result = await copyAgentSkills({
      sourceDir,
      installedDir,
      claudeSkillsDir,
      codexSkillsDir,
      agentsSkillsDir,
      cliVersion: "1.2.3",
    });

    assert.deepEqual(result, {
      ok: false,
      code: "AGENT_SKILLS_INSTALL_FAILED",
      message: `Refusing to overwrite non-Clawperator skill entry: ${join(codexSkillsDir, "skill-author-by-recording")}`,
    });
    assert.equal(await readFile(join(targetSkillDir, "SKILL.md"), "utf8"), "# existing-installed-version\n");
  });
});

describe("cmdAgentSkillsInstall", () => {
  it("preserves legacy top-level discovery dirs alongside agentDiscoveryDirs in json output", async () => {
    const root = await makeTempRoot();
    const sourceDir = await createSourceSkills(root, [
      "skill-author-by-agent-discovery",
      "skill-author-by-recording",
    ]);
    const installedDir = join(root, "home", ".clawperator", "agent-skills");
    const claudeSkillsDir = join(root, "home", ".claude", "skills");
    const codexSkillsDir = join(root, "home", ".codex", "skills");
    const agentsSkillsDir = join(root, "home", ".agents", "skills");

    const rendered = await cmdAgentSkillsInstall({
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

    assert.deepEqual(parsed.skills, ["skill-author-by-agent-discovery", "skill-author-by-recording"]);
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

describe("cmdAgentSkillsList", () => {
  it("returns a helpful message when install dir does not exist", async () => {
    const root = await makeTempRoot();
    const output = await cmdAgentSkillsList({
      format: "json",
      installDir: join(root, "missing-install-dir"),
    });

    assert.deepEqual(JSON.parse(output), {
      skills: [],
      count: 0,
      installedDir: join(root, "missing-install-dir"),
      message: "No installed agent-skills found. Run clawperator agent-skills install to get skill-author-by-agent-discovery and skill-author-by-recording.",
    });
  });

  it("returns the documented json shape for installed agent-skills", async () => {
    const root = await makeTempRoot();
    const installDir = join(root, "home", ".clawperator", "agent-skills");
    const discoveryDir = join(installDir, "skill-author-by-agent-discovery");
    const skillDir = join(installDir, "skill-author-by-recording");
    await mkdir(discoveryDir, { recursive: true });
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(discoveryDir, "SKILL.md"), "# skill-author-by-agent-discovery\n", "utf8");
    await writeFile(join(skillDir, "SKILL.md"), "# skill-author-by-recording\n", "utf8");

    const output = await cmdAgentSkillsList({
      format: "json",
      installDir,
    });

    assert.deepEqual(JSON.parse(output), {
      skills: [
        {
          name: "skill-author-by-agent-discovery",
          skillPath: join(discoveryDir, "SKILL.md"),
        },
        {
          name: "skill-author-by-recording",
          skillPath: join(skillDir, "SKILL.md"),
        },
      ],
      count: 2,
      installedDir: installDir,
    });
  });

  it("surfaces filesystem errors instead of reporting an empty install", async () => {
    const root = await makeTempRoot();
    const installDir = join(root, "unreadable-install-dir");
    await mkdir(installDir, { recursive: true });
    await chmod(installDir, 0o000);

    try {
      const output = await cmdAgentSkillsList({
        format: "json",
        installDir,
      });
      const parsed = JSON.parse(output);
      assert.equal(parsed.code, "AGENT_SKILLS_LIST_FAILED");
    } finally {
      await chmod(installDir, 0o755);
    }
  });
});

describe("listPackagedAgentSkills", () => {
  it("lists both packaged first-party agent-skills from the repo tree", async () => {
    const skills = await listPackagedAgentSkills();
    assert.deepEqual(skills, ["skill-author-by-agent-discovery", "skill-author-by-recording"]);
  });
});
