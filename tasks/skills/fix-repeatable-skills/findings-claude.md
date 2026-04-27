# Findings: Repeatable Personal Home Automations with Clawperator/OpenClaw

Independent research pass. All claims verified against local files, session
logs, and official docs. `findings-codex.md` was not inspected.

---

## Summary

There are three distinct skill layers currently in play, only two of which are
agent-discoverable. The critical missing piece is not making
`~/.clawperator/skills` discoverable - the official design explicitly prohibits
that. The missing piece is a set of personal wrapper skills in agent-discoverable
directories that supply user-specific constants (device serial, zone name
aliases, default profile names) and translate natural user requests into
parameterized calls to generic Clawperator runtime skills.

Several existing personal workspace skills in `~/.openclaw/workspace/skills/` are
stale, still referencing the legacy ActionTask/FCM pipeline instead of
Clawperator. The OpenClaw main agent is already bypassing them and calling
Clawperator directly - confirming that the migration path is clear and the
personal skills just need to catch up.

---

## Layer Map

### Layer 1 - Generic Clawperator Runtime Skills (nonpersonal)

- **Source:** `~/src/clawperator-skills/skills/`
- **Installed:** `~/.clawperator/skills/skills/`
- **Registry:** `~/.clawperator/skills/skills/skills-registry.json`
- **Discovery:** exclusively via `clawperator skills` CLI (list, for-app, search, get, run)
- **NOT** placed in any agent-scannable folder by design

Per the official skills overview page at `docs.clawperator.com/skills/overview/`:

> The installer does not mirror runtime skills into shared agent skill directories
> such as `~/.agents/skills/`, `~/.claude/skills/`, or `~/.codex/skills/`.

Skills are registry-driven, not discovered by folder scanning alone. The
`loadRegistry()` fallback chain resolves to
`~/.clawperator/skills/skills/skills-registry.json` when no env var or explicit
path is set.

Current generic skills relevant to home automation:
- `au.com.polyaire.airtouch5.set-power-state` - AirTouch whole-system on/off
- `au.com.polyaire.airtouch5.set-zone-state` - AirTouch per-zone on/off (needs exact zone label)
- `au.com.polyaire.airtouch5.set-fan-level` - AirTouch fan level
- `au.com.polyaire.airtouch5.set-mode` - AirTouch mode (cool/heat/fan/dry/auto)
- `com.google.android.apps.chromecast.app.set-power-replay` - Google Home climate power
- `com.google.android.apps.chromecast.app.control-hvac-orchestrated` - Google Home HVAC
- `com.netflix.mediaclient.set-my-list-state-replay` - Netflix My List add/remove
- `com.solaxcloud.starter.get-battery` - SolaX battery percentage
- `com.globird.energy.get-usage` - GloBird energy usage

### Layer 2 - Personal OpenClaw Workspace Skills

- **Location:** `~/.openclaw/workspace/skills/`
- **Discovery:** OpenClaw main agent reads these directly via workspace context
- **Evidence:** Session log shows agent read
  `~/.openclaw/workspace/skills/home-set-aircon/SKILL.md` (line 1613) and
  `~/.openclaw/workspace/skills/home-get-solax-battery/SKILL.md` (line 1626)
- **Format:** SKILL.md front matter with name/description + instructions

Current personal skills in this location:
- `home-get-aircon-status` - reads aircon state via ActionTask (stale)
- `home-set-aircon` - sets aircon power via ActionTask (stale)
- `home-get-solax-battery` - reads SolaX battery via ActionTask (stale)
- `home-get-globird-usage` - reads GloBird via ActionTask (stale)
- `home-get-bedroom-temperature` - reads SwitchBot via raw adb broadcast (stale)
- `show-android-device` - launches scrcpy (works, not Clawperator-dependent)
- `solax-cloud-api` - uses Solax Cloud API directly (web path, not device path)

### Layer 3 - Shared Agent Skills

- **Location:** `~/.agents/skills/`
- **Discovery:** Claude Code and Codex find these automatically
- **Bridge to Clawperator:** `~/.agents/AGENTS.md` contains a
  `CLAWPERATOR_SHARED_AGENT_BRIDGE` section that redirects to the Clawperator CLI
  rather than mirroring runtime skills here

---

## Discovery Matrix

| Directory | Which agents can see it | How | Evidence |
|---|---|---|---|
| `~/.openclaw/workspace/skills/` | OpenClaw main agent | Direct file reads during session | Session log lines 1613, 1626 |
| `~/.agents/skills/` | Claude Code, Codex | Built-in agent discovery | CLAUDE.md, `~/.agents/AGENTS.md` |
| `~/.clawperator/skills/skills/` | None directly | Clawperator CLI only | Official docs, installer design |
| `~/.openclaw/skills/` | N/A | Directory does not exist | Confirmed by `ls` |
| `~/.clawperator/AGENTS.md` | Any agent that reads it | File read | Contains skill registry summary and examples |

