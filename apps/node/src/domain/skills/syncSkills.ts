import { execFile } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { SKILLS_REPO_URL, DEFAULT_SKILLS_DIR, DEFAULT_SKILLS_REGISTRY_SUBPATH } from "./skillsConfig.js";
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

function exec(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60_000 }, (err, stdout, stderr) => {
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
      await exec("git", ["-C", dir, "fetch", "--quiet"]);
      await exec("git", ["-C", dir, "checkout", ref]);
      await exec("git", ["-C", dir, "pull", "--ff-only", "--quiet"]);
    } else {
      await exec("git", ["clone", SKILLS_REPO_URL, dir]);
      if (ref !== "main") {
        await exec("git", ["-C", dir, "checkout", ref]);
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

  // Validate registry exists after sync
  try {
    const raw = await readFile(registryPath, "utf-8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.skills)) {
      return {
        ok: false,
        code: SKILLS_SYNC_FAILED,
        message: `Registry at ${registryPath} is invalid: skills array required`,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      code: SKILLS_SYNC_FAILED,
      message: `Registry not found after sync: ${msg}. Expected at ${registryPath}`,
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
