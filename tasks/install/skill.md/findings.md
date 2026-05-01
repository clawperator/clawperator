# `skill.md` Install Entrypoint Findings

## Summary

Stripe Link is using `https://link.com/skill.md` as a public, agent-readable
bootstrap entrypoint. The human-facing page tells the user to paste a single
instruction into their agent:

```text
Read link.com/skill.md and get me set up with Link
```

The URL is not a general docs page. It redirects to the canonical `SKILL.md`
inside Stripe's `stripe/link-cli` GitHub repository, where the actual agent
contract lives. This is a small but useful packaging pattern: a short public URL
for humans, backed by a normal skill file for agents.

Clawperator can support the same pattern easily because it already has:

- a public landing surface at `clawperator.com`
- a one-command installer at `https://clawperator.com/install.sh`
- agent-readable public context in `llms.txt` and `llms-full.txt`
- bundled host-agent skills installed into common agent skill roots
- `~/.clawperator/AGENTS.md` as a durable local orientation file after install

The missing layer is a concise, hosted `https://clawperator.com/skill.md` that
tells an agent how to install or repair Clawperator safely, verify readiness,
and then orient itself through the existing local artifacts.

## What Link Ships

Link's public agent page presents the flow as:

- point the agent to `skill.md`
- authenticate and grant access
- alternatively install `@stripe/link-cli` and run `link-cli --help`

