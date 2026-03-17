import { spawn } from "node:child_process";
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
  stdout?: string;
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
    const child = spawn(cmd, cmdArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const finish = (result: SkillRunResult | SkillRunError) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      resolve(result);
    };

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      const errCode =
        typeof (err as { code?: unknown }).code === "string"
          ? (err as { code?: string }).code
          : "SPAWN_FAILED";
      finish({
        ok: false,
        code: SKILL_EXECUTION_FAILED,
        message: `Skill ${skillId} ${errCode}: ${err.message}`,
        skillId,
        stdout: stdout || undefined,
        stderr: stderr || undefined,
      });
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      if (timedOut) {
        finish({
          ok: false,
          code: SKILL_EXECUTION_TIMEOUT,
          message: `Skill ${skillId} timed out after ${timeout}ms`,
          skillId,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
        });
        return;
      }

      if (code !== 0) {
        const exitCode = code ?? 1;
        finish({
          ok: false,
          code: SKILL_EXECUTION_FAILED,
          message: `Skill ${skillId} exited with code ${exitCode}`,
          skillId,
          exitCode,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
        });
        return;
      }

      finish({
        ok: true,
        skillId,
        output: stdout,
        exitCode: 0,
        durationMs,
      });
    });

    timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeout);
  });
}
