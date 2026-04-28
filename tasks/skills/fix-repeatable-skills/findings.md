# Findings

## Executive Summary

Clawperator has a solid generic runtime skill layer, but the repeatable personal automation layer is incomplete. Runtime skills live under `~/.clawperator/skills` and are intentionally discovered through the `clawperator skills` CLI and `skills-registry.json`, not by host agents scanning skill folders. The missing piece is a small set of personal agent-facing wrapper skills in OpenClaw-discoverable or shared agent-discoverable locations.

The implementation priority is to create or repair personal wrappers that translate natural requests into explicit Clawperator skill invocations. Those wrappers should hold local defaults and vocabulary such as the preferred device, operator package, room aliases, and default media profile. Generic Clawperator skills should stay nonpersonal and parameterized.

Do not mirror or symlink `~/.clawperator/skills` into shared agent skill directories as the primary fix. The repo and installed host guide already define the bridge: agents should use `clawperator skills for-app`, `clawperator skills search`, `clawperator skills get`, and `clawperator skills run`.

## Current State

Clawperator runtime skills are registry-driven. `docs/skills/overview.md` says skills are not discovered by folder scanning alone, and that `clawperator skills list`, `for-app`, `search`, `get`, `validate`, and `run` all read the registry through `loadRegistry()` in `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`.

The registry resolution path is:

1. explicit `registryPath`
2. `CLAWPERATOR_SKILLS_REGISTRY`
3. `<cwd>/skills/skills-registry.json`
4. when no explicit path or env var is active, fallback to `../../skills/skills-registry.json` from `apps/node`
5. fallback to `~/.clawperator/skills/skills/skills-registry.json`

`docs/skills/overview.md` also states the installer writes a local runtime guide to `~/.clawperator/AGENTS.md`, appends a bounded bridge into `~/.agents/AGENTS.md` when present, and does not mirror runtime skills into shared agent skill directories such as `~/.agents/skills`, `~/.claude/skills`, or `~/.codex/skills`.

The installed bridge in `~/.agents/AGENTS.md` matches that design:

```text
Clawperator runtime skills stay in the `clawperator` CLI surface.
Do not mirror them into shared agent skill directories.
```

OpenClaw has agent-facing workspace skills under `~/.openclaw/workspace/skills`. Several are stale and still reference the legacy ActionTask/FCM path:

- `~/.openclaw/workspace/skills/home-set-aircon/SKILL.md`
- `~/.openclaw/workspace/skills/home-get-solax-battery/SKILL.md`
- `~/.openclaw/workspace/skills/home-get-globird-usage/SKILL.md`

The current `~/.openclaw/workspace/HEARTBEAT.md` has already moved the home-battery reminder to the better device path:

```bash
clawperator skills run com.solaxcloud.starter.get-battery --device <device_serial>
```

Relevant generic runtime skills exist in `~/src/clawperator-skills/skills` and the installed registry. For AirTouch, `clawperator skills search --app au.com.polyaire.airtouch5` returns:

- `au.com.polyaire.airtouch5.set-power-state`
- `au.com.polyaire.airtouch5.set-zone-state`
- `au.com.polyaire.airtouch5.set-fan-level`
- `au.com.polyaire.airtouch5.set-mode`

Other relevant generic runtime skills include:

- `com.netflix.mediaclient.set-my-list-state-replay`
- `com.solaxcloud.starter.get-battery`
- `com.globird.energy.get-yesterday-usage-cost-replay`
- `com.globird.energy.get-usage`

## Key Findings

### 1. Generic runtime skills are not the right assistant-facing discovery layer

**Problem**

The generic Clawperator runtime skills are app-level execution packages. Their names and descriptions are written for `clawperator skills` runtime discovery, not for personal natural-language intent routing.

**Evidence**

- `docs/skills/overview.md` says runtime skills are registry-driven and not discovered by folder scanning alone.
- `apps/node/src/domain/host/hostSetup.ts` writes the shared agent bridge with the instruction: "Do not mirror them into shared agent skill directories."
- `~/.agents/AGENTS.md` contains the installed bridge that points agents to `~/.clawperator/AGENTS.md` and `clawperator skills` commands.
- `~/.clawperator/AGENTS.md` lists runtime skill ids and examples rather than acting as a prompt-skill directory.

**Impact**

Making `~/.clawperator/skills` directly discoverable would mix two abstractions. It would expose generic runtime packages as if they were personal assistant skills, while still failing to answer local questions like "which device?", "which profile?", and "what does living room mean in the target app?"

**Recommended Fix**

Keep `~/.clawperator/skills` runtime-only. Use the CLI bridge for runtime skill discovery. Create personal wrapper skills in agent-discoverable locations that call the generic runtime skills with explicit arguments.

