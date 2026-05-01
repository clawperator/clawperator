# `skill.md` Agent Onboarding Findings

## Purpose

This file synthesizes the independent findings in:

- `tasks/install/skill.md/findings-codex.md`
- `tasks/install/skill.md/findings-claude.md`

It is intended as the evidence base for a later `$task-author` task pack. It
keeps confirmed facts separate from inferences, records objections to weaker
claims, and maps the findings to a likely Clawperator implementation.

## Executive Summary

Stripe Link is using `https://link.com/skill.md` as a short, public,
agent-readable entrypoint. The Link agents page tells humans to point their
agent at a `skill.md` file, while the URL redirects to a real `SKILL.md` in the
`stripe/link-cli` GitHub repository.

The important paradigm is not just "host one Markdown file." It is a product
onboarding handshake:

- the human sees a copyable or memorable instruction
- the agent fetches an authoritative Markdown skill
- the skill names tools, install steps, auth flow, output contracts, safety
  rules, and recovery behavior
- the human remains involved for approval or device setup boundaries

Clawperator is a strong fit because it is already an agent-facing actuator
runtime with a non-trivial install and orientation flow. A public
`https://clawperator.com/skill.md` should be treated as an install and
orientation bootstrap contract for outside agents. It should not replace
runtime skills, the docs, or local host-specific `~/.clawperator/AGENTS.md`.

Recommended first implementation:

- serve `sites/landing/public/skill.md` directly from `https://clawperator.com/skill.md`
- keep it setup-focused: install, repair, verify, orient
- include a link or alias for well-known skill discovery only if we decide to
  support that in the same task
- update landing machine-facing files and install validation together
- document the public prompt and the maintenance contract

## Verified Facts

| Claim | Status | Evidence |
| --- | --- | --- |
| Link has an agents page that frames Link as a wallet for agents. | Confirmed | `https://link.com/au/agents` and `https://link.com/agents` |
| Link's agents page includes a "How to get started" flow with "Point your agent to the skill.md file" and "Authenticate and grant access." | Confirmed | Static page HTML includes `Point your agent to the <Link>skill.md</Link> file` and `Authenticate and grant access`. |
| Link's page has "Tell your agent to:" and "Or run:" labels. | Confirmed | Static page HTML includes those labels. |
| The exact prompt `Read link.com/skill.md and get me set up with Link` was observed by the user. | User-provided, not independently extracted | The prompt was in the user's supplied page excerpt. My static HTML fetch found the surrounding labels but not the literal prompt text, likely because the command block is hydrated or rendered client-side. |
| `https://link.com/skill.md` redirects to GitHub raw content when fetched with US Link locale cookies. | Confirmed | `curl -H 'Cookie: country=US; locale=en' https://link.com/skill.md` returns `307` to `https://raw.githubusercontent.com/stripe/link-cli/refs/heads/main/skills/create-payment-credential/SKILL.md`. |
| The redirected file is a real `SKILL.md` with YAML frontmatter and agent operating instructions. | Confirmed | `https://raw.githubusercontent.com/stripe/link-cli/main/skills/create-payment-credential/SKILL.md`. |
| Link's `SKILL.md` prefers MCP when available and falls back to CLI. | Confirmed | The skill has a "Choosing how to call Link" section with MCP tool mapping and CLI fallback. |
| Link's CLI package is `@stripe/link-cli`. | Confirmed | Link README and `packages/cli/package.json` in `stripe/link-cli`. |
| Link's repo includes `.codex-plugin`, `.claude-plugin`, MCP config, and a skill directory. | Confirmed | `https://github.com/stripe/link-cli`. |
| Stripe announced Link wallet for agents on April 29, 2026. | Confirmed | Stripe blog post "Giving agents the ability to pay", dated April 29, 2026. |
| Mintlify hosts `/skill.md` and well-known skill discovery endpoints for docs sites. | Confirmed | Mintlify `skill.md` docs and blog. |
| The Agent Skills spec requires a skill directory with `SKILL.md` containing YAML frontmatter and Markdown. | Confirmed | `https://agentskills.io/specification`. |
| Clawperator's npm package name is `clawperator`. | Confirmed | `apps/node/package.json` has `"name": "clawperator"`. |
| Clawperator requires Node.js 24+. | Confirmed | `apps/node/package.json` has `"node": ">=24.0.0"` and `docs/setup.md` says Node.js v24+. |
| `install.sh` installs `clawperator@latest` and delegates to `clawperator install`. | Confirmed | `sites/landing/public/install.sh`, `docs/setup.md`, and `apps/node/src/cli/registry.ts`. |
| `clawperator install` writes `~/.clawperator/AGENTS.md`, `install-state.json`, and `mcp-config-snippet.json`. | Confirmed | `docs/setup.md` and `apps/node/src/domain/host/hostSetup.ts`. |

