# Agent Host Orientation and CLI Discoverability

## Executive Summary

Follow-up to the install/onboarding cleanup pack after PR #196. This pack is
the durable home for deferred items D1 and D2: public agent-facing docs
information architecture plus CLI self-orientation and discovery guidance.
This is a cross-surface task pack, so it lives unscoped under `tasks/`: 2 PRs,
4 phases. PR-1 settles the public "start here" path for host-agent readers and
updates the authored docs around it. PR-2 tightens CLI help and
registry/discovery error guidance so the shell surface points at the same
stable docs and flows.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | start after the shipped onboarding baseline from PR #196 is available on the branch you implement from |

## Goal

After this task ships, a zero-context host agent or human should be able to
answer three questions without reading task files or branch-local notes:

1. what the first public Clawperator page to read is after install
2. when to start with `clawperator skills` versus MCP
3. which CLI command or error message should be the next step when discovery
   stalls

## Why Now

PR #196 is intentionally scoped to shipped onboarding and install behavior:
runtime-skill discovery, durable install artifacts, and the bounded shared-agent
bridge. D1 and D2 are still worthwhile, but they should simplify around the
shipped behavior that lands from that PR instead of reopening its scope with a
broader docs and CLI pass.

## Current Shipped Baseline

Treat these as already-shipped baseline behavior for this pack. This pack is
allowed to explain them better, but not redesign them:

- `clawperator skills for-app <package_id>` exists as the primary app-oriented
  discovery command
- runtime-skill registry resolution now falls back to the installed home path
  under `~/.clawperator/skills/skills/skills-registry.json`
- `install.sh` writes durable host-agent artifacts under `~/.clawperator/`:
  `AGENTS.md`, `install-state.json`, and `mcp-config-snippet.json`
- if `~/.agents/AGENTS.md` already exists, the installer appends one bounded
  Clawperator bridge block there; it does not create the file otherwise
- runtime skills remain a `clawperator skills ...` model, not shared-agent
  prompt-skills mirrored into `~/.agents/skills/`
- public docs already describe the shipped behavior in `docs/setup.md`,
  `docs/skills/overview.md`, and `docs/api/mcp.md`, but the current entry path
  and cross-linking are still broader follow-up work

## In Scope

- Define one canonical public doc path for agent-host orientation after install
- Rework the public docs cross-links so setup, runtime-skills, and MCP pages
  point at that same canonical orientation flow
- Add exactly one new authored public docs page if the existing pages cannot
  carry the orientation job cleanly
- Tighten top-level CLI help and `skills` help so they point at the stable
  discovery flow that ships after PR #196
- Tighten registry-read and skill-discovery error guidance so it points at the
  installed home path plus the right next command or public docs page
- Regenerate the docs site outputs that derive from these changes

## Out of Scope

- Skill preflight or `requires` metadata work from F6
- Any install artifact or `install.sh` behavior change
- Any new CLI subcommand or runtime capability change
- MCP transport or tool-surface changes
- Android runtime, Operator APK, or device-behavior work

## Existing Artifact Scope

- `docs/setup.md`, `docs/skills/overview.md`, `docs/api/mcp.md`, `docs/index.md`,
  and `docs/quickstart.md`: in scope to rewrite where needed so they align on
  one public first-success flow
- `apps/node/src/cli/registry.ts`: in scope for help-text and usage guidance
  changes only; do not add or remove commands in this pack
- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`: in scope for
  guidance and remediation text only; the fallback resolution logic shipped for
  onboarding is preserved unless a direct contradiction is found
- `sites/docs/.build/` and `sites/docs/site/`: generated outputs only; never
  hand-edit them

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `docs/` authored public pages | Canonical host-agent entry path and cross-links | PR-1 / Phases 1-2 |
| `sites/docs/mkdocs.yml` | Public nav placement for any new or repointed page | PR-1 / Phase 1 |
| `sites/docs/source-map.yaml` | Generated-page ownership when CLI reference output changes | PR-2 / Phase 4 |
| `docs/internal/design/agent-host-integration.md` | Durable internal rule changes only if the preferred orientation flow changes materially | PR-1 / Phase 1 |
| `apps/node/src/cli/registry.ts` | Top-level and `skills` help/orientation text | PR-2 / Phase 3 |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Registry-read remediation and next-step guidance | PR-2 / Phase 4 |
| `apps/node/src/test/unit/skills.test.ts` | Focused regression coverage for changed discovery/error text where appropriate | PR-2 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Public install and artifact behavior | `docs/setup.md`, `sites/landing/public/install.sh` |
| Runtime-skills discovery semantics | `docs/skills/overview.md`, `apps/node/src/cli/registry.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| MCP front-door guidance | `docs/api/mcp.md`, `apps/node/src/cli/registry.ts` |
| Public docs nav | `sites/docs/mkdocs.yml` |
| Generated CLI reference ownership | `sites/docs/source-map.yaml` |
| Durable host-agent design rules | `docs/internal/design/agent-host-integration.md` |
| Historical scope split for this pack | This `plan.md` under `Why Now` and `Current Shipped Baseline`. Do not read retired onboarding task files; this pack is self-contained. |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Use this pack against a branch where the shipped onboarding baseline from
  PR #196 already exists. Do not fold D1 or D2 back into that PR.
