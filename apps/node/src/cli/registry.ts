import { ERROR_CODES } from "../contracts/errors.js";
import { formatError } from "./output.js";
import type { Logger } from "../adapters/logger.js";

// ---------------------------------------------------------------------------
// Exported utilities (moved from index.ts so registry handlers can use them)
// ---------------------------------------------------------------------------

export class UsageError extends Error {}

export function getOpt(rest: string[], flag: string): string | undefined {
  const i = rest.indexOf(flag);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : undefined;
}

export function getStringOpt(rest: string[], flag: string): string | undefined {
  const i = rest.indexOf(flag);
  if (i < 0) {
    return undefined;
  }
  if (!rest[i + 1]) {
    throw new UsageError(`${flag} requires a value`);
  }
  return rest[i + 1];
}

export function getNumberOpt(rest: string[], flag: string): number | undefined {
  const i = rest.indexOf(flag);
  if (i < 0) {
    return undefined;
  }
  if (!rest[i + 1]) {
    throw new UsageError(`${flag} requires a value`);
  }
  return Number(rest[i + 1]);
}

export function hasFlag(rest: string[], flag: string): boolean {
  return rest.includes(flag);
}

export function getCommandArgs(argv: string[], commandPath: string[]): string[] | undefined {
  for (let i = 0; i <= argv.length - commandPath.length; i++) {
    let matches = true;
    for (let j = 0; j < commandPath.length; j++) {
      if (argv[i + j] !== commandPath[j]) {
        matches = false;
        break;
      }
    }
    if (matches) {
      return argv.slice(i + commandPath.length);
    }
  }
  return undefined;
}

export function getInvalidTimeoutResult(timeoutMs: number | undefined, options: { format: "json" | "pretty" }): string | undefined {
  if (timeoutMs !== undefined && !Number.isFinite(timeoutMs)) {
    return formatError(
      {
        code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
        message: "timeoutMs must be a finite number",
      },
      options
    );
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HandlerContext = {
  argv: string[];
  rest: string[];
  format: "json" | "pretty";
  verbose: boolean;
  logger: Logger;
  deviceId?: string;
  receiverPackage?: string;
  timeoutMs?: number;
};

export interface CommandDef {
  name: string;
  synonyms?: string[];
  summary: string;
  help: string;
  subtopics?: Record<string, string>;
  topLevelBlock?: string;
  group: string;
  handler: (ctx: HandlerContext) => Promise<string | void>;
}

// ---------------------------------------------------------------------------
// Help text constants (verbatim from original index.ts)
// ---------------------------------------------------------------------------

const HELP_OPERATOR_SETUP = `clawperator operator setup

Usage:
  clawperator operator setup --apk <path> [--device <id>] [--operator-package <pkg>] [--json]

Required:
  --apk <path>              Local filesystem path to the Operator APK file

Optional:
  --device <id>            Target Android device serial (required when multiple devices are connected)
  --operator-package <pkg>  Operator package identifier (required when both release and debug variants are installed)

Notes:
  - This is the canonical setup command for the Clawperator Operator APK.
  - Runs three phases in order: install, permission grant, verification.
  - Install phase: copies the APK onto the device via adb.
  - Permission grant phase: enables the accessibility service and notification listener.
  - Verification phase: confirms the package is visible to the package manager.
  - Fails with a structured error if any phase fails. The error code identifies which phase failed.
  - If omitted, setup auto-detects the package only when exactly one known Operator variant is installed.
  - If both release and debug variants are installed, pass --operator-package explicitly.
  - Do not use raw adb install for normal setup. It leaves the device in a partial state without required permissions.
  - operator install remains a compatibility alias for operator setup.
  - Use clawperator grant-device-permissions only after the Operator APK crashes and Android revokes permissions.
`;

const HELP_SNAPSHOT = `clawperator snapshot

Usage:
  clawperator snapshot [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json] [--verbose]

Notes:
  - Captures a UI snapshot via the canonical execution path.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
  - --timeout overrides the execution timeout within policy limits.
`;

const HELP_SCREENSHOT = `clawperator screenshot

Usage:
  clawperator screenshot [--device <id>] [--operator-package <pkg>] [--path <file>] [--timeout <ms>] [--json] [--verbose]

Notes:
  - Captures a PNG screenshot via the canonical execution path.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
  - --path writes the screenshot to the provided local filesystem path.
  - If --path is omitted, Clawperator writes to a generated temp file and returns that path in the result envelope.
  - --timeout overrides the execution timeout within policy limits.
`;

const HELP_CLICK = `clawperator click

Usage:
  clawperator click --selector <json> [--device <id>] [--operator-package <pkg>] [--json]

Required:
  --selector <json>         JSON selector object, e.g. '{"textEquals":"Login"}'

Notes:
  - Builds and runs a single click action via the execute path.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_OPEN = `clawperator open

Usage:
  clawperator open <target> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator open --app <package-id> [--device <id>] [--operator-package <pkg>]
  clawperator open --uri <uri> [--device <id>] [--operator-package <pkg>]

Notes:
  - Target is auto-detected: https?:// -> open_uri, <scheme>:// -> open_uri, otherwise -> open_app.
  - --app forces package name interpretation.
  - --uri forces URI/URL interpretation.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_TYPE = `clawperator type

Usage:
  clawperator type <text> --selector <json> [--submit] [--clear] [--device <id>] [--operator-package <pkg>] [--json]
  clawperator type --text <value> --selector <json> [--submit] [--clear] [--device <id>] [--operator-package <pkg>]

Notes:
  - Builds and runs a single enter_text action via the execute path.
  - --submit sends Enter/Return after typing.
  - --clear clears the field before typing.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_READ = `clawperator read

Usage:
  clawperator read --selector <json> [--device <id>] [--operator-package <pkg>] [--json]

Required:
  --selector <json>         JSON selector object, e.g. '{"resourceId":"android:id/title"}'

Notes:
  - Builds and runs a single read_text action via the execute path.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_WAIT = `clawperator wait

Usage:
  clawperator wait --selector <json> [--device <id>] [--operator-package <pkg>] [--json]

Required:
  --selector <json>         JSON selector object, e.g. '{"textContains":"Loading"}'

Notes:
  - Builds and runs a single wait_for_node action via the execute path.
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_PRESS = `clawperator press

Usage:
  clawperator press <key> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator press --key <key> [--device <id>] [--operator-package <pkg>]

Notes:
  - Builds and runs a single press_key action via the execute path.
  - Valid keys: back, home, recents
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_BACK = `clawperator back

Usage:
  clawperator back [--device <id>] [--operator-package <pkg>] [--json]

Notes:
  - Presses the Android back key. Equivalent to: clawperator press back
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_SCROLL = `clawperator scroll

Usage:
  clawperator scroll <direction> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator scroll --direction <direction> [--device <id>] [--operator-package <pkg>]

Notes:
  - Builds and runs a single scroll action via the execute path.
  - Valid directions: down, up, left, right
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
`;

const HELP_SKILLS_INSTALL = `clawperator skills install

Usage:
  clawperator skills install [--json]

Notes:
  - Clones the skills repository to ~/.clawperator/skills/
  - On success, set:
      export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
  - If the skills repository requires authentication, install may fail until credentials are configured.
`;

const HELP_SKILLS_SYNC = `clawperator skills sync

Usage:
  clawperator skills sync --ref <git-ref> [--json]

Notes:
  - Fetches or clones ~/.clawperator/skills/ and pins the local registry to the requested git ref.
  - Requires git access to the configured skills repository.
  - Registry path after sync:
      $HOME/.clawperator/skills/skills/skills-registry.json
`;

const HELP_SKILLS_NEW = `clawperator skills new

Usage:
  clawperator skills new <skill_id> [--summary <text>] [--json]

Notes:
  - Scaffolds a new local skill in the currently configured skills registry repo.
  - Derives applicationId and intent by splitting <skill_id> on the final dot.
  - Creates: SKILL.md, skill.json, scripts/run.js, and scripts/run.sh
  - --summary overrides the default TODO summary written to skill.json and SKILL.md.
  - Updates the configured registry JSON so the new skill appears in skills list.
`;

const HELP_SKILLS_VALIDATE = `clawperator skills validate

Usage:
  clawperator skills validate <skill_id> [--dry-run] [--json]
  clawperator skills validate --all [--dry-run] [--json]

Notes:
  - Use <skill_id> to validate one skill, or --all to validate every registry entry in one pass.
  - Verifies that the registry entry exists for the requested skill.
  - Checks that skill.json, SKILL.md, script files, and artifact files exist on disk.
  - Confirms that the parsed skill.json metadata matches the registry entry.
  - This is an integrity check, not a live device test.
  - --dry-run extends the check to compiled artifact payloads for artifact-backed skills by parsing each artifact JSON and validating it against the execution schema.
  - Script-only skills skip payload validation during --dry-run because their payload is generated at runtime by the skill script.
`;

const HELP_SKILLS_COMPILE_ARTIFACT = `clawperator skills compile-artifact

Usage:
  clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>] [--json]
  clawperator skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>] [--json]

