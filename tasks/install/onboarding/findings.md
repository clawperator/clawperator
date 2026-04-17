# Findings: OpenClaw onboarding gaps for Clawperator

## Scope

Anchor user request (Telegram):

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device."

Evaluation target — the real first-run path for an OpenClaw-class personal assistant:

1. receive the Telegram message
2. discover Clawperator on the web
3. run `curl -fsSL https://clawperator.com/install.sh | bash`
4. discover installed Google Home runtime skills
5. run the right skill
6. report current HVAC state back to the user

Notes on levels. OpenClaw is the chat-to-agent gateway; it routes a message to an underlying coding agent (Claude Code, Codex, etc.) that in turn shells out to `clawperator`. The "discovery conventions" called out below are the ones OpenClaw documents as its tool surface (`AGENTS.md`, `TOOLS.md`, plugin entry points) plus the `~/.agents/skills` and per-agent-CLI skill directories the underlying agents already read. This note focuses on what blocks or weakens the flow above.

## Executive summary

Clawperator already has the runtime capability for this scenario:

- `install.sh` installs the CLI, operator APK, and the public skills repo.
- The public skills repo already contains four Google Home HVAC skills.
- The CLI already supports `skills list`, `skills search`, `skills get`, `skills run`.

The problem is not missing runtime capability. The problem is missing agent handoff after install. Today an OpenClaw-style agent can successfully install Clawperator and still fail to realize:

1. that runtime skills were installed at all
2. where they live
3. how to reach them from the CLI it just acquired
4. which skills match the user's natural-language request
5. what prerequisites those skills require

Everything below is a discoverability / onboarding gap, not a runtime gap.

## What exists today

**Installer behavior** — `sites/landing/public/install.sh`:

1. installs `clawperator`
2. runs `clawperator doctor`
3. runs `clawperator skills install` (clones the public skills repo to `~/.clawperator/skills`)
4. appends `CLAWPERATOR_SKILLS_REGISTRY` to `~/.zshrc` / `~/.bashrc`
5. runs `clawperator authoring-skills install` (fan-outs into `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills`)
6. writes `~/.clawperator/AGENTS.md`

Key code refs: [install.sh:490](sites/landing/public/install.sh:490), [install.sh:540](sites/landing/public/install.sh:540), [install.sh:598](sites/landing/public/install.sh:598), [install.sh:1068](sites/landing/public/install.sh:1068).

**Google Home runtime skills already on disk after install**:

| Skill ID | Intent | Role |
| --- | --- | --- |
| `com.google.android.apps.chromecast.app.get-climate-replay` | `get-climate` | Read current climate state |
| `com.google.android.apps.chromecast.app.set-power-replay` | `set-power` | Turn climate power on / off |
| `com.google.android.apps.chromecast.app.set-temperature-replay` | `set-temperature` | Set target temperature |
| `com.google.android.apps.chromecast.app.control-hvac-orchestrated` | `control-hvac` | Agent-driven controller (requires `codex` on host) |

Refs: `../clawperator-skills/skills/skills-registry.json`, per-skill `skill.json` and `SKILL.md`.

**Registry model** — runtime skills are registry-driven, not folder-scanned. Loaded via `CLAWPERATOR_SKILLS_REGISTRY`, with a CWD-relative fallback. Refs: [apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8](apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8), [docs/skills/overview.md:17](docs/skills/overview.md:17), [docs/api/environment.md:145](docs/api/environment.md:145).

## Findings

### F1. `clawperator skills list` fails in a fresh shell after a successful install — highest-friction gap

Default path when `CLAWPERATOR_SKILLS_REGISTRY` is unset: `<cwd>/skills/skills-registry.json`. Installed path: `~/.clawperator/skills/skills/skills-registry.json`. The installer only propagates the env var via shell rc append, so a non-interactive or subprocess-spawned shell fails with:

```
Warning: CLAWPERATOR_SKILLS_REGISTRY is not set. Run 'clawperator skills install' to configure the registry path.
{"code":"REGISTRY_READ_FAILED","message":"Registry not found at default path:
  <repo_root>/skills/skills-registry.json. Set CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."}
```

