# Findings: OpenClaw Onboarding Gaps for Clawperator

## Scope

This document combines the Codex and Opus findings into one gap-focused research note.

Anchor user request:

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device"

The evaluation target is the real first-run path for an OpenClaw-class personal assistant agent:

1. receive the Telegram-style user message
2. discover Clawperator on the web
3. run `curl -fsSL https://clawperator.com/install.sh | bash`
4. discover installed Google Home runtime skills
5. run the right skill
6. report current HVAC state back to the user

This note focuses on what currently blocks or weakens that flow.

## Executive Summary

Clawperator already has most of the underlying capability needed for this scenario:

1. `install.sh` installs the CLI, operator APK, and a public skills repo.
2. The public skills repo already contains Google Home HVAC skills.
3. The CLI already supports `skills list`, `skills search`, `skills get`, and `skills run`.

The main issue is not missing runtime capability. The issue is missing agent handoff after install.

Today, an OpenClaw-style agent can successfully install Clawperator and still fail to realize:

1. that runtime skills were installed
2. where those skills live
3. how the Clawperator registry model differs from OpenClaw's own skill discovery model
4. which Google Home skills are relevant
5. what prerequisites those skills require

So the core problem is discoverability and integration, not the absence of Google Home support.

## What Exists Today

### Installer behavior

`sites/landing/public/install.sh` currently:

1. installs `clawperator`
2. runs `clawperator doctor`
3. runs `clawperator skills install`
4. appends `CLAWPERATOR_SKILLS_REGISTRY` to shell rc files
5. installs authoring skills
6. writes `~/.clawperator/AGENTS.md`

Evidence:

- installer skill setup: `sites/landing/public/install.sh:490`
- authoring-skill setup: `sites/landing/public/install.sh:540`
- agent-guide write: `sites/landing/public/install.sh:598`
- final install summary: `sites/landing/public/install.sh:1068`

### Runtime skills already exist for Google Home HVAC

The public skills repo already contains the relevant Google Home skills:

| Skill ID | Intent | Role |
| --- | --- | --- |
| `com.google.android.apps.chromecast.app.get-climate-replay` | `get-climate` | Read current climate state |
| `com.google.android.apps.chromecast.app.set-power-replay` | `set-power` | Turn climate power on/off |
| `com.google.android.apps.chromecast.app.set-temperature-replay` | `set-temperature` | Set target temperature |
| `com.google.android.apps.chromecast.app.control-hvac-orchestrated` | `control-hvac` | Agent-driven controller |

Evidence:

- registry entries: `../clawperator-skills/skills/skills-registry.json:89`
- orchestrated skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1`
- replay skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1`

### Clawperator runtime skills are registry-driven

Clawperator runtime skills are not discovered by folder scanning alone. They are loaded through the configured registry path.

Evidence:

- registry loader: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:6`
- skills overview docs: `docs/skills/overview.md:17`
- environment docs: `docs/api/environment.md:145`

## Findings

### F1. `clawperator skills list` can fail in a fresh shell even after a successful install

This is the highest-friction implementation gap.

After install, the long-lived runtime registry lives at:

`~/.clawperator/skills/skills/skills-registry.json`

But the CLI default when `CLAWPERATOR_SKILLS_REGISTRY` is unset is:

`<cwd>/skills/skills-registry.json`

That means any non-interactive or fresh shell that does not source `~/.zshrc` or `~/.bashrc` can fail to discover installed skills even though the installer already cloned them successfully.

Why this matters:

`clawperator skills list` is the canonical command an agent should use to answer "what can this host do?" If that command fails by default, the agent is pushed toward the false conclusion that no skills are installed.

Evidence:

- default path behavior: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8`
- installer shell export behavior: `sites/landing/public/install.sh:505`
- environment docs: `docs/api/environment.md:145`

### F2. OpenClaw and Clawperator use different skill discovery models, and there is no bridge between them

Clawperator installs runtime skills into `~/.clawperator/skills` and expects them to be discovered through `CLAWPERATOR_SKILLS_REGISTRY`.

