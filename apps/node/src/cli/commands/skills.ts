import { EventEmitter } from "node:events";
import { homedir } from "node:os";
import { join } from "node:path";
import { listSkills } from "../../domain/skills/listSkills.js";
import { getSkill } from "../../domain/skills/getSkill.js";
import { compileArtifact } from "../../domain/skills/compileArtifact.js";
import { syncSkills } from "../../domain/skills/syncSkills.js";
import { searchSkills } from "../../domain/skills/searchSkills.js";
import { runSkill, type SkillRunEnv } from "../../domain/skills/runSkill.js";
import { scaffoldSkill } from "../../domain/skills/scaffoldSkill.js";
import { validateAllSkills, validateSkill } from "../../domain/skills/validateSkill.js";
import { SKILL_RESULT_FRAME_PREFIX } from "../../contracts/skillResult.js";
import { SKILL_OUTPUT_ASSERTION_FAILED } from "../../contracts/skills.js";
import type { OutputOptions } from "../output.js";
import { formatSuccess, formatError } from "../output.js";
import { getCliVersion } from "../../domain/version/compatibility.js";
import { getAlternateOperatorVariant } from "../../domain/version/compatibility.js";
import { getDefaultRuntimeConfig } from "../../adapters/android-bridge/runtimeConfig.js";
import { checkApkPresence } from "../../domain/doctor/checks/readinessChecks.js";
import type { Logger } from "../../adapters/logger.js";
import type { LogEvent } from "../../contracts/logging.js";
import {
  CLAWPERATOR_BIN_ENV_VAR,
  CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR,
  resolveSkillBinCommand,
  resolveOperatorPackage,
} from "../../domain/skills/skillsConfig.js";

function isIgnorablePipeError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const code = (error as { code?: unknown }).code;
  return code === "EPIPE" || code === "ERR_STREAM_DESTROYED";
}

function suppressStreamPipeErrors(stream: EventEmitter): () => void {
  const onError = (error: unknown) => {
    if (!isIgnorablePipeError(error)) {
      process.nextTick(() => {
        throw error instanceof Error ? error : new Error(String(error));
      });
    }
  };
  stream.on("error", onError);
  return () => {
    stream.off("error", onError);
  };
}

function emitCliEvent(logger: Logger | undefined, event: Omit<LogEvent, "ts">): void {
  logger?.emit({
    ts: new Date().toISOString(),
    ...event,
  });
}

function splitTextIntoLinesPreservingEndings(text: string): string[] {
  const matches = text.match(/[^\r\n]*(?:\r?\n|$)/g) ?? [];
  return matches.filter((line) => line.length > 0);
}

function lineWithoutTrailingNewline(line: string): string {
  return line.replace(/\r?\n$/, "");
}

function stripTrailingSkillResultFrame(stdout: string): string {
  const lines = splitTextIntoLinesPreservingEndings(stdout);
  if (lines.length === 0) {
    return stdout;
  }

  let jsonLineIndex = -1;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (lineWithoutTrailingNewline(lines[index]).trim().length > 0) {
      jsonLineIndex = index;
      break;
    }
  }
  if (jsonLineIndex < 0) {
    return stdout;
  }

  let markerLineIndex = -1;
  for (let index = jsonLineIndex - 1; index >= 0; index -= 1) {
    if (lineWithoutTrailingNewline(lines[index]).trim().length > 0) {
      markerLineIndex = index;
      break;
    }
  }
  if (markerLineIndex < 0) {
    return stdout;
  }

  if (lineWithoutTrailingNewline(lines[markerLineIndex]) !== SKILL_RESULT_FRAME_PREFIX) {
    return stdout;
  }

  return lines.slice(0, markerLineIndex).join("");
}

