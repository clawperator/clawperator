# Public `skill.md` Agent Setup Entrypoint

## Executive Summary

This pack adds a Link-style public agent onboarding entrypoint for Clawperator:
`https://clawperator.com/skill.md`. The first implementation is a landing and
documentation change, not a runtime or plugin ecosystem change.

The goal is to let a user tell an outside agent:

```text
Read https://clawperator.com/skill.md and get me set up with Clawperator.
```

That public skill should guide the agent through setup, repair, verification,
and local orientation. It should not become a broad runtime command tutorial,
runtime skill package, or registry/plugin metadata project.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this task ships:

- `https://clawperator.com/skill.md` serves a direct, static, agent-readable
  setup and orientation skill.
- `https://clawperator.com/agents.md` exists as a compact agent-facing entry
  that points to `/skill.md` and the shell installer fallback.
- Existing landing machine-readable surfaces point agents and crawlers at the
  new entrypoint.
- Install validation proves the public Markdown contract exists and continues
  to name the correct package, prerequisites, commands, and stop conditions.
- Public docs explain the agent-directed setup path without moving durable
  behavior notes into `tasks/`.

## Problem Statement

Clawperator is already an agent-facing actuator runtime, but its first-run flow
spans several surfaces:

- host prerequisites
- CLI install or repair
- `clawperator install`
- Android device or emulator readiness
- Operator APK setup
- `doctor` verification
- device selection with `--device <device_serial>`
- local host-agent orientation under `~/.clawperator/AGENTS.md`
- optional MCP serving with `clawperator mcp serve`
- runtime skill discovery after setup

The existing human docs and `llms.txt` are useful for source discovery, but they
do not give a compact, prescriptive "agent, set this up" contract. A public
`skill.md` fills that gap.

## In Scope

- Add `sites/landing/public/skill.md` as the canonical public setup skill.
- Add `sites/landing/public/agents.md` as a compact public agent entrypoint.
- Update landing machine-facing files so `/skill.md` and `/agents.md` are
  discoverable.
- Update landing copy with the public prompt and installer fallback.
- Add install validation for the new public Markdown contract.
- Update authored public docs so the new agent-directed setup path is durable.
- Regenerate and validate docs-site output when authored docs change.

## Out of Scope

- Redirecting `/skill.md` to GitHub raw content.
- Hosting `skill.md` from `../clawperator-skills`.
- Adding a bundled host-agent skill for this setup flow.
- Registering this setup skill with public skills installer ecosystems.
- Adding `.codex-plugin`, `.claude-plugin`, or similar package metadata.
- Adding `/.well-known/skills/*` or `/.well-known/agent-skills/*` discovery in
  this first PR.
- Adding a full rendered `/agents` page redesign.
- Adding runtime behavior, CLI command changes, Android changes, or new runtime
  skills.
- Documenting debug `.dev` Operator package defaults in the public skill.
- Turning the public skill into a broad runtime command guide.

## Existing Artifact Scope

- `tasks/install/skill.md/findings.md`: evidence base and prior research. Keep
  this file as input for implementation, but do not treat task files as durable
  documentation after the work ships.
- `sites/landing/public/skill.md`: new authored static public skill.
- `sites/landing/public/agents.md`: new authored static public entrypoint.
- `sites/landing/public/_redirects`: in scope so `/agents.md` stops redirecting
  to `/index.md`.
- `sites/landing/public/index.md`: in scope for a small public prompt entry.
- `sites/landing/public/llms.txt`: in scope for discovery links.
- `sites/landing/public/landing-sitemap.xml`: in scope for new public URLs.
- `sites/landing/public/sitemap.xml`: in scope only if the landing sitemap
  timestamp is updated by the task.
- `docs/setup.md` and `docs/host-agents.md`: likely authored docs surfaces for
  durable setup and host-agent orientation notes.
