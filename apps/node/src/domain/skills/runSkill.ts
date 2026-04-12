import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { delimiter } from "node:path";
import { join, extname, isAbsolute, resolve } from "node:path";
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
  SKILL_AGENT_CLI_UNAVAILABLE,
  type SkillAgentConfig,
} from "../../contracts/skills.js";
import {
  emittedSkillResultSchema,
  SKILL_RESULT_CONTRACT_MAJOR_VERSION,
  SKILL_RESULT_CONTRACT_MINOR_VERSION,
  SKILL_RESULT_FRAME_PREFIX,
  type SkillResult,
  type SkillResultSource,
} from "../../contracts/skillResult.js";
import { readSkillManifestMetadata, type SkillManifestReadResult } from "./skillManifest.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const SKILL_AGENT_CLI_ENV_VAR = "CLAWPERATOR_SKILL_AGENT_CLI";
const SKILL_AGENT_CLI_PATH_ENV_VAR = "CLAWPERATOR_SKILL_AGENT_CLI_PATH";
const SKILL_AGENT_TIMEOUT_MS_ENV_VAR = "CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS";
const SKILL_INPUTS_ENV_VAR = "CLAWPERATOR_SKILL_INPUTS";
const SKILL_PROGRAM_ENV_VAR = "CLAWPERATOR_SKILL_PROGRAM";
const SKILL_ID_ENV_VAR = "CLAWPERATOR_SKILL_ID";
const SKILLS_REGISTRY_ENV_VAR = "CLAWPERATOR_SKILLS_REGISTRY";

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

interface AgentCliResolutionSuccess {
  ok: true;
  executablePath: string;
}

interface AgentCliResolutionFailure {
  ok: false;
  message: string;
}

type AgentCliResolution = AgentCliResolutionSuccess | AgentCliResolutionFailure;

interface SkillSourceResolutionSuccess {
  ok: true;
  source: SkillResultSource;
}

interface SkillSourceResolutionFailure {
  ok: false;
  message: string;
}

type SkillSourceResolution = SkillSourceResolutionSuccess | SkillSourceResolutionFailure;

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
  manifestResult: SkillManifestReadResult
): Promise<SkillSourceResolution> {
  if (!manifestResult.ok) {
    return {
      ok: false,
      message: manifestResult.message,
    };
  }

  if (!manifestResult.metadata.agent) {
    return { ok: true, source: { kind: "script" } };
  }

  return { ok: true, source: { kind: "agent", agentCli: manifestResult.metadata.agent.cli } };
}

