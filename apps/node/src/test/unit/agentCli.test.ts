import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveExecutableOnPathForPlatform } from "../../domain/skills/agentCli.js";

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
