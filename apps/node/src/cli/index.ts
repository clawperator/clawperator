#!/usr/bin/env node

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const HELP = `Clawperator CLI

Usage:
  clawperator <command> [options]

Commands:
  devices                                   List connected Android devices
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
  skills compile-artifact <skill_id> --artifact <name> [--vars <json>]
  skills compile-artifact --skill-id <id> --artifact <name> [--vars <json>]
                                            Compile from a skill artifact (skill: positional or --skill-id; artifact: ac-status or ac-status.recipe.json)
  skills sync --ref <git-ref>
                                            Sync and pin skills index/cache to a git ref
  serve [--port <number>] [--host <string>]
                                            Start local HTTP/SSE server for remote control (default host: 127.0.0.1)
  doctor [--json]
                                            Run environment and runtime checks (Stage 3). --json is alias for --output json.
  doctor --fix
                                            Attempt non-destructive host fixes (Stage 3)
  doctor --full
                                            Full Android build + install + handshake + smoke (Stage 3)
  doctor --check-only
                                            Run all checks but always exit 0 (for CI/automation)

Global options:
  --device-id <id>                          Target Android device serial
  --receiver-package <package>              Target Operator package for broadcast dispatch
  --output <json|pretty>                    Output format (default: json)
  --timeout-ms <number>                     Override execution timeout within policy limits
  --verbose                                 Include debug diagnostics in output
  --help                                    Show help
  --version                                 Show version

Notes:
  - inspect ui is a wrapper alias over observe snapshot.
  - action commands are thin wrappers that compile to execution and call execute.
  - Terminal result semantics are driven by [Clawperator-Result].
`;

function getGlobalOpts(argv: string[]): {
  deviceId?: string;
  receiverPackage?: string;
  output: "json" | "pretty";
  verbose: boolean;
  rest: string[];
} {
  const rest: string[] = [];
  let deviceId: string | undefined;
  let receiverPackage: string | undefined;
  let output: "json" | "pretty" = "json";
  let verbose = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--device-id" && argv[i + 1]) {
      deviceId = argv[++i];
    } else if (argv[i] === "--receiver-package" && argv[i + 1]) {
      receiverPackage = argv[++i];
    } else if (argv[i] === "--output" && argv[i + 1]) {
      output = argv[++i] === "pretty" ? "pretty" : "json";
    } else if (argv[i] === "--verbose") {
      verbose = true;
    } else {
      rest.push(argv[i]);
    }
  }
  return { deviceId, receiverPackage, output, verbose, rest };
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
  if (argv.length === 0 || argv.includes("--help") || argv[0] === "help") {
    console.log(HELP);
    process.exit(0);
  }
  if (argv.includes("--version")) {
    const pkg = require("../../package.json") as { version?: string };
    console.log(pkg.version ?? "0.1.0");
    process.exit(0);
  }

  const global = getGlobalOpts(argv);
  const [cmd, ...rest] = global.rest;
  const out = { format: global.output as "json" | "pretty", verbose: global.verbose };

  let result: string;

  switch (cmd) {
    case "devices":
      result = await (await import("./commands/devices.js")).cmdDevices(out);
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
        });
      } else if (rest[0] === "screenshot") {
        result = await (await import("./commands/observe.js")).cmdObserveScreenshot({
          ...out,
          deviceId: global.deviceId ?? getOpt(rest, "--device-id"),
          receiverPackage: global.receiverPackage ?? getOpt(rest, "--receiver-package"),
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
      } else {
        result = JSON.stringify({ code: "USAGE", message: "action open-app|click|read|wait|type [options]" });
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
      } else if (rest[0] === "sync") {
        const ref = getOpt(rest, "--ref");
        result = ref
          ? await (await import("./commands/skills.js")).cmdSkillsSync(ref, out)
          : JSON.stringify({ code: "USAGE", message: "skills sync --ref <git-ref>" });
      } else {
        result = JSON.stringify({ code: "USAGE", message: "skills list|get|compile-artifact|sync ..." });
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
