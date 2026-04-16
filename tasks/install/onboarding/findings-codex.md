# Findings: OpenClaw Onboarding Gaps for Clawperator

## Scope

This note evaluates the current Clawperator install and onboarding path from the perspective of an OpenClaw-style personal assistant agent.

Anchor user request:

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device"

The goal here is not to redesign Clawperator from scratch. The goal is to identify the current gaps that make the above flow harder than it should be for an agent, even though the underlying runtime, skills repo, and documentation are already strong.

## Executive Summary

Clawperator already has most of the underlying pieces needed for this scenario:

1. `install.sh` installs the CLI, operator APK, and a public skills repo.
2. The public skills repo already contains Google Home HVAC skills.
3. The CLI has registry-backed `skills list`, `skills search`, `skills get`, and `skills run` commands.

The main problem is not missing capability. The main problem is missing handoff between Clawperator's runtime skill model and OpenClaw's agent skill model.

Today, after a successful `install.sh`, OpenClaw still has no obvious way to learn:

1. that runtime skills now exist under `~/.clawperator/skills`
2. how to discover them
3. how to pick the Google Home HVAC skills
4. how to run them safely in a headless agent session
5. which parts are Clawperator runtime skills versus OpenClaw-injected prompt skills

This is the core onboarding gap.

## What Exists Today

### Install path

`sites/landing/public/install.sh` does all of the following:

1. installs `clawperator`
2. runs `clawperator doctor`
3. runs `clawperator skills install`
4. writes `CLAWPERATOR_SKILLS_REGISTRY` into shell rc files
5. installs authoring skills
6. writes `~/.clawperator/AGENTS.md`

Evidence:

- Installer skill setup: `sites/landing/public/install.sh:490`
- Installer authoring-skill setup: `sites/landing/public/install.sh:540`
- Installer agent guide write: `sites/landing/public/install.sh:598`
- Final install summary: `sites/landing/public/install.sh:1068`

### Runtime skills model

Clawperator runtime skills are registry-driven, not folder-scan-driven. The CLI reads them via `CLAWPERATOR_SKILLS_REGISTRY`, otherwise from `<cwd>/skills/skills-registry.json`.

Evidence:

- Registry loader: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:6`
- Skills overview docs: `docs/skills/overview.md:17`
- Environment docs: `docs/api/environment.md:145`

### Public Google Home HVAC skills already exist

The sibling public skills repo currently contains these Google Home skills:

| Skill ID | Intent | Current role |
| --- | --- | --- |
| `com.google.android.apps.chromecast.app.get-climate-replay` | `get-climate` | Read climate status |
| `com.google.android.apps.chromecast.app.set-power-replay` | `set-power` | Toggle HVAC power |
| `com.google.android.apps.chromecast.app.set-temperature-replay` | `set-temperature` | Set target temp |
| `com.google.android.apps.chromecast.app.control-hvac-orchestrated` | `control-hvac` | Agent-driven one-action controller |

Evidence:

- Registry entries: `../clawperator-skills/skills/skills-registry.json:89`
- Orchestrated skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1`
- Replay skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1`

## Findings

### F1. `install.sh` installs runtime skills, but does not make them discoverable to OpenClaw

Clawperator installs runtime skills into `~/.clawperator/skills` and exposes them to the `clawperator` CLI through `CLAWPERATOR_SKILLS_REGISTRY`.

OpenClaw does not use that discovery model. OpenClaw's docs say it loads skills from:

1. `<workspace>/skills`
2. `<workspace>/.agents/skills`
3. `~/.agents/skills`
4. `~/.openclaw/skills`
5. bundled skills

That means a successful Clawperator install does not, by itself, make Clawperator runtime skills visible to OpenClaw's prompt-building or skill-selection system.

Impact:

An OpenClaw agent can finish the install and still remain unaware that Google Home HVAC skills are present locally.

Evidence:

- Clawperator install location: `apps/node/src/domain/skills/skillsConfig.ts:6`
- Clawperator sync target: `apps/node/src/domain/skills/syncSkills.ts:41`
- OpenClaw skill locations: [OpenClaw Skills docs](https://docs.openclaw.ai/tools/skills)

### F2. The installer wires authoring skills into agent discovery directories, but not runtime skills

This is a particularly important mismatch.

`install.sh` installs authoring skills and wires them into:

1. `~/.claude/skills`
2. `${CODEX_HOME:-~/.codex}/skills`
3. `~/.agents/skills`

But it does not do the equivalent for Clawperator runtime skills.

So after install, generic agents can discover Clawperator authoring helpers, but not the actual runtime Google Home HVAC skills that matter for user-on-behalf use.

Impact:

The host ends up optimized for repository maintenance workflows before it is optimized for the real end-user agent workflow.

Evidence:

- Authoring skill install summary: `sites/landing/public/install.sh:540`
- Authoring skill discovery docs: `docs/skills/authoring.md:45`
- No equivalent runtime-skill symlink/install flow exists in `install.sh`

### F3. Clawperator's own CLI does not default to the installed runtime skills repo

This is the highest-friction implementation detail in the current design.

After install, the long-lived runtime registry lives at:

`~/.clawperator/skills/skills/skills-registry.json`

But the CLI default when `CLAWPERATOR_SKILLS_REGISTRY` is unset is:

`<cwd>/skills/skills-registry.json`

That means the install is not self-describing unless the later shell session loads the exported environment variable successfully.

This is fragile for agent use because OpenClaw and other headless runtimes commonly launch commands in fresh, non-interactive shells that may not source `~/.zshrc` or `~/.bashrc`.

Impact:

An OpenClaw agent may run:

```bash
clawperator skills search google-home --json
```

and get a registry error even though the installer already cloned the skills repo successfully.

Evidence:

- Default path behavior: `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8`
- Installer shell export behavior: `sites/landing/public/install.sh:505`
- Environment docs: `docs/api/environment.md:145`

### F4. The generated agent guide is written to `~/.clawperator/AGENTS.md`, not OpenClaw's workspace

The installer writes a small guide to `~/.clawperator/AGENTS.md`.

OpenClaw's documented workspace, however, is `~/.openclaw/workspace`, and its durable operating instructions live there. OpenClaw does not, by default, read `~/.clawperator/AGENTS.md`.

So even the installer artifact that tries to help "AI agents" is written to a location that OpenClaw is unlikely to consume.

Impact:

The system does produce agent-facing context, but not in the place OpenClaw actually reads.

Evidence:

- Installer guide write: `sites/landing/public/install.sh:598`
- OpenClaw workspace docs: [Personal Assistant Setup](https://docs.openclaw.ai/start/openclaw)

### F5. The generated guide documents authoring skills, but not runtime skill discovery or Google Home usage

The generated `~/.clawperator/AGENTS.md` focuses on:

1. `doctor`
2. `snapshot`
3. a simple click example
4. installed authoring skills

It does not teach an agent:

1. where runtime skills were installed
2. that public runtime skills came from `clawperator-skills`
3. how to run `clawperator skills list/search/get`
4. how to find the Google Home HVAC skills
5. what arguments those skills need

Impact:

Even if an agent finds the guide, it still does not learn the one thing that matters for the Telegram HVAC scenario.

Evidence:

- Generated guide template: `sites/landing/public/install.sh:605`

### F6. There is no OpenClaw-specific bridge story after install

The marketing site correctly frames the relationship as "OpenClaw/agent is the brain; Clawperator is the hand". But there is no concrete OpenClaw-specific post-install bridge that tells the agent what to do next.

Missing pieces include:

1. no documented `openclaw` workflow for invoking Clawperator
2. no OpenClaw skill that teaches discovery and use of Clawperator runtime skills
3. no OpenClaw workspace bootstrap that records the installed Clawperator registry path
4. no documented Telegram assistant flow for a message like the HVAC example

Impact:

The product story is correct at the concept level, but still under-specified at the first real user turn.

Evidence:

- Landing page framing: `sites/landing/app/page.js:401`
- Agents page: `sites/landing/app/agents/page.js:1`
- Repo search shows almost no public OpenClaw integration guidance beyond conceptual mentions

### F7. The public skills exist, but the discovery path is still too implicit

From an agent's point of view, "Google Home HVAC support exists" is currently a hidden fact.

Yes, the repo contains the right skills. Yes, the CLI exposes `skills search`. But an agent still has to independently infer:

1. the package name is `com.google.android.apps.chromecast.app`
2. the relevant concept keywords are `climate`, `hvac`, `temperature`, or `power`
3. the desired tile label must be passed as `unit_name`

That is good enough for a developer who already knows the system. It is not yet good enough for a first-time personal assistant agent doing product evaluation on behalf of a user.

Impact:

A simple user request still requires too much repo archaeology or package-name guessing.

Evidence:

- Skill search behavior is exact for app and intent, substring-only for keyword: `apps/node/src/domain/skills/searchSkills.ts:14`
- Google Home skill IDs and contracts: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1`

### F8. The best existing "control" skill is hard-wired to `codex`, not OpenClaw

The orchestrated HVAC skill declares:

```json
"agent": {
  "cli": "codex",
  "timeoutMs": 300000
}
```

That means `clawperator skills run com.google.android.apps.chromecast.app.control-hvac-orchestrated ...` currently expects Codex to be the inner runtime agent.

For the requested "check status" use case, this is not a blocker because the replay status skill exists. But for the broader "let OpenClaw use Clawperator to control Google Home" story, it is a real cross-product gap.

Impact:

OpenClaw cannot honestly claim that the existing orchestrated HVAC runtime is natively OpenClaw-driven today.

Evidence:

- Orchestrated skill manifest: `../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1`
- Runtime source injection path: `apps/node/src/domain/skills/runSkill.ts:1`

