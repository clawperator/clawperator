#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
import { createLogger } from "../adapters/logger.js";
import {
  COMMANDS,
  UsageError,
  didYouMean,
  generateTopLevelHelp,
  resolveHelpFromRegistry,
  type HandlerContext,
} from "./registry.js";

function getGlobalOpts(argv: string[]): {
  deviceId?: string;
  operatorPackage?: string;
  timeoutMs?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
  output: "json" | "pretty";
  verbose: boolean;
  rest: string[];
} {
  const rest: string[] = [];
  let deviceId: string | undefined;
  let operatorPackage: string | undefined;
  let timeoutMs: number | undefined;
  let logLevel: "debug" | "info" | "warn" | "error" | undefined;
  let output: "json" | "pretty" = "json";
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--device-id" && argv[i + 1]) {
      deviceId = argv[++i];
    } else if (argv[i] === "--device" && argv[i + 1]) {
      // --device is the new canonical for --device-id (old name still works)
      deviceId = argv[++i];
    } else if (argv[i] === "--receiver-package") {
      const value = argv[i + 1];
      if (value === undefined || value.trim().length === 0 || value.startsWith("-")) {
        throw new UsageError("--receiver-package requires a value");
      }
      // --receiver-package is an alias for --operator-package (old name still works)
      operatorPackage = value;
      i++;
    } else if (argv[i] === "--operator-package") {
      const value = argv[i + 1];
      if (value === undefined || value.trim().length === 0 || value.startsWith("-")) {
        throw new UsageError("--operator-package requires a value");
      }
      operatorPackage = value;
      i++;
    } else if ((argv[i] === "--output" || argv[i] === "--format") && argv[i + 1]) {
      output = argv[++i] === "pretty" ? "pretty" : "json";
    } else if (argv[i] === "--json") {
      // --json sets output to json (new canonical shorthand)
      output = "json";
    } else if (argv[i] === "--timeout-ms") {
      if (!argv[i + 1]) {
        throw new UsageError("--timeout-ms requires a value");
      }
      timeoutMs = Number(argv[++i]);
    } else if (argv[i] === "--timeout") {
      // --timeout is the new canonical for --timeout-ms
      if (!argv[i + 1]) {
        throw new UsageError("--timeout requires a value");
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
  return { deviceId, operatorPackage, timeoutMs, logLevel, output, verbose, rest };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help") {
    console.log(generateTopLevelHelp(COMMANDS));
    process.exit(0);
  }
  if (argv.includes("--version")) {
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
  if (argv.includes("--help")) {
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
  const logger = createLogger({
    logDir: process.env.CLAWPERATOR_LOG_DIR,
    logLevel: global.logLevel ?? process.env.CLAWPERATOR_LOG_LEVEL,
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
        const ctx: HandlerContext = {
          argv,
          rest,
          format: out.format,
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
  if (typeof result === "string") {
    if (usageParseError) {
      process.exitCode = 1;
      return;
    }
    // Heuristic: bare { code, message } objects without "envelope" are error results.
    // All success shapes include "envelope" via formatSuccess; USAGE/NOT_IMPLEMENTED exit 0.
    // Invariant must be maintained: new success paths must include "envelope" in their output.
    if (result.startsWith("{") && result.includes('"code"') && !result.includes('"envelope"')) {
      try {
        const obj = JSON.parse(result) as { code?: string };
        if (obj.code && obj.code !== "USAGE" && obj.code !== "NOT_IMPLEMENTED") {
          process.exitCode = 1;
        }
      } catch {
        // Malformed JSON that passed the string heuristic - treat as non-error.
      }
    }
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ code: "UNKNOWN", message: String(e) }));
  process.exit(1);
});
