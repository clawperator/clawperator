#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const HELP = `Clawperator CLI

Usage:
  clawperator <command> [options]

Commands:
  operator setup --apk <path> [--device-id <id>] [--receiver-package <package>]
                                            Install the Operator APK, grant required permissions, and verify readiness
  devices                                   List connected Android devices
  emulator list                             List configured Android emulators (AVDs)
  emulator inspect <name>                   Show normalized metadata for one AVD
  emulator create [--name <name>]           Create a supported Google Play AVD
  emulator start <name>                     Start an AVD and wait until Android is ready
  emulator stop <name>                      Stop a running emulator by AVD name
  emulator delete <name>                    Delete an AVD by name
  emulator status                           List running emulators and boot state
  emulator provision                        Reuse or create a supported emulator
  provision emulator                        Alias of emulator provision
  packages list [--device-id <id>] [--third-party]
                                            List installed package IDs on a device
  execute --execution <json-or-file> [--device-id <id>] [--receiver-package <package>]
                                            Execute a validated command payload
  execute best-effort --goal <text> [--device-id <id>] [--receiver-package <package>]
                                            Produce deterministic next-action suggestion from current UI
  observe snapshot [--device-id <id>] [--receiver-package <package>]
                                            Capture current UI snapshot output
  observe screenshot [--device-id <id>] [--receiver-package <package>]
                                            Capture current device screenshot (png)
  inspect ui [--device-id <id>] [--receiver-package <package>]
                                            Alias of observe snapshot with formatted output
  action open-app --app <packageId> [--device-id <id>] [--receiver-package <package>]
                                            Build and run single open_app action via execute path
  action open-uri --uri <value> [--device-id <id>] [--receiver-package <package>]
                                            Build and run single open_uri action via execute path
  action click --selector <json> [--device-id <id>] [--receiver-package <package>]
                                            Build and run single click action via execute path
  action read --selector <json> [--device-id <id>] [--receiver-package <package>]
                                            Build and run single read_text action via execute path
  action wait --selector <json> [--device-id <id>] [--receiver-package <package>]
                                            Build and run single wait_for_node action via execute path
  action type --selector <json> --text <value> [--submit] [--clear] [--device-id <id>] [--receiver-package <package>]
                                            Build and run single enter_text action via execute path
  skills list
                                            List available skills from local indexes/cache
  skills get <skill_id>
                                            Show skill metadata
  skills search --app <package_id> [--intent <intent>] [--keyword <text>]
                                            Search skills by app package, intent, or keyword
  skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
  skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>]
                                            Compile from a skill artifact (skill: positional or --skill-id; artifact: ac-status or ac-status.recipe.json)
  skills run <skill_id> [--device-id <id>] [-- <extra_args>]
                                            Invoke a skill script (convenience wrapper)
  skills install
                                            Clone skills repository to ~/.clawperator/skills/
  skills update [--ref <git-ref>]
                                            Pull latest skills (optionally pin to a ref)
  skills sync --ref <git-ref>
                                            Sync and pin skills index/cache to a git ref
  grant-device-permissions [--device-id <id>] [--receiver-package <package>]
                                            Re-grant accessibility and notification permissions (remediation only)
  serve [--port <number>] [--host <string>]
                                            Start local HTTP/SSE server for remote control (default host: 127.0.0.1)
  doctor [--json]
                                            Run environment and runtime checks (Stage 3). --json/--format json is alias for --output json.
  doctor --fix
                                            Attempt non-destructive host fixes (Stage 3)
  doctor --full
                                            Full Android build + install + handshake + smoke (Stage 3)
  doctor --check-only
                                            Keep doctor non-blocking by always exiting 0 (for CI/automation)
  version
                                            Show the CLI version
  version --check-compat [--device-id <id>] [--receiver-package <package>]
                                            Compare the CLI version with the installed Operator APK version

Global options:
  --device-id <id>                          Target Android device serial
  --receiver-package <package>              Target Operator package for broadcast dispatch
  --output <json|pretty>, --format <json|pretty>
                                            Output format (default: json)
  --timeout-ms <number>                     Override execution timeout within policy limits
  --verbose                                 Include debug diagnostics in output
  --help                                    Show help
  --version                                 Show version