Reproduced live on this machine after a completed install.

Why this matters: `skills list` is the canonical answer to "what can this host do?" If that command fails by default, the agent concludes "no skills installed" — the opposite of the truth.

Why it breaks for agents specifically:

- agents spawn `clawperator` via `execFile` / `spawn` / non-login shells; `.zshrc` / `.bashrc` are not sourced
- `clawperator doctor` itself emits the same warning, so the very first diagnostic command looks broken

Refs: [apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8](apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:8), [install.sh:505](sites/landing/public/install.sh:505).

**Fix direction:** fall back to `${HOME}/.clawperator/skills/skills/skills-registry.json` before failing. Keep the env var as override, drop it as requirement.

### F2. `~/.clawperator/AGENTS.md` omits runtime skills, and lives in a non-conventional path

Single finding, two halves.

**Content half.** [install.sh:598](sites/landing/public/install.sh:598) `write_agent_guide()` produces a file that lists `doctor`, `snapshot`, `click`, authoring-skills. It does not list:

1. where runtime skills were installed
2. that they came from `clawperator-skills`
3. how to call `clawperator skills list / search / get / run`
4. that four Google Home HVAC skills already exist
5. what arguments those skills accept

On this machine the file names exactly one authoring skill (`skill-author-by-recording`) and zero runtime skills, despite the registry containing 17. An agent that finds this file still does not learn the single fact the Telegram scenario needs.

**Location half.** The file lives at `~/.clawperator/AGENTS.md`. OpenClaw-class agents read, in rough order:

1. `./AGENTS.md`
2. `$HOME/AGENTS.md`
3. `$HOME/.agents/AGENTS.md`
4. per-agent skill dirs (`~/.agents/skills/*/SKILL.md`, `~/.claude/skills/*/SKILL.md`, `~/.codex/skills/*/SKILL.md`)

Clawperator writes to none of those. Worse, on this machine `~/.agents/AGENTS.md` already exists — owned by an unrelated PR/git-workflow skills repo — and contains zero mention of clawperator. A default traversal would conclude "this host is for git automation" and never find clawperator.

