# Onboarding gaps: OpenClaw discovering and using Clawperator

Research deliverable for the Telegram-driven onboarding scenario:

> "I saw this app called clawperator. Check it out and see if I can use it to control my air conditioner via the Google Home app. I've plugged in an Android device."

This document enumerates gaps that prevent an OpenClaw-class agent from reliably traversing: message -> clawperator.com -> `install.sh` -> run a pre-built Google Home HVAC skill -> return current HVAC state. It is focused on *gaps*, not praise.

Scope note: Clawperator is the actuator; OpenClaw is the chat-to-agent gateway ([docs.openclaw.ai](https://docs.openclaw.ai)). OpenClaw routes a message to a coding agent (Claude Code, Codex, etc.) and exposes tool-discovery conventions centered on `AGENTS.md`, `TOOLS.md`, and `~/.agents/skills/` ("Plugin Entry Points", "AGENTS.md Template"). The gaps below are Clawperator-side.

---

## TL;DR

The current installer correctly places artifacts on disk:

- `~/.clawperator/skills/skills/skills-registry.json` (runtime skills, including 4 Google Home HVAC skills)
- `~/.clawperator/authoring-skills/` (authoring skills)
- `~/.clawperator/AGENTS.md` (a Clawperator-facing agent guide)
- `~/.agents/skills/skill-author-by-recording/` (symlink/copy for agent discovery)
- `CLAWPERATOR_SKILLS_REGISTRY=...` line appended to `~/.zshrc` / `~/.bashrc`

But a cold-start agent **cannot discover that any of this exists** using the conventions OpenClaw-class gateways rely on. The runtime-skills inventory is invisible, the registry env var does not propagate into non-login shells, the default registry path is wrong for the installed layout, and the one `AGENTS.md` file an OpenClaw agent would naturally look at (`~/.agents/AGENTS.md`) is written by an unrelated skills repo and does not mention Clawperator at all.

A user typing the Telegram prompt above will get one of three outcomes today:

1. agent web-searches, finds `clawperator.com`, runs `install.sh`, and then dead-ends because `clawperator skills list` fails in the spawned shell;
2. agent reaches the right `CLAWPERATOR_SKILLS_REGISTRY` by luck (user session reloaded), lists skills, but never learns that a `control-hvac` skill exists because the top hit from a keyword search like "air conditioner" returns nothing (skills use `climate`/`hvac` vocabulary, not "aircon"/"ac");
3. agent drives the Google Home app by hand from the primitive API rather than the purpose-built skill.

All three are fixable and each gap below is independent.

---

## Gap 1: `clawperator skills list` fails in a fresh shell even though skills are installed

**File:** [apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:9](apps/node/src/adapters/skills-repo/localSkillsRegistry.ts:9)

`getDefaultRegistryPath()` resolves to `join(process.cwd(), "skills", "skills-registry.json")`. For any agent that cwd's somewhere other than the Clawperator repo root (i.e., every real agent), the default is wrong.

Reproduced now, from a fresh shell with the repo already installed to `~/.clawperator/`:

```
$ clawperator skills list
Warning: CLAWPERATOR_SKILLS_REGISTRY is not set. Run 'clawperator skills install' to configure the registry path.
{"code":"REGISTRY_READ_FAILED","message":"Registry not found at default path:
  <repo_root>/skills/skills-registry.json.
  Set CLAWPERATOR_SKILLS_REGISTRY or run clawperator skills install."}
```

The installer does set the env var in `~/.zshrc` / `~/.bashrc` (see [install.sh:505-530](sites/landing/public/install.sh:505)), but:

- An agent spawning `clawperator` via `execFile`, `child_process.spawn`, or a non-interactive shell will typically not source these rc files.
- macOS Terminal's zsh sources `.zshrc` for interactive shells; a subprocess launched from an existing agent session may not.
- `clawperator doctor` itself also emits the "CLAWPERATOR_SKILLS_REGISTRY is not set" warning before anything else, so the agent's very first diagnostic command looks broken.

**Why this is the single highest-impact gap:** it turns the authoritative way an agent enumerates skills (`clawperator skills list`) into a failure mode by default, which reads to an agent as "there are no skills" and is the opposite of true.

**Fix direction:** default the fallback to `${HOME}/.clawperator/skills/skills/skills-registry.json` when the CWD-relative path does not exist. Re-run the installer's env hint only if both the home-directory path and the configured env var are missing.

---

## Gap 2: `~/.clawperator/AGENTS.md` omits runtime skills entirely

**File:** [install.sh:608-670](sites/landing/public/install.sh:608) — `write_agent_guide()`

Current content written on this machine:

```
# Clawperator
Deterministic Android automation runtime for AI agents.

## Quick start
clawperator doctor --json
clawperator snapshot --json
clawperator click --text "Settings" --json

## Documentation
- https://docs.clawperator.com/llms.txt
- https://docs.clawperator.com/llms-full.txt
- https://docs.clawperator.com/setup/

## Authoring Skills
First-party Clawperator authoring skills are installed at:
~/.clawperator/authoring-skills

Available skills:
- skill-author-by-recording
```

Notable omissions given that `~/.clawperator/skills/skills/skills-registry.json` already contains 17 skills including:

- `com.google.android.apps.chromecast.app.control-hvac-orchestrated`
- `com.google.android.apps.chromecast.app.get-climate-replay`
- `com.google.android.apps.chromecast.app.set-power-replay`
- `com.google.android.apps.chromecast.app.set-temperature-replay`

An OpenClaw agent reading this file sees only the *authoring* category and one entry (`skill-author-by-recording`), which is the wrong tool for the Telegram task. The runtime skills for the user's stated app (Google Home) are not advertised anywhere on the host filesystem.

**Fix direction:** `write_agent_guide()` should enumerate the runtime skills registry too, with a compact `applicationId | intent | summary` table keyed off the registry JSON. Consider generating a second file, `~/.clawperator/SKILLS.md`, that is a stable markdown view of the registry so an agent can grep without parsing JSON.

---

## Gap 3: No discoverability bridge at the OpenClaw-convention root

**Files:**
- [install.sh:600-673](sites/landing/public/install.sh:600)
- observed state: `~/.agents/AGENTS.md` exists but is owned by the unrelated PR-workflow skills repo

OpenClaw docs describe `AGENTS.md` and `TOOLS.md` as the discovery surface ([docs.openclaw.ai/reference/templates/AGENTS.md](https://docs.openclaw.ai/reference/templates/AGENTS.md), [docs.openclaw.ai/reference/templates/TOOLS.md](https://docs.openclaw.ai/reference/templates/TOOLS.md), "Plugin Entry Points"). The places an OpenClaw-class agent will look, in roughly that order:

1. `./AGENTS.md` in the working directory
2. `$HOME/AGENTS.md`
3. `$HOME/.agents/AGENTS.md`
4. `$HOME/.agents/skills/*/SKILL.md`

On this machine:

- `~/AGENTS.md` does not exist.
- `~/.agents/AGENTS.md` exists and is a *PR/git workflow* guide. It describes clean-branches, pr-autoloop, context-grok. No mention of clawperator.
- `~/.agents/skills/` contains `skill-author-by-recording` (from clawperator) but also 13 unrelated PR skills from the other project.

Consequence: OpenClaw's default discovery traversal finds skills that look like "this host is for automating git/PRs" and never surfaces Clawperator. The `~/.clawperator/AGENTS.md` that Clawperator *does* write lives at a non-conventional path the agent has no reason to open.

**Fix direction:** the installer needs a light-touch convention contribution:

- Append (do not overwrite) a `## Clawperator` section to `~/.agents/AGENTS.md` that points at `~/.clawperator/AGENTS.md` and `clawperator skills list`.
- Optionally write `~/.clawperator/TOOLS.md` in the OpenClaw TOOLS.md schema describing `clawperator` as an available CLI with a brief signature table.
- If `~/AGENTS.md` exists already, append; if not, don't create one (too opinionated). Same policy as the shell-rc append.

Critical design constraint: Clawperator cannot own `~/.agents/AGENTS.md` because other skills repos already do. The contribution must be idempotent and clearly delimited (guard comments like the existing `# Clawperator Skills Registry` pattern in the rc files).

---

## Gap 4: Runtime skills are not surfaced through the CLI help / doctor output

**Files:** [apps/node/src/cli/registry.ts:2064-2130](apps/node/src/cli/registry.ts:2064), [install.sh:988-1023](sites/landing/public/install.sh:988)

The `clawperator skills` help block lists sub-commands but doesn't tell the agent *what is installed*. `clawperator --help` has no "what can I do on this host" block.

`clawperator doctor --output pretty` at the end of install only reports host/device readiness:

```
Critical checks:
  [OK] Node version v24.14.1 is compatible.
  [OK] adb is installed.
  [OK] adb server is healthy.
  [OK] Device <device_serial> is connected and reachable.
  [OK] Device shell is available.
  [OK] Operator APK (com.clawperator.operator) is installed.
  [FAIL] CLI and installed APK versions are not compatible.
```

There is no check along the lines of "skills registry resolves; 17 skills available; 4 cover `com.google.android.apps.chromecast.app`". That single diagnostic line would dramatically shorten the agent's decision path from "installation succeeded" to "skills ready for the user's target app".

**Fix direction:**

- add a `skills.registry.presence` check to doctor that resolves the registry from `$CLAWPERATOR_SKILLS_REGISTRY` → `~/.clawperator/skills/skills/skills-registry.json` and reports count + per-app counts.
- make `clawperator skills list` work without env var (Gap 1).
- add a new summary command or block so that `clawperator doctor --format json` can answer "for app X, which skills exist" without requiring the agent to call a second command first.

---

## Gap 5: Skill vocabulary does not match user vocabulary

**File:** `~/.clawperator/skills/skills/skills-registry.json`

The Telegram user says "air conditioner" and "control". The registry uses `climate`, `hvac`, `set-power`, `set-temperature`. `clawperator skills search --keyword` does substring match, so:

- `--keyword "air conditioner"` → zero hits
- `--keyword "aircon"` / `--keyword "ac"` → zero hits
- `--keyword "hvac"` → 1 hit (`control-hvac-orchestrated`)
- `--keyword "google home"` → zero hits (text is not in any summary; `applicationId` is `com.google.android.apps.chromecast.app`, which does not contain "google home" either)
- `--keyword "climate"` → 4 hits

So the agent must either know the word "climate" or know to search by `--app com.google.android.apps.chromecast.app`, both of which are expert moves.

**Fix direction:**

- add `aliases: ["air conditioner", "aircon", "ac", "google home", "heater"]` or `keywords: [...]` to `SkillEntry` and include that field in search scoring.
- alternatively ship a small `tags` array and have `skills search` match on it.
- expose `clawperator skills search` as MCP resource with a prose description so the MCP server handles the synonym mapping.

This is a small schema change but it is the single gap most likely to cause an agent that *has* reached the skills registry to still miss the right skill.

---

## Gap 6: `skills run` preconditions are not advertised at discovery time

**File:** `~/.clawperator/skills/skills/com.google.android.apps.chromecast.app.control-hvac-orchestrated/SKILL.md`

The HVAC control skill requires:

- `com.google.android.apps.chromecast.app` installed *and* signed in on the device
- the unit exposed in the `Climate` chip under the `Home` tab
- Codex CLI available on the host (per the skill's `agent.cli: codex` block)
- `danger-full-access` sandbox posture for Codex
- the exact `--unit-name` string matching the controller toolbar title

None of these preconditions surface in `clawperator skills get <id>` JSON output. An agent that has correctly located the skill still does not know "I must first run `clawperator packages list --third-party` to confirm the app is present" or "I need `codex` on PATH" or "the user must name the climate unit the same as the label in the app".

**Fix direction:** add `preflight` / `requires` metadata to `SkillEntry` in `apps/node/src/contracts/skills.ts` covering: required packages, required host CLIs, required inputs that the user must supply. Have `clawperator skills get` render these. Have the orchestrated `run.js` harness check them and fail with a structured `PRECONDITION_*` error rather than running and failing mid-flow.

Also consider: a `get-climate-replay` dry-run that does not require `codex` at all would be a safer "check the current HVAC state" answer for the Telegram task than `control-hvac-orchestrated`. The agent has no way to know that today; document it in the skill entries.

---

## Gap 7: The installer finishing message is the only place some things are said

**File:** [install.sh:1081-1124](sites/landing/public/install.sh:1081)

The final `echo` block contains important orientation — skills registry path, APK location, doctor result, agent-guide pointer — but an OpenClaw agent does not retain this across turns. Anything that matters later needs a persistent on-disk landing zone.

Specifically these live *only* in stdout today:

- "Skills registry configured at: ~/.clawperator/skills/skills/skills-registry.json"
- "Authoring skills installed at: ~/.clawperator/authoring-skills/"
- "Agent guide: https://docs.clawperator.com/llms.txt"
- "If you are an AI agent, read the agent guide before running any commands."

**Fix direction:** mirror this block into `~/.clawperator/AGENTS.md` (Gap 2 already touches this). Also write a small `~/.clawperator/install-state.json` with schema version, install timestamp, CLI version, APK version, registry path, device serial last used. Agents can read it in one `cat` instead of re-running `doctor --format json` across turns.

---

## Gap 8: No on-disk `llms.txt` for offline / sandboxed agents

**Files:** [sites/docs/static/llms.txt](sites/docs/static/llms.txt), [sites/landing/public/llms.txt](sites/landing/public/llms.txt)

`llms.txt` lives on the public web only. An OpenClaw gateway running in a restricted sandbox (no outbound HTTP, or one behind a proxy that strips `docs.clawperator.com`) cannot read it. The installer already has network access, so it could cache the current `llms.txt` and `llms-full.txt` to `~/.clawperator/docs/llms.txt` and `~/.clawperator/docs/llms-full.txt` at install time.

**Fix direction:** during install, fetch `https://docs.clawperator.com/llms.txt` and `llms-full.txt` and write them under `~/.clawperator/docs/`. Reference these local copies from `~/.clawperator/AGENTS.md` ahead of the web URLs. Treat the cache as best-effort (do not fail install if the fetch fails).

---

## Gap 9: The MCP surface is not wired up as the default discovery path

**File:** [apps/node/src/cli/registry.ts:2463](apps/node/src/cli/registry.ts:2463) — `clawperator mcp ...`

An MCP server is already implemented. OpenClaw-class agents that speak MCP could treat Clawperator as a first-class tool source *without* any of Gaps 1-8 mattering, because MCP solves tool-discovery by design. But:

- the installer never registers the MCP server with any OpenClaw-resident agent config
- there is no documented "add this to your claude-desktop config / codex config" snippet written to `~/.clawperator/`
- the agent has to discover MCP via web docs, which brings us back to Gap 8

**Fix direction:** at end of install, print *and* write an `mcp-config-snippet.json` to `~/.clawperator/` containing the exact `"clawperator": { "command": "...", "args": ["mcp", "serve"] }` entry, with variants for Claude Desktop, Codex, and generic stdio MCP consumers. Even if we do not automate the registration (risky), the pasteable snippet is the difference between a 30-second integration and an unbounded research task.

---

## Gap 10: Nothing fails loudly when skills exist but the device is not signed in

Not an onboarding gap per se, but the Telegram scenario will hit it fast. The user wired up the Android device but may not have signed in to Google Home on that device. The HVAC skills will run and fail deep in the UI flow rather than rejecting at preflight. The failure will be a timeout or an unexpected-UI error, which to an OpenClaw agent looks like "Clawperator is broken" rather than "the user needs to open Google Home once and sign in".

**Fix direction:** tie this to Gap 6. `preflight` should include "app is installed AND has been launched at least once AND is not showing a sign-in screen". This check exists implicitly in several recorded skills but is not a first-class preflight today.

---

## Summary table

| # | Gap | Severity | Fix surface |
|---|-----|----------|-------------|
| 1 | `skills list` fails in fresh shell | Critical | `localSkillsRegistry.ts` default path |
| 2 | `AGENTS.md` omits runtime skills | Critical | `install.sh: write_agent_guide` |
| 3 | No bridge at OpenClaw convention root | High | `install.sh` (append to `~/.agents/AGENTS.md`) |
| 4 | Doctor/help do not advertise skills | High | new doctor check + help block |
| 5 | Search vocabulary mismatch | High | `SkillEntry.aliases` / `keywords` |
| 6 | Skill preconditions not in metadata | Medium | `contracts/skills.ts` + harness |
| 7 | Install output lives only in stdout | Medium | write `install-state.json` |
| 8 | No offline `llms.txt` cache | Medium | fetch during install |
| 9 | MCP snippet not materialized | Medium | write `mcp-config-snippet.json` |
| 10 | No sign-in preflight | Medium | per-skill preflight contract |

---

## Recommended smallest viable change to unblock the Telegram scenario

If only three things ship, pick these:

1. **Gap 1** — default registry path falls back to `~/.clawperator/skills/skills/skills-registry.json` so `clawperator skills list` Just Works. Without this, every other fix is circumvented by the first command failing.
2. **Gap 2** — `~/.clawperator/AGENTS.md` renders the runtime skills registry, grouped by `applicationId`, with `intent`, `summary`, and the exact `clawperator skills run ...` invocation string. The agent can cat one file and have the full menu.
3. **Gap 5** — add `aliases` / `keywords` on the Google Home skills so `skills search --keyword "air conditioner"` returns `control-hvac-orchestrated` and `get-climate-replay` at the top.

With those three in place, the plausible OpenClaw path for the Telegram prompt becomes:

```
# agent, cold start, receives message
curl -fsSL https://clawperator.com/install.sh | bash
cat ~/.clawperator/AGENTS.md                          # (Gap 2)
clawperator skills search --keyword "air conditioner" # (Gap 5) -> 2 skills
clawperator skills get com.google.android.apps.chromecast.app.get-climate-replay
clawperator skills run com.google.android.apps.chromecast.app.get-climate-replay \
  --device <serial> -- --unit-name "<inferred>"
# -> returns current HVAC state; agent replies to user via OpenClaw
```

Gaps 3, 4, 6-10 improve reliability and extend the model to OpenClaw-native discovery, but the above three are what turn the Telegram task from "probably fails" into "probably works".