Notes:
  - operator setup is the canonical setup command. operator install remains an alias.
  - inspect ui is a wrapper alias over observe snapshot.
  - action commands are thin wrappers that compile to execution and call execute.
  - The default receiver package is com.clawperator.operator. Use --receiver-package com.clawperator.operator.dev for local debug builds.
  - Terminal result semantics are driven by [Clawperator-Result].
`;

const HELP_TOPICS: Record<string, string> = {
  "operator setup": `clawperator operator setup

Usage:
  clawperator operator setup --apk <path> [--device-id <id>] [--receiver-package <package>] [--output <json|pretty>]

Required:
  --apk <path>              Local filesystem path to the Operator APK file

Optional:
  --device-id <id>          Target Android device serial (required when multiple devices are connected)
  --receiver-package <pkg>  Operator package identifier (required when both release and debug variants are installed)

Notes:
  - This is the canonical setup command for the Clawperator Operator APK.
  - Runs three phases in order: install, permission grant, verification.
  - Install phase: copies the APK onto the device via adb.
  - Permission grant phase: enables the accessibility service and notification listener.
  - Verification phase: confirms the package is visible to the package manager.
  - Fails with a structured error if any phase fails. The error code identifies which phase failed.
  - If omitted, setup auto-detects the package only when exactly one known Operator variant is installed.
  - If both release and debug variants are installed, pass --receiver-package explicitly.
  - Do not use raw adb install for normal setup. It leaves the device in a partial state without required permissions.
  - operator install remains a compatibility alias for operator setup.
  - Use clawperator grant-device-permissions only after the Operator APK crashes and Android revokes permissions.
`,
  "observe snapshot": `clawperator observe snapshot

Usage:
  clawperator observe snapshot [--device-id <id>] [--receiver-package <package>] [--timeout-ms <number>] [--output <json|pretty>] [--verbose]

Notes:
  - Captures a UI snapshot via the canonical execution path.
  - Default receiver package: com.clawperator.operator
  - Use --receiver-package com.clawperator.operator.dev for local debug APKs.
  - --timeout-ms overrides the execution timeout within policy limits.
`,
  "skills install": `clawperator skills install

Usage:
  clawperator skills install [--output <json|pretty>]

Notes:
  - Clones the skills repository to ~/.clawperator/skills/
  - On success, set:
      export CLAWPERATOR_SKILLS_REGISTRY="$HOME/.clawperator/skills/skills/skills-registry.json"
  - If the skills repository requires authentication, install may fail until credentials are configured.
`,
  "skills sync": `clawperator skills sync

Usage:
  clawperator skills sync --ref <git-ref> [--output <json|pretty>]

Notes:
  - Fetches or clones ~/.clawperator/skills/ and pins the local registry to the requested git ref.
  - Requires git access to the configured skills repository.
  - Registry path after sync:
      $HOME/.clawperator/skills/skills/skills-registry.json
`,
  "doctor": `clawperator doctor

Usage:
  clawperator doctor [--output <json|pretty>] [--device-id <id>] [--receiver-package <package>] [--verbose]
  clawperator doctor --fix
  clawperator doctor --full
  clawperator doctor --check-only

Notes:
  - Default receiver package: com.clawperator.operator
  - Use --receiver-package com.clawperator.operator.dev for local debug APKs.
  - If handshake times out, rerun with --verbose and compare the installed APK package with --receiver-package.
`,
  "version": `clawperator version

Usage:
  clawperator version
  clawperator version --check-compat [--device-id <id>] [--receiver-package <package>] [--output <json|pretty>]

Notes:
  - Default receiver package: com.clawperator.operator
  - Use --receiver-package com.clawperator.operator.dev for local debug APKs.
  - --check-compat compares CLI major.minor with the installed APK variant on the device.
`,
  "grant-device-permissions": `clawperator grant-device-permissions

Usage:
  clawperator grant-device-permissions [--device-id <id>] [--receiver-package <package>] [--output <json|pretty>]