Refs: [install.sh:598](sites/landing/public/install.sh:598), [install.sh:605](sites/landing/public/install.sh:605), OpenClaw [AGENTS template](https://docs.openclaw.ai/reference/templates/AGENTS.md), [personal-assistant setup](https://docs.openclaw.ai/start/openclaw).

**Fix direction:**

- `write_agent_guide()` should render the runtime registry into the file (grouped by `applicationId`, with `intent`, `summary`, exact `clawperator skills run ...` invocation).
- Append (not overwrite) a bounded, guard-comment-delimited `## Clawperator` section to `~/.agents/AGENTS.md` that points at `~/.clawperator/AGENTS.md` and teaches `clawperator skills list`. Same idempotency discipline as the existing shell-rc append.
- Optional: write `~/.clawperator/TOOLS.md` in OpenClaw's `TOOLS.md` schema describing `clawperator` as a CLI tool.

### F3. Runtime skills are not wired into agent-discovery conventions, only authoring skills are

`install.sh` explicitly fans authoring skills into `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills`. Runtime skills (including the Google Home HVAC ones) get none of that treatment.

Note: runtime skills are CLI-invoked (`clawperator skills run <id>`), not standalone `SKILL.md` executables, so symlinking them into `~/.agents/skills` as-is would not work. The primary missing piece is a bridge at the documented agent-discovery layer: `AGENTS.md` / `TOOLS.md` should teach the agent to delegate to `clawperator skills`. A small bridge skill under `~/.agents/skills` can still help, but it should be clearly a pointer/delegator rather than something that makes Clawperator runtime skills look like native prompt-skills.

Refs: [install.sh:540](sites/landing/public/install.sh:540), [docs/skills/authoring.md:45](docs/skills/authoring.md:45).

**Fix direction:** install one small bridge skill into the agent-discovery directories whose SKILL.md is essentially "to drive an Android app, call `clawperator skills list` first; then `clawperator skills run ...`". This is also where F2's `~/.agents/AGENTS.md` append should cross-link.

### F4. `clawperator doctor` does not report skills readiness

`doctor` answers host/device questions only. After a clean install, the agent's obvious next question is not "is adb working?" but:

> "What app-level capabilities are already installed on this host?"

A skills-aware doctor check — "registry resolves; 17 skills available; 4 cover `com.google.android.apps.chromecast.app`" — would compress the agent's decision path from "install succeeded, now I must go explore" to "skills ready for the user's stated app".

Refs: [apps/node/src/cli/registry.ts:2064](apps/node/src/cli/registry.ts:2064), [install.sh:988](sites/landing/public/install.sh:988).

**Fix direction:** the cleaner near-term move is probably a `clawperator skills for-app <pkg>` shortcut so an agent can answer "what can I do for this app?" in one command. A `skills.registry.presence` doctor check can still help, but the app-oriented shortcut is likely the better primary surface because it answers the actual user-on-behalf question more directly and avoids making doctor carry too much app-capability logic.

### F5. Skill search vocabulary does not match user vocabulary, and user-language terms mis-rank

`skills search --keyword` does a case-insensitive substring match across `id`, `summary`, and `applicationId` ([apps/node/src/domain/skills/searchSkills.ts:30](apps/node/src/domain/skills/searchSkills.ts:30)).

Behavior on the real registry, verified live:

| Query | Result |
| --- | --- |
| `"air conditioner"` | 0 hits |
| `"aircon"` | 0 hits |
| `"ac"` | 4 hits, but **all four are wrong** — `com.coles.search-products`, `com.globird.energy.get-yesterday-usage-cost-replay`, `com.woolworths.search-products`, plus `control-hvac-orchestrated` (matches because "hvac" contains "ac") |
| `"google home"` | 4 hits (matches `summary` text) — works today |
| `"climate"` | 4 hits — works today |
| `"hvac"` | 1 hit |

So the failure mode is worse than "user words miss the right skills": user words also *return confidently wrong skills*. An agent that searches "ac" gets supermarket skills and would have no a priori reason to reject them.

Refs: [apps/node/src/domain/skills/searchSkills.ts:30](apps/node/src/domain/skills/searchSkills.ts:30), [../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1](../clawperator-skills/skills/com.google.android.apps.chromecast.app.get-climate-replay/skill.json:1).

**Fix direction:**

- add `keywords: string[]` (or `aliases`) to `SkillEntry` in [apps/node/src/contracts/skills.ts](apps/node/src/contracts/skills.ts) and match on it.
- seed Google Home HVAC skills with `["air conditioner", "aircon", "ac", "heater", "hvac", "climate", "google home"]`.
- require minimum token length and/or whole-token boundaries to stop "ac" matching "hvac" — or, better, give exact-token matches on `keywords` higher rank than substring matches on summary.

### F6. `skills get` does not surface the preconditions needed for first-run use

The Google Home skills silently assume:

1. `com.google.android.apps.chromecast.app` is installed on the burner
2. Google Home is signed in and has at least one climate unit linked
3. the climate unit is reachable via the `Home` → `Climate` route
4. the caller passes the exact `unit_name` that matches the controller toolbar title
5. for `control-hvac-orchestrated`, the `codex` CLI is installed on the host (declared by `agent.cli: codex`); without it the skill will fail mid-run

None of that surfaces in `clawperator skills get <id>` today. A correctly-discovered skill can still fail deep in the UI flow, which reads to the agent as "Clawperator is broken" rather than "the user needs to sign in to Google Home".

Note on `agent.cli: codex`: this is the CLI the orchestrated skill spawns *internally* — it is not about which agent calls `clawperator` from the outside. OpenClaw → clawperator → internal codex works fine as long as codex is on PATH. The gap is that this precondition is invisible at discovery time, not that the skill is OpenClaw-hostile.

Refs: [apps/node/src/domain/skills/runSkill.ts:1](apps/node/src/domain/skills/runSkill.ts:1), [apps/node/src/contracts/skills.ts:1](apps/node/src/contracts/skills.ts:1), [../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1](../clawperator-skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/skill.json:1).

**Fix direction:** add first-class `preflight` / `requires` metadata to `SkillEntry`: required Android packages, required sign-in state, required host CLIs, required user-provided inputs, and an explicit `safer_first_run` / replay pointer for read-only alternatives. Have `skills get` render it; have orchestrated harnesses reject early with structured `PRECONDITION_*` errors.

### F7. Install-time orientation lives only in stdout

The final `echo` block at [install.sh:1081](sites/landing/public/install.sh:1081) prints the skills registry path, APK path, agent-guide URL, and the "AI agents should read the guide" nudge. None of this is durable across turns. An OpenClaw session 24 hours later sees none of it.

**Fix direction:** mirror the block into `~/.clawperator/AGENTS.md` (F2) and additionally write `~/.clawperator/install-state.json` with schema version, install timestamp, CLI version, APK version, resolved registry path, last device serial. One `cat` replaces N `doctor --format json` re-runs.

### F8. The MCP surface exists but is not materialized as the default bridge

Clawperator already implements an MCP server ([apps/node/src/cli/registry.ts:2463](apps/node/src/cli/registry.ts:2463)). MCP would sidestep F1–F5 entirely because tool discovery is solved at the protocol layer. But the installer does not register the MCP server with any agent host and does not write a ready-to-paste config snippet.

**Fix direction:** write `~/.clawperator/mcp-config-snippet.json` with variants for Claude Desktop, Codex, and generic stdio MCP consumers. Print the paste location in the final install message. Automatic registration is too invasive — the paste-ready file is the right compromise.

## Practical consequence for the Telegram scenario

Given the message above, the most likely failure today is:

1. install succeeds
2. agent runs `clawperator skills list` in a spawned shell → fails (F1)
3. agent reads `~/.clawperator/AGENTS.md` (if it finds it) → sees only authoring skills (F2)
4. agent web-searches the docs → finds `skills search` and tries "air conditioner" → 0 hits (F5), or tries "ac" → 4 wrong hits (F5)
5. if the agent does reach `control-hvac-orchestrated` it doesn't learn that `codex` must be on PATH or that Google Home sign-in is required (F6)
6. agent reports "I can't control this" even though the capability is already on disk

Every step here is fixable independently.

## Priority fixes

### P0 — the three that convert the Telegram flow from "probably fails" to "probably works"

1. **F1** — fall back to `~/.clawperator/skills/skills/skills-registry.json` in the registry loader. Single-file change. Without this, every other fix is gated behind a command that fails by default.
2. **F2 content** — render the runtime skills registry into `~/.clawperator/AGENTS.md`, grouped by `applicationId`, with `intent`, `summary`, and exact `clawperator skills run ...` examples.
3. **F5** — add `keywords` to `SkillEntry` and seed the Google Home HVAC skills with `["air conditioner", "aircon", "ac", "heater", "hvac", "climate", "google home"]`. Rank exact-token matches on `keywords` ahead of substring summary matches so `"ac"` stops returning Coles.

### P1 — meaningfully strengthens subsequent turns and cross-agent discovery

4. **F2 location** — idempotent `## Clawperator` append to `~/.agents/AGENTS.md`; same guard-comment discipline as the shell-rc append.
5. **F4** — add `clawperator skills for-app <pkg>` as the primary app-capability discovery surface; optionally follow with a lighter `skills.registry.presence` doctor check.
6. **F6** — first-class `preflight` metadata in `SkillEntry`; rendered in `skills get`; enforced in orchestrated harnesses.
7. **F7** — `install-state.json`.
8. **F8** — ship `mcp-config-snippet.json`.

### P2

9. **F3** — single bridge skill under `~/.claude/skills`, `~/.codex/skills`, `~/.agents/skills` that visibly delegates to `clawperator skills` rather than trying to masquerade as a native runtime-skill model.