### 2. The missing layer is personal wrappers with local defaults and vocabulary

**Problem**

OpenClaw and other agents need a personal intent layer that maps natural user requests to generic Clawperator skill calls.

**Evidence**

- AirTouch zone skill requires exact inputs: `--zone-name <label>` and `--state <on|off>`.
- Netflix My List skill requires `--action`, `--title`, and `--profile`.
- SolaX battery skill can run directly through `clawperator skills run com.solaxcloud.starter.get-battery --device <device_serial>`.
- Session evidence shows natural room wording can differ from app labels. A request for "Living Room" failed with `AirTouch Zones view did not expose the Living Room row`, while the app label `living` succeeded later.

**Impact**

Without wrappers, agents must infer local facts every run. That leads to retries, wrong argument shapes, extra clarification, or false success claims after a runtime failure.

**Recommended Fix**

Create personal wrapper skills for repeatable automations. The wrappers should supply:

- default device reference
- default operator package policy
- app label aliases such as `living room` -> `living`
- default profile names as placeholders or local-only values
- exact `clawperator skills run ...` commands
- success criteria based on `skillResult.status` and verification fields

### 3. Existing OpenClaw workspace skills are stale and should be migrated or retired

**Problem**

Several `~/.openclaw/workspace/skills` entries still point to the old ActionTask/FCM pipeline.

**Evidence**

- `home-set-aircon` documents `ac:on`, `ac:off`, and `~/src/ActionTask/scripts/operator_event_ac_status.sh`.
- `home-get-solax-battery` documents `~/src/ActionTask/scripts/operator_event_solax_battery.sh`.
- `home-get-globird-usage` documents `~/src/ActionTask/scripts/operator_event_globird_usage.sh`.
- The session log showed at least one ActionTask script path failed with "no such file or directory".
- `HEARTBEAT.md` now explicitly says to use Clawperator on the physical Android device and not the SolaX web/API path for the home battery reminder.

**Impact**

If an agent triggers one of these stale personal skills, it may follow dead instructions even though a working Clawperator runtime skill exists.

**Recommended Fix**

Rewrite or delete the stale workspace skills. For user-initiated requests, replace them with wrappers around `clawperator skills run`. For scheduled workflows that do not need natural-language normalization, keep the command directly in `HEARTBEAT.md`.

### 4. The personal skill home must match the agent surface

**Problem**

There are multiple agent skill homes with different discovery behavior.

**Evidence**

- OpenClaw docs and local session behavior show workspace skills under `~/.openclaw/workspace/skills` are available to the OpenClaw main agent.
- `openclaw skills list --eligible --json` showed personal AgentSkills from `~/.agents/skills` with source `agents-skills-personal`.
- Existing Codex skills are loaded from `.agents/skills` in this repo and user-scoped `~/.agents/skills`.
- Wrapper placement depends on which agent surface must trigger the automation.

**Impact**

Putting the wrappers in only one place may solve the problem for one agent surface but not another.

**Recommended Fix**

Use placement intentionally:

- `~/.openclaw/workspace/skills`: OpenClaw assistant workflows tied to this workspace.
- `~/.agents/skills`: personal, cross-workspace AgentSkills for Codex, Claude Code, and other compatible hosts.
- `~/.openclaw/skills`: OpenClaw-managed shared/local skills when that lifecycle is desired.
- `~/.clawperator/skills`: Clawperator runtime skill installation only.

If the same home automation must be available from both OpenClaw and direct coding agents, either duplicate a small wrapper in both discoverable homes or create one canonical wrapper plus a thin delegating wrapper.

### 5. Runtime failures must be surfaced truthfully

**Problem**

Several Clawperator skill attempts failed for reasons unrelated to intent selection, including argument shape, snapshot extraction, missing app/package state, and app UI mismatch.

**Evidence**

- An AirTouch attempt first passed `state=on` after `--`, which produced a failed SkillResult with the note `Pass --state on or --state off`.
- A retry with `--state on` reached the app but failed at runtime with `SKILL_EXECUTION_FAILED`.
- A direct snapshot attempt failed with `SNAPSHOT_EXTRACTION_FAILED` while `foreground_package` was `au.com.polyaire.airtouch5` and `overlay_package` was `com.sec.android.app.launcher`.
- GloBird yesterday-cost replay failed when no UI node matched `Energy`.
- Netflix work encountered environment-dependent blockers and the runtime skill requires explicit `--profile`.

**Impact**

A wrapper that only encodes aliases is not enough. It must also define what counts as success and how to report failure.

**Recommended Fix**

Every wrapper should:

