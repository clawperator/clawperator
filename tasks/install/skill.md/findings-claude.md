# Research Findings: `skill.md` Agent Onboarding Pattern

**Date:** 2026-05-01
**Researcher:** Claude (Sonnet 4.6)
**Scope:** "Read `<domain>/skill.md` and get me set up with `<Product>`" agent onboarding pattern

---

## 1. What the Link Flow Is Doing

Stripe's Link product (`link.com`) has published a dedicated page at `https://link.com/au/agents` that presents agents as first-class users of the product. The page describes a two-step onboarding:

1. **"Point your agent to the skill.md file"** - the page links to `/skill.md` on the same domain.
2. **"Authenticate and grant access"** - the user approves the agent's Link connection.

The intended user-facing prompt is something like:
> "Read link.com/skill.md and get me set up with Link"

An agent (Claude, OpenClaw, Codex, or custom) fetches `https://link.com/skill.md`, receives a SKILL.md-formatted document with step-by-step setup instructions, and executes them - installing the `@stripe/link-cli` package, authenticating to the user's Link account, and optionally configuring an MCP server.

**Confirmed from primary sources:**
- `link.com/au/agents` page explicitly says "Point your agent to the skill.md file" and links to `/skill.md` ([archived fetch, 2026-05-01]).
- The `stripe/link-cli` GitHub repo contains `skills/create-payment-credential/SKILL.md`, which handles runtime payment credential flow.
- The repo also contains `.claude-plugin` and `.codex-plugin` directories, indicating deliberate multi-agent-client targeting.

**Inferred (not verified directly):**
- The publicly served `link.com/skill.md` likely contains a setup-focused SKILL.md that drives installation of link-cli and MCP configuration. The redirect loop prevented a direct fetch - possibly geo-restricted to US, or requires a specific user-agent.
- The exact verbatim user-facing prompt is inferred from page context; it was not present as a literal copyable string in the page excerpt available.

