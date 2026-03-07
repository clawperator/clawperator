import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join, extname } from "node:path";
import { loadRegistry, findSkillById, getRepoRoot } from "../../adapters/skills-repo/localSkillsRegistry.js";
import {
  REGISTRY_READ_FAILED,
  SKILL_NOT_FOUND,
  SKILL_SCRIPT_NOT_FOUND,
  SKILL_EXECUTION_FAILED,
  SKILL_EXECUTION_TIMEOUT,
} from "../../contracts/skills.js";

const DEFAULT_TIMEOUT_MS = 120_000;

export interface SkillRunResult {
  ok: true;
  skillId: string;
  output: string;
  exitCode: number;
  durationMs: number;
}

export interface SkillRunError {
  ok: false;
  code: string;
  message: string;
  skillId?: string;
  exitCode?: number;
  stderr?: string;
}

export async function runSkill(
  skillId: string,
  args: string[],
  registryPath?: string,
  timeoutMs?: number
): Promise<SkillRunResult | SkillRunError> {
  let resolvedPath: string;
  try {
    const loaded = await loadRegistry(registryPath);
    const skill = findSkillById(loaded.registry, skillId);
    if (!skill) {
      return { ok: false, code: SKILL_NOT_FOUND, message: `Skill not found: ${skillId}`, skillId };
    }

    if (!skill.scripts || skill.scripts.length === 0) {
      return {
        ok: false,
        code: SKILL_SCRIPT_NOT_FOUND,
        message: `Skill ${skillId} has no scripts defined`,
        skillId,
      };
    }

    const repoRoot = getRepoRoot(loaded.resolvedPath);
    // Prefer .js script over .sh for direct node invocation
    const scriptRelative =
      skill.scripts.find((s) => extname(s) === ".js") ??
      skill.scripts.find((s) => extname(s) === ".sh") ??
      skill.scripts[0];

    resolvedPath = join(repoRoot, scriptRelative);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message };
  }

  try {
    await access(resolvedPath);
  } catch {
    return {
      ok: false,
      code: SKILL_SCRIPT_NOT_FOUND,
      message: `Script not found: ${resolvedPath}`,
      skillId,
    };
  }

  const ext = extname(resolvedPath);
  const cmd = ext === ".js" ? process.execPath : resolvedPath;
  const cmdArgs = ext === ".js" ? [resolvedPath, ...args] : args;
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const start = Date.now();
  return new Promise((resolve) => {
    execFile(cmd, cmdArgs, { timeout, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      const durationMs = Date.now() - start;

      if (err) {
        const isTimeout = "killed" in err && err.killed && err.signal === "SIGTERM";
        if (isTimeout) {
          resolve({
            ok: false,
            code: SKILL_EXECUTION_TIMEOUT,
            message: `Skill ${skillId} timed out after ${timeout}ms`,
            skillId,
            stderr: stderr || undefined,
          });
          return;
        }

        // err.code is a string for spawn errors (ENOENT, EACCES) and a number for exit codes
        const errCode = "code" in err ? err.code : undefined;
        const exitCode = typeof errCode === "number" ? errCode : 1;
        const detail = typeof errCode === "string"
          ? `${errCode}: ${err.message}`
          : `exited with code ${exitCode}`;
        resolve({
          ok: false,
          code: SKILL_EXECUTION_FAILED,
          message: `Skill ${skillId} ${detail}`,
          skillId,
          exitCode,
          stderr: stderr || undefined,
        });
        return;
      }

      resolve({
        ok: true,
        skillId,
        output: stdout,
        exitCode: 0,
        durationMs,
      });
    });
  });
}