Notes:
  - Compiles a deterministic skill artifact into a validated execution payload.
  - Use either the positional <skill_id> or --skill-id <id>.
  - --artifact accepts either the bare artifact name or the full .recipe.json filename.
  - --vars must be a JSON object string used for template substitution.
  - Compile failure usually means a missing artifact, missing required vars, or an invalid execution shape.
  - Use clawperator execute --validate-only for an extra contract-only check before a live device run.
`;

const HELP_SKILLS_RUN = `clawperator skills run

Usage:
  clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [-- <extra_args>]

Notes:
  - Runs the selected skill script through the local skill wrapper.
  - Use --device explicitly when more than one Android device is connected.
  - --operator-package sets the Operator package for this skill run (default: com.clawperator.operator).
    Use com.clawperator.operator.dev for local debug APKs.
  - --timeout overrides the wrapper timeout for this run only.
  - --expect-contains turns the run into a lightweight output assertion.
  - If the assertion text is missing, the wrapper fails with SKILL_OUTPUT_ASSERTION_FAILED.
  - By default, the wrapper performs a pre-run dry-run validation gate before starting the skill script.
  - --skip-validate bypasses that gate for CI or development escape hatches only.
  - Arguments after -- are forwarded to the underlying skill script unchanged.
  - Environment variables CLAWPERATOR_BIN and CLAWPERATOR_RECEIVER_PACKAGE are injected into the skill script.
  - This wrapper does not replace live validation of screenshots, artifacts, or app state.
`;

const HELP_DOCTOR = `clawperator doctor

Usage:
  clawperator doctor [--json] [--device <id>] [--operator-package <pkg>] [--verbose]
  clawperator doctor --fix
  clawperator doctor --full
  clawperator doctor --check-only

Notes:
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
  - Exit code 0 means all critical checks passed, including the warning-only multi-device ambiguity case.
  - Exit code 1 means a genuine failure such as no device, APK not installed, or handshake failure.
  - If handshake times out, rerun with --verbose and compare the installed APK package with --operator-package.
`;

const HELP_VERSION = `clawperator version

Usage:
  clawperator version
  clawperator version --check-compat [--device <id>] [--operator-package <pkg>] [--json]

  Notes:
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
  - --check-compat compares the CLI version with the installed APK version on the device.
`;

const HELP_GRANT_DEVICE_PERMISSIONS = `clawperator grant-device-permissions

Usage:
  clawperator grant-device-permissions [--device <id>] [--operator-package <pkg>] [--json]

Notes:
  - Default receiver package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs.
  - Grants accessibility, notification posting, and notification listener permissions via adb.
  - This command is for crash recovery only. Use it when the Operator APK crashes and Android revokes permissions.
  - For normal setup, always use clawperator operator setup instead.
`;

const HELP_EMULATOR = `clawperator emulator

Usage:
  clawperator emulator list [--json]
  clawperator emulator inspect <name> [--json]
  clawperator emulator create [--name <name>] [--json]
  clawperator emulator start <name> [--json]
  clawperator emulator stop <name> [--json]
  clawperator emulator delete <name> [--json]
  clawperator emulator status [--json]
  clawperator emulator provision [--json]
  clawperator provision emulator [--json]

Notes:
  - Emulator provisioning prefers: running supported emulator, stopped supported AVD, then new AVD creation.
  - New AVDs target Android API 35 and a Google Play image by default.
  - JSON is the canonical output format for agent callers.
