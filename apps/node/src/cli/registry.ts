import { ERROR_CODES } from "../contracts/errors.js";
import { formatError } from "./output.js";
import type { Logger } from "../adapters/logger.js";
import {
  resolveElementMatcherFromCli,
  resolveContainerMatcherFromCli,
  hasElementSelectorFlag,
  makeMissingSelectorError,
  ELEMENT_SELECTOR_VALUE_FLAGS,
  CONTAINER_SELECTOR_VALUE_FLAGS,
} from "./selectorFlags.js";

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

/**
 * Positional tokens that are not flags and not values paired with `valueFlags`.
 * Tokens in `booleanFlags` are skipped without consuming a following argument.
 */
export function barePositionalTokens(
  rest: string[],
  valueFlags: readonly string[],
  booleanFlags: readonly string[],
): string[] {
  const valueSet = new Set(valueFlags);
  const boolSet = new Set(booleanFlags);
  const out: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === undefined) continue;
    if (a.startsWith("-")) {
      if (valueSet.has(a)) {
        if (rest[i + 1] !== undefined && !rest[i + 1].startsWith("-")) {
          i += 1;
        }
        continue;
      }
      if (boolSet.has(a)) {
        continue;
      }
      continue;
    }
    out.push(a);
  }
  return out;
}

/**
 * Return a copy of rest with the given flag and its following value removed.
 * If the flag is not present, returns the original array.
 */