OpenClaw's published skill model is different. It discovers skills from workspace and shared agent directories such as:

1. `<workspace>/skills`
2. `<workspace>/.agents/skills`
3. `~/.agents/skills`
4. `~/.openclaw/skills`

That means a successful Clawperator install does not automatically make Clawperator runtime skills visible to OpenClaw's own prompt-building or skill-selection system.

Evidence:

- Clawperator install location: `apps/node/src/domain/skills/skillsConfig.ts:6`
- Clawperator sync target: `apps/node/src/domain/skills/syncSkills.ts:41`
- OpenClaw skill docs: [OpenClaw Skills docs](https://docs.openclaw.ai/tools/skills)

### F3. The installer wires authoring skills into agent discovery directories, but not runtime skills

This is one of the clearest mismatches in the current onboarding story.

`install.sh` explicitly wires authoring skills into:

1. `~/.claude/skills`
2. `${CODEX_HOME:-~/.codex}/skills`
3. `~/.agents/skills`

But it does not do the equivalent for runtime skills.

So after install, generic agents are more likely to discover Clawperator maintenance helpers than the runtime Google Home HVAC skills the user actually cares about.

Evidence:

- authoring skill install summary: `sites/landing/public/install.sh:540`
- authoring skill discovery docs: `docs/skills/authoring.md:45`

### F4. `~/.clawperator/AGENTS.md` omits runtime skills entirely

The installer does write an agent-facing guide, but it currently focuses on:

1. `doctor`
2. `snapshot`
3. a simple click example
4. installed authoring skills

It does not tell an agent:

1. where runtime skills were installed
2. that public runtime skills came from `clawperator-skills`
3. how to use `clawperator skills list/search/get`
4. which Google Home skills already exist
5. what arguments those skills require

This means even an agent that finds `~/.clawperator/AGENTS.md` still does not learn the key fact for the Telegram HVAC scenario.

Evidence:

- guide write: `sites/landing/public/install.sh:598`
- guide template: `sites/landing/public/install.sh:605`

### F5. The guide is written to a Clawperator-specific path, not an OpenClaw-conventional discovery path

The installer writes its guide to:

`~/.clawperator/AGENTS.md`

But OpenClaw-class agents are much more likely to look at:

1. `./AGENTS.md`
2. `~/AGENTS.md`
3. `~/.agents/AGENTS.md`
4. `~/.agents/skills/*/SKILL.md`

So the system does generate agent-facing context, but not in the place OpenClaw naturally reads.

This is made worse by the fact that `~/.agents/AGENTS.md` may already exist for unrelated host workflows and currently has no Clawperator bridge section.

Evidence:

- installer guide write: `sites/landing/public/install.sh:598`
- OpenClaw personal assistant docs: [Personal Assistant Setup](https://docs.openclaw.ai/start/openclaw)
- OpenClaw AGENTS template docs: [AGENTS.md Template](https://docs.openclaw.ai/reference/templates/AGENTS.md)

### F6. Runtime skills are not surfaced through doctor or host-oriented help output

`clawperator doctor` is the obvious first diagnostic command after install, but it only reports host/device readiness. It does not tell the agent whether the skills registry resolved, how many skills are installed, or whether the target app already has skills.

Similarly, `clawperator skills` help lists the subcommands, but it does not answer the more important agent question:

> "What capabilities are already installed on this host for the app the user mentioned?"

This forces the agent to do extra discovery work after the first successful install instead of getting immediate confirmation that Google Home HVAC skills are ready.

Evidence:

- CLI registry/help surface: `apps/node/src/cli/registry.ts:2064`
- install doctor flow: `sites/landing/public/install.sh:988`

### F7. Skill search vocabulary does not match ordinary user vocabulary

The user says "air conditioner" and "Google Home". The current skills use vocabulary like:

1. `climate`
2. `hvac`
3. `set-power`
4. `set-temperature`
5. `com.google.android.apps.chromecast.app`

`skills search --keyword` uses substring matching. So an agent that searches with user-language terms such as `"air conditioner"`, `"aircon"`, `"ac"`, or `"google home"` may miss the correct skills entirely.

This means an agent can reach the registry and still fail to find the right capability because the vocabulary is tuned for author/developer terms rather than user phrasing.

Evidence:

- search behavior: `apps/node/src/domain/skills/searchSkills.ts:14`
- Google Home skill IDs and contracts: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1`

### F8. `skills get` does not surface enough preconditions for first-run agent use

The orchestrated Google Home HVAC skill currently requires more than just "run this command". Its real-world preconditions include:

1. Google Home installed on the burner device
2. Google Home already signed in
3. the climate unit exposed under the expected `Climate` / `Home` route
4. the exact `unit_name` label
5. for the orchestrated path, `codex` available on the host

None of that currently appears as first-class preflight metadata in `SkillEntry` or `clawperator skills get`.

So an agent may correctly find a skill, but still not know whether:

1. the replay path is safer for "check current status"
2. the orchestrated path depends on Codex specifically
3. the user must provide or confirm the exact climate-tile label

Evidence:

- orchestrated runtime path: `apps/node/src/domain/skills/runSkill.ts:1`
- skill contract shape: `apps/node/src/contracts/skills.ts:1`
- orchestrated skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1`

### F9. The best existing control skill is hard-wired to `codex`, not OpenClaw

The Google Home control skill declares:

```json
"agent": {
  "cli": "codex",
  "timeoutMs": 300000
}
```

For the exact "check current HVAC status" scenario this is not fatal, because the replay read-only skill already exists.

But for the broader intended story, "OpenClaw uses Clawperator to control Google Home", this is a real cross-product mismatch. The current flagship orchestrated HVAC runtime is not natively OpenClaw-oriented today.

Evidence:

- orchestrated skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1`

### F10. Important orientation currently lives only in install stdout

The final installer output includes useful orientation such as:

1. the skills registry path
2. the authoring-skills location
3. the agent-guide pointer
4. the suggestion that AI agents read the guide before running commands

That is useful for a human at install time, but not durable enough for OpenClaw-style agent workflows that continue later in fresh shells or future turns.

If information matters after install, it should exist in a persistent on-disk form the agent can re-read.

Evidence:

- final install summary block: `sites/landing/public/install.sh:1081`

### F11. The MCP surface exists but is not materialized as the default bridge

Clawperator already has an MCP server. In principle, this could become the cleanest bridge between OpenClaw and Clawperator because MCP gives the agent a first-class tool surface instead of forcing shell-oriented skill discovery.

But today:

1. the installer does not register the MCP server with OpenClaw or related agents
2. it does not write a ready-to-paste MCP config snippet to disk
3. the agent still has to discover MCP support from docs or source code

So the strongest existing integration surface is not yet helping the first-run onboarding flow.

Evidence:

- MCP CLI surface: `apps/node/src/cli/registry.ts:2463`

### F12. There is no opinionated first-success recipe for "evaluate Google Home HVAC status"

The shortest likely-success path for the Telegram request is roughly:

1. install Clawperator
2. verify readiness with `clawperator doctor`
3. confirm Google Home is installed and signed in on the burner
4. discover Google Home runtime skills
5. run `get-climate-replay` with the correct `--unit-name`
6. return power, mode, and temperature to the user

The system can do this today, but that path is not surfaced as a first-class onboarding recipe anywhere obvious in the install flow or agent landing surfaces.

Right now the product behaves more like an SDK install followed by open-ended exploration than a guided "yes, I can check your HVAC state through Google Home" evaluation path.

Evidence:

- setup docs: `docs/setup.md:1`
- agents page: `sites/landing/app/agents/page.js:1`

## Practical Consequence For The Telegram Scenario

If an OpenClaw agent receives:

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device"

then the likely failure points today are:

1. the agent installs Clawperator successfully
2. the agent runs `clawperator skills list` or `skills search` in a fresh shell
3. the registry is not resolved because the shell did not source the exported env var
4. even if the registry resolves, the agent may search for `"air conditioner"` or `"google home"` and miss the right skills
5. even if the agent finds the right skill, it may not realize the safer first move is the replay read-only skill rather than the orchestrated control skill
6. even if it chooses a skill correctly, it may not realize Google Home sign-in and exact tile label are prerequisites

This is a discoverability and onboarding problem, not a runtime-capability problem.

## Priority Fixes

### P0. Make installed runtime skills self-discovering for headless shells

The CLI should fall back to the installed home-directory registry path before failing:

`~/.clawperator/skills/skills/skills-registry.json`

Without this, the first canonical discovery command can still fail after a successful install.

### P0. Surface runtime skills in the generated agent guide

`~/.clawperator/AGENTS.md` should enumerate runtime skills, especially grouped by app, with:

1. `applicationId`
2. `intent`
3. `summary`
4. exact `clawperator skills run ...` examples
5. a note that Google Home HVAC skills already exist

### P0. Add an explicit OpenClaw bridge

Best candidate options:

1. append a bounded Clawperator section to `~/.agents/AGENTS.md`
2. write `~/.clawperator/TOOLS.md` or equivalent OpenClaw-oriented tool description
3. install an OpenClaw-readable bridge skill under `~/.agents/skills` or `~/.openclaw/skills`

The bridge should teach the agent to:

1. verify Clawperator readiness
2. discover runtime skills via the CLI
3. prefer existing public skills before inventing new ones
4. ask for or infer required values such as `unit_name`

### P0. Add vocabulary aliases so user-language searches find the right skills

Google Home HVAC skills should be discoverable through terms like:

1. `air conditioner`
2. `aircon`
3. `ac`
4. `google home`
5. `heater`

This is likely the smallest schema-level change that materially improves first-run agent success.

### P1. Surface skill readiness through doctor or a host-summary command

After install, the obvious next question is not just "is adb working?" but:

> "What app-level capabilities are already installed here?"

A skills-aware doctor check or summary command would answer that directly.

### P1. Add first-class skill preflight metadata

`SkillEntry` or adjacent metadata should advertise:

1. required Android package(s)
2. required host CLIs
3. user-provided inputs like `unit_name`
4. sign-in expectations
5. whether a replay path is the safer first-run option

### P1. Materialize MCP config as an install artifact

The installer should write a ready-to-paste MCP config snippet under `~/.clawperator/` for Codex, Claude Desktop, and generic stdio MCP consumers.

### P1. Add a first-class Google Home HVAC evaluation recipe

The current system needs a short, scenario-oriented doc or install follow-up that says:

1. verify device and operator readiness
2. confirm Google Home is installed and signed in
3. discover Google Home runtime skills
4. start with `get-climate-replay`
5. return current HVAC status to the user

## Smallest Viable Unblocker

If only a few changes ship, the most leverage appears to be:

1. fix registry fallback so `clawperator skills list` works after install without shell-session luck
2. render runtime skills into `~/.clawperator/AGENTS.md`
3. add search aliases so `"air conditioner"` and `"google home"` find the existing Google Home HVAC skills

Those three changes would move the Telegram scenario much closer to "just works" without requiring a larger architecture rewrite.

## Useful Evidence

- install script: `sites/landing/public/install.sh:1`
- runtime skills overview: `docs/skills/overview.md:1`
- environment docs: `docs/api/environment.md:1`
- setup docs: `docs/setup.md:1`
- agents page: `sites/landing/app/agents/page.js:1`
- OpenClaw skills docs: [https://docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
- OpenClaw AGENTS docs: [https://docs.openclaw.ai/reference/templates/AGENTS.md](https://docs.openclaw.ai/reference/templates/AGENTS.md)
- OpenClaw personal assistant docs: [https://docs.openclaw.ai/start/openclaw](https://docs.openclaw.ai/start/openclaw)