`;

// ---------------------------------------------------------------------------
// COMMANDS registry
// ---------------------------------------------------------------------------

export const COMMANDS: Record<string, CommandDef> = {};

// operator
COMMANDS["operator"] = {
  name: "operator",
  group: "Device Setup",
  summary: "Install the Operator APK and configure the device",
  help: HELP_OPERATOR_SETUP,
  subtopics: {
    setup: HELP_OPERATOR_SETUP,
    install: HELP_OPERATOR_SETUP,
  },
  topLevelBlock: `  operator setup --apk <path> [--device <id>] [--operator-package <pkg>]
                                            Install the Operator APK, grant required permissions, and verify readiness`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const sub = rest[0];
    if (sub === "setup" || sub === "install") {
      const apkPath = getOpt(rest, "--apk");
      if (!apkPath) {
        return JSON.stringify({ code: "USAGE", message: `operator ${sub ?? "setup"} requires --apk <path>. Use clawperator operator setup --help for details.` });
      } else {
        return (await import("./commands/operatorSetup.js")).cmdOperatorSetup({
          ...out,
          apkPath,
          deviceId,
          receiverPackage,
        });
      }
    } else {
      return JSON.stringify({
        code: "USAGE",
        message: sub
          ? `Unknown operator subcommand '${sub}'. Use: clawperator operator setup --apk <path>`
          : "Use: clawperator operator setup --apk <path>",
      });
    }
  },
};

// setup
COMMANDS["setup"] = {
  name: "setup",
  group: "Device Setup",
  summary: "Alias guidance - use operator setup instead",
  help: HELP_OPERATOR_SETUP,
  handler: async (_ctx) => {
    return JSON.stringify({
      code: "USAGE",
      message: "clawperator setup is not a valid top-level command. Use: clawperator operator setup --apk <path>",
      canonical: "clawperator operator setup --apk <path> [--device <id>] [--operator-package <pkg>]",
    });
  },
};

// install
COMMANDS["install"] = {
  name: "install",
  group: "Device Setup",
  summary: "Alias guidance - use operator setup instead",
  help: HELP_OPERATOR_SETUP,
  handler: async (_ctx) => {
    return JSON.stringify({
      code: "USAGE",
      message: "clawperator install is not a valid command. Use: clawperator operator setup --apk <path>",
      canonical: "clawperator operator setup --apk <path> [--device <id>] [--operator-package <pkg>]",
    });
  },
};

// devices
COMMANDS["devices"] = {
  name: "devices",
  group: "Device Management",
  summary: "List connected Android devices",
  help: "clawperator devices\n\nUsage:\n  clawperator devices\n\nNotes:\n  - Lists all connected Android devices detected via adb.\n",
  topLevelBlock: `  devices                                   List connected Android devices`,
  handler: async (ctx) => {
    const { format, verbose, logger } = ctx;
    return (await import("./commands/devices.js")).cmdDevices({ format, verbose, logger });
  },
};

// emulator
COMMANDS["emulator"] = {
  name: "emulator",
  group: "Device Management",
  summary: "Manage Android emulators (AVDs)",
  help: HELP_EMULATOR,
  subtopics: {
    list: HELP_EMULATOR,
    inspect: HELP_EMULATOR,
    create: HELP_EMULATOR,
    start: HELP_EMULATOR,
    stop: HELP_EMULATOR,
    delete: HELP_EMULATOR,
    status: HELP_EMULATOR,
    provision: HELP_EMULATOR,
  },
  topLevelBlock: `  emulator list                             List configured Android emulators (AVDs)
  emulator inspect <name>                   Show normalized metadata for one AVD
  emulator create [--name <name>]           Create a supported Google Play AVD
  emulator start <name>                     Start an AVD and wait until Android is ready
  emulator stop <name>                      Stop a running emulator by AVD name
  emulator delete <name>                    Delete an AVD by name
  emulator status                           List running emulators and boot state
  emulator provision                        Reuse or create a supported emulator
  provision emulator                        Alias of emulator provision`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger } = ctx;
    const out = { format, verbose, logger };
    const sub = rest[0];
    if (sub === "list") {
      return (await import("./commands/emulator.js")).cmdEmulatorList(out);
    } else if (sub === "inspect") {
      return rest[1]
        ? (await import("./commands/emulator.js")).cmdEmulatorInspect(rest[1], out)
        : JSON.stringify({ code: "USAGE", message: "emulator inspect <name>" });
    } else if (sub === "create") {
      return (await import("./commands/emulator.js")).cmdEmulatorCreate({
        ...out,
        name: getOpt(rest, "--name"),
      });
    } else if (sub === "start") {
      return rest[1]
        ? (await import("./commands/emulator.js")).cmdEmulatorStart(rest[1], out)
        : JSON.stringify({ code: "USAGE", message: "emulator start <name>" });
    } else if (sub === "stop") {
      return rest[1]
        ? (await import("./commands/emulator.js")).cmdEmulatorStop(rest[1], out)
        : JSON.stringify({ code: "USAGE", message: "emulator stop <name>" });
    } else if (sub === "delete") {
      return rest[1]
        ? (await import("./commands/emulator.js")).cmdEmulatorDelete(rest[1], out)
        : JSON.stringify({ code: "USAGE", message: "emulator delete <name>" });
    } else if (sub === "status") {
      return (await import("./commands/emulator.js")).cmdEmulatorStatus(out);
    } else if (sub === "provision") {
      return (await import("./commands/emulator.js")).cmdProvisionEmulator(out);
    } else {
      return JSON.stringify({ code: "USAGE", message: "emulator list|inspect|create|start|stop|delete|status|provision" });
    }
  },
};

// provision
COMMANDS["provision"] = {
  name: "provision",
  group: "Device Management",
  summary: "Provision an Android emulator",
  help: HELP_EMULATOR,
  subtopics: {
    emulator: HELP_EMULATOR,
  },
  handler: async (ctx) => {
    const { rest, format, verbose, logger } = ctx;
    const out = { format, verbose, logger };
    if (rest[0] === "emulator") {
      return (await import("./commands/emulator.js")).cmdProvisionEmulator(out);
    } else {
      return JSON.stringify({ code: "USAGE", message: "provision emulator" });
    }
  },
};

// packages
COMMANDS["packages"] = {
  name: "packages",
  group: "Device Management",
  summary: "List installed packages on a device",
  help: "clawperator packages list\n\nUsage:\n  clawperator packages list [--device <id>] [--third-party]\n",
  topLevelBlock: `  packages list [--device <id>] [--third-party]
                                            List installed package IDs on a device`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId } = ctx;
    const out = { format, verbose, logger };
    if (rest[0] === "list") {
      return (await import("./commands/packages.js")).cmdPackagesList({
        ...out,
        deviceId,
        thirdParty: hasFlag(rest, "--third-party"),
      });
    } else {
      return JSON.stringify({ code: "USAGE", message: "packages list [--device <id>] [--third-party]" });
    }
  },
};

// execute
COMMANDS["execute"] = {
  name: "execute",
  group: "Execution",
  summary: "Execute a validated command payload",
  help: "clawperator execute\n\nUsage:\n  clawperator execute --execution <json-or-file> [--validate-only] [--dry-run] [--device <id>] [--operator-package <pkg>]\n  clawperator execute best-effort --goal <text> [--device <id>] [--operator-package <pkg>]\n",
  topLevelBlock: `  execute --execution <json-or-file> [--validate-only] [--dry-run] [--device <id>] [--operator-package <pkg>]
                                            Execute a validated command payload or print a dry-run plan
  execute best-effort --goal <text> [--device <id>] [--operator-package <pkg>]
                                            Produce deterministic next-action suggestion from current UI`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage, timeoutMs } = ctx;
    const out = { format, verbose, logger };
    if (rest[0] === "best-effort") {
      const goal = getOpt(rest, "--goal");
      return JSON.stringify({
        code: "NOT_IMPLEMENTED",
        message: "execute best-effort is Stage 1 limited; use snapshot + agent reasoning for now",
        goal,
      });
    } else {
      const execution = getOpt(rest, "--execution");
      if (!execution) {
        return JSON.stringify({ code: "USAGE", message: "execute requires --execution <json-or-file>" });
      } else {
        return (await import("./commands/execute.js")).cmdExecute({
          ...out,
          execution,
          deviceId,
          receiverPackage,
          timeoutMs,
          validateOnly: hasFlag(rest, "--validate-only"),
          dryRun: hasFlag(rest, "--dry-run"),
          logger,
        });
      }
    }
  },
};

// snapshot
COMMANDS["snapshot"] = {
  name: "snapshot",
  group: "Device Interaction",
  summary: "Capture UI snapshot from device",
  help: HELP_SNAPSHOT,
  topLevelBlock: `  snapshot [--device <id>] [--operator-package <pkg>]
                                            Capture current UI snapshot output`,
  handler: async (ctx) => {
    const { format, logger, deviceId, receiverPackage, timeoutMs } = ctx;
    return (await import("./commands/observe.js")).cmdObserveSnapshot({
      format,
      logger,
      deviceId,
      receiverPackage,
      timeoutMs,
    });
  },
};

// screenshot
COMMANDS["screenshot"] = {
  name: "screenshot",
  group: "Device Interaction",
  summary: "Capture PNG screenshot from device",
  help: HELP_SCREENSHOT,
  topLevelBlock: `  screenshot [--device <id>] [--operator-package <pkg>] [--path <file>]
                                            Capture current device screenshot (png)`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, receiverPackage, timeoutMs } = ctx;
    return (await import("./commands/observe.js")).cmdObserveScreenshot({
      format,
      logger,
      deviceId,
      receiverPackage,
      timeoutMs,
      path: getStringOpt(rest, "--path"),
    });
  },
};

// click (synonym: tap)
COMMANDS["click"] = {
  name: "click",
  synonyms: ["tap"],
  group: "Device Interaction",
  summary: "Run a single click action via execute path",
  help: HELP_CLICK,
  topLevelBlock: `  click --selector <json> [--device <id>] [--operator-package <pkg>]
                                            Build and run single click action via execute path`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const selector = getOpt(rest, "--selector");
    const runOpts = { deviceId, receiverPackage, logger };
    if (!selector) {
      return JSON.stringify({
        code: "MISSING_SELECTOR",
        message: "click requires a selector.\n\nUsage:\n  clawperator click --selector '{\"textEquals\":\"Login\"}'\n\nSee: clawperator click --help",
      });
    }
    return (await import("./commands/action.js")).cmdActionClick({ ...out, selector, ...runOpts });
  },
};

// open (synonyms: open-uri, open-url)
COMMANDS["open"] = {
  name: "open",
  synonyms: ["open-uri", "open-url"],
  group: "Device Interaction",
  summary: "Open a package, URL, or URI (auto-detected)",
  help: HELP_OPEN,
  topLevelBlock: `  open <target> [--device <id>] [--operator-package <pkg>]
                                            Open a package ID, URL, or URI (auto-detected)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    const positional = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
    const appFlag = getOpt(rest, "--app");
    const uriFlag = getOpt(rest, "--uri");
    if (positional && appFlag) {
      return JSON.stringify({ code: "USAGE", message: "Specify the target as a positional argument or --app, not both." });
    }
    if (positional && uriFlag) {
      return JSON.stringify({ code: "USAGE", message: "Specify the target as a positional argument or --uri, not both." });
    }
    if (appFlag && uriFlag) {
      return JSON.stringify({ code: "USAGE", message: "--app and --uri are mutually exclusive. Provide one or the other." });
    }
    const target = positional ?? appFlag ?? uriFlag;
    if (!target) {
      return JSON.stringify({
        code: "USAGE",
        message: "open requires a target.\n\nUsage:\n  clawperator open <package-id>\n  clawperator open <url>\n  clawperator open <uri>",
      });
    }
    // If --app or --uri was given explicitly, route accordingly
    if (appFlag) {
      return (await import("./commands/action.js")).cmdActionOpenApp({ ...out, applicationId: appFlag, ...runOpts });
    }
    if (uriFlag) {
      return (await import("./commands/action.js")).cmdActionOpenUri({ ...out, uri: uriFlag, ...runOpts });
    }
    // Auto-detect from positional target
    if (/^https?:\/\//.test(target) || target.includes("://")) {
      return (await import("./commands/action.js")).cmdActionOpenUri({ ...out, uri: target, ...runOpts });
    }
    return (await import("./commands/action.js")).cmdActionOpenApp({ ...out, applicationId: target, ...runOpts });
  },
};

