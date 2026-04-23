# Host Agent Orientation

## Purpose

Choose the correct Clawperator front door after install: runtime-skill discovery
through `clawperator skills`, installed authoring-workflow discovery through
`clawperator bundled-skills`, long-running tool registration through
`clawperator mcp serve`, or direct action work through the CLI and local API.
This page also defines the zero-results route: when runtime-skill discovery
finds no relevant match, start with `clawperator-skill-author-by-agent-discovery` and use
`clawperator-skill-author-by-recording` only after discovery returns
`proceed_to_recording`, or when the route is already well understood.
If packaged first-party bundled skills are installed, `clawperator-agent-orientation`
is the first-run packaged front door for this route and should point back to
this page, while `clawperator-upgrade` is the packaged whole-product upgrade
route. It checks `clawperator --version`, verifies the installer-owned Node and
Java prerequisites before choosing the CLI-first path, uses the CLI-first
upgrade sequence when the host is already viable, and falls back to
`install.sh` only as recovery when the CLI is not reachable or the bootstrap
prerequisites still need repair.

## When To Read This Page

Read this page after [Setup](setup.md) succeeds.

Machine-checkable prerequisite:

```bash
clawperator doctor --json
```

Continue only when:

- exit code is `0`
- `criticalOk` is `true`

If you have not reached that state yet, finish [Setup](setup.md) first.

Before any device-touching command, identify the target device:

```bash
clawperator devices
```

If more than one device is connected, carry `--device <device_serial>` through
later `snapshot`, `skills run`, and direct-action commands.

## First Route After Install

Use this order:

1. Read this page.
2. If packaged first-party bundled skills are installed and you are unfamiliar
   with this host, start with `clawperator-agent-orientation`. It should verify
   readiness, separate runtime skills from bundled skills, and end with one
   concrete next step.
3. If the user or calling workflow explicitly chose a whole-product refresh,
   use `clawperator-upgrade`.
4. If you need an app-specific capability, start with `clawperator skills`.
5. If your host already speaks stdio MCP and wants registered tools, use `clawperator mcp serve`.
6. If you already know you need raw actions and result envelopes, continue to [Quickstart](quickstart.md).

## Choose The Front Door

| Situation | Start here | Why |
| --- | --- | --- |
| You are unfamiliar with this host and want the packaged first-run orientation surface | `clawperator-agent-orientation` | Thin packaged router that points back to this page and the canonical docs. |
| The user or calling workflow explicitly chose a whole-product refresh before you trust any downstream route | `clawperator-upgrade` | Checks `clawperator --version`, verifies Node 24+ and Java 17/21, then uses `npm install -g clawperator@latest`, `clawperator install`, and `clawperator doctor --json`. Uses `install.sh` only when the CLI is not reachable or the bootstrap prerequisites need repair. |
| You know the Android package id and want the fastest answer to "what can this host do for this app?" | `clawperator skills for-app <package_id> --json` | `skills for-app` is the primary app-oriented discovery surface. |
| You only know user-language terms such as app name or intent | `clawperator skills search --keyword <text> --json` | Search is the fallback when you do not have the package id yet. |
| You already have a skill id and want the exact metadata | `clawperator skills get <skill_id> --json` | Confirms the registry entry before a run. |
| You want to execute a skill through the wrapper | `clawperator skills run <skill_id> ... --json` | Uses the runtime-skill wrapper and its validation gate. |
| Runtime-skill discovery returned no relevant match and you need the zero-results authoring route | `clawperator bundled-skills list --json` | Bundled skills are separate from runtime skills. Start with `clawperator-skill-author-by-agent-discovery`, then use `clawperator-skill-author-by-recording` only after discovery returns `proceed_to_recording`, or when the route is already well understood. |
| Your host already supports stdio MCP and wants registered tools such as `devices`, `snapshot`, `execute`, and `configure` | `clawperator mcp serve` | MCP is the transport surface for long-running tool registration. |
| You already know the exact action payload you want to send | [Quickstart](quickstart.md) | Quickstart covers the observe / decide / act loop directly. |

## Runtime-Skill Discovery Flow

Use the shortest successful path first:

```bash
clawperator skills for-app <package_id> --json
clawperator skills search --keyword <text> --json
clawperator skills get <skill_id> --json
clawperator skills run <skill_id> --json
```

Decision rules:

- Start with `skills for-app` when you know the Android package id.
- Use `skills search --keyword` when you only have a user-language term.
- Use `skills get` before `skills run` when you need to confirm the exact id or summary.
- Use `skills run` only after discovery, not as the first probe.
- Do not start with `skills list` unless the real task is inventory rather than
  app-oriented discovery.
- If discovery returns zero relevant matches and the next job is skill creation
  rather than raw execution, inspect installed bundled skills with
  `clawperator bundled-skills list --json`, start with
  `clawperator-skill-author-by-agent-discovery`, and continue to
  [Authoring](skills/authoring.md).

## Zero-Results Route

Use this authoring decision table only after runtime-skill discovery found no
relevant installed match.