Source: [Link agents page](https://link.com/au/agents)

With a US Link locale cookie, `https://link.com/skill.md` responds with a `307`
redirect to:

```text
https://raw.githubusercontent.com/stripe/link-cli/refs/heads/main/skills/create-payment-credential/SKILL.md
```

The target file is a real skill package document with YAML frontmatter and
natural-language operating instructions. It includes:

- `name`, `description`, `allowed-tools`, `license`, `version`, and metadata
- an `openclaw` metadata block with install requirements for `@stripe/link-cli`
- trigger guidance for payment, checkout, and Link sign-in requests
- an MCP-first path with CLI fallback
- machine-readable JSON-output expectations
- explicit background/polling instructions for long-running auth and approval
  flows
- a step-by-step payment credential workflow
- safety guidance for card credentials, merchant trust, and agent directives
- common error codes and recovery behavior

Sources:

- [Link `SKILL.md`](https://raw.githubusercontent.com/stripe/link-cli/main/skills/create-payment-credential/SKILL.md)
- [Link CLI repository README](https://github.com/stripe/link-cli)
- [Link Codex plugin manifest](https://raw.githubusercontent.com/stripe/link-cli/main/.codex-plugin/plugin.json)
- [Link MCP config](https://raw.githubusercontent.com/stripe/link-cli/main/.mcp.json)

## Product Context

Stripe announced Link's wallet for agents on April 29, 2026. The model is:

- a user grants an agent access through OAuth
- the agent creates a spend request
- the user approves the request in Link
- Link returns a one-time-use card or shared payment token
- the agent completes the purchase without seeing reusable raw payment
  credentials

Sources:

- [Stripe blog: Giving agents the ability to pay](https://stripe.com/blog/giving-agents-the-ability-to-pay)
- [TechCrunch coverage, April 30, 2026](https://techcrunch.com/2026/04/30/stripe-link-digital-wallet-ai-agents-shopping/)

The product is not just "install this CLI." It uses `skill.md` as an agent
operations manual. The CLI, MCP server, and plugin metadata are supporting
surfaces for the same agent-facing contract.

## Broader Pattern

This appears to be a growing convention for agent-first onboarding:

- publish a stable `skill.md` URL at a memorable product domain
- tell the user to paste one instruction into their agent
- let the agent read the Markdown, install required tools, authenticate, and
  proceed
- keep command schemas, safety rules, and recovery behavior inside the skill
  instead of scattering them across human docs

Other examples found during search:

- Canary tells users: `Read https://canary.bot/skill.md and follow the instructions to join Canary`.
- Polygon Agent CLI says it ships a `SKILL.md` that Claude and OpenClaw can load
  directly.
- Nara documents skill installation for OpenClaw, Claude Code, Codex, and other
  agents.
- AgentLink exposes `https://api.theagentlink.xyz/skill.md` as a protocol URL.

Sources:

- [Canary agent onboarding](https://canary.bot/)
- [Polygon Agent CLI docs](https://docs.polygon.technology/payment-services/agentic-payments/polygon-agent-cli/)
- [Nara skill docs](https://docs.nara.build/docs/skill/use-in-agent/)
- [AgentLink connect page](https://theagentlink.xyz/connect)

## Why This Fits Clawperator

This maps especially well to Clawperator because Clawperator is already an
agent-actuator substrate. A hosted `skill.md` would be an agent-facing bootstrap
contract, not a replacement for runtime skills.

The likely Clawperator flow would be:

```text
Read https://clawperator.com/skill.md and get me set up with Clawperator
```

The hosted skill should tell the agent to:

1. Check for an existing `clawperator` binary.
2. Prefer `clawperator install` when the CLI is already present.
3. Use `curl -fsSL https://clawperator.com/install.sh | bash` only for initial
   bootstrap or recovery when the CLI is missing.
4. Run `clawperator doctor`.
5. Run `clawperator devices` and preserve explicit `--device <serial>` guidance
   when multiple devices are connected.
6. Read `~/.clawperator/AGENTS.md` after install for local, host-specific
   orientation.
7. Surface `~/.clawperator/mcp-config-snippet.json` when the user's agent can use
   MCP.
8. Use `clawperator skills list`, `clawperator skills search`, and
   `clawperator skills get` to discover installed runtime skills.
9. Make clear that Clawperator is the hand, not the planner.

That would make the public install path friendlier to Claude, Codex, OpenClaw,
Cursor, custom agents, and any future agent that can fetch a URL and run shell
commands.

## Recommended Shape

Add `sites/landing/public/skill.md` as an authored source file served from
`https://clawperator.com/skill.md`.

Recommended sections:

- YAML frontmatter:
  - `name: clawperator-setup`
  - `description`: install, repair, verify, and orient Clawperator
  - `allowed-tools`: shell commands for `clawperator`, `curl`, `npm`, `node`,
    `java`, `adb`, and file reads under `~/.clawperator`
  - metadata with homepage, docs, repository, and installer URLs
- Purpose:
  - "Set up Clawperator as a deterministic Android automation hand for the
    user's agent."
- Safety:
  - do not store personal device identifiers in examples
  - do not push or expose local artifacts
  - ask before installing if the environment is sensitive or managed
- Install decision tree:
  - CLI exists: run `clawperator version`, `clawperator install`, then
    `clawperator doctor`
  - CLI missing: run `curl -fsSL https://clawperator.com/install.sh | bash`
  - npm-only fallback: `npm install -g clawperator` plus `clawperator install`
- Verification:
  - `clawperator doctor`
  - `clawperator devices`
  - `clawperator snapshot --device <device_serial>` when a ready device is
    available
- Agent orientation:
  - read `~/.clawperator/AGENTS.md`
  - inspect `~/.clawperator/install-state.json`
  - inspect `~/.clawperator/mcp-config-snippet.json`
- Next actions:
  - use MCP when configured
  - otherwise use branch-local or installed CLI as appropriate
  - discover runtime skills with existing `clawperator skills` commands

We could either serve a real Markdown file directly from
`sites/landing/public/skill.md` or add a redirect to a canonical GitHub raw
skill. Link uses the redirect model. For Clawperator, direct static Markdown in
`sites/landing/public/` is probably simpler and keeps the landing site's
machine-facing root files together with `install.sh`, `llms.txt`, and
`robots.txt`.

## Implementation Notes

Likely code/docs touch points:

- `sites/landing/public/skill.md`: new hosted agent bootstrap skill
- `sites/landing/public/index.md`: add a "Tell your agent" install snippet
- `sites/landing/public/llms.txt`: mention the hosted skill entrypoint
- `sites/landing/public/landing-sitemap.xml` and `sites/landing/public/sitemap.xml`:
  include `https://clawperator.com/skill.md`
- `docs/setup.md` or `docs/host-agents.md`: document the agent-directed install
  path if this becomes official
- validation under `validation/install/`: add a check that `/skill.md` exists,
  has Markdown content, includes the installer command, and does not drift from
  the current setup flow

Potential prompt:

```text
Read https://clawperator.com/skill.md and get me set up with Clawperator.
```

Potential human-facing fallback:

```bash
curl -fsSL https://clawperator.com/install.sh | bash
clawperator doctor
```

## Open Questions

- Should `skill.md` be a Clawperator "setup skill" only, or should it also teach
  first-use Android snapshot and action flows?
- Should the hosted file use current Codex/OpenClaw frontmatter fields, Stripe's
  looser Link-style fields, or both for interoperability?
- Should `clawperator.com/skill.md` redirect to GitHub raw content, like Link,
  or be served directly from the landing public directory?
- Should the same content be packaged as a bundled host-agent skill, for example
  `clawperator-setup`, so installed agents can rediscover it offline?
- Should we add a corresponding `/agents` landing page section with a copyable
  "Tell your agent" instruction?

## Bottom Line

The `Read link.com/skill.md and get me set up with Link` pattern is a concise
agent onboarding handshake:

- memorable URL for humans
- Markdown contract for agents
- install and auth instructions in one place
- structured command expectations
- safety and recovery guidance

Clawperator is already structurally close. Adding `https://clawperator.com/skill.md`
would be a small implementation with high discoverability value.