// type (synonym: fill)
COMMANDS["type"] = {
  name: "type",
  synonyms: ["fill"],
  group: "Device Interaction",
  summary: "Run a single enter_text action via execute path",
  help: HELP_TYPE,
  topLevelBlock: `  type <text> --selector <json> [--submit] [--clear] [--device <id>] [--operator-package <pkg>]
                                            Build and run single enter_text action via execute path`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    const selector = getOpt(rest, "--selector");
    const positional = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
    const textFlag = getOpt(rest, "--text");
    if (positional && textFlag !== undefined) {
      return JSON.stringify({ code: "USAGE", message: "Specify the text as a positional argument or --text, not both." });
    }
    const text = positional ?? textFlag;
    if (!selector) {
      return JSON.stringify({
        code: "MISSING_SELECTOR",
        message: "type requires a selector.\n\nUsage:\n  clawperator type --selector <json> --text <value>\n\nSee: clawperator type --help",
      });
    }
    if (text === undefined) {
      return JSON.stringify({ code: "USAGE", message: "type requires --text <value> or a positional text argument.\n\nUsage:\n  clawperator type --selector <json> --text <value>" });
    }
    return (await import("./commands/action.js")).cmdActionType({
      ...out, selector, text,
      submit: hasFlag(rest, "--submit"),
      clear: hasFlag(rest, "--clear"),
      ...runOpts,
    });
  },
};