function createPrettyStdoutForwarder(writer: (chunk: string) => void) {
  let incomplete = "";
  let protectedTail = "";
  let protectingFrameTail = false;

  return {
    onChunk(chunk: string) {
      incomplete += chunk;
      const completeLines = splitTextIntoLinesPreservingEndings(incomplete);
      const trailingLine = completeLines.at(-1);
      const trailingIsComplete = trailingLine === undefined || trailingLine.endsWith("\n");
      const readyLines = trailingIsComplete ? completeLines : completeLines.slice(0, -1);

      for (const line of readyLines) {
        if (!protectingFrameTail && lineWithoutTrailingNewline(line) === SKILL_RESULT_FRAME_PREFIX) {
          protectingFrameTail = true;
        }

        if (protectingFrameTail) {
          protectedTail += line;
        } else {
          writer(line);
        }
      }

      incomplete = trailingIsComplete ? "" : trailingLine ?? "";
    },
    finish(options: { stripTerminalFrame: boolean }) {
      if (incomplete.length > 0) {
        if (!protectingFrameTail && lineWithoutTrailingNewline(incomplete) === SKILL_RESULT_FRAME_PREFIX) {
          protectingFrameTail = true;
        }
        if (protectingFrameTail) {
          protectedTail += incomplete;
        } else {
          writer(incomplete);
        }
        incomplete = "";
      }

      writer(options.stripTerminalFrame ? stripTrailingSkillResultFrame(protectedTail) : protectedTail);
      protectedTail = "";
      protectingFrameTail = false;
    },
  };
}

function sanitizePrettySkillStdout(stdout: string | undefined, skillResultPresent: boolean): string | undefined {
  if (stdout === undefined || !skillResultPresent) {
    return stdout;
  }
  return stripTrailingSkillResultFrame(stdout);
}