| Situation | Next surface | Expected outcome |
| --- | --- | --- |
| No relevant runtime skill match and the next job is choosing the truthful route | `clawperator bundled-skills list --json` | Confirm the installed bundled-skill front doors on this host. |
| You need the bounded zero-results front door | `clawperator-skill-author-by-agent-discovery` | Produce one discovery artifact and choose exactly one next step. |
| Discovery returns `proceed_to_recording`, or the route is already well understood | `clawperator-skill-author-by-recording` | Run the proving workflow from a fresh recording and one self-test. |
| You explicitly want the low-level manual scaffold instead of the installed guided workflows | `clawperator skills new <skill_id>` | Create a local scaffold only. |

The discovery pass should stay agent-driven by default. If discovery returns
`proceed_to_recording`, the next phase changes boundary: use
`clawperator-skill-author-by-recording` as a user-performed proving workflow rather than
continuing autonomous device driving through the recording step.

## MCP Decision Rule

Use `clawperator mcp serve` only when the host already wants MCP.

Use [MCP Server](api/mcp.md) for:

- stdio MCP client setup
- long-running MCP sessions
- tool registration for hosts such as Claude Desktop

Do not use MCP as the first discovery surface when the real question is
"what runtime skills are installed for this app?". Start with
`clawperator skills` for that job.

## When Discovery Stalls

Use this sequence:

1. Confirm the registry is readable:

```bash
clawperator skills list --json
```

2. If registry discovery still fails, check the installed home path written by
   the install and sync flow:

```bash
ls ~/.clawperator/skills/skills/skills-registry.json
```

3. If that file is missing or stale, reinstall the runtime skills:

```bash
clawperator skills install
```

4. If the host should connect through MCP instead of shelling out to the CLI,
   read the installed snippet and then use `clawperator mcp serve`:

```bash
cat ~/.clawperator/mcp-config-snippet.json
clawperator mcp serve
```

5. If the registry is readable but no installed runtime skill matches the
   request, inspect the installed authoring-workflow helpers:

```bash
clawperator bundled-skills list --json
```

Then continue to [Authoring](skills/authoring.md), start with
`clawperator-skill-author-by-agent-discovery`, and move to `clawperator-skill-author-by-recording`
only after discovery returns `proceed_to_recording`, or when the route is
already well understood.

## Durable Post-Install Files

These files help a host orient after install:

| Path | Meaning | Next step |
| --- | --- | --- |
| `~/.clawperator/AGENTS.md` | Local Clawperator guide written by `clawperator host setup` during install | Use it as machine-local context after you read this public route. |
| `~/.clawperator/install-state.json` | Durable install metadata written by `clawperator host setup` | Check `registryPath`, `cliVersion`, and `lastDeviceSerial` without rerunning install. |
| `~/.clawperator/mcp-config-snippet.json` | Paste-ready MCP config written by `clawperator host setup` | Use it when you choose the MCP route. |
| `~/.clawperator/skills/skills/skills-registry.json` | Installed runtime-skills registry | Verify it exists when `skills list` or `skills for-app` cannot discover skills. |
| `~/.clawperator/bundled-skills/` | Installed first-party bundled skills | Inspect it through `clawperator bundled-skills list --json` when runtime discovery returns no relevant match. |

## Verification

Use these commands to confirm the intended surface is working:

```bash
clawperator --help
clawperator skills --help
clawperator bundled-skills --help
clawperator skills for-app com.android.settings --json
clawperator skills search --keyword settings --json
clawperator skills get com.android.settings.capture-overview --json
clawperator skills list --json
clawperator bundled-skills list --json
```

Check:

- `clawperator --help` and `clawperator skills --help` name `clawperator-agent-orientation` as the first-run surface for unfamiliar hosts and point zero-match users to `clawperator bundled-skills list`
- `clawperator --help` and `clawperator skills --help` name `clawperator-upgrade` as the packaged whole-product refresh route and note the Node/Java prerequisite gate
- `clawperator bundled-skills --help` names `clawperator-agent-orientation` as the first-run orientation skill, `clawperator-upgrade` as the packaged whole-product upgrade route after explicit upgrade intent and prerequisite viability, `clawperator-skill-author-by-agent-discovery` as the zero-results front door, and `clawperator-skill-author-by-recording` as the proving workflow
- `skills for-app`, `skills search`, and `skills list` return top-level `skills` and `count`
- `skills get` returns a top-level `skill`
- `bundled-skills list` returns top-level `skills`, `count`, and `installedDir`
- `bundled-skills list` includes `clawperator-agent-orientation`, `clawperator-upgrade`, `clawperator-skill-author-by-agent-discovery`, and `clawperator-skill-author-by-recording` in `skills[].name`

For MCP:

```bash
clawperator mcp serve
```

Check:

- the process starts without printing normal CLI help
- the process remains attached to stdio for the MCP client

## Read Next

| Topic | Page |
| --- | --- |
| Install and device readiness | [Setup](setup.md) |
| Raw observe / decide / act loop | [Quickstart](quickstart.md) |
| Runtime-skill registry and wrapper behavior | [Skills Overview](skills/overview.md) |
| Authoring-workflow install and current boundaries | [Authoring](skills/authoring.md) |
| MCP client setup and tool surface | [MCP Server](api/mcp.md) |