// read
COMMANDS["read"] = {
  name: "read",
  group: "Device Interaction",
  summary: "Run a single read_text action via execute path",
  help: HELP_READ,
  topLevelBlock: `  read --selector <json> [--device <id>] [--operator-package <pkg>]
                                            Build and run single read_text action via execute path`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    const selector = getOpt(rest, "--selector");
    if (!selector) {
      return JSON.stringify({
        code: "MISSING_SELECTOR",
        message: "read requires a selector.\n\nUsage:\n  clawperator read --selector <json>\n\nSee: clawperator read --help",
      });
    }
    return (await import("./commands/action.js")).cmdActionRead({ ...out, selector, ...runOpts });
  },
};

// wait
COMMANDS["wait"] = {
  name: "wait",
  group: "Device Interaction",
  summary: "Run a single wait_for_node action via execute path",
  help: HELP_WAIT,
  topLevelBlock: `  wait --selector <json> [--device <id>] [--operator-package <pkg>]
                                            Build and run single wait_for_node action via execute path`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    const selector = getOpt(rest, "--selector");
    if (!selector) {
      return JSON.stringify({
        code: "MISSING_SELECTOR",
        message: "wait requires a selector.\n\nUsage:\n  clawperator wait --selector <json>\n\nSee: clawperator wait --help",
      });
    }
    return (await import("./commands/action.js")).cmdActionWait({ ...out, selector, ...runOpts });
  },
};

// press (synonym: press-key)
COMMANDS["press"] = {
  name: "press",
  synonyms: ["press-key"],
  group: "Device Interaction",
  summary: "Run a single press_key action via execute path",
  help: HELP_PRESS,
  topLevelBlock: `  press <key> [--device <id>] [--operator-package <pkg>]
                                            Build and run single press_key action (back|home|recents)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    const positional = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
    const keyFlag = getOpt(rest, "--key");
    if (positional && keyFlag) {
      return JSON.stringify({ code: "USAGE", message: "Specify the key as a positional argument or --key, not both." });
    }
    const key = positional ?? keyFlag;
    if (!key) {
      return JSON.stringify({
        code: "USAGE",
        message: "press requires a key name.\n\nValid keys: back, home, recents\n\nExample:\n  clawperator press back",
      });
    }
    return (await import("./commands/action.js")).cmdActionPressKey({ ...out, key, ...runOpts });
  },
};

// back
COMMANDS["back"] = {
  name: "back",
  group: "Device Interaction",
  summary: "Press the Android back key",
  help: HELP_BACK,
  topLevelBlock: `  back [--device <id>] [--operator-package <pkg>]
                                            Press the Android back key`,
  handler: async (ctx) => {
    const { format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const runOpts = { deviceId, receiverPackage, logger };
    return (await import("./commands/action.js")).cmdActionPressKey({ ...out, key: "back", ...runOpts });
  },
};

// scroll
COMMANDS["scroll"] = {
  name: "scroll",
  group: "Device Interaction",
  summary: "Run a single scroll action via execute path",
  help: HELP_SCROLL,
  topLevelBlock: `  scroll <direction> [--device <id>] [--operator-package <pkg>]
                                            Build and run single scroll action (down|up|left|right)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage, timeoutMs } = ctx;
    const out = { format, verbose, logger };
    const positional = rest[0] && !rest[0].startsWith("--") ? rest[0] : undefined;
    const dirFlag = getOpt(rest, "--direction");
    if (positional && dirFlag) {
      return JSON.stringify({ code: "USAGE", message: "Specify the direction as a positional argument or --direction, not both." });
    }
    const direction = positional ?? dirFlag;
    if (!direction) {
      return JSON.stringify({
        code: "USAGE",
        message: "scroll requires a direction.\n\nValid directions: down, up, left, right\n\nExample:\n  clawperator scroll down",
      });
    }
    const validDirections = ["down", "up", "left", "right"];
    if (!validDirections.includes(direction)) {
      return JSON.stringify({
        code: "USAGE",
        message: `Invalid scroll direction "${direction}". Valid: down, up, left, right`,
      });
    }
    try {
      const { buildScrollExecution } = await import("../domain/actions/scroll.js");
      const { runExecution } = await import("../domain/executions/runExecution.js");
      const { formatSuccess, formatError } = await import("./output.js");
      const execution = buildScrollExecution(direction, timeoutMs);
      const result = await runExecution(execution, {
        deviceId,
        receiverPackage: receiverPackage ?? process.env.CLAWPERATOR_RECEIVER_PACKAGE,
        warn: message => process.stderr.write(message),
        logger,
      });
      if (result.ok) {
        return formatSuccess(
          {
            envelope: result.envelope,
            deviceId: result.deviceId,
            terminalSource: result.terminalSource,
            isCanonicalTerminal: result.terminalSource === "clawperator_result",
          },
          out
        );
      }
      return formatError(result.error, out);
    } catch (e) {
      const { formatError } = await import("./output.js");
      return formatError(e, out);
    }
  },
};


