# Repeatable Skills Findings

## Summary

Your instinct is right, with one important path correction.

The missing layer is not "make the public Clawperator skill repo personal." The missing layer is a small set of personal OpenClaw or AgentSkills wrappers that live in an agent-discoverable location and call the generic Clawperator runtime skills with your local defaults, vocabulary, device id, operator package, and app-specific preferences.

The durable split should be:

1. `github.com/clawperator/clawperator-skills`
   - Generic, reusable Android automation runtime skills.
   - No <person_name>-specific profile names, home zone aliases, or local device assumptions.
   - Canonical local dev checkout: `~/src/clawperator-skills`.
   - Runtime install/cache home for Clawperator: `~/.clawperator/skills`.
2. OpenClaw / AgentSkills personal layer
   - Personal wrappers that make natural-language requests repeatable.
   - Good homes:
     - `~/.agents/skills` for personal skills shared across OpenClaw workspaces and other compatible agent hosts.
     - `~/.openclaw/workspace/skills` for skills that belong only to this OpenClaw workspace.
     - `~/.openclaw/skills` for OpenClaw managed/local shared skills.
   - These wrappers should call `clawperator skills run ...` against the generic Clawperator skill ids.

## OpenClaw Skill Discovery

OpenClaw's current docs say it loads AgentSkills-compatible folders from several locations:

- Extra dirs configured with `skills.load.extraDirs`.
- Bundled skills.
- Managed/local skills at `~/.openclaw/skills`.
- Personal agent skills at `~/.agents/skills`.
- Project agent skills at `<workspace>/.agents/skills`.
- Workspace skills at `<workspace>/skills`.

The documented precedence is:

`<workspace>/skills` > `<workspace>/.agents/skills` > `~/.agents/skills` > `~/.openclaw/skills` > bundled skills > `skills.load.extraDirs`

Sources:

- [OpenClaw Skills - locations and precedence](https://docs.openclaw.ai/tools/skills)
- [OpenClaw CLI skills reference](https://docs.openclaw.ai/cli/skills)
- [OpenClaw ClawHub guide](https://docs.openclaw.ai/tools/clawhub)

This means `~/.clawperator/skills` is not the OpenClaw managed skill directory. It is the Clawperator runtime skill directory. OpenClaw will not treat it as a first-class skill source unless you explicitly add it through OpenClaw config, symlink it into an OpenClaw skill root, or create wrapper skills elsewhere.

However, adding `~/.clawperator/skills` directly to OpenClaw discovery would be the wrong primary fix. Those skills are generic runtime automation packages, and their names and descriptions are written for Clawperator skill execution, not for your personal assistant's intent routing.

## Local Evidence

`openclaw skills list --eligible --json` confirms OpenClaw already sees personal AgentSkills from `~/.agents/skills` with source `agents-skills-personal`.

The same session log also shows OpenClaw had workspace skills under `~/.openclaw/workspace/skills`, including:

- `home-get-globird-usage`
- `home-get-solax-battery`
- `home-set-aircon`
- `show-android-device`
- `solax-summary-fetch`

Those skills triggered from user language, which proves the OpenClaw prompt layer can discover and use personal wrappers. The weak point is that the existing wrappers are stale or ad hoc. For example:

- `home-get-globird-usage` pointed at `~/src/ActionTask/scripts/operator_event_globird_usage.sh`, which did not exist in the session.
- `check-home-battery` initially used a SolaX API script and failed because `SOLAX_TOKENID` was missing.
- A later heartbeat was corrected to use the Clawperator runtime skill: `clawperator skills run com.solaxcloud.starter.get-battery --device <device_serial> --output json`.
- The AirTouch attempt found the generic Clawperator skills with `clawperator skills search --app au.com.polyaire.airtouch5 --output json`, but the agent first passed arguments in the wrong shape and then hit a runtime snapshot failure.

The lesson is not "skills are undiscoverable." The lesson is "the discoverable skills need to be the personal intent layer, and that layer should invoke the maintained Clawperator skills instead of old one-off ActionTask scripts."

## Recommended Architecture

Use two skill layers.

### Layer 1: Generic Clawperator Runtime Skills

Keep these in `~/src/clawperator-skills` and install/sync them to `~/.clawperator/skills`.

Examples:

- `au.com.polyaire.airtouch5.set-power-state`
- `au.com.polyaire.airtouch5.set-zone-state`
- `com.netflix.mediaclient.set-my-list-state-replay`
- `com.globird.energy.get-yesterday-usage-cost-replay`
- `com.solaxcloud.starter.get-battery`

These should stay generic:

- Take explicit inputs.
- Avoid personal aliases like "living room" unless the app itself displays that label.
- Avoid hardcoded profile names.
- Avoid hardcoded local device ids.
- Emit deterministic `[Clawperator-Skill-Result]` results.

### Layer 2: Personal OpenClaw / AgentSkills Wrappers

Create personal skills in `~/.agents/skills` for things you expect to ask naturally from OpenClaw.

Examples:

- `home-hvac-set-power-state`
- `home-hvac-set-zone-state`
- `home-hvac-set-mode`
- `home-hvac-set-fan-level`
- `home-energy-get-yesterday-usage-cost`
- `home-battery-get-level`
- `media-netflix-set-my-list-state`

These wrappers should encode the personal context:

- Preferred physical device id: `<device_serial>`.
- Preferred local operator package: `com.clawperator.operator.dev` for local development when installed, or release package when that is the known working runtime.
- Human vocabulary and aliases:
  - "AC", "aircon", "air conditioner" -> AirTouch 5.
  - "living room" -> displayed zone label `living`.
  - "office" -> displayed zone label `Office`, if that is the app label.
- Netflix profile default:
  - profile `<person_name>`.
- Recovery behavior:
  - Run `clawperator devices` or `adb devices` if device selection is ambiguous.
  - Use `clawperator skills search --app <package> --output json` when the exact runtime skill id is not known.
  - Surface Clawperator failures truthfully instead of claiming completion.

## Why Wrappers Beat Symlinking

A symlink from `~/.agents/skills` to `~/.clawperator/skills` might make files visible, but it would mix abstractions:

- Generic runtime skill names like `au.com.polyaire.airtouch5.set-zone-state` are not ergonomic assistant-facing triggers.
- Generic descriptions cannot include your personal aliases without contaminating the public Clawperator skills repo.
- Runtime skills describe how to execute a deterministic app automation. Personal AgentSkills should describe when the assistant should choose that automation.
- OpenClaw skill descriptions are the primary trigger surface. A wrapper can say "Use when <person_name> asks to turn AC on/off, set AirTouch zones, or use room nicknames." The generic runtime skill should not.

Use symlinks only for development convenience if needed, not as the primary design.

## Example Wrapper Shape

`~/.agents/skills/home-hvac-set-zone-state/SKILL.md`:

~~~markdown
---
name: home-hvac-set-zone-state
description: Set a named home AirTouch 5 HVAC zone on or off through Clawperator. Use when <person_name> asks to turn AC, aircon, cooling, heating, or climate control on/off for a room or zone, including aliases such as living room, office, bedroom, or guest room.
---

Use Clawperator on the physical Android device.

Defaults:

- device: `<device_serial>`
- operator package: `com.clawperator.operator.dev`
- runtime skill: `au.com.polyaire.airtouch5.set-zone-state`

Normalize requested state:

- `on`, `enable`, `turn on`, `cool`, `start` -> `on`
- `off`, `disable`, `turn off`, `stop` -> `off`

Normalize room aliases:

- `living room`, `lounge` -> `living`
- `office`, `study` -> `Office`

Run:

```bash
clawperator skills run au.com.polyaire.airtouch5.set-zone-state \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --output json \
  -- \
  --zone-name '<normalized_zone_label>' \
  --state '<on|off>'
```

Read the returned `skillResult`. Only report success when `skillResult.status` is `success`.
~~~

That is the right level of personalization: local aliases and defaults live in the personal wrapper, while the runtime skill remains portable.

## Example Netflix Wrapper

`~/.agents/skills/media-netflix-set-my-list-state/SKILL.md`:

~~~markdown
---
name: media-netflix-set-my-list-state
description: Add or remove Netflix titles from <person_name>'s My List on the Android Netflix app through Clawperator. Use when <person_name> asks to add, save, remove, unsave, or check a title in Netflix My List.
---

Use Clawperator on the physical Android device.

Defaults:

- device: `<device_serial>`
- profile: `<person_name>`
- runtime skill: `com.netflix.mediaclient.set-my-list-state-replay`

Normalize action:

- `add`, `save`, `put on my list`, `watch later` -> `add`
- `remove`, `delete`, `take off my list`, `unsave` -> `remove`

Run:

```bash
clawperator skills run com.netflix.mediaclient.set-my-list-state-replay \
  --device <device_serial> \
  --output json \
  -- \
  --action '<add|remove>' \
  --title '<title>' \
  --profile '<person_name>'
```

Only report completion if the returned skill result verifies the final My List state.
~~~

## Where Each Kind Of Skill Should Live

Preferred placement:

- `~/.agents/skills`: personal, cross-workspace, agent-facing wrappers. This is the best home for "<person_name>'s home" automation vocabulary.
- `~/.openclaw/workspace/skills`: workspace-only wrappers. Use this if the skill should belong only to this OpenClaw assistant workspace.
- `~/.openclaw/skills`: OpenClaw managed/local shared skills. Use this for OpenClaw-native local overrides, not for Clawperator runtime installs.
- `~/.clawperator/skills`: Clawperator runtime skill installation/cache. Do not rely on this as the assistant-facing discovery layer.
- `~/src/clawperator-skills`: development checkout for generic public Clawperator runtime skills.

## Skill Authoring Rules To Use

From the skill creator guidance:

- Keep `SKILL.md` concise.
- Put triggering language in the frontmatter `description`, because that is what the agent sees before the body is loaded.
- Use scripts when execution needs deterministic reliability.
- Use references only when there is detailed domain knowledge that should load conditionally.
- Validate skill folders after edits.

For these personal wrappers, start with simple `SKILL.md` files before adding scripts. A wrapper only needs a script if agents repeatedly pass arguments incorrectly or if normalization becomes too complex.

## Concrete Next Steps

1. Create personal wrapper skills under `~/.agents/skills`, starting with:
   - `home-hvac-set-power-state`
   - `home-hvac-set-zone-state`
   - `media-netflix-set-my-list-state`
   - `home-battery-get-level`
   - `home-energy-get-yesterday-usage-cost`
2. Make each wrapper call `clawperator skills run ... --output json` against the generic Clawperator skill.
3. Put local defaults and aliases in the wrapper body, not in `clawperator-skills`.
4. Retire or rewrite stale `~/.openclaw/workspace/skills` wrappers that point at `~/src/ActionTask`.
5. Prefer `com.clawperator.operator.dev` in wrapper instructions only if the debug Operator is actually installed and healthy. Otherwise document the currently working package.
6. Run `openclaw skills list --eligible --json` after creating wrappers to confirm they are visible.
7. Start a fresh OpenClaw session, because docs say newly installed skills are picked up in a new session, and the skill watcher only refreshes changed `SKILL.md` snapshots.
8. Forward-test with realistic requests:
   - "turn on AC in the office"
   - "turn off AC in the living room"
   - "add House of Cards to my Netflix list"
   - "what is the home battery at?"
9. For each test, verify the agent selected the personal wrapper first, then the wrapper selected the generic Clawperator runtime skill.

## Open Questions

- Confirm whether the desired persistent personal home is `~/.agents/skills` only, or whether some wrappers should stay workspace-scoped in `~/.openclaw/workspace/skills`.
- Confirm the exact AirTouch zone labels displayed in the app and the preferred alias table.
- Confirm whether `com.clawperator.operator.dev` is installed and should be the wrapper default for OpenClaw-triggered home automation, or whether the release package is currently more reliable.
- Decide whether `~/.clawperator/skills` should be added to `skills.load.extraDirs` for inspection only. My recommendation is no for primary triggering, because personal wrapper skills are cleaner and safer.

## Bottom Line

Clawperator runtime skills are the reliable hand. OpenClaw / AgentSkills wrappers are the personal intent layer. The missing puzzle piece is not another copy of the generic skills. It is the personalized adapter layer that knows how <person_name> talks, what device to target, what app profile to use, and which generic Clawperator skill should execute the action.