async function canExecute(path: string): Promise<boolean> {
  try {
    await access(path, fsConstants.X_OK);
    return true;
  } catch {
    try {
      await access(path, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}

async function resolveAgentCliExecutable(
  agent: SkillAgentConfig,
  skillDir: string,
  resolvedEnv: NodeJS.ProcessEnv
): Promise<AgentCliResolution> {
  if (agent.cliPath && agent.cliPath.length > 0) {
    const resolvedCliPath = isAbsolute(agent.cliPath) ? agent.cliPath : resolve(skillDir, agent.cliPath);
    if (await canExecute(resolvedCliPath)) {
      return { ok: true, executablePath: resolvedCliPath };
    }
    return {
      ok: false,
      message: `Configured agent CLI was not found or is not executable at ${resolvedCliPath}`,
    };
  }

  const pathEntries = (resolvedEnv.PATH ?? "").split(delimiter).filter((entry) => entry.length > 0);
  for (const entry of pathEntries) {
    const candidate = join(entry, agent.cli);
    if (await canExecute(candidate)) {
      return { ok: true, executablePath: candidate };
    }
  }

  return {
    ok: false,
    message: `Configured agent CLI '${agent.cli}' was not found on PATH`,
  };
}

function parseSkillResultFrame(
  stdout: string,
  expectedSkillId: string,
  sourceResolution: SkillSourceResolution,
  logger?: Logger
): SkillFrameParseSuccess | SkillFrameParseFailure {
  const lines = stdout.split(/\r?\n/);
  const nonEmptyLines = lines
    .map((line) => ({ raw: line, trimmed: line.trim() }))
    .filter((line) => line.trimmed.length > 0);
  const markerIndexes = nonEmptyLines
    .map((line, index) => (line.raw === SKILL_RESULT_FRAME_PREFIX ? index : -1))
    .filter((index) => index >= 0);

  if (nonEmptyLines.length === 0) {
    return { ok: true, skillResult: null };
  }

  if (markerIndexes.length === 0) {
    return { ok: true, skillResult: null };
  }

  if (nonEmptyLines.length === 1) {
    return { ok: false, message: "SkillResult frame marker was not followed by a JSON line" };
  }

  const jsonLine = nonEmptyLines[nonEmptyLines.length - 1].trimmed;
  const markerLine = nonEmptyLines[nonEmptyLines.length - 2].raw;

  if (markerLine !== SKILL_RESULT_FRAME_PREFIX) {
    return { ok: false, message: "SkillResult frame must be the terminal non-empty stdout suffix" };
  }

  if (!jsonLine.startsWith("{")) {
    return { ok: false, message: "SkillResult frame marker must be followed by a JSON object line" };
  }

  if (!sourceResolution.ok) {
    return {
      ok: false,
      message: `${sourceResolution.message}. Framed SkillResult output requires authoritative source metadata.`,
    };
  }

  if (markerIndexes.length > 1 || markerIndexes[0] !== nonEmptyLines.length - 2) {
    return { ok: false, message: "Skill emitted multiple SkillResult frames or a non-terminal SkillResult marker" };
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

  if (schemaResult.data.skillId !== expectedSkillId) {
    return {
      ok: false,
      message: `SkillResult skillId ${schemaResult.data.skillId} did not match invoked skill ${expectedSkillId}`,
    };
  }

  return {
    ok: true,
    skillResult: {
      ...schemaResult.data,
      source: sourceResolution.source,
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
  let sourceResolution: SkillSourceResolution = { ok: true, source: { kind: "script" } };
  let resolvedAgentConfig: SkillAgentConfig | null = null;
  let resolvedAgentExecutablePath: string | null = null;
  let skillProgramPath: string | null = null;
  let resolvedRegistryPath: string | null = null;
  let effectiveTimeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...env,
  };
  try {
    const loaded = await loadRegistry(registryPath);
    resolvedRegistryPath = loaded.resolvedPath;
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
    skillProgramPath = join(repoRoot, skill.path, "SKILL.md");
    // Prefer .js script over .sh for direct node invocation
    const scriptRelative =
      skill.scripts.find((s) => extname(s) === ".js") ??
      skill.scripts.find((s) => extname(s) === ".sh") ??
      skill.scripts[0];

    resolvedPath = join(repoRoot, scriptRelative);
    const manifestResult = await readSkillManifestMetadata(repoRoot, skill.path);
    sourceResolution = await resolveSkillResultSource(manifestResult);

    if (manifestResult.ok && manifestResult.metadata.agent) {
      resolvedAgentConfig = manifestResult.metadata.agent;
      effectiveTimeoutMs = timeoutMs ?? resolvedAgentConfig.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const agentResolution = await resolveAgentCliExecutable(
        resolvedAgentConfig,
        join(repoRoot, skill.path),
        childEnv
      );
      if (!agentResolution.ok) {
        return {
          ok: false,
          code: SKILL_AGENT_CLI_UNAVAILABLE,
          message: `Skill ${skillId} requires agent CLI '${resolvedAgentConfig.cli}', but it is unavailable. ${agentResolution.message}`,
          skillId,
          skillResult: null,
        };
      }
      resolvedAgentExecutablePath = agentResolution.executablePath;
    }
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

  if (resolvedAgentConfig && skillProgramPath !== null) {
    try {
      await access(skillProgramPath);
    } catch {
      return {
        ok: false,
        code: SKILL_SCRIPT_NOT_FOUND,
        message: `SKILL.md not found: ${skillProgramPath}`,
        skillId,
        skillResult: null,
      };
    }
  }

  const ext = extname(resolvedPath);
  const cmd = ext === ".js" ? process.execPath : resolvedPath;
  const cmdArgs = ext === ".js" ? [resolvedPath, ...args] : args;
  const timeout = effectiveTimeoutMs;
  const skillLogger = callbacks?.logger?.child({ skillId });

  // Merge provided env with process.env, with provided env taking precedence
  if (resolvedAgentConfig && resolvedAgentExecutablePath && skillProgramPath) {
    childEnv[SKILL_AGENT_CLI_ENV_VAR] = resolvedAgentConfig.cli;
    childEnv[SKILL_AGENT_CLI_PATH_ENV_VAR] = resolvedAgentExecutablePath;
    childEnv[SKILL_AGENT_TIMEOUT_MS_ENV_VAR] = String(effectiveTimeoutMs);
    childEnv[SKILL_INPUTS_ENV_VAR] = JSON.stringify(args);
    childEnv[SKILL_PROGRAM_ENV_VAR] = skillProgramPath;
    childEnv[SKILL_ID_ENV_VAR] = skillId;
    if (resolvedRegistryPath !== null) {
      childEnv[SKILLS_REGISTRY_ENV_VAR] = resolvedRegistryPath;
    }
  }

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
      if (timedOut) {
        finish({
          ok: false,
          code: SKILL_EXECUTION_TIMEOUT,
          message: `Skill ${skillId} timed out after ${timeout}ms`,
          skillId,
          stdout: stdout || undefined,
          stderr: stderr || undefined,
          skillResult: null,
        });
        return;
      }

      const parsedSkillResult = parseSkillResultFrame(stdout, skillId, sourceResolution, skillLogger);
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