// skills
COMMANDS["skills"] = {
  name: "skills",
  group: "Skills",
  summary: "Manage and run automation skills",
  help: `clawperator skills

Usage:
  clawperator skills list
  clawperator skills get <skill_id>
  clawperator skills search --app <package_id> [--intent <intent>] [--keyword <text>]
  clawperator skills search <keyword>
  clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
  clawperator skills new <skill_id> [--summary <text>]
  clawperator skills validate <skill_id> [--dry-run]
  clawperator skills validate --all [--dry-run]
  clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [-- <extra_args>]
  clawperator skills install
  clawperator skills update [--ref <git-ref>]
  clawperator skills sync --ref <git-ref>
`,
  subtopics: {
    install: HELP_SKILLS_INSTALL,
    sync: HELP_SKILLS_SYNC,
    new: HELP_SKILLS_NEW,
    validate: HELP_SKILLS_VALIDATE,
    "compile-artifact": HELP_SKILLS_COMPILE_ARTIFACT,
    run: HELP_SKILLS_RUN,
  },
  topLevelBlock: `  skills list
                                            List available skills from local indexes/cache
  skills get <skill_id>
                                            Show skill metadata
  skills search --app <package_id> [--intent <intent>] [--keyword <text>]
  skills search <keyword>                   Search skills by app package, intent, or keyword
                                            (bare keyword is shorthand for --keyword)
  skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
  skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>]
                                            Compile from a skill artifact (skill: positional or --skill-id; artifact: climate-status or climate-status.recipe.json)
  skills new <skill_id> [--summary <text>]
                                            Scaffold a new local skill folder and registry entry
  skills validate <skill_id> [--dry-run]
  skills validate --all [--dry-run]
                                            Validate one local skill or the entire configured registry
  skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [-- <extra_args>]
                                            Invoke a skill script (convenience wrapper)
  skills install
                                            Clone skills repository to ~/.clawperator/skills/
  skills update [--ref <git-ref>]
                                            Pull latest skills (optionally pin to a ref)
  skills sync --ref <git-ref>
                                            Sync and pin skills index/cache to a git ref`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage, timeoutMs } = ctx;
    const out = { format, verbose, logger };
    if (rest[0] === "list") {
      return (await import("./commands/skills.js")).cmdSkillsList(out);
    } else if (rest[0] === "get") {
      return rest[1]
        ? (await import("./commands/skills.js")).cmdSkillsGet(rest[1], out)
        : JSON.stringify({ code: "USAGE", message: "skills get <skill_id>" });
    } else if (rest[0] === "search") {
      const app = getOpt(rest, "--app");
      const intent = getOpt(rest, "--intent");
      const positional = rest[1] && !rest[1].startsWith("--") ? rest[1] : undefined;
      const keyword = getOpt(rest, "--keyword") ?? positional;
      if (!app && !intent && !keyword) {
        return JSON.stringify({
          code: "USAGE",
          message: "skills search requires --app <package_id>, --intent <intent>, or --keyword <text>",
          example: "clawperator skills search --keyword solax",
        });
      } else {
        return (await import("./commands/skills.js")).cmdSkillsSearch({ app, intent, keyword }, out);
      }
    } else if (rest[0] === "compile-artifact") {
      const skillId = getOpt(rest, "--skill-id") ?? rest[1];
      const artifact = getOpt(rest, "--artifact");
      const vars = getOpt(rest, "--vars") ?? "{}";
      if (!skillId || !artifact) {
        return JSON.stringify({
          code: "USAGE",
          message:
            "skills compile-artifact requires <skill_id> (positional) or --skill-id <id>, and --artifact <name>. Example: skills compile-artifact com.example.skill --artifact climate-status [--vars '{}']",
        });
      } else {
        return (await import("./commands/skills.js")).cmdSkillsCompileArtifact(skillId, artifact, vars, out);
      }
    } else if (rest[0] === "new") {
      if (!rest[1]) {
        return JSON.stringify({ code: "USAGE", message: "skills new <skill_id> [--summary <text>]" });
      } else {
        const summary = getOpt(rest, "--summary");
        return (await import("./commands/skills.js")).cmdSkillsNew(rest[1], { ...out, summary });
      }
    } else if (rest[0] === "validate") {
      const dryRun = hasFlag(rest, "--dry-run");
      if (hasFlag(rest, "--all")) {
        return (await import("./commands/skills.js")).cmdSkillsValidateAll({ ...out, dryRun });
      } else if (!rest[1]) {
        return JSON.stringify({ code: "USAGE", message: "skills validate <skill_id> [--dry-run] | skills validate --all [--dry-run]" });
      } else {
        return (await import("./commands/skills.js")).cmdSkillsValidate(rest[1], { ...out, dryRun });
      }
    } else if (rest[0] === "run") {
      const skillId = rest[1];
      if (!skillId) {
        return JSON.stringify({ code: "USAGE", message: "skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [-- <extra_args>]" });
      } else {
        const dashDash = rest.indexOf("--");
        const optSegment = dashDash >= 0 ? rest.slice(0, dashDash) : rest;
        const scriptArgs: string[] = [];
        const effectiveTimeoutMs = timeoutMs;
        const invalidTimeoutResult = getInvalidTimeoutResult(effectiveTimeoutMs, { format });
        if (invalidTimeoutResult) {
          return invalidTimeoutResult;
        }
        const expectContains = getStringOpt(optSegment, "--expect-contains");
        const skipValidate = hasFlag(optSegment, "--skip-validate");
        if (deviceId) scriptArgs.push(deviceId);
        if (dashDash >= 0) {
          scriptArgs.push(...rest.slice(dashDash + 1));
        }
        return (await import("./commands/skills.js")).cmdSkillsRun(
          skillId,
          scriptArgs,
          effectiveTimeoutMs,
          expectContains,
          receiverPackage,
          { ...out, skipValidate, deviceId, logger }
        );
      }
    } else if (rest[0] === "install") {
      return (await import("./commands/skills.js")).cmdSkillsInstall(out);
    } else if (rest[0] === "update") {
      const ref = getOpt(rest, "--ref") ?? "main";
      return (await import("./commands/skills.js")).cmdSkillsUpdate(ref, out);
    } else if (rest[0] === "sync") {
      const ref = getOpt(rest, "--ref");
      return ref
        ? (await import("./commands/skills.js")).cmdSkillsSync(ref, out)
        : JSON.stringify({ code: "USAGE", message: "skills sync --ref <git-ref>" });
    } else {
      return JSON.stringify({ code: "USAGE", message: "skills list|get|search|compile-artifact|new|validate|run|install|update|sync ..." });
    }
  },
};