- `validation/install/`: in scope for new public `skill.md` contract coverage.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `sites/landing/public/skill.md` | New canonical public setup skill | Phase 1 |
| `sites/landing/public/agents.md` | New compact agent entrypoint | Phase 1 |
| `sites/landing/public/_redirects` | Remove stale `/agents.md` redirect and retarget `.md` aliases | Phase 1 |
| `sites/landing/public/index.md` | Add a small "Tell your agent" entry | Phase 1 |
| `sites/landing/public/llms.txt` | Add `/skill.md` and `/agents.md` discovery links | Phase 1 |
| `sites/landing/public/landing-sitemap.xml` | Add `/skill.md` and `/agents.md` URLs | Phase 1 |
| `validation/install/test_skill_md.sh` | New contract validation harness | Phase 1 |
| `validation/install/test_install.sh` | Wire the new harness into the suite | Phase 1 |
| `validation/install/README.md` | Document the new harness | Phase 1 |
| `docs/setup.md` | Add or link the agent-directed setup path | Phase 2 |
| `docs/host-agents.md` | Explain how outside agents should use `/skill.md` and local orientation | Phase 2 |
| `sites/docs/.build/` and `sites/docs/site/` | Regenerated only through docs build, if docs changes require it | Phase 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Durable findings and user decisions | `tasks/install/skill.md/findings.md` and this `plan.md` |
| Package name and Node requirement | `apps/node/package.json` |
| Install command and post-bootstrap route | `sites/landing/public/install.sh`, `apps/node/src/cli/registry.ts` |
| CLI commands and accepted flags | `apps/node/src/cli/registry.ts` |
| Host setup artifacts | `apps/node/src/domain/host/hostSetup.ts` |
| Public setup docs | `docs/setup.md` |
| Host-agent orientation docs | `docs/host-agents.md` |
| Landing machine files | `sites/landing/public/` |
| Install validation patterns | `validation/install/` |
| Agent API and CLI UX principles | `docs/internal/design/node-api-design-guiding-principles.md` |

Do not write public commands or package names from memory. Reopen the relevant
source before editing.

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Serve `/skill.md` as a direct static file from `sites/landing/public/skill.md`.
- Do not redirect `/skill.md` to GitHub raw content.
- Add an entry at `https://clawperator.com/agents.md`.
- Do not create a full rendered `/agents` page in this PR.
- Keep the public skill setup-focused: install, repair, verify, orient, and
  hand off to local docs or skills discovery.
- Use `clawperator` as the npm package name.
- State Node.js 24+ as the Node requirement.
- Use `curl -fsSL https://clawperator.com/install.sh | bash` as the shell
  bootstrap fallback.
- Use `npm install -g clawperator` or `npm install -g clawperator@latest` only
  when describing direct npm installation.
- Use `clawperator install` as the canonical post-bootstrap route.
- Use `clawperator doctor`, `clawperator devices`, and
  `clawperator snapshot --device <device_serial>` as readiness checks.
- Mention `clawperator mcp serve` only as the stdio MCP route after setup, not
  as a replacement for install.
- Do not mention debug `.dev` Operator package defaults in the public skill.
- Do not add public skills registry metadata or `.codex-plugin` /
  `.claude-plugin` metadata.

**Judgment required:**

- The exact Markdown structure of `skill.md`, as long as it preserves the
  contract above.
- Whether `skill.md` uses YAML frontmatter, and which non-sensitive metadata is
  included.
- The exact "last verified" marker. If included, derive package version from
  `apps/node/package.json` at implementation time and keep the marker easy to
  validate.
- The exact placement of the new prompt in `index.md` and public docs.
- The exact placement of redirect rules after removing `/agents.md /index.md`
  and retargeting `/agent.md` and `/for-agents.md` to `/agents.md`.

## Public `skill.md` Content Contract

The public skill should be concise and operational. It should include:

- What Clawperator is: an actuator for Android automation by agents.
- What Clawperator is not: an autonomous planner or credential manager.
- When to use this skill: first install, repair, verify, orient, MCP setup, or
  device readiness checks.
- Prerequisites: Node.js 24+, npm, Java 17 or 21, adb, and an Android physical
  device or emulator.
- Fresh bootstrap route:

  ```bash
  curl -fsSL https://clawperator.com/install.sh | bash
  ```

- Existing CLI route:

  ```bash
  npm install -g clawperator@latest
  clawperator install
  ```

- Readiness checks:

  ```bash
  clawperator doctor
  clawperator devices
  clawperator snapshot --device <device_serial>
  ```

- Local orientation after install: read `~/.clawperator/AGENTS.md`,
  `~/.clawperator/install-state.json`, and
  `~/.clawperator/mcp-config-snippet.json` when present.
