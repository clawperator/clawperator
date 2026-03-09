import { execFile } from "node:child_process";
import { access, readFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { SKILLS_BUNDLE_URL, DEFAULT_SKILLS_DIR, DEFAULT_SKILLS_REGISTRY_SUBPATH } from "./skillsConfig.js";
import { SKILLS_SYNC_FAILED, SKILLS_GIT_NOT_FOUND } from "../../contracts/skills.js";

export interface SyncSkillsResult {
  ok: true;
  synced: true;
  skillsDir: string;
  registryPath: string;
  message: string;
}

export interface SyncSkillsError {
  ok: false;
  code: string;
  message: string;
}

function exec(cmd: string, args: string[], timeoutMs = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) reject(err);
      else resolve({ stdout, stderr });
    });
  });
}

async function gitAvailable(): Promise<boolean> {
  try {
    await exec("git", ["--version"]);
    return true;
  } catch {
    return false;
  }
}

async function dirExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function syncSkills(
  ref: string,
  skillsDir?: string
): Promise<SyncSkillsResult | SyncSkillsError> {
  const dir = skillsDir ?? DEFAULT_SKILLS_DIR;
  const registryPath = join(dir, DEFAULT_SKILLS_REGISTRY_SUBPATH);

  if (!(await gitAvailable())) {
    return {
      ok: false,
      code: SKILLS_GIT_NOT_FOUND,
      message: "git is not installed or not on PATH. Install git to use skills install/update.",
    };
  }

  try {
    if (await dirExists(join(dir, ".git"))) {
      // Migrate remote URL if it still points to an old location
      try {
        const { stdout } = await exec("git", ["-C", dir, "remote", "get-url", "origin"]);
        if (stdout.trim() !== SKILLS_BUNDLE_URL) {
          await exec("git", ["-C", dir, "remote", "set-url", "origin", SKILLS_BUNDLE_URL]);
        }
      } catch {
        // No remote configured - add one
        await exec("git", ["-C", dir, "remote", "add", "origin", SKILLS_BUNDLE_URL]);
      }
      // Download bundle to a temporary file since git cannot fetch/clone directly from a remote HTTP bundle file
      const tmpBundle = join(tmpdir(), `clawperator-skills-${Date.now()}.bundle`);
      try {
        const response = await fetch(SKILLS_BUNDLE_URL);
        if (!response.ok) throw new Error(`Failed to download skills bundle: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        await writeFile(tmpBundle, Buffer.from(buffer));
        
        // NOTE: HTTP-served git bundles are static files - git re-downloads the
        // entire bundle on every fetch (no incremental delta like a live git server).
        await exec("git", ["-C", dir, "fetch", tmpBundle, "+refs/heads/*:refs/remotes/origin/*", "--quiet"]);
        await exec("git", ["-C", dir, "checkout", ref]);
        // Only fast-forward merge if on a branch (not detached HEAD from a tag/commit).
        // Check symbolic-ref separately so a merge failure is not silently swallowed.
        let onBranch = false;
        try {
          await exec("git", ["-C", dir, "symbolic-ref", "HEAD"], 5_000);
          onBranch = true;
        } catch {
          // Detached HEAD - fetch+checkout is sufficient
        }
        if (onBranch) {
          await exec("git", ["-C", dir, "merge", "--ff-only", "--quiet", `origin/${ref}`]);
        }
      } finally {
        try { await unlink(tmpBundle); } catch { /* ignore */ }
      }
    } else {
      await mkdir(dirname(dir), { recursive: true });
      const tmpBundle = join(tmpdir(), `clawperator-skills-${Date.now()}.bundle`);
      try {
        const response = await fetch(SKILLS_BUNDLE_URL);
        if (!response.ok) throw new Error(`Failed to download skills bundle: ${response.statusText}`);
        const buffer = await response.arrayBuffer();
        await writeFile(tmpBundle, Buffer.from(buffer));
        await exec("git", ["clone", tmpBundle, dir]);
        // Set origin to the remote URL instead of the temporary file
        await exec("git", ["-C", dir, "remote", "set-url", "origin", SKILLS_BUNDLE_URL]);
        if (ref !== "main") {
          await exec("git", ["-C", dir, "checkout", ref]);
        }
      } finally {
        try { await unlink(tmpBundle); } catch { /* ignore */ }
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: SKILLS_SYNC_FAILED,
      message: `Skills sync failed: ${msg}`,
    };
  }

  // Validate registry exists and is valid after sync
  let raw: string;
  try {
    raw = await readFile(registryPath, "utf-8");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: SKILLS_SYNC_FAILED,
      message: `Registry file not found or unreadable after sync: ${msg}. Expected at ${registryPath}`,
    };
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: SKILLS_SYNC_FAILED,
      message: `Registry at ${registryPath} is invalid JSON: ${msg}`,
    };
  }

  if (!Array.isArray(data.skills)) {
    return {
      ok: false,
      code: SKILLS_SYNC_FAILED,
      message: `Registry at ${registryPath} is invalid: skills array required`,
    };
  }

  return {
    ok: true,
    synced: true,
    skillsDir: dir,
    registryPath,
    message: `Skills synced to ${dir} (ref: ${ref})`,
  };
}