// recording
COMMANDS["recording"] = {
  name: "recording",
  synonyms: ["record"],
  group: "Recording",
  summary: "Manage recording sessions on the Operator app",
  help: "clawperator recording\n\nUsage:\n  clawperator recording start|stop|pull|parse ... ('record' is an alias)\n",
  topLevelBlock: `  recording start [--session-id <id>] [--device-id <serial>] [--operator-package <pkg>]
                                            Start a recording session on the Operator app ('record' is an alias)
  recording stop  [--session-id <id>] [--device-id <serial>] [--operator-package <pkg>]
                                            Stop the active recording session and finalize the on-device file ('record' is an alias)
  recording pull  [--session-id <id>] [--out <dir>] [--device-id <serial>]
                                            Pull the on-device NDJSON recording to host (default: ./recordings/, 'record' is an alias)
  recording parse --input <file> [--out <file>]
                                            Parse a raw NDJSON recording into a step log JSON ('record' is an alias)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const sub = rest[0];
    const runOpts = {
      deviceId,
      receiverPackage,
    };
    if (sub === "start") {
      return (await import("./commands/record.js")).cmdRecordStart({
        ...out,
        sessionId: getOpt(rest, "--session-id"),
        ...runOpts,
      });
    } else if (sub === "stop") {
      return (await import("./commands/record.js")).cmdRecordStop({
        ...out,
        sessionId: getOpt(rest, "--session-id"),
        ...runOpts,
      });
    } else if (sub === "pull") {
      const outputDirFlag = getStringOpt(rest, "--out");
      const outputDir = outputDirFlag ?? "./recordings/";
      return (await import("./commands/record.js")).cmdRecordPull({
        ...out,
        sessionId: getOpt(rest, "--session-id"),
        outputDir,
        ...runOpts,
      });
    } else if (sub === "parse") {
      const inputFile = getStringOpt(rest, "--input");
      if (!inputFile) {
        return JSON.stringify({ code: "USAGE", message: "recording parse --input <file> [--out <file>] ('record' is an alias)" });
      } else {
        const outputFileFlag = getStringOpt(rest, "--out");
        return (await import("./commands/record.js")).cmdRecordParse({
          ...out,
          inputFile,
          outputFile: outputFileFlag,
        });
      }
    } else {
      return JSON.stringify({ code: "USAGE", message: "recording start|stop|pull|parse ... ('record' is an alias)" });
    }
  },
};

// serve
COMMANDS["serve"] = {
  name: "serve",
  group: "Server",
  summary: "Start local HTTP/SSE server for remote control",
  help: "clawperator serve\n\nUsage:\n  clawperator serve [--port <number>] [--host <string>]\n\nNotes:\n  - Default host: 127.0.0.1\n",
  topLevelBlock: `  serve [--port <number>] [--host <string>]
                                            Start local HTTP/SSE server for remote control (default host: 127.0.0.1)`,
  handler: async (ctx) => {
    const { rest, verbose, logger } = ctx;
    const portStr = getOpt(rest, "--port");
    const port = portStr ? parseInt(portStr, 10) : 3000;
    const host = getOpt(rest, "--host") ?? "127.0.0.1";
    if (isNaN(port) || port <= 0 || port > 65535) {
      return JSON.stringify({ code: "USAGE", message: "Invalid port number. Must be 1-65535." });
    }
    await (await import("./commands/serve.js")).cmdServe({
      port,
      host,
      verbose,
      logger,
    });
    // Long-running: cmdServe never resolves in normal operation.
    // Return undefined so the dispatcher's `result !== undefined` guard
    // skips console.log, matching the old switch behavior.
    return undefined;
  },
};

// doctor
COMMANDS["doctor"] = {
  name: "doctor",
  group: "Diagnostics",
  summary: "Run environment and runtime checks",
  help: HELP_DOCTOR,
  topLevelBlock: `  doctor [--json]
                                            Run environment and runtime checks (Stage 3). --json/--format json is alias for --output json.
  doctor --fix
                                            Attempt non-destructive host fixes (Stage 3)
  doctor --full
                                            Full Android build + install + handshake + smoke (Stage 3)
  doctor --check-only
                                            Keep doctor non-blocking by always exiting 0 (for CI/automation)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    const isJson = hasFlag(rest, "--json") || format === "json";
    return (await import("./commands/doctor.js")).cmdDoctor({
      ...out,
      format: isJson ? "json" : "pretty",
      fix: hasFlag(rest, "--fix"),
      full: hasFlag(rest, "--full"),
      checkOnly: hasFlag(rest, "--check-only"),
      deviceId,
      receiverPackage,
      logger,
    });
  },
};