- rely on the default JSON output
- parse the returned JSON or instruct the agent to inspect `skillResult`
- report success only when `skillResult.status` is `success`
- include `skillResult.result`, checkpoints, and `terminalVerification` in the response or troubleshooting path
- preserve failures such as `SKILL_EXECUTION_FAILED`, `SNAPSHOT_EXTRACTION_FAILED`, missing nodes, and missing package/app state

## Recommended Implementation Plan

### Phase 1: Establish canonical personal config

Create one small local reference for shared personal defaults. The likely home is `~/.openclaw/workspace/TOOLS.md` for OpenClaw, with placeholders in repo/task docs:

- preferred physical device: `<device_serial>`
- preferred local operator package: `com.clawperator.operator.dev` when that debug Operator is installed and healthy, otherwise release package `com.clawperator.operator`
- default media profile: `<profile_name>`
- AirTouch alias table, initially:
  - `living room`, `lounge` -> `living`
  - `office`, `study` -> `Office`

Keep private values out of committed repo files.

### Phase 2: Replace stale OpenClaw workspace skills

Rewrite these as thin Clawperator wrappers or delete them if redundant:

- `~/.openclaw/workspace/skills/home-set-aircon`
- `~/.openclaw/workspace/skills/home-get-aircon-status`
- `~/.openclaw/workspace/skills/home-get-solax-battery`
- `~/.openclaw/workspace/skills/home-get-globird-usage`
- `~/.openclaw/workspace/skills/home-get-bedroom-temperature`

For SolaX scheduled battery checks, keep `HEARTBEAT.md` on the direct Clawperator command path unless natural-language trigger handling is needed.

### Phase 3: Add AirTouch personal wrappers

Create:

- `home-hvac-set-power-state`
- `home-hvac-set-zone-state`
- optionally `home-hvac-set-mode`
- optionally `home-hvac-set-fan-level`

Example power wrapper:

~~~markdown
---
name: home-hvac-set-power-state
description: Set the home AirTouch 5 system power on or off through Clawperator. Use when asked to turn AC, aircon, air conditioner, cooling, heating, or climate control on or off for the whole system.
---

Use Clawperator on the physical Android device.

Defaults:

- device: `<device_serial>`
- operator package: `<operator_package>`
- runtime skill: `au.com.polyaire.airtouch5.set-power-state`

Normalize requested state:

- `on`, `enable`, `turn on`, `start` -> `on`
- `off`, `disable`, `turn off`, `stop` -> `off`

Run:

```bash
clawperator skills run au.com.polyaire.airtouch5.set-power-state \
  --device <device_serial> \
  --operator-package <operator_package> \
  -- \
  --state '<on|off>'
```

Report success only when `skillResult.status` is `success`.
~~~

Example zone wrapper:

~~~markdown
---
name: home-hvac-set-zone-state
description: Set a named home AirTouch 5 HVAC zone on or off through Clawperator. Use when asked to turn AC, aircon, cooling, heating, or climate control on or off for a room or zone, including aliases such as living room, lounge, office, or study.
---

Use Clawperator on the physical Android device.

Defaults:

- device: `<device_serial>`
- operator package: `<operator_package>`
- runtime skill: `au.com.polyaire.airtouch5.set-zone-state`

Normalize requested state:

- `on`, `enable`, `turn on`, `start` -> `on`
- `off`, `disable`, `turn off`, `stop` -> `off`

Normalize room aliases:

- `living room`, `lounge` -> `living`
- `office`, `study` -> `Office`

Run:

```bash
clawperator skills run au.com.polyaire.airtouch5.set-zone-state \
  --device <device_serial> \
  --operator-package <operator_package> \
  -- \
  --zone-name '<normalized_zone_label>' \
  --state '<on|off>'
```

If a zone alias is unknown, inspect the live AirTouch Zones screen or ask for the exact app label. Do not guess. Report success only when `skillResult.status` is `success`.
~~~

### Phase 4: Add media and energy wrappers

Create `media-netflix-set-my-list-state`:

~~~markdown
---
name: media-netflix-set-my-list-state
description: Add or remove Netflix titles from the default profile's My List on the Android Netflix app through Clawperator. Use when asked to add, save, remove, unsave, or check a title in Netflix My List.
---

Defaults:

- device: `<device_serial>`
- profile: `<profile_name>`
- runtime skill: `com.netflix.mediaclient.set-my-list-state-replay`

Normalize action:

- `add`, `save`, `put on my list`, `watch later` -> `add`
- `remove`, `delete`, `take off my list`, `unsave` -> `remove`

Run:

```bash
clawperator skills run com.netflix.mediaclient.set-my-list-state-replay \
  --device <device_serial> \
  -- \
  --action '<add|remove>' \
  --title '<title>' \
  --profile '<profile_name>'
```

If the app is missing or profile selection fails, report the blocker. Do not claim the list changed unless the returned skill result verifies the final state.
~~~

