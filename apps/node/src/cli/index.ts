#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { createClawperatorLogger } from "../adapters/logger.js";
import {
  COMMANDS,
  UsageError,
  didYouMean,
  generateTopLevelHelp,
  resolveHelpFromRegistry,
  resolveSupportedFlagsFromRegistry,
  type HandlerContext,
} from "./registry.js";
import { shouldCliStdoutForceExitCode1 } from "./stdoutExitCode.js";

function levenshteinDistance(s1: string, s2: string): number {
  const track = Array(s2.length + 1).fill(null).map(() =>
    Array(s1.length + 1).fill(null));
  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }
  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }
  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1,
        track[j - 1][i] + 1,
        track[j - 1][i - 1] + indicator);
    }
  }
  return track[s2.length][s1.length];
}

function similarityRatio(s1: string, s2: string): number {
  const dist = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return 1 - (dist / maxLen);
}

const FLAG_VALUE_ARITY = new Map<string, number>([
  ["--device", 1],
  ["--device-id", 1],
  ["--operator-package", 1],
  ["--receiver-package", 1],
  ["--output", 1],
  ["--format", 1],
  ["--timeout", 1],
  ["--timeout-ms", 1],
  ["--log-level", 1],
  ["--apk", 1],
  ["--name", 1],
  ["--path", 1],
  ["--app", 1],
  ["--key", 1],
  ["--direction", 1],
  ["--text", 1],
  ["--text-contains", 1],
  ["--id", 1],
  ["--desc", 1],
  ["--desc-contains", 1],
  ["--role", 1],
  ["--selector", 1],
  ["--container-text", 1],
  ["--container-text-contains", 1],
  ["--container-id", 1],
  ["--container-desc", 1],
  ["--container-desc-contains", 1],
  ["--container-role", 1],
  ["--container-selector", 1],
  ["--payload", 1],
  ["--execution", 1],
  ["--goal", 1],
  ["--skill-id", 1],
  ["--artifact", 1],
  ["--vars", 1],
  ["--summary", 1],
  ["--session-id", 1],
  ["--out", 1],
  ["--input", 1],
  ["--label", 1],
  ["--label-id", 1],
  ["--label-desc", 1],
  ["--ref", 1],
  ["--port", 1],
  ["--host", 1],
  ["--intent", 1],
  ["--keyword", 1],
  ["--expect-contains", 1],
  ["--coordinate", 2],
]);

const COMMANDS_ALLOW_LEADING_POSITIONAL = new Set([
  "exec",
]);

function getGlobalOpts(argv: string[]): {
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
  output: "json" | "pretty";
  /** True when the user set JSON output via --json or an explicit --output/--format json (not the CLI default). */
  explicitJsonOutput: boolean;
  verbose: boolean;
  rest: string[];
} {
  const rest: string[] = [];
  let deviceId: string | undefined;
  let operatorPackage: string | undefined;
  let timeoutMs: number | undefined;
  let logLevel: "debug" | "info" | "warn" | "error" | undefined;
  let output: "json" | "pretty" = "json";
  let explicitJsonOutput = false;
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--") {
      // Stop scanning for global flags. Push `--` and all remaining tokens to `rest` verbatim so
      // callers like `skills run` can forward them to subprocess scripts.
      rest.push(...argv.slice(i));
      break;
    } else if (argv[i] === "--device" && argv[i + 1]) {
      deviceId = argv[++i];
    } else if (argv[i] === "--device-id" && argv[i + 1]) {
      // legacy alias
      deviceId = argv[++i];
    } else if (argv[i] === "--operator-package") {
      const value = argv[i + 1];
      if (value === undefined || value.trim().length === 0 || value.startsWith("-")) {
        throw new UsageError("--operator-package requires a value");
      }
      operatorPackage = value;
      i++;
    } else if (argv[i] === "--receiver-package") {
      const value = argv[i + 1];
      if (value === undefined || value.trim().length === 0 || value.startsWith("-")) {
        throw new UsageError("--receiver-package requires a value");
      }
      // legacy alias
      operatorPackage = value;
      i++;
    } else if (argv[i] === "--json") {
      // json is explicit
      output = "json";
      explicitJsonOutput = true;
    } else if ((argv[i] === "--output" || argv[i] === "--format") && argv[i + 1]) {
      const next = argv[++i];
      output = next === "pretty" ? "pretty" : "json";
      if (next === "json") {
        explicitJsonOutput = true;
      }
    } else if (argv[i] === "--timeout") {
      if (!argv[i + 1]) {
        throw new UsageError("--timeout requires a value");
      }
      timeoutMs = Number(argv[++i]);
    } else if (argv[i] === "--timeout-ms") {
      if (!argv[i + 1]) {
        throw new UsageError("--timeout-ms requires a value");
      }
      timeoutMs = Number(argv[++i]);
    } else if (argv[i] === "--log-level") {
      if (!argv[i + 1]) {
        throw new UsageError("--log-level requires a value");
      }
      const value = argv[++i].toLowerCase();
      if (value === "debug" || value === "info" || value === "warn" || value === "error") {
        logLevel = value;
      } else {
        throw new UsageError("--log-level must be one of: debug, info, warn, error");
      }
    } else if (argv[i] === "--verbose") {
      verbose = true;
    } else {
      rest.push(argv[i]);
    }
  }
  return { deviceId, operatorPackage, timeoutMs, logLevel, output, explicitJsonOutput, verbose, rest };
}