export function stripFlagWithValue(rest: string[], flag: string): string[] {
  const i = rest.indexOf(flag);
  if (i < 0) return rest;
  const next = rest[i + 1];
  if (next === undefined || next.startsWith("-")) return rest;
  return [...rest.slice(0, i), ...rest.slice(i + 2)];
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
  operatorPackage?: string;
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
  clawperator operator setup --apk <path> [--device <id>] [--operator-package <package>] [--output <json|pretty>]

Required:
  --apk <path>              Local filesystem path to the Operator APK file

Optional:
  --device <id>          Target Android device serial (required when multiple devices are connected)
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


const HELP_SKILLS_INSTALL = `clawperator skills install

Usage:
  clawperator skills install [--output <json|pretty>]

Notes:
  - Clones the skills repository to ~/.clawperator/skills/
  - On success, set:
      export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
  - If the skills repository requires authentication, install may fail until credentials are configured.
`;

const HELP_SKILLS_SYNC = `clawperator skills sync

Usage:
  clawperator skills sync --ref <git-ref> [--output <json|pretty>]

Notes:
  - Fetches or clones ~/.clawperator/skills/ and pins the local registry to the requested git ref.
  - Requires git access to the configured skills repository.
  - Registry path after sync:
      $HOME/.clawperator/skills/skills/skills-registry.json
`;

const HELP_SKILLS_NEW = `clawperator skills new

Usage:
  clawperator skills new <skill_id> [--summary <text>] [--output <json|pretty>]

Notes:
  - Scaffolds a new local skill in the currently configured skills registry repo.
  - Derives applicationId and intent by splitting <skill_id> on the final dot.
  - Creates: SKILL.md, skill.json, scripts/run.js, and scripts/run.sh
  - --summary overrides the default TODO summary written to skill.json and SKILL.md.
  - Updates the configured registry JSON so the new skill appears in skills list.
`;

const HELP_SKILLS_VALIDATE = `clawperator skills validate

Usage:
  clawperator skills validate <skill_id> [--dry-run] [--output <json|pretty>]
  clawperator skills validate --all [--dry-run] [--output <json|pretty>]

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
  clawperator skills compile-artifact <skill_id> --artifact <name> [--vars <json>] [--output <json|pretty>]
  clawperator skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>] [--output <json|pretty>]

Notes:
  - Compiles a deterministic skill artifact into a validated execution payload.
  - Use either the positional <skill_id> or --skill-id <id>.
  - --artifact accepts either the bare artifact name or the full .recipe.json filename.
  - --vars must be a JSON object string used for template substitution.
  - Compile failure usually means a missing artifact, missing required vars, or an invalid execution shape.
  - Use clawperator exec --validate-only for an extra contract-only check before a live device run.
`;

const HELP_SKILLS_RUN = `clawperator skills run

Usage:
  clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [--output <json|pretty>] [-- <extra_args>]

Notes:
  - Runs the selected skill script through the local skill wrapper.
  - Use --device explicitly when more than one Android device is connected.
  - --operator-package sets the Operator package for this skill run (default: com.clawperator.operator).
    Use com.clawperator.operator.dev for local debug APKs. --receiver-package is a legacy alias (see global options).
  - --json is canonical for JSON output here too (--output json and --format json are accepted; see global options).
  - --timeout overrides the wrapper timeout for this run only (--timeout-ms is accepted as an alias).
  - --expect-contains turns the run into a lightweight output assertion.
  - If the assertion text is missing, the wrapper fails with SKILL_OUTPUT_ASSERTION_FAILED.
  - By default, the wrapper performs a pre-run dry-run validation gate before starting the skill script.
  - --skip-validate bypasses that gate for CI or development escape hatches only.
  - Arguments after -- are forwarded to the underlying skill script unchanged.
  - Environment variables CLAWPERATOR_BIN and CLAWPERATOR_OPERATOR_PACKAGE are injected into the skill script.
  - This wrapper does not replace live validation of screenshots, artifacts, or app state.
`;

const HELP_DOCTOR = `clawperator doctor

Usage:
  clawperator doctor [--output <json|pretty>] [--device <id>] [--operator-package <package>] [--verbose]
  clawperator doctor --fix
  clawperator doctor --full
  clawperator doctor --check-only

Notes:
  - Default Operator package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs. --receiver-package is a legacy alias (see global options).
  - Exit code 0 means all critical checks passed, including the warning-only multi-device ambiguity case.
  - Exit code 1 means a genuine failure such as no device, APK not installed, or handshake failure.
  - If handshake times out, rerun with --verbose and compare the installed APK package with --operator-package.
`;

const HELP_VERSION = `clawperator version

Usage:
  clawperator version
  clawperator version --check-compat [--device <id>] [--operator-package <package>] [--output <json|pretty>]

  Notes:
  - Default Operator package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs. --receiver-package is a legacy alias (see global options).
  - --check-compat compares the CLI version with the installed APK version on the device.
`;

const HELP_GRANT_DEVICE_PERMISSIONS = `clawperator grant-device-permissions

Usage:
  clawperator grant-device-permissions [--device <id>] [--operator-package <package>] [--output <json|pretty>]

Notes:
  - Default Operator package: com.clawperator.operator
  - Use --operator-package com.clawperator.operator.dev for local debug APKs. --receiver-package is a legacy alias (see global options).
  - Grants accessibility, notification posting, and notification listener permissions via adb.
  - This command is for crash recovery only. Use it when the Operator APK crashes and Android revokes permissions.
  - For normal setup, always use clawperator operator setup instead.
`;

const HELP_SNAPSHOT = `clawperator snapshot

Usage:
  clawperator snapshot [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]

Notes:
  - Returns the current Android UI hierarchy as XML.
  - Output includes envelope, stepResults[0].actionType = "snapshot_ui", stepResults[0].data.text (XML).
  - --timeout overrides the default execution timeout (default: 30000 ms).
`;

const HELP_SCREENSHOT = `clawperator screenshot

Usage:
  clawperator screenshot [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--path <file>] [--json]

Notes:
  - Captures a screenshot from the connected device.
  - --path saves the PNG to the specified file path; if omitted, the image is base64-encoded in the output.
  - --timeout overrides the default execution timeout.
`;

const HELP_CLICK = `clawperator click

Usage:
  clawperator click --text <text> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator click --id <resource-id> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator click --role <role> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator click --desc <text> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator click --selector '<json>' [--device <id>] [--operator-package <pkg>] [--json]

Selector flags (at least one required; combine for AND matching):
  --text <text>           Exact visible text
  --text-contains <text>  Partial text match
  --id <resource-id>      Android resource ID
  --desc <text>           Exact content description
  --desc-contains <text>  Partial content description
  --role <role>           Element role (button, textfield, text, switch, checkbox, image, etc.)
  --selector <json>       Raw NodeMatcher JSON (advanced; mutually exclusive with simple flags)

Options:
  --long      Perform a long press (clickType: long_click)
  --focus     Set input focus without clicking (clickType: focus)

Notes:
  - Performs a tap on the first matching element.
  - Multiple simple flags combine with AND semantics.
  - --long and --focus are mutually exclusive.
  - Exits with MISSING_SELECTOR if no selector flag is provided.
  - Synonym: tap (accepted, not in help)

Examples:
  clawperator click --text "Wi-Fi"
  clawperator click --role button --text-contains "Submit"
  clawperator click --id "com.example:id/btn_ok"
  clawperator click --text "Settings" --long
  Advanced (raw NodeMatcher JSON): clawperator click --selector '{"textEquals":"Wi-Fi","role":"text"}'
`;

const HELP_OPEN = `clawperator open

Usage:
  clawperator open <package-id>        Open an Android app
  clawperator open <url>               Open a URL in the browser
  clawperator open <uri>               Open a deep link

Options:
  --app <target>       Same as a single positional target (package, URL, or URI)

Notes:
  - Target detection: if the value contains a URI scheme (*://), it uses open_uri; otherwise open_app.
  - --app does not force the app path: a URL or deep link passed with --app still opens as a URI.
  - Synonyms: open-uri, open-url (accepted, not in help)
`;

const HELP_TYPE = `clawperator type

Usage:
  clawperator type <text> --role <role> [--device <id>] [--operator-package <pkg>] [--submit] [--clear] [--json]
  clawperator type <text> --id <resource-id> [--device <id>] [--operator-package <pkg>] [--submit] [--clear] [--json]
  clawperator type <text> --desc <text> [--device <id>] [--operator-package <pkg>] [--submit] [--clear] [--json]
  clawperator type <text> --selector '<json>' [--device <id>] [--operator-package <pkg>] [--submit] [--clear] [--json]

Text to type:
  Positional argument or --text <text> (mutually exclusive; --text is reserved for text to type)

Selector flags (at least one required; combine for AND matching):
  --id <resource-id>      Android resource ID
  --desc <text>           Exact content description
  --desc-contains <text>  Partial content description
  --role <role>           Element role (button, textfield, text, switch, checkbox, image, etc.)
  --text-contains <text>  Partial text match
  --selector <json>       Raw NodeMatcher JSON (advanced; mutually exclusive with simple flags)

Options:
  --submit             Press Enter after typing
  --clear              No effect today (field is not cleared before typing on device)

Notes:
  - Types text into the first matching element.
  - --text is used for the text content to type, not the element selector.
    Use --id, --role, --desc, --text-contains, --desc-contains, or --selector (advanced) to identify the target.
  - Synonym: fill (accepted, not in help)

Examples:
  clawperator type "hello world" --role textfield
  clawperator type "search query" --id "com.example:id/search_box" --submit
  clawperator type --text "hello" --role textfield
  Advanced (raw NodeMatcher JSON): clawperator type "hi" --selector '{"resourceId":"com.example:id/search_box"}'
`;

const HELP_READ = `clawperator read

Usage:
  clawperator read --text <text> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator read --id <resource-id> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator read --role <role> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator read --desc <text> [--device <id>] [--operator-package <pkg>] [--json]
  clawperator read --selector '<json>' [--device <id>] [--operator-package <pkg>] [--json]

Selector flags (at least one required; combine for AND matching):
  --text <text>           Exact visible text
  --text-contains <text>  Partial text match
  --id <resource-id>      Android resource ID
  --desc <text>           Exact content description
  --desc-contains <text>  Partial content description
  --role <role>           Element role
  --selector <json>       Raw NodeMatcher JSON (advanced; mutually exclusive with simple flags)

Notes:
  - Returns the text content of the first matching element.
  - Multiple simple flags combine with AND semantics.

Examples:
  clawperator read --id "com.example:id/battery_level"
  clawperator read --text "Battery"
  clawperator read --role switch --desc "Wi-Fi"
  Advanced (raw NodeMatcher JSON): clawperator read --selector '{"resourceId":"com.example:id/status"}'
`;

const HELP_WAIT = `clawperator wait

Usage:
  clawperator wait --text <text> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator wait --id <resource-id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator wait --role <role> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator wait --desc <text> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator wait --selector '<json>' [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]

Selector flags (at least one required; combine for AND matching):
  --text <text>           Exact visible text
  --text-contains <text>  Partial text match
  --id <resource-id>      Android resource ID
  --desc <text>           Exact content description
  --desc-contains <text>  Partial content description
  --role <role>           Element role
  --selector <json>       Raw NodeMatcher JSON (advanced; mutually exclusive with simple flags)

Notes:
  - Waits until the first matching element appears.
  - --timeout overrides the default wait timeout.
  - Multiple simple flags combine with AND semantics.

Examples:
  clawperator wait --text "Done"
  clawperator wait --id "com.example:id/progress" --timeout 10000
  clawperator wait --role button --text-contains "OK"
  Advanced (raw NodeMatcher JSON): clawperator wait --selector '{"textEquals":"Done"}'
`;

const HELP_PRESS = `clawperator press

Usage:
  clawperator press <key> [--device <id>] [--operator-package <pkg>] [--json]

Valid keys:
  back       Navigate to previous screen
  home       Return to home screen
  recents    Open recent apps

Notes:
  - Key may be supplied as a positional argument or via --key <key>.
  - Synonym: press-key (accepted, not in help)
`;

const HELP_BACK = `clawperator back

Usage:
  clawperator back [--device <id>] [--operator-package <pkg>] [--json]

Notes:
  - Presses the Android back key. Equivalent to 'clawperator press back'.
`;

const HELP_CLOSE = `clawperator close

Usage:
  clawperator close <package> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator close --app <package> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]

Required:
  <package>             Android application package ID (e.g., com.android.settings)
  --app <package>       Alternative to positional argument

Synonym:
  close-app             Same as close

Notes:
  - Force-stops the specified application via adb.
  - The close_app action runs as a pre-flight in the Node layer before broadcast dispatch.
  - Requires the target app to be installed (does not need to be running).

Examples:
  clawperator close com.android.settings
  clawperator close com.google.android.apps.chromecast.app --json
  clawperator close-app com.android.settings
`;

const HELP_SCROLL = `clawperator scroll

Usage:
  clawperator scroll <direction> [--container-text <text>] [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator scroll <direction> [--container-id <resource-id>] [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]

Valid directions:
  down, up, left, right

Container selector flags (all optional; restrict scroll to a specific scrollable container):
  --container-text <text>           Container with exact visible text
  --container-text-contains <text>  Container with partial text match
  --container-id <resource-id>      Container by Android resource ID
  --container-desc <text>           Container by exact content description
  --container-desc-contains <text>  Container by partial content description
  --container-role <role>           Container by element role
  --container-selector <json>       Container by raw NodeMatcher JSON (mutually exclusive with --container-* flags)

Notes:
  - Direction may be supplied as a positional argument or via --direction <direction>.
  - --timeout overrides the default execution timeout (default: 30000 ms).
  - Without container flags, scrolls the default scrollable container on screen.

Examples:
  clawperator scroll down
  clawperator scroll up --container-id "com.example:id/list_view"
  clawperator scroll down --container-role list
`;

const HELP_SCROLL_UNTIL = `clawperator scroll-until

Usage:
  clawperator scroll-until [<direction>] --text <text> [--click] [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]
  clawperator scroll-until [<direction>] --id <resource-id> [--click] [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--json]

Valid directions:
  down, up, left, right (default: down)

Selector flags (one is required):
  --text <text>           Target element with exact visible text
  --text-contains <text>  Target element with partial text match
  --id <resource-id>      Target element by Android resource ID
  --desc <text>           Target element by exact content description
  --desc-contains <text>  Target element by partial content description
  --role <role>           Target element by element role
  --selector <json>       Target element by raw NodeMatcher JSON (mutually exclusive with simple flags)

Container selector flags (all optional; restrict scroll to a specific scrollable container):
  --container-text <text>           Container with exact visible text
  --container-text-contains <text>  Container with partial text match
  --container-id <resource-id>      Container by Android resource ID
  --container-desc <text>           Container by exact content description
  --container-desc-contains <text>  Container by partial content description
  --container-role <role>           Container by element role
  --container-selector <json>       Container by raw NodeMatcher JSON

Options:
  --click    Click the target element after scrolling to it (becomes scroll_and_click action)

Notes:
  - Synonym: scroll-and-click (implies --click)
  - Without --click, the action type is scroll_until (scroll until element is visible).
  - With --click, the action type is scroll_and_click (scroll until visible, then click).
  - Tuning parameters (maxScrolls, maxDurationMs, etc.) are not exposed as CLI flags.
    Use 'clawperator exec' with raw JSON for advanced tuning.

Examples:
  clawperator scroll-until --text "About phone"
  clawperator scroll-until --text "Living room" --click
  clawperator scroll-until up --text "Settings" --container-id "com.foo:id/list"
  clawperator scroll-and-click --text "Submit"  (same as scroll-until --text "Submit" --click)
`;

const HELP_EMULATOR = `clawperator emulator

Usage:
  clawperator emulator list [--output <json|pretty>]
  clawperator emulator inspect <name> [--output <json|pretty>]
  clawperator emulator create [--name <name>] [--output <json|pretty>]
  clawperator emulator start <name> [--output <json|pretty>]
  clawperator emulator stop <name> [--output <json|pretty>]
  clawperator emulator delete <name> [--output <json|pretty>]
  clawperator emulator status [--output <json|pretty>]
  clawperator emulator provision [--output <json|pretty>]
  clawperator provision emulator [--output <json|pretty>]

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
  topLevelBlock: `  operator setup --apk <path> [--device <id>] [--operator-package <package>]
                                            Install the Operator APK, grant required permissions, and verify readiness`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, operatorPackage } = ctx;
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
          operatorPackage,
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
      canonical: "clawperator operator setup --apk <path> [--device <id>] [--operator-package <package>]",
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
      canonical: "clawperator operator setup --apk <path> [--device <id>] [--operator-package <package>]",
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

// exec (synonym: execute)
COMMANDS["exec"] = {
  name: "exec",
  synonyms: ["execute"],
  group: "Execution",
  summary: "Execute a validated command payload",
  help: "clawperator exec\n\nUsage:\n  clawperator exec --execution <json-or-file> [--validate-only] [--dry-run] [--device <id>] [--operator-package <package>]\n  clawperator exec best-effort --goal <text> [--device <id>] [--operator-package <package>]\n\n`execute` is accepted as a synonym for `exec`.\n",
  topLevelBlock: `  exec --execution <json-or-file> [--validate-only] [--dry-run] [--device <id>] [--operator-package <package>]
                                            Execute a validated command payload or print a dry-run plan
  exec best-effort --goal <text> [--device <id>] [--operator-package <package>]
                                            Produce deterministic next-action suggestion from current UI`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, operatorPackage, timeoutMs } = ctx;
    const out = { format, verbose, logger };
    if (rest[0] === "best-effort") {
      const goal = getOpt(rest, "--goal");
      return JSON.stringify({
        code: "NOT_IMPLEMENTED",
        message: "exec best-effort is Stage 1 limited; use snapshot + agent reasoning for now",
        goal,
      });
    } else {
      const execution = getOpt(rest, "--execution");
      if (!execution) {
        return JSON.stringify({ code: "USAGE", message: "exec requires --execution <json-or-file>" });
      } else {
        return (await import("./commands/execute.js")).cmdExecute({
          ...out,
          execution,
          deviceId,
          operatorPackage,
          timeoutMs,
          validateOnly: hasFlag(rest, "--validate-only"),
          dryRun: hasFlag(rest, "--dry-run"),
          logger,
        });
      }
    }
  },
};

// Device Interaction commands

COMMANDS["snapshot"] = {
  name: "snapshot",
  group: "Device Interaction",
  summary: "Get current Android UI hierarchy as XML",
  help: HELP_SNAPSHOT,
  topLevelBlock: `  snapshot [--device <id>] [--json]            Get current Android UI hierarchy as XML`,
  handler: async (ctx) => {
    const { format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
    const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
    if (invalidTimeout) return invalidTimeout;
    return (await import("./commands/observe.js")).cmdObserveSnapshot({
      format,
      deviceId,
      operatorPackage,
      timeoutMs,
      logger,
    });
  },
};

COMMANDS["screenshot"] = {
  name: "screenshot",
  group: "Device Interaction",
  summary: "Capture a screenshot from the device",
  help: HELP_SCREENSHOT,
  topLevelBlock: `  screenshot [--device <id>] [--path <file>] [--json]
                                            Capture a screenshot from the device`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
    const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
    if (invalidTimeout) return invalidTimeout;
    const path = getStringOpt(rest, "--path");
    return (await import("./commands/observe.js")).cmdObserveScreenshot({
      format,
      deviceId,
      operatorPackage,
      timeoutMs,
      path,
      logger,
    });
  },
};

COMMANDS["click"] = {
  name: "click",
  synonyms: ["tap"],
  group: "Device Interaction",
  summary: "Tap the first matching UI element",
  help: HELP_CLICK,
  topLevelBlock: `  click --text <text> | --id <id> | --role <role> [--device <id>] [--json]
                                            Tap the first matching UI element`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage } = ctx;
    if (!hasElementSelectorFlag(rest)) {
      return makeMissingSelectorError("click");
    }
    const resolved = resolveElementMatcherFromCli(rest);
    if (!resolved.ok) {
      return formatError(resolved.error, { format });
    }

    // Check for --long and --focus flags (mutually exclusive)
    const hasLong = hasFlag(rest, "--long");
    const hasFocus = hasFlag(rest, "--focus");
    if (hasLong && hasFocus) {
      return JSON.stringify({
        code: "EXECUTION_VALIDATION_FAILED",
        message: "--long and --focus are mutually exclusive.\n\nUse --long for a long press, or --focus to set input focus.",
      });
    }
    let clickType: "default" | "long_click" | "focus" = "default";
    if (hasLong) clickType = "long_click";
    if (hasFocus) clickType = "focus";

    return (await import("./commands/action.js")).cmdActionClick({
      format,
      matcher: resolved.matcher,
      clickType,
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["open"] = {
  name: "open",
  synonyms: ["open-uri", "open-url"],
  group: "Device Interaction",
  summary: "Open an app, URL, or URI on the device",
  help: HELP_OPEN,
  topLevelBlock: `  open <package-id|url|uri> [--device <id>] [--json]
                                            Open an app, URL, or URI on the device`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage } = ctx;
    const appFlag = getOpt(rest, "--app");
    const bare = barePositionalTokens(rest, ["--app"], []);
    if (appFlag !== undefined && bare.length > 0) {
      return formatError(
        {
          code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
          message:
            "open: pass the target as a positional argument or via --app, not both.\n\nSee: clawperator open --help",
        },
        { format },
      );
    }
    const target = appFlag ?? bare[0];
    if (!target || target.trim().length === 0) {
      return JSON.stringify({
        code: "MISSING_ARGUMENT",
        message:
          "open requires a target.\n\nUsage:\n  clawperator open <package-id>       Open an Android app\n  clawperator open <url>              Open a URL in browser\n  clawperator open <uri>              Open a deep link\n\nExamples:\n  clawperator open com.android.settings\n  clawperator open https://example.com",
      });
    }
    if (isOpenCliUriTarget(target)) {
      return (await import("./commands/action.js")).cmdActionOpenUri({
        format,
        uri: target,
        deviceId,
        operatorPackage,
        logger,
      });
    }
    return (await import("./commands/action.js")).cmdActionOpenApp({
      format,
      applicationId: target,
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["type"] = {
  name: "type",
  synonyms: ["fill"],
  group: "Device Interaction",
  summary: "Type text into the first matching UI element",
  help: HELP_TYPE,
  topLevelBlock: `  type <text> --role <role> | --id <id> [--device <id>] [--json]
                                            Type text into the first matching UI element`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage } = ctx;
    // --text for type is the text-to-type, not an element selector.
    // Extract it first, then resolve the element selector from the remaining flags.
    const typeTextFlag = getOpt(rest, "--text");
    const allSelectorValueFlags = [...ELEMENT_SELECTOR_VALUE_FLAGS];
    const bare = barePositionalTokens(rest, allSelectorValueFlags, ["--submit", "--clear"]);
    if (typeTextFlag !== undefined && bare.length > 0) {
      return formatError(
        {
          code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
          message:
            "type: pass text as a positional argument or via --text, not both.\n\nSee: clawperator type --help",
        },
        { format },
      );
    }
    const typeText = typeTextFlag ?? bare[0];
    if (!typeText) {
      return JSON.stringify({
        code: "MISSING_ARGUMENT",
        message: "type requires text to type. Pass text as a positional argument or via --text <text>.",
      });
    }
    // Build rest-for-selector: strip --text <value> so it is not treated as textEquals
    const restForSelector = stripFlagWithValue(rest, "--text");
    // For type, the selector flags exclude --text (used for text-to-type above).
    // Check for any selector flag except --text in restForSelector.
    const TYPE_SELECTOR_FLAGS = ELEMENT_SELECTOR_VALUE_FLAGS.filter((f) => f !== "--text");
    if (!TYPE_SELECTOR_FLAGS.some((f) => restForSelector.includes(f))) {
      return JSON.stringify({
        code: "MISSING_SELECTOR",
        message: `type requires a selector.\nUse one of:\n  --id <resource-id>      Android resource ID\n  --desc <text>           Content description\n  --desc-contains <text>  Partial content description\n  --role <role>           Element role\n  --text-contains <text>  Partial text match\n  --selector <json>       Raw JSON (advanced)\nExample:\n  clawperator type "hello" --role textfield`,
      });
    }
    const resolved = resolveElementMatcherFromCli(restForSelector);
    if (!resolved.ok) {
      return formatError(resolved.error, { format });
    }
    return (await import("./commands/action.js")).cmdActionType({
      format,
      matcher: resolved.matcher,
      text: typeText,
      submit: hasFlag(rest, "--submit"),
      clear: hasFlag(rest, "--clear"),
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["read"] = {
  name: "read",
  group: "Device Interaction",
  summary: "Read text from the first matching UI element",
  help: HELP_READ,
  topLevelBlock: `  read --text <text> | --id <id> | --role <role> [--device <id>] [--json]
                                            Read text from the first matching UI element`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage } = ctx;
    if (!hasElementSelectorFlag(rest)) {
      return makeMissingSelectorError("read");
    }
    const resolved = resolveElementMatcherFromCli(rest);
    if (!resolved.ok) {
      return formatError(resolved.error, { format });
    }
    return (await import("./commands/action.js")).cmdActionRead({
      format,
      matcher: resolved.matcher,
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["wait"] = {
  name: "wait",
  group: "Device Interaction",
  summary: "Wait until a matching UI element appears",
  help: HELP_WAIT,
  topLevelBlock: `  wait --text <text> | --id <id> | --role <role> [--device <id>] [--timeout <ms>] [--json]
                                            Wait until a matching UI element appears`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
    const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
    if (invalidTimeout) return invalidTimeout;
    if (!hasElementSelectorFlag(rest)) {
      return makeMissingSelectorError("wait");
    }
    const resolved = resolveElementMatcherFromCli(rest);
    if (!resolved.ok) {
      return formatError(resolved.error, { format });
    }
    return (await import("./commands/action.js")).cmdActionWait({
      format,
      matcher: resolved.matcher,
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["press"] = {
  name: "press",
  synonyms: ["press-key"],
  group: "Device Interaction",
  summary: "Press a hardware key on the device",
  help: HELP_PRESS,
  topLevelBlock: `  press <back|home|recents> [--device <id>] [--json]
                                            Press a hardware key on the device`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage } = ctx;
    const keyFlag = getOpt(rest, "--key");
    const bare = barePositionalTokens(rest, ["--key"], []);
    if (keyFlag !== undefined && bare.length > 0) {
      return formatError(
        {
          code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
          message:
            "press: pass the key as a positional argument or via --key, not both.\n\nSee: clawperator press --help",
        },
        { format },
      );
    }
    const key = keyFlag ?? bare[0];
    if (!key) {
      return JSON.stringify({
        code: "MISSING_ARGUMENT",
        message: "press requires a key name.\n\nValid keys: back, home, recents\n\nExample:\n  clawperator press back",
      });
    }
    return (await import("./commands/action.js")).cmdActionPressKey({
      format,
      key,
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

COMMANDS["back"] = {
  name: "back",
  group: "Device Interaction",
  summary: "Press the Android back key",
  help: HELP_BACK,
  topLevelBlock: `  back [--device <id>] [--json]               Press the Android back key`,
  handler: async (ctx) => {
    const { format, logger, deviceId, operatorPackage } = ctx;
    return (await import("./commands/action.js")).cmdActionPressKey({
      format,
      key: "back",
      deviceId,
      operatorPackage,
      logger,
    });
  },
};

const closeHandler = async (ctx: HandlerContext): Promise<string | void> => {
  const { rest, format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
  const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
  if (invalidTimeout) return invalidTimeout;

  const appFlag = getOpt(rest, "--app");
  const bare = barePositionalTokens(rest, ["--app"], []);
  if (appFlag !== undefined && bare.length > 0) {
    return formatError(
      {
        code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
        message:
          "close: pass the package as a positional argument or via --app, not both.\n\nSee: clawperator close --help",
      },
      { format },
    );
  }
  const applicationId = appFlag ?? bare[0];
  if (!applicationId || applicationId.trim().length === 0) {
    return JSON.stringify({
      code: "MISSING_ARGUMENT",
      message:
        "close requires a package name.\n\nUsage:\n  clawperator close <package>\n  clawperator close --app <package>\n\nExamples:\n  clawperator close com.android.settings\n  clawperator close com.google.android.apps.chromecast.app --json",
    });
  }
  return (await import("./commands/action.js")).cmdCloseApp({
    format,
    applicationId,
    deviceId,
    operatorPackage,
    timeoutMs,
    logger,
  });
};

COMMANDS["close"] = {
  name: "close",
  synonyms: ["close-app"],
  group: "Device Interaction",
  summary: "Force-stop an Android application",
  help: HELP_CLOSE,
  topLevelBlock: `  close <package> [--device <id>] [--json]    Force-stop an Android application`,
  handler: async (ctx) => closeHandler(ctx),
};

COMMANDS["scroll"] = {
  name: "scroll",
  group: "Device Interaction",
  summary: "Scroll the screen in a direction",
  help: HELP_SCROLL,
  topLevelBlock: `  scroll <down|up|left|right> [--container-id <id>] [--device <id>] [--json]
                                            Scroll the screen in a direction`,
  handler: async (ctx) => {
    const { rest, format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
    const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
    if (invalidTimeout) return invalidTimeout;
    const scrollValueFlags = ["--direction", ...CONTAINER_SELECTOR_VALUE_FLAGS];
    const directionFlag = getOpt(rest, "--direction");
    const bare = barePositionalTokens(rest, scrollValueFlags, []);
    if (directionFlag !== undefined && bare.length > 0) {
      return formatError(
        {
          code: ERROR_CODES.EXECUTION_VALIDATION_FAILED,
          message:
            "scroll: pass direction as a positional argument or via --direction, not both.\n\nSee: clawperator scroll --help",
        },
        { format },
      );
    }
    const direction = directionFlag ?? bare[0];
    const validDirections = ["down", "up", "left", "right"];
    if (!direction || !validDirections.includes(direction)) {
      return JSON.stringify({
        code: "MISSING_ARGUMENT",
        message: `scroll requires a direction.\n\nValid directions: ${validDirections.join(", ")}\n\nExamples:\n  clawperator scroll down\n  clawperator scroll up`,
      });
    }
    const containerResolved = resolveContainerMatcherFromCli(rest);
    if (!containerResolved.ok) {
      return formatError(containerResolved.error, { format });
    }
    return (await import("./commands/action.js")).cmdScroll({
      format,
      direction,
      container: containerResolved.container,
      deviceId,
      operatorPackage,
      timeoutMs,
      logger,
    });
  },
};

// scroll-until (and synonym scroll-and-click)
const scrollUntilHandler = async (ctx: HandlerContext, clickAfterDefault: boolean): Promise<string | void> => {
  const { rest, format, logger, deviceId, operatorPackage, timeoutMs } = ctx;
  const invalidTimeout = getInvalidTimeoutResult(timeoutMs, { format });
  if (invalidTimeout) return invalidTimeout;

  // Check for selector flags
  if (!hasElementSelectorFlag(rest)) {
    return makeMissingSelectorError("scroll-until");
  }

  // Parse direction (positional or defaults to "down")
  const scrollUntilValueFlags = [...ELEMENT_SELECTOR_VALUE_FLAGS, ...CONTAINER_SELECTOR_VALUE_FLAGS, "--click"];
  const bare = barePositionalTokens(rest, scrollUntilValueFlags, []);
  const direction = bare[0] ?? "down";
  const validDirections = ["down", "up", "left", "right"];
  if (!validDirections.includes(direction)) {
    return JSON.stringify({
      code: "MISSING_ARGUMENT",
      message: `Invalid direction: ${direction}. Valid directions: ${validDirections.join(", ")}`,
    });
  }

  // Resolve element matcher
  const matcherResult = resolveElementMatcherFromCli(rest);
  if (!matcherResult.ok) {
    return formatError(matcherResult.error, { format });
  }

  // Resolve container matcher (optional)
  const containerResult = resolveContainerMatcherFromCli(rest);
  if (!containerResult.ok) {
    return formatError(containerResult.error, { format });
  }

  // Check for --click flag
  const clickAfter = clickAfterDefault || hasFlag(rest, "--click");

  return (await import("./commands/action.js")).cmdScrollUntil({
    format,
    direction,
    matcher: matcherResult.matcher,
    container: containerResult.container,
    clickAfter,
    deviceId,
    operatorPackage,
    timeoutMs,
    logger,
  });
};

COMMANDS["scroll-until"] = {
  name: "scroll-until",
  group: "Device Interaction",
  summary: "Scroll until a target element is visible",
  help: HELP_SCROLL_UNTIL,
  topLevelBlock: `  scroll-until [<direction>] --text <text> [--click] [--device <id>] [--json]
                                            Scroll until a target element is visible (optionally click it)`,
  handler: async (ctx) => scrollUntilHandler(ctx, false),
};

COMMANDS["scroll-and-click"] = {
  name: "scroll-and-click",
  synonyms: [],
  group: "Device Interaction",
  summary: "Scroll until target is visible, then click it (alias for scroll-until --click)",
  help: HELP_SCROLL_UNTIL,
  topLevelBlock: `  scroll-and-click [<direction>] --text <text> [--device <id>] [--json]
                                            Scroll until target is visible, then click it`,
  handler: async (ctx) => scrollUntilHandler(ctx, true),
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
  clawperator skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [--output <json|pretty>] [-- <extra_args>]
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
  skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [--output <json|pretty>] [-- <extra_args>]
                                            Invoke a skill script (convenience wrapper)
  skills install
                                            Clone skills repository to ~/.clawperator/skills/
  skills update [--ref <git-ref>]
                                            Pull latest skills (optionally pin to a ref)
  skills sync --ref <git-ref>
                                            Sync and pin skills index/cache to a git ref`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, operatorPackage, timeoutMs } = ctx;
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
        return JSON.stringify({
          code: "USAGE",
          message:
            "skills run <skill_id> [--device <id>] [--operator-package <pkg>] [--timeout <ms>] [--expect-contains <text>] [--skip-validate] [--json] [--output <json|pretty>] [-- <extra_args>]",
        });
      } else {
        const dashDash = rest.indexOf("--");
        const optSegment = dashDash >= 0 ? rest.slice(0, dashDash) : rest;
        const scriptArgs: string[] = [];
        const localTimeoutMs = getNumberOpt(optSegment, "--timeout-ms") ?? getNumberOpt(optSegment, "--timeout");
        const effectiveTimeoutMs = localTimeoutMs ?? timeoutMs;
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
          operatorPackage,
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
  topLevelBlock: `  recording start [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
                                            Start a recording session on the Operator app ('record' is an alias)
  recording stop  [--session-id <id>] [--device <serial>] [--operator-package <pkg>]
                                            Stop the active recording session and finalize the on-device file ('record' is an alias)
  recording pull  [--session-id <id>] [--out <dir>] [--device <serial>]
                                            Pull the on-device NDJSON recording to host (default: ./recordings/, 'record' is an alias)
  recording parse --input <file> [--out <file>]
                                            Parse a raw NDJSON recording into a step log JSON ('record' is an alias)`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, operatorPackage } = ctx;
    const out = { format, verbose, logger };
    const sub = rest[0];
    const runOpts = {
      deviceId,
      operatorPackage,
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
    const { rest, format, verbose, logger, deviceId, operatorPackage } = ctx;
    const out = { format, verbose, logger };
    const isJson = hasFlag(rest, "--json") || format === "json";
    return (await import("./commands/doctor.js")).cmdDoctor({
      ...out,
      format: isJson ? "json" : "pretty",
      fix: hasFlag(rest, "--fix"),
      full: hasFlag(rest, "--full"),
      checkOnly: hasFlag(rest, "--check-only"),
      deviceId,
      operatorPackage,
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
  topLevelBlock: `  grant-device-permissions [--device <id>] [--operator-package <package>]
                                            Re-grant accessibility and notification permissions (remediation only)`,
  handler: async (ctx) => {
    const { format, verbose, logger, deviceId, operatorPackage } = ctx;
    const out = { format, verbose, logger };
    return (await import("./commands/grantDevicePermissions.js")).cmdGrantDevicePermissions({
      ...out,
      deviceId,
      operatorPackage,
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
  version --check-compat [--device <id>] [--operator-package <package>]
                                            Compare the CLI version with the installed Operator APK version`,
  handler: async (ctx) => {
    const { rest, format, verbose, logger, deviceId, operatorPackage } = ctx;
    const out = { format, verbose, logger };
    return (await import("./commands/version.js")).cmdVersion({
      ...out,
      checkCompat: hasFlag(rest, "--check-compat"),
      deviceId,
      operatorPackage,
    });
  },
};

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** True when the open command should use open_uri (target string contains a URI scheme). */
export function isOpenCliUriTarget(target: string): boolean {
  return /[a-z][a-z0-9+\-.]*:\/\//i.test(target);
}

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

// Maps removed compound commands to their flat replacements.
// When a caller types e.g. "action click", cmd="action" and rest[0]="click",
// so we can give a precise "use 'click' instead" message.
const REMOVED_COMPOUND_COMMANDS: Record<string, Record<string, string>> = {
  action: { click: "click", "open-app": "open", "open-uri": "open", type: "type", read: "read", wait: "wait", "press-key": "press" },
  observe: { snapshot: "snapshot", screenshot: "screenshot" },
  inspect: { ui: "snapshot" },
};

export function didYouMean(cmd: string, rest: string[], commands: Record<string, CommandDef>): string {
  // Check removed compound commands first - give precise migration guidance.
  const compoundMap = REMOVED_COMPOUND_COMMANDS[cmd];
  if (compoundMap) {
    const sub = rest[0];
    const replacement = sub ? compoundMap[sub] : undefined;
    if (replacement) {
      return JSON.stringify({
        code: "UNKNOWN_COMMAND",
        message: `'${cmd} ${sub}' has been removed. Use '${replacement}' instead. Run 'clawperator ${replacement} --help' for usage.`,
        suggestion: replacement,
      });
    }
    // Known removed namespace but unknown or missing subcommand
    const validSubs = Object.keys(compoundMap).join(", ");
    return JSON.stringify({
      code: "UNKNOWN_COMMAND",
      message: `'${cmd}' has been removed. Use one of: ${validSubs} - e.g. 'clawperator snapshot'. Run --help for available commands.`,
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
    "  --device <id>, --device-id <id>         Target Android device serial (<!--flag-->--device<!--/flag--> is canonical)",
    "  --operator-package <package>, --receiver-package <package>",
    "                                            Target Operator package for broadcast dispatch (--receiver-package is a legacy alias)",
    "  --json                                    JSON output shorthand (same as --output json)",
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
    "  - exec is the canonical command for execution payloads; 'execute' is a supported synonym.",
    "  - Flat commands (snapshot, click, open, type, read, wait, press, back, scroll) are the canonical device interaction surface.",
    "  - Removed nested CLI forms such as `observe snapshot` or `action click`; unknown-command errors suggest the flat replacement.",
    "  - The default Operator package is com.clawperator.operator. Use --operator-package com.clawperator.operator.dev for local debug builds.",
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