## Link Pattern Details

The Link flow has four layers:

1. Human-facing page: `https://link.com/agents` and localized variants describe
   the agent wallet and tell users to point an agent at `skill.md`.
2. Stable public skill URL: `https://link.com/skill.md` is short enough to paste
   into an agent instruction.
3. Canonical repository content: the public URL redirects to the GitHub raw
   `SKILL.md` in `stripe/link-cli`.
4. Tooling bundle: the repo also ships the CLI package, MCP server config,
   plugin metadata, and the skill package.

The hosted Link skill is not just a package installer. It is an operations
manual for a sensitive payment workflow. It covers:

- when to use the skill
- allowed shell tools
- install requirement for `@stripe/link-cli`
- MCP-first invocation and CLI fallback
- `--format json` contracts
- background auth and approval polling
- merchant evaluation before requesting credentials
- credential type selection for card versus shared payment token
- explicit handling of sensitive card and token data
- error cases and recovery behavior

That makes the useful lesson for Clawperator broader than a redirect. The file
must encode how an agent should behave, where it must stop, and how it proves
the setup is complete.

## Broader Ecosystem Context

There is enough evidence to treat `skill.md` as an emerging convention, but the
task pack should avoid overclaiming exact adoption statistics unless a later
agent re-verifies them from primary data.

Confirmed ecosystem facts:

- `agentskills.io` defines a `SKILL.md` format with required `name` and
  `description` frontmatter.
- Mintlify says it hosts generated `skill.md` files at `/skill.md` and supports
  `/.well-known/skills/*` plus `/.well-known/agent-skills/*` discovery paths.
- Mintlify's January 21, 2026 blog says Mintlify docs sites contain
  `/.well-known/skills/default/skill.md` and also serve `/skill.md` for
  convenience.
- GitBook's February 24, 2026 blog frames `skill.md` as product documentation
  for agents and emphasizes workflows, boundaries, decision rules, and
  guardrails.
- Vercel documents a `skills` CLI using commands such as
  `npx skills add <owner/repo>` and describes skills as directories containing
  `SKILL.md`.

Useful external examples found during research:

- Canary presents `Read https://canary.bot/skill.md and follow the instructions
  to join Canary`.
- Polygon Agent CLI docs say the CLI ships with a `SKILL.md` agents can load
  directly.
- Nara docs describe installing a Nara skill into agents including OpenClaw,
  Claude Code, Codex, Cursor, OpenCode, and Amp.
- AgentLink presents `https://api.theagentlink.xyz/skill.md` as a protocol URL.

## Corrections To Prior Drafts

These points should guide the task pack and prevent weak claims from being
copied forward:

- Do not say Link's public `skill.md` is merely "setup-focused." The verified
  redirect target is `create-payment-credential/SKILL.md`, which includes setup,
  auth, MCP/CLI selection, and runtime payment credential behavior.
- Do not say `link.com/skill.md` could not be fetched. It can be fetched when
  locale cookies avoid the AU to US redirect loop.
- Do not use `npm install -g @clawperator/node`. The current package is
  `clawperator`, installed with `npm install -g clawperator` or
  `npm install -g clawperator@latest`.
- Do not say Clawperator requires Node.js 18+. The current requirement is
  Node.js 24+.
- Do not rely on ecosystem scale numbers from non-primary summaries unless they
  are re-verified from primary datasets. The task does not need those numbers.
- Do not treat `/.well-known/skills/default/skill.md` as mandatory for the first
  Clawperator implementation. It is a useful discovery convention, but
  `/skill.md` alone delivers the Link-style user prompt.
- Do not conflate a public bootstrap skill with Clawperator runtime skills.
  Runtime app skills still belong in the skills repository and installed
  runtime skill registry.

## Why This Fits Clawperator

Clawperator is already built as the hand for agent brains. The product has a
host-side CLI, Node API, MCP server, Android Operator APK, runtime skills, and a
physical or emulator target. The first-time setup path is powerful but has
multiple decision points:

- shell prerequisites
- CLI install or repair
- `clawperator install`
- Android device or emulator readiness
- Operator APK setup
- permission and accessibility repair
- device disambiguation with `--device <serial>`
- MCP snippet discovery
- runtime skill discovery

A public `skill.md` can turn those into an explicit agent flow. The file should
tell an outside agent:

1. What Clawperator is and is not.
2. How to choose between existing CLI repair and fresh bootstrap.
3. Which commands to run and in what order.
4. Which outputs prove readiness.
5. Which host or device steps require the human.
6. Where to find local host-specific orientation after install.
7. How to choose MCP versus CLI after setup.

This is especially useful because Clawperator's existing public docs are good
for humans and `llms.txt` is good for source discovery, but neither is quite the
same as a compact, prescriptive "agent, do this setup flow" contract.

## Recommended Clawperator Implementation

### First PR Shape

The first implementation should be a docs and landing-site task, not a Node or
Android runtime change.

Recommended authored surfaces:

- `sites/landing/public/skill.md`
- `sites/landing/public/index.md`
- `sites/landing/public/llms.txt`
- `sites/landing/public/sitemap.xml`
- `sites/landing/public/landing-sitemap.xml`
- `docs/setup.md` or `docs/host-agents.md`
- `validation/install/`

Generated or build output should not be hand-edited. If public docs are touched,
run the docs build path required by repository rules.

### File Location Decision

Prefer a real static file at:

```text
sites/landing/public/skill.md
```

Reasons:

- Clawperator already serves root machine-facing files from
  `sites/landing/public/`.
- The file belongs beside `install.sh`, `llms.txt`, `robots.txt`, and
  `sitemap.xml`.
- Direct static hosting is simpler than a redirect and easier to validate in
  install tests.
- A redirect to GitHub raw can be added later if we want source-code URL
  canonicalization like Link.

Optional future paths:

- `/.well-known/skills/default/skill.md`
- `/.well-known/agent-skills/index.json`
- `/.well-known/agent-skills/clawperator-setup/SKILL.md`

Do not make these future paths block the first `/skill.md` implementation unless
the task author intentionally scopes discovery support into the same PR.

### Proposed Public Prompt

```text
Read https://clawperator.com/skill.md and get me set up with Clawperator.
```

The landing page can also show:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
```

### Recommended `skill.md` Scope

The public skill should be named around setup and orientation, for example:

```yaml
---
name: clawperator-setup
description: Install, repair, verify, and orient Clawperator for Android automation by AI agents. Use when setting up Clawperator on a host, repairing an install, configuring MCP, or verifying device readiness.
license: Apache-2.0
compatibility: Requires Node.js 24+, Java 17 or 21, adb, and a physical Android device or emulator.
metadata:
  homepage: https://clawperator.com
  docs: https://docs.clawperator.com
  repository: https://github.com/clawperator/clawperator
  installer: https://clawperator.com/install.sh
allowed-tools:
  - Bash(clawperator:*)
  - Bash(curl:*)
  - Bash(npm:*)
  - Bash(node:*)
  - Bash(java:*)
  - Bash(adb:*)
---
```

The body should include:

- concise mission statement: Clawperator is the deterministic Android
  automation hand, not an autonomous planner
- setup decision table:
  - CLI exists: run `clawperator version`, `clawperator install`, then
    `clawperator doctor`
  - CLI missing: run `curl -fsSL https://clawperator.com/install.sh | bash`
  - npm-only fallback: run `npm install -g clawperator`, then
    `clawperator install`
- verification commands:
  - `clawperator doctor`
  - `clawperator devices`
  - `clawperator snapshot --device <device_serial>` when a ready device exists
- multiple-device rule:
  - always preserve and use explicit `--device <device_serial>` guidance when
    multiple adb-visible devices exist
- local orientation:
  - read `~/.clawperator/AGENTS.md`
  - inspect `~/.clawperator/install-state.json`
  - inspect `~/.clawperator/mcp-config-snippet.json`
- MCP guidance:
  - prefer MCP when the host agent can use the generated snippet
  - otherwise use CLI commands directly
- runtime skills guidance:
  - discover with `clawperator skills list`, `clawperator skills search`, and
    `clawperator skills get`
- human boundary conditions:
  - USB debugging, physical connection, OS prompts, and some Android permission
    flows may require human action
  - do not invent credentials or pretend setup is complete when `doctor` or
    `snapshot` fails