export async function cmdSkillsList(options: { format: OutputOptions["format"] }): Promise<string> {
  const result = await listSkills();
  if (result.ok) {
    return formatSuccess({ skills: result.skills, count: result.skills.length }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsGet(
  skillId: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await getSkill(skillId);
  if (result.ok) {
    return formatSuccess({ skill: result.skill }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsCompileArtifact(
  skillId: string,
  artifact: string,
  varsJson: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  // CLI help examples for `--artifact` use `climate-status`.
  const result = await compileArtifact(skillId, artifact, varsJson ?? "{}");
  if (result.ok) {
    return formatSuccess({ execution: result.execution }, options);
  }
  return formatError(
    { code: result.code, message: result.message, details: result.details },
    options
  );
}

export async function cmdSkillsSync(
  ref: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills(ref);
  if (result.ok) {
    return formatSuccess({ synced: result.synced, message: result.message }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsInstall(
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills("main");
  if (result.ok) {
    return formatSuccess({
      synced: result.synced,
      message: result.message,
      registryPath: result.registryPath,
      envInstruction: `export CLAWPERATOR_SKILLS_REGISTRY="${result.registryPath}"`,
    }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsUpdate(
  ref: string,
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await syncSkills(ref || "main");
  if (result.ok) {
    return formatSuccess({ synced: result.synced, message: result.message }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsSearch(
  query: { app?: string; intent?: string; keyword?: string },
  options: { format: OutputOptions["format"] }
): Promise<string> {
  const result = await searchSkills(query);
  if (result.ok) {
    return formatSuccess({ skills: result.skills, count: result.skills.length }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsRun(
  skillId: string,
  args: string[],
  timeoutMs: number | undefined,
  expectContains: string | undefined,
  operatorPackage: string | undefined,
  options: {
    format: OutputOptions["format"];
    skipValidate?: boolean;
    deviceId?: string;
    runSkillImpl?: typeof runSkill;
    validateSkillImpl?: typeof validateSkill;
    logger?: Logger;
  }
): Promise<string> {
  // Resolve the env vars for the skill script
  // Priority: explicit flag > env var > default
  const resolvedBin = resolveSkillBinCommand();
  const resolvedOperatorPackage = operatorPackage ?? resolveOperatorPackage();

  const env: SkillRunEnv = {
    [CLAWPERATOR_BIN_ENV_VAR]: resolvedBin,
    [CLAWPERATOR_OPERATOR_PACKAGE_ENV_VAR]: resolvedOperatorPackage,
  };

  const runSkillImpl = options.runSkillImpl ?? runSkill;
  const validateSkillImpl = options.validateSkillImpl ?? validateSkill;
  const cliLogger = options.logger?.child({ skillId, deviceId: options.deviceId });
  let validationSkipped = false;
  if (!options.skipValidate) {
    const validation = await validateSkillImpl(skillId, undefined, { dryRun: true });
    if (!validation.ok) {
      return formatError({
        code: validation.code,
        message: validation.message,
        details: validation.details,
      }, options);
    }
    validationSkipped = validation.dryRun?.payloadValidation === "skipped";
  }

  const config = getDefaultRuntimeConfig({
    deviceId: options.deviceId,
    operatorPackage: resolvedOperatorPackage,
    logger: cliLogger,
  });
  let apkStatus = `MISSING - run \`clawperator operator setup --apk <path>\``;
  try {
    const apkPresence = await checkApkPresence(config);
    if (apkPresence.status === "pass") {
      apkStatus = `OK (${resolvedOperatorPackage})`;
    } else if (apkPresence.status === "warn") {
      const alternateVariant = getAlternateOperatorVariant(resolvedOperatorPackage);
      apkStatus = `WARN - ${apkPresence.summary}${apkPresence.detail ? ` ${apkPresence.detail}` : ""} Use --operator-package ${alternateVariant} or reinstall the matching APK.`;
    } else {
      apkStatus = `FAIL - ${apkPresence.summary}${apkPresence.detail ? ` ${apkPresence.detail}` : ""}`;
    }
  } catch {
    apkStatus = `MISSING - run \`clawperator operator setup --apk <path>\``;
  }

  const logDate = new Date();
  const yyyy = String(logDate.getFullYear());
  const mm = String(logDate.getMonth() + 1).padStart(2, "0");
  const dd = String(logDate.getDate()).padStart(2, "0");
  const logPath = cliLogger?.logPath() ?? join(homedir(), ".clawperator", "logs", `clawperator-${yyyy}-${mm}-${dd}.log`);
  const bannerMessage = `[Clawperator] v${getCliVersion()}  APK: ${apkStatus}  Logs: ${logPath}  Hint: tail -f ${logPath}  Docs: https://docs.clawperator.com/llms.txt`;
  if (cliLogger !== undefined) {
    emitCliEvent(cliLogger, {
      level: "debug",
      event: "cli.banner",
      skillId,
      message: bannerMessage,
    });
  } else if (options.format !== "json") {
    process.stdout.write(`${bannerMessage}\n`);
  }

  if (validationSkipped) {
    const validationMessage = "  [INFO] Payload validation skipped: no pre-compiled artifacts";
    if (cliLogger !== undefined) {
      emitCliEvent(cliLogger, {
        level: "debug",
        event: "cli.validation",
        skillId,
        message: validationMessage,
      });
    } else if (options.format !== "json") {
      process.stderr.write(`${validationMessage}\n`);
    }
  }

  const result = options.format !== "json"
    ? await (async () => {
        const removeStdoutErrorListener = suppressStreamPipeErrors(process.stdout);
        const removeStderrErrorListener = suppressStreamPipeErrors(process.stderr);
        const stdoutForwarder = createPrettyStdoutForwarder((chunk) => {
          try {
            process.stdout.write(chunk);
          } catch (error) {
            if (!isIgnorablePipeError(error)) {
              throw error;
            }
          }
        });
        try {
          const runResult = await runSkillImpl(skillId, args, undefined, timeoutMs, env, {
            onOutput: (chunk, stream) => {
              try {
                if (stream === "stdout") {
                  stdoutForwarder.onChunk(chunk);
                } else {
                  process.stderr.write(chunk);
                }
              } catch (error) {
                if (!isIgnorablePipeError(error)) {
                  throw error;
                }
              }
            },
            logger: cliLogger,
          }, expectContains);
          stdoutForwarder.finish({
            stripTerminalFrame: runResult.skillResult !== null,
          });
          return runResult;
        } finally {
          removeStdoutErrorListener();
          removeStderrErrorListener();
        }
      })()
    : await runSkillImpl(skillId, args, undefined, timeoutMs, env, { logger: cliLogger }, expectContains);
  if (result.ok) {
    return formatSuccess({
      skillId: result.skillId,
      output: options.format === "pretty"
        ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
        : result.output,
      exitCode: result.exitCode,
      durationMs: result.durationMs,
      skillResult: result.skillResult,
      timeoutMs: timeoutMs ?? undefined,
      expectedSubstring: expectContains ?? undefined,
    }, options);
  }
  if (result.code === SKILL_OUTPUT_ASSERTION_FAILED) {
    return formatError({
      code: SKILL_OUTPUT_ASSERTION_FAILED,
      message: result.message,
      skillId: result.skillId,
      output: options.format === "pretty"
        ? sanitizePrettySkillStdout(result.output, result.skillResult !== null)
        : result.output,
      skillResult: result.skillResult,
      expectedSubstring: result.expectedSubstring,
      timeoutMs: timeoutMs ?? undefined,
    }, options);
  }
  return formatError({
    code: result.code,
    message: result.message,
    skillId: result.skillId,
    exitCode: result.exitCode,
    stdout: options.format === "pretty"
      ? sanitizePrettySkillStdout(result.stdout, result.skillResult !== null)
      : result.stdout,
    stderr: result.stderr,
    skillResult: result.skillResult,
    timeoutMs: timeoutMs ?? undefined,
    expectedSubstring: expectContains ?? undefined,
  }, options);
}

export async function cmdSkillsNew(
  skillId: string,
  options: { format: OutputOptions["format"]; summary?: string; recordingContextPath?: string }
): Promise<string> {
  const result = await scaffoldSkill(skillId, {
    summary: options.summary,
    recordingContextPath: options.recordingContextPath,
  });
  if (result.ok) {
    return formatSuccess({
      created: true,
      skillId: result.skillId,
      registryPath: result.registryPath,
      skillPath: result.skillPath,
      files: result.files,
      ...(result.recordingContextPath ? { recordingContextPath: result.recordingContextPath } : {}),
      next: "Edit SKILL.md and scripts/run.js, then verify with: clawperator skills validate <skill_id>",
    }, options);
  }
  return formatError({ code: result.code, message: result.message }, options);
}

export async function cmdSkillsValidate(
  skillId: string,
  options: { format: OutputOptions["format"]; dryRun?: boolean; logger?: Logger }
): Promise<string> {
  const result = await validateSkill(skillId, undefined, { dryRun: options.dryRun });
  if (result.ok) {
    const rendered = formatSuccess({
      valid: true,
      skill: result.skill,
      registryPath: result.registryPath,
      ...(result.dryRun ? { dryRun: result.dryRun } : {}),
      checks: result.checks,
    }, options);
    if (result.dryRun?.payloadValidation === "skipped") {
      const validationMessage = "  [INFO] Payload validation skipped: no pre-compiled artifacts";
      if (options.logger !== undefined) {
        emitCliEvent(options.logger.child({ skillId }), {
          level: "debug",
          event: "cli.validation",
          skillId,
          message: validationMessage,
        });
      } else if (options.format !== "json") {
        process.stderr.write(`${validationMessage}\n`);
      }
    }
    return rendered;
  }
  return formatError({
    code: result.code,
    message: result.message,
    details: result.details,
  }, options);
}

export async function cmdSkillsValidateAll(
  options: { format: OutputOptions["format"]; dryRun?: boolean; logger?: Logger }
): Promise<string> {
  const result = await validateAllSkills(undefined, { dryRun: options.dryRun });
  if (result.ok) {
    if (options.dryRun) {
      for (const validSkill of result.validSkills) {
        if (validSkill.checks.artifactPaths.length === 0) {
          const validationMessage = "  [INFO] Payload validation skipped: no pre-compiled artifacts";
          if (options.logger !== undefined) {
            emitCliEvent(options.logger.child({ skillId: validSkill.skill.id }), {
              level: "debug",
              event: "cli.validation",
              skillId: validSkill.skill.id,
              message: validationMessage,
            });
          } else if (options.format !== "json") {
            process.stderr.write(`${validationMessage}\n`);
          }
        }
      }
    }
    return formatSuccess({
      valid: true,
      totalSkills: result.totalSkills,
      registryPath: result.registryPath,
      validSkills: result.validSkills,
    }, options);
  }
  return formatError({
    code: result.code,
    message: result.message,
    registryPath: result.registryPath,
    details: result.details,
  }, options);
}
