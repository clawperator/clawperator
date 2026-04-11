import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { loadRegistry, findSkillById, getRepoRoot } from "../../adapters/skills-repo/localSkillsRegistry.js";
import type { Logger } from "../../adapters/logger.js";
import {
  REGISTRY_READ_FAILED,
  SKILL_NOT_FOUND,
  SKILL_SCRIPT_NOT_FOUND,
  SKILL_EXECUTION_FAILED,
  SKILL_EXECUTION_TIMEOUT,
  SKILL_OUTPUT_ASSERTION_FAILED,
  SKILL_RESULT_PARSE_FAILED,
} from "../../contracts/skills.js";
import {
  emittedSkillResultSchema,
  SKILL_RESULT_CONTRACT_MAJOR_VERSION,
  SKILL_RESULT_CONTRACT_MINOR_VERSION,
  SKILL_RESULT_FRAME_PREFIX,
  type SkillResult,
  type SkillResultSource,
} from "../../contracts/skillResult.js";

const DEFAULT_TIMEOUT_MS = 120_000;

export interface SkillRunResult {
  ok: true;
  skillId: string;
  output: string;
  exitCode: number;
  durationMs: number;
  skillResult: SkillResult | null;
}

export interface SkillRunError {
  ok: false;
  code: string;
  message: string;
  skillId?: string;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  /** Present when code is SKILL_OUTPUT_ASSERTION_FAILED */
  output?: string;
  expectedSubstring?: string;
  skillResult: SkillResult | null;
}

export interface SkillRunEnv {
  /** Path to CLI binary used by skill scripts */
  CLAWPERATOR_BIN?: string;
  /** Operator package passed as --operator-package on every CLI call within a skill */
  CLAWPERATOR_OPERATOR_PACKAGE?: string;
  [key: string]: string | undefined;
}

export interface SkillRunCallbacks {
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
  logger?: Logger;
}

interface SkillManifestLike {
  agent?: {
    cli?: string;
  };
}

interface SkillFrameParseSuccess {
  ok: true;
  skillResult: SkillResult | null;
}

interface SkillFrameParseFailure {
  ok: false;
  message: string;
}

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) {
    return null;
  }
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
  };
}