---

## Should `~/.clawperator/skills` Be Made Discoverable?

**No.** Leave it as a runtime-only home. Reasoning:

1. The official installer explicitly does not mirror runtime skills into shared
   agent directories. This is a deliberate design boundary.
2. The installer already writes a bridge: it appends a bounded section to
   `~/.agents/AGENTS.md` that points agents to `clawperator skills` CLI commands
   rather than to local files.
3. Runtime skills are registry-driven. An agent scanning the folder without the
   registry would get an incomplete, unvalidated view.
4. Symlinks or mirrors would create sync drift between the installed location
   and any alias, making registry updates unreliable.
5. The session log confirms the agent can already invoke generic skills correctly
   via the CLI - the discovery problem is not "can the agent find the skill" but
   "does it know the right personal parameters to pass."

---

## The Real Missing Layer: Personal Parameter Wrappers

The session log shows the actual failure mode clearly. When the user said "turn
on the living room," the OpenClaw agent called:

```
clawperator skills run au.com.polyaire.airtouch5.set-zone-state
  --device <device_serial> -- --zone-name "Living Room" --state on
```

This failed. The AirTouch app does not expose a row named "Living Room." The
agent then trial-and-errored "living" (lowercase, without "Room") which
succeeded. That trial-and-error loop is exactly what a personal wrapper skill
should eliminate.

Similarly, the Netflix My List skill requires an explicit `--profile <name>`.
Without a personal wrapper, the agent has to ask the user for the profile name
or guess it each time.

The generic Clawperator skills are correctly parameterized. The personal layer
needs to supply the user-specific binding.

---

## Recommended Architecture

```
User request (natural language)
        |
        v
Personal skill in discoverable location
  - Translates natural names to app labels
  - Supplies default device serial
  - Supplies default profile/unit names
        |
        v
clawperator skills run <generic-skill-id>
  --device <device_serial>
  --operator-package <operator_pkg>
  -- --zone-name "<app_label>" --state <on|off>
        |
        v
Generic Clawperator runtime skill
  (app-level, nonpersonal, in registry)
        |
        v
Clawperator Operator on device
```

For OpenClaw: personal wrappers live in `~/.openclaw/workspace/skills/`.
For Claude Code / Codex: personal wrappers live in `~/.agents/skills/`.

---

## Example Personal Skill Designs

### `home-hvac-set-power-state`
Location: `~/.openclaw/workspace/skills/home-hvac-set-power-state/SKILL.md`

```markdown
---
name: home-hvac-set-power-state
description: Turn the AirTouch 5 whole-system on or off. Use when asked to
  turn the aircon on/off, or set AirTouch system power to a specific state.
---

Translates the user's on/off intent to the AirTouch 5 Clawperator skill.

Default device: <device_serial>
Default operator package: com.clawperator.operator

Run:

    clawperator skills run au.com.polyaire.airtouch5.set-power-state \
      --device <device_serial> \
      --operator-package com.clawperator.operator \
      -- --state <on|off>

Read the SkillResult frame for the verified outcome.
```

### `home-hvac-set-zone-state`
Location: `~/.openclaw/workspace/skills/home-hvac-set-zone-state/SKILL.md`

```markdown
---
name: home-hvac-set-zone-state
description: Turn an AirTouch 5 zone on or off using natural room names. Use
  when asked to turn a specific room's aircon on or off.
---

Zone alias table (natural name -> AirTouch app label, case-sensitive):

  "living room" -> "living"
  "lounge"      -> "living"
  "office"      -> "Office"
  [expand as new zones are confirmed live from the app]

Default device: <device_serial>
Default operator package: com.clawperator.operator

1. Map the user's room name to the AirTouch app label using the table above.
   If no match is found, inspect the live app with a snapshot before proceeding
   and record any new alias discovered.

2. Run:

       clawperator skills run au.com.polyaire.airtouch5.set-zone-state \
         --device <device_serial> \
         --operator-package com.clawperator.operator \
         -- --zone-name "<app_label>" --state <on|off>

3. Read the SkillResult frame for the verified outcome.
```

**Evidence for alias table:**
- "Office" - confirmed successful (session log line 550)
- "living" - confirmed successful (session log line 1927)
- "Living Room" - confirmed FAILED (session log line 1922); exact error:
  `AirTouch Zones view did not expose the Living Room row`

### `media-netflix-set-my-list-state`
Location: `~/.openclaw/workspace/skills/media-netflix-set-my-list-state/SKILL.md`