- `clawperator skills for-app <package_id>` remains the primary app-oriented
  discovery surface. This pack should explain and surface it better, not replace
  it.
- `clawperator mcp serve` remains the MCP transport surface. This pack may
  clarify when to use it, but it must not redefine the transport model.
- `api/cli.md` is code-derived from `apps/node/src/cli/registry.ts` through
  `sites/docs/source-map.yaml`. Do not hand-edit generated CLI reference output.
- Public docs guidance must point at authored docs routes, not task files, local
  paths, or GitHub source URLs unless a page is intentionally internal-only.
- `~/.clawperator/AGENTS.md` remains a local artifact. It is complementary to
  the public docs, not a replacement for them.

**Judgment required:**

- Whether the canonical public front door should reuse an existing page or be a
  new authored page under `docs/`
- Which existing public pages should become thin pointers versus fuller
  standalone explanations
- The exact top-level help wording that best answers "where do I start?"
- Which registry/discovery errors deserve richer next-step guidance without
  turning help text into a wall of prose

## Decision Rules

| Question | Rule |
| --- | --- |
| Should this pack create a new public page? | Reuse an existing page if one page can carry the agent-host orientation job with targeted edits. If not, create exactly one new authored public page under `docs/` and wire it into `sites/docs/mkdocs.yml`. |
| What should CLI help point at? | Point at the canonical public docs route chosen in PR-1, not at GitHub, task files, or local install artifacts. |
| What should `skills` help emphasize? | The shortest post-install discovery flow: `skills for-app`, `skills search`, `skills get`, then `skills run`. |
| What should registry-read guidance emphasize? | The durable installed home path plus the next command or docs page. Do not point only at `CLAWPERATOR_SKILLS_REGISTRY`. |
| Should this pack expand `doctor` into a capability browser? | No. Keep capability discovery on the `skills` surface. |
| Should this pack change `install.sh` messaging directly? | No. Public docs and CLI help are the orientation surfaces here. Install-script behavior stays with the onboarding pack. |

## Failure Modes To Prevent

- The public docs still force a new reader to bounce between setup, skills, and
  MCP pages without a clear first stop.
- A new page duplicates `setup.md` verbatim instead of simplifying the current
  route.
- CLI help and public docs disagree about the first discovery commands.
- Registry-read failures still imply that setting an env var is the only
  remediation path.
- Generated docs are hand-edited instead of regenerated from source.
- The pack grows into install-artifact redesign or F6-style skill-runtime work.

## Output Contract

After this pack ships:

- There is one canonical public docs route for "use Clawperator from a host
  agent" orientation.
- `docs/setup.md`, `docs/skills/overview.md`, and `docs/api/mcp.md` all point
  at that route and no longer require a reader to infer the correct order.
- `clawperator` top-level help and `clawperator skills` help both point at the
  stable discovery flow that shipped after PR #196.
- Registry-read and related discovery guidance name the installed registry path
  and a concrete next step instead of only env-var remediation.
- `./scripts/docs_build.sh` succeeds with the authored and generated docs in
  sync.

## Idempotency

- Re-running the docs build regenerates the same public route and cross-links
  without manual cleanup.
- Re-running Node build and tests does not depend on transient local docs state.
- Help and error guidance remain stable across repeated runs; they do not
  accumulate duplicate docs references.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Canonical public host-agent entry path | `docs/` authored page chosen in PR-1 |
| Public docs nav placement | `sites/docs/mkdocs.yml` |
| Top-level and `skills` help orientation | `apps/node/src/cli/registry.ts` and generated `api/cli.md` |
| Registry-read remediation guidance | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Durable host-agent bridge rules if changed | `docs/internal/design/agent-host-integration.md` |