// grant-device-permissions
COMMANDS["grant-device-permissions"] = {
  name: "grant-device-permissions",
  group: "Diagnostics",
  summary: "Re-grant accessibility and notification permissions",
  help: HELP_GRANT_DEVICE_PERMISSIONS,
  topLevelBlock: `  grant-device-permissions [--device <id>] [--operator-package <pkg>]
                                            Re-grant accessibility and notification permissions (remediation only)`,
  handler: async (ctx) => {
    const { format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    return (await import("./commands/grantDevicePermissions.js")).cmdGrantDevicePermissions({
      ...out,
      deviceId,
      receiverPackage,
    });
  },
};

// version
COMMANDS["version"] = {
  name: "version",
  group: "Diagnostics",
  summary: "Show the CLI version",
  help: HELP_VERSION,
  topLevelBlock: `  version
                                            Show the CLI version
  version --check-compat [--device <id>] [--operator-package <pkg>]
                                            Compare the CLI version with the installed Operator APK version`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, receiverPackage } = ctx;
    const out = { format, verbose, logger };
    return (await import("./commands/version.js")).cmdVersion({
      ...out,
      checkCompat: hasFlag(rest, "--check-compat"),
      deviceId,
      receiverPackage,
    });
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

// Mapping table for removed compound commands -> new flat command names.
// Used by didYouMean to produce specific suggestions when users type old command forms.
const REMOVED_COMPOUND_COMMANDS: Record<string, Record<string, string>> = {
  action: {
    click: "click",
    "open-app": "open",
    "open-uri": "open",
    type: "type",
    read: "read",
    wait: "wait",
    "press-key": "press",
  },
  observe: {
    snapshot: "snapshot",
    screenshot: "screenshot",
  },
  inspect: {
    ui: "snapshot",
  },
};

export function didYouMean(cmd: string, rest: string[], commands: Record<string, CommandDef>): string {
  // Check for removed compound commands first (e.g. "action click", "observe snapshot")
  const compoundMap = REMOVED_COMPOUND_COMMANDS[cmd];
  if (compoundMap) {
    const sub = rest[0];
    const suggestion = sub ? compoundMap[sub] : undefined;
    if (suggestion) {
      return JSON.stringify({
        code: "UNKNOWN_COMMAND",
        message: `Unknown command '${cmd} ${sub}'. Use '${suggestion}' instead. See: clawperator ${suggestion} --help`,
        suggestion,
      });
    }
    // Known removed parent command but no matching subcommand - give general guidance
    const generalSuggestion =
      cmd === "observe" ? "snapshot" :
      cmd === "inspect" ? "snapshot" :
      "click";
    return JSON.stringify({
      code: "UNKNOWN_COMMAND",
      message: `Unknown command: ${cmd}. The '${cmd}' namespace has been removed. Use '${generalSuggestion}' or --help for available commands.`,
      suggestion: generalSuggestion,
    });
  }

  const threshold = Math.max(2, Math.floor(cmd.length / 2));
  // Collect all candidates within threshold distance, then sort deterministically:
  //   1. closest distance first
  //   2. primary name beats synonym at equal distance (more canonical suggestion)
  //   3. alphabetical within same tier (removes dependence on Object.values order)
  const candidates: { name: string; isPrimary: boolean; dist: number }[] = [];
  for (const def of Object.values(commands)) {
    const d = levenshtein(cmd, def.name);
    if (d <= threshold) candidates.push({ name: def.name, isPrimary: true, dist: d });
    for (const syn of def.synonyms ?? []) {
      const ds = levenshtein(cmd, syn);
      if (ds <= threshold) candidates.push({ name: syn, isPrimary: false, dist: ds });
    }
  }
  candidates.sort((a, b) =>
    a.dist !== b.dist ? a.dist - b.dist :
    a.isPrimary !== b.isPrimary ? (b.isPrimary ? 1 : -1) :
    a.name.localeCompare(b.name)
  );
  const bestMatch = candidates[0]?.name;
  if (bestMatch) {
    return JSON.stringify({
      code: "UNKNOWN_COMMAND",
      message: `Unknown command: ${cmd}. Did you mean '${bestMatch}'? Use --help for available commands.`,
      suggestion: bestMatch,
    });
  }
  return JSON.stringify({
    code: "UNKNOWN_COMMAND",
    message: `Unknown command: ${cmd}. Use --help for available commands.`,
  });
}

export function generateTopLevelHelp(commands: Record<string, CommandDef>): string {
  const lines: string[] = [
    "Clawperator CLI",
    "",
    "Usage:",
    "  clawperator <command> [options]",
    "",
    "Commands:",
  ];

  // Track which topLevelBlocks we have already emitted (by group, to avoid duplicates from provision/emulator)
  const emittedBlocks = new Set<string>();
  for (const def of Object.values(commands)) {
    if (def.topLevelBlock && !emittedBlocks.has(def.topLevelBlock)) {
      emittedBlocks.add(def.topLevelBlock);
      lines.push(def.topLevelBlock);
    }
  }

  lines.push(
    "",
    "Global options:",
    "  --device-id <id>, --device <id>           Target Android device serial",
    "  --receiver-package <package>, --operator-package <package>",
    "                                            Target Operator package for broadcast dispatch",
    "  --output <json|pretty>, --format <json|pretty>",
    "                                            Output format (default: json)",
    "  --log-level <debug|info|warn|error>       Persistent log level (default: info)",
    "  --timeout-ms <n>, --timeout <n>           Override execution timeout within policy limits",
    "  --verbose                                 Include debug diagnostics in output",
    "  --help                                    Show help",
    "  --version                                 Show version",
    "",
    "Notes:",
    "  - operator setup is the canonical setup command. operator install remains an alias.",
    "  - recording is the canonical command family; 'record' is a supported short alias.",
    "  - snapshot, screenshot, click, open, type, read, wait, press, back, scroll are flat top-level commands.",
    "  - The default receiver package is com.clawperator.operator. Use --operator-package com.clawperator.operator.dev for local debug builds.",
    "  - Terminal result semantics are driven by [Clawperator-Result].",
    ""
  );

  return lines.join("\n");
}

export function resolveHelpFromRegistry(rest: string[], commands: Record<string, CommandDef>): string {
  const nonFlagArgs = rest.filter((a) => !a.startsWith("--"));
  const rawCmd = nonFlagArgs[0];
  if (!rawCmd) {
    return generateTopLevelHelp(commands);
  }
  const def = commands[rawCmd] ?? Object.values(commands).find((c) => c.synonyms?.includes(rawCmd));
  if (!def) {
    return generateTopLevelHelp(commands);
  }
  if (def.subtopics && nonFlagArgs.length > 1) {
    const sub = nonFlagArgs[1];
    if (def.subtopics[sub]) {
      return def.subtopics[sub];
    } else {
      // Unknown subcommand - fall back to top-level help
      return generateTopLevelHelp(commands);
    }
  }
  return def.help;
}