## Source Of Truth For Task Authoring

| Topic | Verify against |
| --- | --- |
| Landing root files | `sites/landing/public/` |
| Landing redirects | `sites/landing/public/_redirects` |
| Installer behavior | `sites/landing/public/install.sh` |
| Install validation | `validation/install/test_install.sh` and sibling files |
| CLI command names and help | `apps/node/src/cli/registry.ts` |
| Node package name and engine | `apps/node/package.json` |
| Host setup outputs | `apps/node/src/domain/host/hostSetup.ts` |
| Setup docs | `docs/setup.md` |
| Host agent orientation docs | `docs/host-agents.md` |
| Skills docs | `docs/skills/overview.md`, `docs/skills/authoring.md` |
| Public docs build rules | `.agents/skills/docs-build/SKILL.md` |
| Public docs authoring rules | `.agents/skills/docs-author/SKILL.md` |

## Validation Expectations For A Future Task Pack

A later task pack should require at least:

```bash
LC_ALL=C grep -n '[^ -~]' sites/landing/public/skill.md docs/setup.md docs/host-agents.md || true
./validation/install/test_install.sh
./scripts/site_build.sh
```

If the implementation touches public docs under `docs/`, also require:

```bash
./scripts/docs_build.sh
```

If the implementation changes Node CLI behavior, also require:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

The install validation suite should gain focused coverage that:

- `sites/landing/public/skill.md` exists
- the file contains valid frontmatter with `name` and `description`
- the file names `npm install -g clawperator`, not `@clawperator/node`
- the file names Node.js 24+
- the file includes `curl -fsSL https://clawperator.com/install.sh | bash`
- the file includes `clawperator install`
- the file includes `clawperator doctor`
- the file includes explicit `--device <device_serial>` guidance
- the file points to `~/.clawperator/AGENTS.md` and
  `~/.clawperator/mcp-config-snippet.json`

## Open Questions

| Question | Recommendation | Why |
| --- | --- | --- |
| Should the first public file be setup-only or setup plus runtime command guide? | Setup plus orientation only. | Runtime command details are larger, version-sensitive, and already belong in docs and runtime skills. |
| Should `/skill.md` redirect to GitHub raw content like Link? | No for the first implementation. | Static `sites/landing/public/skill.md` is simpler, testable, and aligned with existing root files. |
| Should we add well-known skill discovery endpoints now? | Optional follow-up unless the user wants ecosystem discovery in the first PR. | `/skill.md` is enough for the Link-style prompt; well-known discovery adds more files and validation. |
| Should this also be packaged as a bundled host-agent skill? | Consider follow-up. | The public skill targets pre-install agents; bundled skills target already-installed hosts. |
| Should the skill mention debug `.dev` Operator package defaults? | Only as a local-development note, not the primary public setup path. | Public setup should target release defaults; repo agents still need `.dev` guidance from AGENTS/docs. |
| Should the landing page add a full `/agents` page? | Optional. Start with a compact section in `index.md` unless design scope expands. | This keeps the first PR small and avoids front-end scope creep. |

## Objections And Risks

- A stale public `skill.md` can harm agents more than missing docs because it is
  prescriptive. The task should add validation and name the maintenance owners.
- The public skill must not overpromise full autonomy. Android device setup can
  require human action.
- A broad runtime guide in root `skill.md` could become a second source of truth
  for CLI flags and contracts. Keep it focused and link to canonical docs.
- `allowed-tools` is not uniformly enforced across agent clients. Treat it as
  useful metadata, not a security boundary.
- Payment-focused examples like Link have sensitive credential rules. For
  Clawperator, the analogous risk is device/user action authority. The skill
  should include clear permission and user-consent boundaries.
- The task author should not import third-party ecosystem statistics unless they
  are necessary and primary-source verified. They are not needed for the
  implementation decision.

## Bottom Line

Use the Link pattern as inspiration, but implement the Clawperator version in
Clawperator's own shape:

- direct static `https://clawperator.com/skill.md`
- setup and orientation contract for outside agents
- exact current install commands from repo source
- explicit verification through `doctor`, `devices`, and `snapshot`
- clear handoff to local `~/.clawperator/AGENTS.md`, MCP snippet, and runtime
  skills
- tests that prevent command drift

This is ready to become a `$task-author` task pack for adding the public
`skill.md` install entrypoint.