### F9. The first user-success path still lacks an opinionated "evaluate and read current HVAC status" recipe

For the exact Telegram request, the shortest likely-success path is roughly:

1. install Clawperator
2. verify one target device with `clawperator doctor`
3. ensure Google Home is installed and logged in on the burner
4. discover available Google Home runtime skills
5. run `get-climate-replay` with the right `--unit-name`
6. return the parsed status to the user

The system can do this, but that path is not surfaced as a first-class onboarding flow anywhere obvious in the landing install path.

Impact:

The user wants product evaluation. The current flow behaves more like an SDK install followed by manual exploration.

Evidence:

- Setup docs focus on generic readiness: `docs/setup.md:1`
- Landing agent page is routing-oriented, not scenario-oriented: `sites/landing/app/agents/page.js:1`

## Practical Consequence For The Telegram HVAC Scenario

If an OpenClaw agent receives:

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device"

then the current likely failure points are:

1. the agent can install Clawperator successfully
2. the agent may not inherit `CLAWPERATOR_SKILLS_REGISTRY`
3. the agent may not know that public runtime skills were installed
4. the agent may not know the relevant Google Home skill IDs
5. the agent may not know it needs a Google Home tile label such as `"Living Room AC"`
6. the agent may conclude "no obvious skills found" even though the skills are present

This is a discoverability and integration problem, not a runtime capability problem.

## Highest-Leverage Gaps To Fix

### P0. Make installed runtime skills self-discovering for headless agents

Best candidate fixes:

1. Make `loadRegistry()` fall back to `~/.clawperator/skills/skills/skills-registry.json` before failing.
2. Or write an install-state file that Clawperator commands read directly without depending on shell rc sourcing.

This would remove the biggest accidental failure mode after a successful install.

### P0. Give OpenClaw an explicit bridge into Clawperator runtime skills

Best candidate fixes:

1. install an OpenClaw-readable bridge skill under `~/.agents/skills` or `~/.openclaw/skills`
2. teach that bridge skill to verify Clawperator readiness
3. teach that bridge skill to discover runtime skills via `clawperator skills list/search/get`
4. teach that bridge skill to prefer existing public skills before inventing new ones
5. teach that bridge skill to explain required inputs like `unit_name`

This is likely better than trying to pretend Clawperator runtime skills are already equivalent to OpenClaw prompt skills.

### P0. Add a first-class Google Home HVAC evaluation recipe

Best candidate outputs:

1. a public doc page
2. an agent-facing install follow-up snippet
3. a bridge skill prompt example

The exact evaluation path should say:

1. verify device
2. confirm Google Home installed/logged in
3. search skills for `chromecast`, `google home`, `climate`, `hvac`
4. run `get-climate-replay`
5. report current power, mode, and temperature

### P1. Stop writing the agent guide only into `~/.clawperator/AGENTS.md`

If OpenClaw is the intended agent audience, the system should either:

1. write a companion file into an OpenClaw-readable location when OpenClaw is detected
2. or clearly document the bridge step needed to copy/summarize this into `~/.openclaw/workspace`

### P1. Document runtime skills separately from authoring skills in onboarding copy

Right now authoring skill installation is more explicit than runtime skill installation.

That is backwards for the everyday personal-assistant use case.

### P1. Add an OpenClaw-compatible orchestrated runtime story

For the broader "OpenClaw controls HVAC through Clawperator" story, the current orchestrated skill being pinned to `codex` will become more visible over time.

Options:

1. support `openclaw` as an orchestrated skill runtime CLI
2. make the runtime CLI configurable at install/onboarding time
3. provide OpenClaw-specific orchestrated siblings for flagship workflows like Google Home HVAC

## Recommended Product Framing

The current product truth appears to be:

1. Clawperator already supports the Google Home HVAC scenario.
2. The public skills already exist.
3. The missing piece is agent handoff and discovery after install.

So the main onboarding message should probably become:

> "Clawperator installed successfully. Public runtime skills are now available locally. If you are an agent, start by discovering installed skills with `clawperator skills search ...` or by using the OpenClaw bridge skill."

That is much closer to the real state of the system than the current install finish state.

## Useful Evidence Links

- Clawperator install script: `sites/landing/public/install.sh:1`
- Clawperator runtime skills overview: `docs/skills/overview.md:1`
- Clawperator environment docs: `docs/api/environment.md:1`
- Clawperator setup docs: `docs/setup.md:1`
- Clawperator agents page: `sites/landing/app/agents/page.js:1`
- OpenClaw skills docs: [https://docs.openclaw.ai/tools/skills](https://docs.openclaw.ai/tools/skills)
- OpenClaw agent runtime docs: [https://docs.openclaw.ai/concepts/agent](https://docs.openclaw.ai/concepts/agent)
- OpenClaw personal assistant setup: [https://docs.openclaw.ai/start/openclaw](https://docs.openclaw.ai/start/openclaw)
