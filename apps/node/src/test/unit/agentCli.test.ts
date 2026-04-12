import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveAgentCliExecutable, resolveExecutableOnPathForPlatform } from "../../domain/skills/agentCli.js";

describe("resolveExecutableOnPathForPlatform", () => {
  it("resolves Windows launcher extensions via PATHEXT", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clawperator-agent-cli-win-"));
    const launcherPath = join(tempDir, "codex.cmd");

    try {
      await writeFile(launcherPath, "@echo off\r\n", "utf8");

      const resolved = await resolveExecutableOnPathForPlatform(
        "codex",
        tempDir,
        "win32",
        ".CMD;.EXE"
      );

      assert.ok(resolved);
      assert.strictEqual(resolved.toLowerCase(), launcherPath.toLowerCase());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

describe("resolveAgentCliExecutable", () => {
  it("rejects absolute cliPath values", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clawperator-agent-cli-abs-"));

    try {
      const result = await resolveAgentCliExecutable(
        { cli: "codex", cliPath: "/tmp/fake-agent" },
        tempDir,
        process.env
      );
      assert.ok(!result.ok);
      assert.match(result.message, /must be relative to the skill directory/i);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("rejects relative cliPath values that escape the skill directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "clawperator-agent-cli-escape-"));
    const skillDir = join(tempDir, "skill");

    try {
      await mkdir(skillDir, { recursive: true });
      const result = await resolveAgentCliExecutable(
        { cli: "codex", cliPath: "../outside-agent" },
        skillDir,
        process.env
      );
      assert.ok(!result.ok);
      assert.match(result.message, /must stay within the skill directory/i);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