```markdown
---
name: media-netflix-set-my-list-state
description: Add or remove a Netflix title from My List under the default
  user profile. Use when asked to add or remove something from Netflix My List.
---

Default profile: <default_profile_name>
Default device: <device_serial>

If the user does not specify a profile, use the default.

Run:

    clawperator skills run com.netflix.mediaclient.set-my-list-state-replay \
      --device <device_serial> \
      -- --action <add|remove> \
         --title "<title>" \
         --profile "<profile_name>"

Note: the authored replay skill has known brittle profile-card parsing. If the
skill fails at profile selection, fall back to raw Clawperator CLI navigation
(confirmed end-to-end at session log line 1618 area for House of Cards).
```

---

## Heartbeat / Scheduled Battery Pattern

The HEARTBEAT.md already uses the correct pattern - it calls Clawperator
directly without a personal wrapper:

```
clawperator skills run com.solaxcloud.starter.get-battery \
  --device <device_serial> --output json
```

This worked (session log line 1001: `SolaX battery level: 21.0%`). The existing
personal workspace skill `home-get-solax-battery` is redundant and stale
(still references ActionTask).

For repeatable scheduled automations:
- Cron entries in HEARTBEAT.md should call `clawperator skills run` directly
- Personal workspace skills are appropriate for user-initiated requests where
  natural language needs to be translated to parameterized skill calls
- Both use the same underlying generic skills

---

## Risks

1. **Zone name drift** - AirTouch app updates can rename or rearrange zone
   labels. The alias table in the personal skill will silently go stale. Skill
   failures will be the signal. Add a validation step (snapshot zones list) when
   a zone match fails before reporting an error.

2. **Netflix skill reliability** - The replay skill
   `com.netflix.mediaclient.set-my-list-state-replay` has documented brittle
   profile-card parsing (session memory 2026-04-20). Raw Clawperator CLI navigation
   worked where the skill failed. The personal wrapper should document this fallback
   explicitly rather than trusting the skill unconditionally.

3. **Stale ActionTask personal skills** - Multiple personal workspace skills
   still reference `~/src/ActionTask` which no longer exists. Any agent reading
   those skills and trying to follow their instructions will fail. They should be
   migrated or deleted.

4. **Device serial in multiple places** - Currently hardcoded in HEARTBEAT.md.
   A canonical single source (e.g., TOOLS.md entry) would make device changes
   easier to manage.

5. **Agent-layer mismatch** - Skills in `~/.openclaw/workspace/skills/` are only
   visible to the OpenClaw main agent. Skills in `~/.agents/skills/` are visible
   to Claude Code and Codex. If the same home automation is needed from Claude
   Code, it needs a parallel entry in `~/.agents/skills/`.

---

## Open Questions

1. What are all the actual AirTouch zone labels as they appear in the app?
   A snapshot against the live device would give the ground truth for the full
   alias table.

2. What is the default Netflix profile name? It should be stored in TOOLS.md
   or the personal skill rather than being passed explicitly each time.

3. Should personal skills for Claude Code / Codex (`~/.agents/skills/`) mirror
   the OpenClaw personal skills? Or should they delegate to OpenClaw for
   device-touching work?

4. The Google Home HVAC path (`com.google.android.apps.chromecast.app`) and the
   AirTouch path are two different ways to control the same physical system. The
   session shows both were used at different times. Which is the canonical path?
   The personal wrapper should pick one and explain why.

---

## Concrete Next Steps

1. **Migrate stale personal skills** - Update `home-get-solax-battery`,
   `home-set-aircon`, `home-get-aircon-status`, `home-get-globird-usage`, and
   `home-get-bedroom-temperature` to call Clawperator, or delete them if
   HEARTBEAT.md or direct agent invocation already covers the use case.

2. **Create `home-hvac-set-zone-state`** - Use the confirmed alias table above.
   Run live against the device to discover any remaining zones and extend the table.

3. **Create `home-hvac-set-power-state`** - Thin wrapper that binds device serial
   and operator package for the AirTouch power skill.

4. **Add a canonical device config** - Document the physical device serial in
   `~/.openclaw/workspace/TOOLS.md` as a named reference so it doesn't need to
   be hardcoded in each personal skill separately.

5. **Create `media-netflix-set-my-list-state`** - Document the default profile
   name and the skill fallback pattern for profile-card parsing failures.

6. **Decide Claude Code coverage** - If home automation should also be reachable
   from Claude Code, add matching personal wrapper skills in `~/.agents/skills/`.

7. **Do not touch `~/.clawperator/skills`** - Runtime skills stay there and stay
   discovery-invisible to agents. The CLI bridge in `~/.agents/AGENTS.md` is the
   correct mechanism.