- Human handoff points: OS prompts, Android Developer Options, USB debugging,
  accessibility permission, app sign-in, and selecting a physical device or
  emulator when needed.
- Post-setup routes: docs, MCP server, runtime skill discovery, and canonical
  CLI help.
- Stop conditions: do not guess credentials, do not bypass user approval, do
  not continue when no authorized device is available, and report exact failing
  command/output when setup cannot be completed.

It should not include:

- A long runtime command tutorial.
- Debug `.dev` Operator package defaults.
- Private local paths except the standard `~/.clawperator/*` files.
- Claims about future discovery ecosystems that this PR does not implement.

## `agents.md` Content Contract

`sites/landing/public/agents.md` should be short. It is not a full page
redesign. It should include:

- A one-paragraph summary of Clawperator for agents.
- The exact user prompt:

  ```text
  Read https://clawperator.com/skill.md and get me set up with Clawperator.
  ```

- The shell fallback:

  ```bash
  curl -fsSL https://clawperator.com/install.sh | bash
  ```

- Links to `/skill.md`, `/install.sh`, `https://docs.clawperator.com/`,
  `https://clawperator.com/llms.txt`, and
  `https://clawperator.com/llms-full.txt`.
- A short note that Clawperator is the deterministic hand and the external
  agent remains the brain.

## Decision Rules

| Question | Rule |
| --- | --- |
| What owns `/skill.md`? | `sites/landing/public/skill.md`, served directly from `clawperator.com`. |
| Should `/skill.md` redirect to GitHub raw? | No. Keep it direct and static for this first implementation. |
| Should `/agents.md`, `/agent.md`, or `/for-agents.md` redirect to `/index.md`? | No. Once `agents.md` exists, remove `/agents.md /index.md` and retarget `/agent.md` and `/for-agents.md` to `/agents.md`. |
| Should `/agent` and `/for-agents` change? | No. Preserve their existing redirects to `/agents`, the existing rendered landing route. |
| How much runtime guidance belongs in `skill.md`? | Only enough to verify readiness and hand off to docs, MCP, or skill discovery. Do not create a full runtime tutorial. |
| Should the public skill mention local debug package defaults? | No. Keep public setup oriented toward release defaults. |
| Should the task add well-known skill discovery endpoints? | No. Leave them as future work unless a later task scopes them explicitly. |
| Should validation fetch the live website? | No. Validate repository files and local build outputs. Live verification can be a manual post-merge check if needed. |
| How should docs claims be written? | Open code first. If docs and code disagree, code is authoritative. |

## Failure Modes To Prevent

- `/agents.md`, `/agent.md`, or `/for-agents.md` are still redirected to `/index.md` after the new file exists.
- The public skill names the wrong npm package.
- The public skill states Node.js 18+ or another stale requirement.
- The public skill over-promises device setup, permissions, sign-in, or MCP
  behavior that still requires human action.
- The task adds a GitHub raw redirect even though the user explicitly rejected
  it.
- The task adds public skills registry or plugin metadata out of scope.
- The public skill becomes a long runtime command guide and buries the setup
  flow.
- Landing discovery files point at `/skill.md`, but validation does not protect
  the contract.
- Durable setup guidance remains only in `tasks/`.

## Output Contract

After Phase 1:

- `sites/landing/public/skill.md` exists and passes install validation.
- `sites/landing/public/agents.md` exists and is not redirected away.
- Landing machine-facing discovery files include the new entrypoints.
- Install validation includes a focused `skill.md` harness and the harness is
  wired into the full install suite.
- `./scripts/site_build.sh` succeeds.

After Phase 2:

- Authored public docs describe the agent-directed setup path.
- Docs output is regenerated through the docs build workflow if required by the
  docs change.
- `./scripts/docs_build.sh` succeeds.
- The task pack contains no un-migrated durable guidance that belongs in docs.

## Validation Summary

The implementing agent must run, at minimum:

```bash
bash validation/install/test_skill_md.sh
./validation/install/test_install.sh
./scripts/site_build.sh
```

If authored docs under `docs/` change, also run:

```bash
./scripts/docs_build.sh
```

Before final review, also check touched Markdown and redirect files for em
dashes:

```bash
! rg -n $'\u2014' sites/landing/public/skill.md sites/landing/public/agents.md sites/landing/public/index.md docs/setup.md docs/host-agents.md validation/install/README.md
```