**Sources:**
- `https://link.com/au/agents` (fetched 2026-05-01)
- `https://github.com/stripe/link-cli` (fetched 2026-05-01)
- [Stripe Link TechCrunch](https://techcrunch.com/2026/04/30/stripe-link-digital-wallet-ai-agents-shopping/)

---

## 2. What `skill.md` Contains and How It Is Served

### Format

A `skill.md` file is a SKILL.md-formatted document: YAML frontmatter followed by Markdown instructions. The frontmatter defines `name` and `description` (required by the [agentskills.io spec](https://agentskills.io/specification)); the body contains step-by-step instructions, gotchas, and links to detailed docs.

Example structure the Link skill likely follows:

```markdown
---
name: link-setup
description: Set up Stripe Link wallet access for AI agent payments. Use when getting started with Link or when an agent needs payment credentials.
---

## Prerequisites
...

## Installation
npx @stripe/link-cli auth login --client-name "<agent-name>"

## MCP Configuration
...
```

### Canonical URL Convention

The Agent Skills spec (agentskills.io, released December 2025) defines `/.well-known/skills/default/skill.md` as the canonical discovery path. The `/skill.md` root path is a widely-used convenience alias. Both are in active use:

- Mintlify docs sites auto-generate `/.well-known/skills/default/skill.md` and also serve `/skill.md`.
- The `npx skills add <docs-url>` CLI tool discovers skills automatically from either path.

### How It Is Served

Products simply host the file as a static asset at the root URL. For documentation-hosted examples (GitBook, Mintlify), the file lives within the docs site. For product-root examples like Link, it is a static file served at the root domain, analogous to `robots.txt` or `llms.txt`.

**Sources:**
- [agentskills.io specification](https://agentskills.io/specification)
- [Mintlify blog - skill.md open standard](https://www.mintlify.com/blog/skill-md)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [GitBook blog - skill.md](https://www.gitbook.com/blog/skill-md)

---

## 3. Whether This Appears to Be a Broader Convention

**Yes - this is a real and fast-growing convention, not a one-off.**

Key evidence:

- **Origin:** Anthropic released the Agent Skills format as an open standard in December 2025. Within weeks, OpenAI adopted it for Codex CLI, followed by GitHub Copilot (VS Code), Cursor, and Gemini CLI. The same SKILL.md folder drives all of them without modification.
- **Scale:** A February 2026 study found the public skills ecosystem grew 18.5x in 20 days (2,179 skills on Jan 16 to 40,000+ by Feb 5). As of March 2026, over 490,000 skills across three major marketplaces (SkillsMP, Skills.sh, ClawHub).
- **Ecosystem infrastructure:** The `npx skills add <url>` CLI tool installs skills from any URL, hub, or docs site. The `/.well-known/` path is being proposed as an RFC for automatic agent discovery.
- **Adoption by products:** Mintlify, GitBook, Vercel, and Stripe/Link are confirmed adopters. The pattern is being framed as "AI documentation" becoming a competitive product surface.

The "Read `<domain>/skill.md` and get me set up with `<product>`" prompt is the consumer-facing version of this convention - it is the simplest possible instruction an agent can execute to bootstrap a product setup. Link appears to be the first major consumer-grade payment product to formalize this.

**Sources:**
- [Anthropic - Equipping agents for the real world](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [agentskills.io specification](https://agentskills.io/specification)
- [Claude Code skills docs](https://code.claude.com/docs/en/skills)
- [GitHub - VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills)

---

## 4. Why This Pattern Would or Would Not Fit Clawperator

### Why It Fits

**Clawperator's primary user is already an agent.** The CLAUDE.md mission states: "The Brain (Agent) interacts with the Clawperator Node API to reason about state and decide what to do next." The `skill.md` pattern is designed precisely for agent-facing product surfaces. Clawperator is a natural fit.

**Setup is non-trivial and currently under-served.** Device setup (ADB, APK install, permissions bootstrap, doctor check) requires multiple correct steps. A public `skill.md` that drives an agent through `clawperator doctor` is exactly the kind of deterministic, step-ordered flow the format is built for.

**The "hand" needs to teach the "brain" its interface.** A well-authored `clawperator.com/skill.md` would let any compatible agent (Claude Code, Codex, Cursor, OpenClaw) self-onboard to Clawperator without human-mediated setup docs. The agent reads the skill, runs the setup steps, and either succeeds or surfaces a diagnostic error.

**Already aligned with existing patterns.** The skills repo at `../clawperator-skills` already distributes skills in SKILL.md format. A public `skill.md` at the domain root is the natural external entry point for that ecosystem.

**The Clawperator brand is already part of the skills ecosystem.** Agent-facing CLI products with `skill.md` support are already indexed on ClawHub and similar registries.

### Risks and Where It Does Not Fit

**Physical device requirements cannot be automated.** USB debugging, APK sideloading, and permission grants require manual steps. A `skill.md` can guide an agent up to the point where human action is required, but it cannot complete device setup autonomously. This must be clearly communicated in the skill's boundary conditions.

**Contract drift risk.** The `skill.md` at a static URL must stay accurate as the CLI and API evolve. If `clawperator.com/skill.md` drifts from the actual behavior, agents will generate incorrect commands. This is a maintenance burden that lives on the landing site team but depends on Node API versioning.

**Scope ambiguity: setup vs. runtime.** A single `skill.md` at the root URL is the "setup" entry point. Runtime agent usage (how to call `snapshot`, `tap`, `type`, `scroll`, etc.) is a separate concern and should live in the skills repo as a distinct runtime skill, not conflated in the setup skill.

---

## 5. Recommended Clawperator Implementation Shape

### Two-skill approach

**Skill 1: Setup skill (public, at domain root)**

Host at:
- `https://clawperator.com/skill.md` (convenience alias)
- `https://clawperator.com/.well-known/skills/default/skill.md` (canonical discovery path)

This is a static file in `sites/landing/public/`. Content:

```markdown
---
name: clawperator-setup
description: Install and configure Clawperator for Android device automation. Use when getting started with Clawperator or when an agent needs to set up the Clawperator hand for a new device.
compatibility: Requires Node.js 18+, adb (Android Debug Bridge), and a connected Android device or emulator.
---

## What Clawperator is
Clawperator is the "hand" for LLM agents doing Android device automation. This skill
sets up the Node CLI and validates the device connection.

## Steps

1. **Install the Node CLI**
   ```
   npm install -g @clawperator/node
   ```

2. **Connect your device**
   Connect an Android device via USB with USB debugging enabled, or start an emulator.
   See https://docs.clawperator.com/setup for full device prep steps.

3. **Run doctor to validate setup**
   ```
   clawperator doctor
   ```
   Fix any issues reported before proceeding.

4. **Verify connection**
   ```
   clawperator devices
   ```
   Confirm your target device appears in the list.

## Next steps
For runtime automation commands (snapshot, tap, type, scroll, etc.), see
https://docs.clawperator.com/api or install the runtime skill:
npx skills add clawperator/android-control
```

**Skill 2: Runtime API skill (in `../clawperator-skills` repo)**

A separate skill covering:
- snapshot / UI inspection
- action types (tap, type, scroll, swipe, key)
- result envelope handling
- error codes and recovery
- device targeting (`--device`)

This is already where the skills repo belongs. The setup skill at the domain root links to it.

### Distribution

1. Also register `clawperator` in the skills CLI registry so `npx skills add clawperator` works.
2. The `link-cli` repo uses `.claude-plugin` and `.codex-plugin` directories for client-specific configuration - consider the same for Clawperator's CLI package.
3. Serve `clawperator.com/skill.md` as a static file via `sites/landing/public/skill.md` (same pattern as `install.sh`, `robots.txt`, `llms.txt`).

---

## 6. Open Questions and Risks

| Question | Status | Notes |
|---|---|---|
| Does `link.com/skill.md` serve the setup skill or the runtime skill? | Unconfirmed | Could not fetch due to redirect loop. Inferred: setup. The `create-payment-credential` skill in the repo handles runtime. |
| Is the user-facing prompt exactly "Read link.com/skill.md and get me set up with Link"? | Inferred | Page says "Point your agent to the skill.md file" - the exact prompt is not verbatim on the page. |
| Does `clawperator.com/skill.md` need to be versioned? | Open | If the CLI flags change, old skill.md content will be wrong. Consider a version comment in the file. |
| Should the setup skill handle both `com.clawperator.operator` and `.dev` variants? | Open | The CLAUDE.md says prefer `.dev` for local development. The public skill.md should probably target the release variant for new users. |
| Can agents actually complete the full setup autonomously? | Partial | Steps 1-4 above can be run by an agent. USB debugging and APK install require manual human steps - the skill must explicitly stop at those boundaries and ask the user. |
| Should the skill be `clawperator.com/skill.md` or `docs.clawperator.com/skill.md`? | Open | Given that the skills convention uses the product's main domain or docs domain, either works. The main domain has higher discoverability for the "Read clawperator.com/skill.md" prompt. |
| How does this relate to the existing `clawperator-agent-orientation` bundled skill? | Open | That skill orients agents already running inside Clawperator's environment. The public `skill.md` targets external agents setting up Clawperator for the first time. They serve different audiences and should be kept separate. |

---

## Summary

The "Read `<domain>/skill.md` and get me set up with `<Product>`" pattern is a real, growing convention built on the Agent Skills open standard. Link (Stripe) is the clearest consumer-grade example: they explicitly direct users to give this prompt to their agent, and the hosted `skill.md` drives agent-executed setup.

For Clawperator, the fit is strong - the product is already agent-first and the setup flow is exactly the kind of multi-step CLI workflow the pattern was built for. The recommended implementation is a two-skill split: a public setup skill at `clawperator.com/skill.md` (static file in `sites/landing/public/`) and a separate runtime API skill distributed through the skills repo.

The main risk is maintenance: the setup skill must stay synchronized with the actual CLI behavior. The clearest boundary: the public `skill.md` guides setup through `clawperator doctor`; everything after that lives in the runtime skill and the docs.