Notes:
  - Default receiver package: com.clawperator.operator
  - Use --receiver-package com.clawperator.operator.dev for local debug APKs.
  - Grants accessibility, notification posting, and notification listener permissions via adb.
  - This command is for crash recovery only. Use it when the Operator APK crashes and Android revokes permissions.
  - For normal setup, always use clawperator operator setup instead.
`,
  "emulator": `clawperator emulator

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
`,
};

class UsageError extends Error {}

function resolveHelpTopic(rest: string[]): string | undefined {
  if (rest.length === 0) return undefined;
  if (rest[0] === "operator" && (rest[1] === "setup" || rest[1] === "install")) return "operator setup";
  if (rest[0] === "operator" && (rest.length === 1 || rest[1] === "--help")) return "operator setup";
  if (rest[0] === "setup" || rest[0] === "install") return "operator setup";
  if (rest[0] === "observe" && rest[1] === "snapshot") return "observe snapshot";
  if (rest[0] === "inspect" && rest[1] === "ui") return "observe snapshot";
  if (rest[0] === "skills" && rest[1] === "install") return "skills install";
  if (rest[0] === "skills" && rest[1] === "sync") return "skills sync";
  if (rest[0] === "doctor") return "doctor";
  if (rest[0] === "version") return "version";
  if (rest[0] === "grant-device-permissions") return "grant-device-permissions";
  if (rest[0] === "emulator") return "emulator";
  if (rest[0] === "provision" && rest[1] === "emulator") return "emulator";
  return undefined;
}

function getGlobalOpts(argv: string[]): {
  deviceId?: string;
  receiverPackage?: string;
  timeoutMs?: number;
  output: "json" | "pretty";
  verbose: boolean;
  rest: string[];
} {
  const rest: string[] = [];
  let deviceId: string | undefined;
  let receiverPackage: string | undefined;
  let timeoutMs: number | undefined;
  let output: "json" | "pretty" = "json";
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--device-id" && argv[i + 1]) {
      deviceId = argv[++i];
    } else if (argv[i] === "--receiver-package" && argv[i + 1]) {
      receiverPackage = argv[++i];
    } else if ((argv[i] === "--output" || argv[i] === "--format") && argv[i + 1]) {
      output = argv[++i] === "pretty" ? "pretty" : "json";
    } else if (argv[i] === "--timeout-ms") {
      if (!argv[i + 1]) {
        throw new UsageError("--timeout-ms requires a value");
      }
      timeoutMs = Number(argv[++i]);
    } else if (argv[i] === "--verbose") {
      verbose = true;
    } else {
      rest.push(argv[i]);
    }
  }
  return { deviceId, receiverPackage, timeoutMs, output, verbose, rest };
}

function getOpt(rest: string[], flag: string): string | undefined {
  const i = rest.indexOf(flag);
  return i >= 0 && rest[i + 1] ? rest[i + 1] : undefined;
}

function hasFlag(rest: string[], flag: string): boolean {
  return rest.includes(flag);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === "help") {
    console.log(HELP);
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
    const topic = resolveHelpTopic(global.rest);
    console.log(topic ? HELP_TOPICS[topic] : HELP);
    process.exit(0);
  }
  const [cmd, ...rest] = global.rest;
  const out = { format: global.output as "json" | "pretty", verbose: global.verbose };

  let result: string;

  switch (cmd) {
    case "operator": {
      const sub = rest[0];
      if (sub === "setup" || sub === "install") {
        const apkPath = getOpt(rest, "--apk");
        if (!apkPath) {
          result = JSON.stringify({ code: "USAGE", message: `operator ${sub ?? "setup"} requires --apk <path>. Use clawperator operator setup --help for details.` });
        } else {
          result = await (await import("./commands/operatorSetup.js")).cmdOperatorSetup({
            ...out,
            apkPath,
            deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
            receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
          });
        }
      } else {
        result = JSON.stringify({
          code: "USAGE",
          message: sub
            ? `Unknown operator subcommand '${sub}'. Use: clawperator operator setup --apk <path>`
            : "Use: clawperator operator setup --apk <path>",
        });
      }
      break;
    }
    case "setup":
      result = JSON.stringify({
        code: "USAGE",
        message: "clawperator setup is not a valid top-level command. Use: clawperator operator setup --apk <path>",
        canonical: "clawperator operator setup --apk <path> [--device-id <id>] [--receiver-package <package>]",
      });
      break;
    case "install":
      // Guidance path: users and agents that guess 'clawperator install' are directed to the canonical command.
      result = JSON.stringify({
        code: "USAGE",
        message: "clawperator install is not a valid command. Use: clawperator operator setup --apk <path>",
        canonical: "clawperator operator setup --apk <path> [--device-id <id>] [--receiver-package <package>]",
      });
      break;
    case "devices":
      result = await (await import("./commands/devices.js")).cmdDevices(out);
      break;
    case "emulator": {
      const sub = rest[0];
      if (sub === "list") {
        result = await (await import("./commands/emulator.js")).cmdEmulatorList(out);
      } else if (sub === "inspect") {
        result = rest[1]
          ? await (await import("./commands/emulator.js")).cmdEmulatorInspect(rest[1], out)
          : JSON.stringify({ code: "USAGE", message: "emulator inspect <name>" });
      } else if (sub === "create") {
        result = await (await import("./commands/emulator.js")).cmdEmulatorCreate({
          ...out,
          name: getOpt(rest, "--name"),
        });
      } else if (sub === "start") {
        result = rest[1]
          ? await (await import("./commands/emulator.js")).cmdEmulatorStart(rest[1], out)
          : JSON.stringify({ code: "USAGE", message: "emulator start <name>" });
      } else if (sub === "stop") {
        result = rest[1]
          ? await (await import("./commands/emulator.js")).cmdEmulatorStop(rest[1], out)
          : JSON.stringify({ code: "USAGE", message: "emulator stop <name>" });
      } else if (sub === "delete") {
        result = rest[1]
          ? await (await import("./commands/emulator.js")).cmdEmulatorDelete(rest[1], out)
          : JSON.stringify({ code: "USAGE", message: "emulator delete <name>" });
      } else if (sub === "status") {
        result = await (await import("./commands/emulator.js")).cmdEmulatorStatus(out);
      } else if (sub === "provision") {
        result = await (await import("./commands/emulator.js")).cmdProvisionEmulator(out);
      } else {
        result = JSON.stringify({ code: "USAGE", message: "emulator list|inspect|create|start|stop|delete|status|provision" });
      }
      break;
    }
    case "provision":
      if (rest[0] === "emulator") {
        result = await (await import("./commands/emulator.js")).cmdProvisionEmulator(out);
      } else {
        result = JSON.stringify({ code: "USAGE", message: "provision emulator" });
      }
      break;
    case "packages":
      if (rest[0] === "list") {
        result = await (await import("./commands/packages.js")).cmdPackagesList({
          ...out,
          deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
          thirdParty: hasFlag(rest, "--third-party"),
        });
      } else {
        result = JSON.stringify({ code: "USAGE", message: "packages list [--device-id <id>] [--third-party]" });
      }
      break;
    case "execute":
      if (rest[0] === "best-effort") {
        const goal = getOpt(rest, "--goal");
        result = JSON.stringify({
          code: "NOT_IMPLEMENTED",
          message: "execute best-effort is Stage 1 limited; use observe snapshot + agent reasoning for now",
          goal,
        });
      } else {
        const execution = getOpt(rest, "--execution");
        if (!execution) {
          result = JSON.stringify({ code: "USAGE", message: "execute requires --execution <json-or-file>" });
        } else {
          result = await (await import("./commands/execute.js")).cmdExecute({
            ...out,
            execution,
            deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
            receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
            timeoutMs: global.timeoutMs,
          });
        }
      }
      break;
    case "observe":
      if (rest[0] === "snapshot") {
        result = await (await import("./commands/observe.js")).cmdObserveSnapshot({
          ...out,
          deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
          receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
          timeoutMs: global.timeoutMs,
        });
      } else if (rest[0] === "screenshot") {
        result = await (await import("./commands/observe.js")).cmdObserveScreenshot({
          ...out,
          deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
          receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
          timeoutMs: global.timeoutMs,
        });
      } else {
        result = JSON.stringify({ code: "USAGE", message: "observe snapshot|screenshot [options]" });
      }
      break;
    case "inspect":
      if (rest[0] === "ui") {
        result = await (await import("./commands/inspect.js")).cmdInspectUi({
          ...out,
          deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
          receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
          timeoutMs: global.timeoutMs,
        });
      } else {
        result = JSON.stringify({ code: "USAGE", message: "inspect ui [options]" });
      }
      break;
    case "action": {
      const sub = rest[0];
      const selector = getOpt(rest, "--selector");
      const runOpts = {
        deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
        receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
      };
      if (sub === "click") {
        result = selector
          ? await (await import("./commands/action.js")).cmdActionClick({ ...out, selector, ...runOpts })
          : JSON.stringify({ code: "USAGE", message: "action click --selector <json>" });
      } else if (sub === "open-app") {
        const app = getOpt(rest, "--app");
        result = app
          ? await (await import("./commands/action.js")).cmdActionOpenApp({ ...out, applicationId: app, ...runOpts })
          : JSON.stringify({ code: "USAGE", message: "action open-app --app <packageId>" });
      } else if (sub === "read") {
        result = selector
          ? await (await import("./commands/action.js")).cmdActionRead({ ...out, selector, ...runOpts })
          : JSON.stringify({ code: "USAGE", message: "action read --selector <json>" });
      } else if (sub === "wait") {
        result = selector
          ? await (await import("./commands/action.js")).cmdActionWait({ ...out, selector, ...runOpts })
          : JSON.stringify({ code: "USAGE", message: "action wait --selector <json>" });
      } else if (sub === "type") {
        const text = getOpt(rest, "--text");
        result =
          selector && text !== undefined
            ? await (await import("./commands/action.js")).cmdActionType({
              ...out,
              selector,
              text,
              submit: hasFlag(rest, "--submit"),
              clear: hasFlag(rest, "--clear"),
              ...runOpts,
            })
            : JSON.stringify({ code: "USAGE", message: "action type --selector <json> --text <value>" });
      } else if (sub === "open-uri") {
        const uri = getOpt(rest, "--uri");
        result = uri
          ? await (await import("./commands/action.js")).cmdActionOpenUri({ ...out, uri, ...runOpts })
          : JSON.stringify({ code: "USAGE", message: "action open-uri --uri <value>" });
      } else {
        const validSubs = "open-app|open-uri|click|read|wait|type";
        const unknownPart = sub ? `Unknown action subcommand '${sub}'. Valid: ` : "";
        result = JSON.stringify({ code: "USAGE", message: `${unknownPart}action ${validSubs} [options]` });
      }
      break;
    }
    case "skills":
      if (rest[0] === "list") {
        result = await (await import("./commands/skills.js")).cmdSkillsList(out);
      } else if (rest[0] === "get") {
        result = rest[1]
          ? await (await import("./commands/skills.js")).cmdSkillsGet(rest[1], out)
          : JSON.stringify({ code: "USAGE", message: "skills get <skill_id>" });
      } else if (rest[0] === "search") {
        const app = getOpt(rest, "--app");
        const intent = getOpt(rest, "--intent");
        const keyword = getOpt(rest, "--keyword");
        if (!app && !intent && !keyword) {
          result = JSON.stringify({ code: "USAGE", message: "skills search requires --app <package_id>, --intent <intent>, or --keyword <text>" });
        } else {
          result = await (await import("./commands/skills.js")).cmdSkillsSearch({ app, intent, keyword }, out);
        }
      } else if (rest[0] === "compile-artifact") {
        const skillId = getOpt(rest, "--skill-id") ?? rest[1];
        const artifact = getOpt(rest, "--artifact");
        const vars = getOpt(rest, "--vars") ?? "{}";
        if (!skillId || !artifact) {
          result = JSON.stringify({
            code: "USAGE",
            message:
              "skills compile-artifact requires <skill_id> (positional) or --skill-id <id>, and --artifact <name>. Example: skills compile-artifact com.example.skill --artifact ac-status [--vars '{}']",
          });
        } else {
          result = await (await import("./commands/skills.js")).cmdSkillsCompileArtifact(skillId, artifact, vars, out);
        }
      } else if (rest[0] === "run") {
        const skillId = rest[1];
        if (!skillId) {
          result = JSON.stringify({ code: "USAGE", message: "skills run <skill_id> [--device-id <id>] [-- <extra_args>]" });
        } else {
          // Build args to pass to the skill script
          // Only parse options from args before "--" to avoid double-counting
          const dashDash = rest.indexOf("--");
          const optSegment = dashDash >= 0 ? rest.slice(0, dashDash) : rest;
          const scriptArgs: string[] = [];
          const deviceId = global.deviceId ?? getOpt(optSegment, "--device-id");
          if (deviceId) scriptArgs.push(deviceId);
          // Pass anything after "--" as extra args
          if (dashDash >= 0) {
            scriptArgs.push(...rest.slice(dashDash + 1));
          }
          result = await (await import("./commands/skills.js")).cmdSkillsRun(skillId, scriptArgs, out);
        }
      } else if (rest[0] === "install") {
        result = await (await import("./commands/skills.js")).cmdSkillsInstall(out);
      } else if (rest[0] === "update") {
        const ref = getOpt(rest, "--ref") ?? "main";
        result = await (await import("./commands/skills.js")).cmdSkillsUpdate(ref, out);
      } else if (rest[0] === "sync") {
        const ref = getOpt(rest, "--ref");
        result = ref
          ? await (await import("./commands/skills.js")).cmdSkillsSync(ref, out)
          : JSON.stringify({ code: "USAGE", message: "skills sync --ref <git-ref>" });
      } else {
        result = JSON.stringify({ code: "USAGE", message: "skills list|get|search|compile-artifact|run|install|update|sync ..." });
      }
      break;
    case "serve":
      {
        const portStr = getOpt(rest, "--port");
        const port = portStr ? parseInt(portStr, 10) : 3000;
        const host = getOpt(rest, "--host") || "127.0.0.1";
        if (isNaN(port) || port <= 0 || port > 65535) {
          result = JSON.stringify({ code: "USAGE", message: "Invalid port number. Must be 1-65535." });
          break;
        }
        await (await import("./commands/serve.js")).cmdServe({
          port,
          host,
          verbose: global.verbose,
        });
        // Long running, we don't return.
        return;
      }
    case "doctor": {
      const isJson = hasFlag(rest, "--json") || out.format === "json";
      result = await (await import("./commands/doctor.js")).cmdDoctor({
        ...out,
        format: isJson ? "json" : "pretty",
        fix: hasFlag(rest, "--fix"),
        full: hasFlag(rest, "--full"),
        checkOnly: hasFlag(rest, "--check-only"),
        deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
        receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
      });
      break;
    }
    case "grant-device-permissions":
      result = await (await import("./commands/grantDevicePermissions.js")).cmdGrantDevicePermissions({
        ...out,
        deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
        receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
      });
      break;
    case "version":
      result = await (await import("./commands/version.js")).cmdVersion({
        ...out,
        checkCompat: hasFlag(rest, "--check-compat"),
        deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
        receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
      });
      break;
    default:
      result = JSON.stringify({ code: "USAGE", message: `Unknown command: ${cmd}. Use --help.` });
  }

  console.log(result);
  if (result.startsWith("{") && result.includes('"code"') && !result.includes('"envelope"')) {
    const obj = JSON.parse(result) as { code?: string };
    if (obj.code && obj.code !== "USAGE" && obj.code !== "NOT_IMPLEMENTED") {
      process.exitCode = 1;
    }
  }
}

main().catch((e) => {
  console.error(JSON.stringify({ code: "UNKNOWN", message: String(e) }));
  process.exit(1);
});