Create or repair energy wrappers only where natural-language user routing adds value:

- `home-battery-get-level` can call `com.solaxcloud.starter.get-battery`.
- `home-energy-get-yesterday-usage-cost` can call `com.globird.energy.get-yesterday-usage-cost-replay`, but should document the known `Energy` node failure mode and fallback to `com.globird.energy.get-usage` if that skill is the more reliable current path.

### Phase 5: Decide cross-agent distribution

After the OpenClaw wrappers work, decide whether each should also exist in `~/.agents/skills`. Keep shared wrappers concise and avoid duplicating private values in committed repo files. If duplication becomes annoying, use a small local reference file for defaults and make wrappers refer to it.

## Validation

### Static validation

Run after creating or editing wrappers:

```bash
openclaw skills list --eligible --json
```

Confirm the new wrapper names appear in the expected source. If wrappers are added under `~/.agents/skills`, validate their `SKILL.md` frontmatter with the applicable AgentSkills validator when available.

Confirm the generic runtime skills are discoverable:

```bash
clawperator skills search --app au.com.polyaire.airtouch5
clawperator skills get au.com.polyaire.airtouch5.set-zone-state
clawperator skills get com.netflix.mediaclient.set-my-list-state-replay
clawperator skills get com.solaxcloud.starter.get-battery
```

### Runtime validation

Check device selection first:

```bash
clawperator devices
adb devices
```

Then validate direct runtime skills before blaming wrappers:

```bash
clawperator skills run au.com.polyaire.airtouch5.set-power-state \
  --device <device_serial> \
  --operator-package <operator_package> \
  -- \
  --state on

clawperator skills run au.com.polyaire.airtouch5.set-zone-state \
  --device <device_serial> \
  --operator-package <operator_package> \
  -- \
  --zone-name Office \
  --state off

clawperator skills run com.solaxcloud.starter.get-battery \
  --device <device_serial>
```

Forward-test the personal wrappers from a fresh OpenClaw session:

- "turn on AC"
- "turn off AC in the office"
- "turn off AC in the living room"
- "what is the home battery at?"
- "add <title> to my Netflix list"
- "remove <title> from my Netflix list"

For each test, verify:

- the agent selected the personal wrapper first
- the wrapper selected the intended generic runtime skill
- `skillResult.status` was checked before reporting success
- failures were surfaced with the relevant error code and checkpoint

### Repo validation if changes land in this repo

If implementation changes touch Clawperator code, contracts, CLI behavior, docs, or generated docs, follow the repo validation loop from `AGENTS.md`. For wrapper-only changes under home directories, do not run Android or Node repo tests unless the implementation also changes repo code.

## Risks and Edge Cases

- **Operator package mismatch:** Local development usually prefers `com.clawperator.operator.dev`, while installed runtime skills may default to `com.clawperator.operator`. Wrappers must choose deliberately and keep the choice in one local config.
- **Multiple devices:** Wrappers must pass `--device <device_serial>` when multiple devices or emulators are connected.
- **AirTouch label drift:** Zone labels are app data, not stable API names. Unknown aliases should trigger live inspection or a clarification instead of guessing.
- **AirTouch screenshot verification:** Power and zone state verification is screenshot or crop based because the app WebView does not expose semantic on/off state. Layout changes can break heuristics.
- **Snapshot extraction failures:** `SNAPSHOT_EXTRACTION_FAILED` can block otherwise correct AirTouch commands. Wrappers should report it as a runtime blocker, not as an intent failure.
- **Netflix app/profile state:** Netflix may be missing, signed out, on a profile chooser, or expose changed resource ids. The wrapper should pass the default profile but still surface app/package/profile-selection failures.
- **GloBird UI drift:** The yesterday-cost replay depends on current labels such as `Energy`, `YESTERDAY USAGE`, and `Cost`. If those labels move or change, the wrapper should fall back to the broader usage skill or report the parser failure.
- **Stale workspace skills:** Leaving old ActionTask wrappers in place can cause agents to follow dead paths.
- **Private identifiers:** Device serials, profile names, local usernames, tokens, and personal names must stay in local uncommitted config or placeholders in repo docs.

## Open Questions

- Should the first implementation target `~/.openclaw/workspace/skills`, `~/.agents/skills`, or both?
- What is the complete current AirTouch zone label list from the live app?
- Which operator package is the reliable default for OpenClaw-triggered runs on this host: `com.clawperator.operator.dev` or `com.clawperator.operator`?
- Should Google Home HVAC skills remain an alternate route, or should AirTouch be the canonical HVAC path for personal wrappers?
- Is `com.globird.energy.get-yesterday-usage-cost-replay` reliable enough after recent app changes, or should `com.globird.energy.get-usage` be the initial personal wrapper target?