/** Tokens after the first `--` are forwarded verbatim (e.g. to skill scripts); exclude them from global meta-flag detection. */
function argvPrefixBeforeForwardSeparator(argv: string[]): string[] {
  const sep = argv.indexOf("--");
  return sep === -1 ? argv : argv.slice(0, sep);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help") {
    console.log(generateTopLevelHelp(COMMANDS));
    process.exit(0);
  }
  const argvForGlobalMeta = argvPrefixBeforeForwardSeparator(argv);
  if (argvForGlobalMeta.includes("--version")) {
    const pkg = require("../../package.json") as { version?: string };
    console.log(pkg.version ?? "0.1.0");
    process.exit(0);
  }

  let global: ReturnType<typeof getGlobalOpts>;
  try {
    global = getGlobalOpts(argv);
  } catch (error) {
    if (error instanceof UsageError) {
      console.log(JSON.stringify({ code: "USAGE", message: error.message }));
      process.exit(1);
    }
    throw error;
  }
  if (argvForGlobalMeta.includes("--help")) {
    console.log(resolveHelpFromRegistry(global.rest, COMMANDS));
    process.exit(0);
  }
  const [cmd, ...rest] = global.rest;
  if (cmd === undefined) {
    // All argv tokens were consumed as global flags; no command was given. Exit 0
    // (informational, not a caller error) so agent loops don't treat this as a failure.
    console.log(JSON.stringify({ code: "USAGE", message: "Use --help for available commands." }));
    process.exit(0);
  }
  const out = { format: global.output as "json" | "pretty", verbose: global.verbose };
  const logger = createClawperatorLogger({
    logDir: process.env.CLAWPERATOR_LOG_DIR,
    logLevel: global.logLevel ?? process.env.CLAWPERATOR_LOG_LEVEL,
    outputFormat: global.output,
  });

  let result: string | undefined;
  let usageParseError = false;

  try {
    if (!cmd) {
      // cmd is "" (explicit empty-string argument). The undefined case is handled
      // by the early guard above; this branch exists only for that edge case.
      result = JSON.stringify({ code: "USAGE", message: "Use --help for available commands." });
    } else {
      const def = COMMANDS[cmd] ?? Object.values(COMMANDS).find((c) => c.synonyms?.includes(cmd));
      if (def) {
        const globalFlags = [
          "--device", "--device-id", "--operator-package", "--receiver-package",
          "--json", "--output", "--format", "--log-level", "--timeout", "--timeout-ms",
          "--verbose", "--help", "--version"
        ];
        const localFlags = resolveSupportedFlagsFromRegistry(def, rest);
        const knownFlags = new Set([...localFlags, ...globalFlags]);

        let firstUnknownFlag: string | undefined;
        // Don't flag-check after `--` (forwarded args)
        const restBeforeForward = argvPrefixBeforeForwardSeparator(rest);
        const allowsLeadingPositional = COMMANDS_ALLOW_LEADING_POSITIONAL.has(def.name);
        let consumedPositional = false;
        for (let i = 0; i < restBeforeForward.length; i += 1) {
          const arg = restBeforeForward[i];
          if (arg === "--") {
            break;
          }
          if (cmd === "exec" && rest[0] !== "best-effort" && arg === "--goal") {
            firstUnknownFlag = arg;
            break;
          }
          const valueArity = FLAG_VALUE_ARITY.get(arg);
          if (valueArity !== undefined) {
            i += valueArity;
            continue;
          }
          if (arg.startsWith("--")) {
            if (!knownFlags.has(arg) && allowsLeadingPositional && !consumedPositional) {
              const nextArg = restBeforeForward[i + 1];
              if (nextArg !== undefined && !nextArg.startsWith("--")) {
                firstUnknownFlag = arg;
                break;
              }
              consumedPositional = true;
              continue;
            }
            if (!knownFlags.has(arg)) {
              firstUnknownFlag = arg;
              break;
            }
            continue;
          }
          consumedPositional = true;
        }

        if (firstUnknownFlag) {
          let bestMatch: string | undefined;
          let bestScore = 0;
          for (const flag of knownFlags) {
            const score = similarityRatio(firstUnknownFlag, flag);
            if (score > bestScore) {
              bestScore = score;
              bestMatch = flag;
            }
          }
          if (bestMatch && bestScore > 0.75) {
            result = JSON.stringify({ code: "USAGE", message: `unrecognized flag '${firstUnknownFlag}'. Did you mean '${bestMatch}'?` });
            usageParseError = true;
          } else {
            result = JSON.stringify({ code: "USAGE", message: `unrecognized flag '${firstUnknownFlag}'` });
            usageParseError = true;
          }
        } else {
          const ctx: HandlerContext = {
            argv,
            rest,
            format: out.format,
            explicitJsonOutput: global.explicitJsonOutput,
            verbose: out.verbose,
            logger,
            deviceId: global.deviceId,
            operatorPackage: global.operatorPackage,
            timeoutMs: global.timeoutMs,
          };
          const handlerResult = await def.handler(ctx);
          if (handlerResult !== undefined) {
            result = handlerResult;
          }
        }
      } else {
        result = didYouMean(cmd, rest, COMMANDS);
      }
    }
  } catch (error) {
    if (error instanceof UsageError) {
      usageParseError = true;
      result = JSON.stringify({ code: "USAGE", message: (error as Error).message });
    } else {
      throw error;
    }
  }

  if (result !== undefined) {
    console.log(result);
  }
  if (typeof result === "string" && shouldCliStdoutForceExitCode1(result, usageParseError)) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ code: "UNKNOWN", message: String(e) }));
  process.exit(1);
});