async function resolveSkillResultSource(
  repoRoot: string,
  skillPath: string,
  logger?: Logger
): Promise<SkillResultSource> {
  try {
    const raw = await readFile(join(repoRoot, skillPath, "skill.json"), "utf-8");
    const parsed = JSON.parse(raw) as SkillManifestLike;
    if (typeof parsed.agent?.cli === "string" && parsed.agent.cli.trim().length > 0) {
      return { kind: "agent", agentCli: parsed.agent.cli.trim() };
    }
  } catch (error) {
    logger?.emit({
      ts: new Date().toISOString(),
      level: "warn",
      event: "skills.run.skill_result_source_fallback",
      message: `Falling back to scripted skill source inference: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  return { kind: "script" };
}

function parseSkillResultFrame(
  stdout: string,
  source: SkillResultSource,
  logger?: Logger
): SkillFrameParseSuccess | SkillFrameParseFailure {
  const lines = stdout.split(/\r?\n/);
  const frameIndexes = lines
    .map((line, index) => (line.trim() === SKILL_RESULT_FRAME_PREFIX ? index : -1))
    .filter((index) => index >= 0);

  if (frameIndexes.length === 0) {
    return { ok: true, skillResult: null };
  }

  if (frameIndexes.length > 1) {
    return { ok: false, message: "Skill emitted multiple SkillResult frames" };
  }

  const markerIndex = frameIndexes[0];
  const jsonLine = lines[markerIndex + 1]?.trim();
  if (!jsonLine) {
    return { ok: false, message: "SkillResult frame marker was not followed by a JSON line" };
  }

  const trailingNonWhitespace = lines.slice(markerIndex + 2).some((line) => line.trim().length > 0);
  if (trailingNonWhitespace) {
    return { ok: false, message: "SkillResult frame must terminate at end-of-stream in v1" };
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(jsonLine);
  } catch (error) {
    return {
      ok: false,
      message: `SkillResult frame contained invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
    };
  }

  if (typeof parsedJson !== "object" || parsedJson === null || Array.isArray(parsedJson)) {
    return { ok: false, message: "SkillResult frame must be a JSON object" };
  }

  if ("source" in parsedJson) {
    return { ok: false, message: "SkillResult frame must not include source; runSkill injects it" };
  }

  const schemaResult = emittedSkillResultSchema.safeParse(parsedJson);
  if (!schemaResult.success) {
    return {
      ok: false,
      message: `SkillResult frame failed validation: ${schemaResult.error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`).join("; ")}`,
    };
  }

  const semver = parseSemver(schemaResult.data.contractVersion);
  if (semver === null) {
    return { ok: false, message: `SkillResult contractVersion must be semver-shaped, got ${schemaResult.data.contractVersion}` };
  }

  if (semver.major !== SKILL_RESULT_CONTRACT_MAJOR_VERSION) {
    return {
      ok: false,
      message: `Unsupported SkillResult contract major version ${semver.major}; expected ${SKILL_RESULT_CONTRACT_MAJOR_VERSION}`,
    };
  }

  if (semver.minor > SKILL_RESULT_CONTRACT_MINOR_VERSION) {
    logger?.emit({
      ts: new Date().toISOString(),
      level: "warn",
      event: "skills.run.skill_result_minor_version_ahead",
      message: `SkillResult contractVersion ${schemaResult.data.contractVersion} is newer than supported minor ${SKILL_RESULT_CONTRACT_MINOR_VERSION}; unknown fields will be ignored`,
    });
  }

  return {
    ok: true,
    skillResult: {
      ...schemaResult.data,
      source,
    },
  };
}

export async function runSkill(
  skillId: string,
  args: string[],
  registryPath?: string,
  timeoutMs?: number,
  env?: SkillRunEnv,
  callbacks?: SkillRunCallbacks,
  expectContains?: string
): Promise<SkillRunResult | SkillRunError> {
  let resolvedPath: string;
  let source: SkillResultSource = { kind: "script" };
  try {
    const loaded = await loadRegistry(registryPath);
    const skill = findSkillById(loaded.registry, skillId);
    if (!skill) {
      return { ok: false, code: SKILL_NOT_FOUND, message: `Skill not found: ${skillId}`, skillId, skillResult: null };
    }

    if (!skill.scripts || skill.scripts.length === 0) {
      return {
        ok: false,
        code: SKILL_SCRIPT_NOT_FOUND,
        message: `Skill ${skillId} has no scripts defined`,
        skillId,
        skillResult: null,
      };
    }

    const repoRoot = getRepoRoot(loaded.resolvedPath);
    // Prefer .js script over .sh for direct node invocation
    const scriptRelative =
      skill.scripts.find((s) => extname(s) === ".js") ??
      skill.scripts.find((s) => extname(s) === ".sh") ??
      skill.scripts[0];

    resolvedPath = join(repoRoot, scriptRelative);
    source = await resolveSkillResultSource(repoRoot, skill.path, callbacks?.logger?.child({ skillId }));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ok: false, code: REGISTRY_READ_FAILED, message, skillResult: null };
  }

  try {
    await access(resolvedPath);
  } catch {
    return {
      ok: false,
      code: SKILL_SCRIPT_NOT_FOUND,
      message: `Script not found: ${resolvedPath}`,
      skillId,
      skillResult: null,
    };
  }

  const ext = extname(resolvedPath);
  const cmd = ext === ".js" ? process.execPath : resolvedPath;
  const cmdArgs = ext === ".js" ? [resolvedPath, ...args] : args;
  const timeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const skillLogger = callbacks?.logger?.child({ skillId });

  // Merge provided env with process.env, with provided env taking precedence
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
  };

  const start = Date.now();
  return new Promise((resolve) => {
    skillLogger?.emit({
      ts: new Date().toISOString(),
      level: "info",
      event: "skills.run.start",
      skillId,
      message: `Skill ${skillId} spawned`,
    });

    const child = spawn(cmd, cmdArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      env: childEnv,
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
      const text = chunk.toString();
      skillLogger?.emit({
        ts: new Date().toISOString(),
        level: "info",
        event: "skills.run.output",
        skillId,
        stream: "stdout",
        message: text,
      });
      callbacks?.onOutput?.(text, "stdout");
      stdout += text;
    });

    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      skillLogger?.emit({
        ts: new Date().toISOString(),
        level: "info",
        event: "skills.run.output",
        skillId,
        stream: "stderr",
        message: text,
      });
      callbacks?.onOutput?.(text, "stderr");
      stderr += text;
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
        skillResult: null,
      });
    });

    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      const parsedSkillResult = parseSkillResultFrame(stdout, source, skillLogger);
      if (!parsedSkillResult.ok) {
        finish({
          ok: false,
          code: SKILL_RESULT_PARSE_FAILED,
          message: parsedSkillResult.message,
          skillId,
          exitCode: code ?? undefined,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          skillResult: null,
        });
        return;
      }

      if (timedOut) {
        finish({
          ok: false,
          code: SKILL_EXECUTION_TIMEOUT,
          message: `Skill ${skillId} timed out after ${timeout}ms`,
          skillId,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          skillResult: parsedSkillResult.skillResult,
        });
        return;
      }

      if (code !== 0) {
        const exitCode = code ?? 1;
        skillLogger?.emit({
          ts: new Date().toISOString(),
          level: "error",
          event: "skills.run.failed",
          skillId,
          message: `Skill ${skillId} exited with code ${exitCode} after ${durationMs}ms`,
        });
        skillLogger?.emit({
          ts: new Date().toISOString(),
          level: "info",
          event: "skills.run.complete",
          skillId,
          exitCode,
          message: `Skill ${skillId} exited with code ${exitCode} after ${durationMs}ms`,
        });
        finish({
          ok: false,
          code: SKILL_EXECUTION_FAILED,
          message: `Skill ${skillId} exited with code ${exitCode}`,
          skillId,
          exitCode,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          skillResult: parsedSkillResult.skillResult,
        });
        return;
      }

      skillLogger?.emit({
        ts: new Date().toISOString(),
        level: "info",
        event: "skills.run.complete",
        skillId,
        exitCode: 0,
        message: `Skill ${skillId} exited with code 0 after ${durationMs}ms`,
      });
      if (expectContains !== undefined && !stdout.includes(expectContains)) {
        finish({
          ok: false,
          code: SKILL_OUTPUT_ASSERTION_FAILED,
          message: `Skill ${skillId} output did not include expected text`,
          skillId,
          output: stdout,
          expectedSubstring: expectContains,
          skillResult: parsedSkillResult.skillResult,
        });
        return;
      }
      finish({
        ok: true,
        skillId,
        output: stdout,
        exitCode: 0,
        durationMs,
        skillResult: parsedSkillResult.skillResult,
      });
    });

    timeoutId = setTimeout(() => {
      timedOut = true;
      skillLogger?.emit({
        ts: new Date().toISOString(),
        level: "error",
        event: "skills.run.timeout",
        skillId,
        message: `Skill ${skillId} timed out after ${timeout}ms`,
      });
      child.kill("SIGTERM");
    }, timeout);
  });
}
