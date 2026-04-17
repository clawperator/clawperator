# Agent Host Orientation and CLI Discoverability

## Executive Summary

This pack originally tracked the follow-up work after PR #196 for public
host-agent orientation, CLI self-orientation, and registry remediation.

That core work is now shipped on branches that already contain:

- `docs/host-agents.md` as the canonical public post-install route
- `docs/setup.md` still scoped to install and readiness
- `docs/quickstart.md` still scoped to direct automation and the observe / decide / act loop
- docs-home and public cross-links pointing at that route
- top-level CLI and `skills` help that reference the same route and discovery
  flow
- registry remediation text that names the installed home path

Do not reopen those decisions from this pack.

The remaining value of this task pack is narrower: keep the handoff current and
clean up any residual public docs contradictions that still present
env-var-first skills guidance instead of the shipped installed-home discovery
flow.

## Status

| Item | Value |
| --- | --- |
| State | partially shipped |
| Total shipped phases | 4 |
| Remaining phases | 1 |
| Completed | 1, 2, 3, 4 |
| Remaining | 5 |
| Current / Next | Phase 5 |
| Blockers | none; use the current repo state, not the pre-ship baseline |

## Goal

Keep the pack aligned with the current repo so a zero-context agent or human
can answer three questions without task archaeology:

1. what the first public Clawperator page to read is after install
2. when to start with `clawperator skills` versus MCP
3. which docs and remediation text still need cleanup if discovery guidance
   drifts back toward env-var-first instructions

## Current Shipped Baseline

Treat these as already-shipped baseline behavior and documentation:

- `docs/host-agents.md` is the canonical public post-install route
- this is no longer an open design decision in this pack
- `docs/setup.md` remains the install and readiness page
- `docs/quickstart.md` remains the direct automation and observe / decide / act page
- `docs/index.md` links to `docs/host-agents.md`
- `clawperator` top-level help points at the public host-agent route
- `clawperator skills` help emphasizes the shortest discovery flow:
  `skills for-app`, `skills search`, `skills get`, then `skills run`
- `clawperator mcp serve` remains the MCP transport surface and its help points
  back to the same public orientation route
- runtime-skill registry resolution falls back to the installed home path under
  `~/.clawperator/skills/skills/skills-registry.json`
- registry-read remediation text treats that installed-home path as the normal
  post-install recovery path and names a concrete next command
- this changes guidance only, not `loadRegistry()` precedence or fallback behavior
- explicit `CLAWPERATOR_SKILLS_REGISTRY` still wins when set, including
  fail-fast behavior when it is blank or points at a missing configured path

## Remaining Gap

The main remaining contradiction is in public docs pages outside the original
Phase 1-4 scope that still present env-var-first skills guidance:

- `docs/api/environment.md`
- `docs/skills/runtime.md`

If this pack is reopened for implementation work, treat those contradictions as
the remaining target instead of recreating the already-shipped canonical route
or CLI help wording.

## In Scope

- Keep this task pack accurate about what has already shipped
- Elevate `docs/host-agents.md` into the required-reading and source-of-truth
  lists
- Clean up residual public docs contradictions in:
  - `docs/api/environment.md`
  - `docs/skills/runtime.md`
- Regenerate docs outputs if any authored docs change

## Out of Scope

- Re-choosing the canonical public route
- Adding a second competing "start here" page
- Repeating the top-level CLI and `skills` help alignment that is already
  shipped
- Any install artifact or `install.sh` behavior change
- Any new CLI subcommand or runtime capability change
- MCP transport or tool-surface changes
- Android runtime, Operator APK, or device-behavior work

## Existing Artifact Scope

- `docs/host-agents.md`: already-shipped canonical route; treat it as baseline
  and source of truth
- `docs/setup.md`, `docs/skills/overview.md`, `docs/api/mcp.md`,
  `docs/index.md`, and `docs/quickstart.md`: already aligned around the
  canonical route; only touch again if a contradiction is found
- `docs/api/environment.md` and `docs/skills/runtime.md`: in scope for the
  remaining residual-guidance cleanup
- `apps/node/src/cli/registry.ts`: already aligned for this pack; do not reopen
  it unless a new contradiction is found in current code
- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`: already aligned
  for this pack; do not reopen it unless current behavior changes
- `sites/docs/.build/` and `sites/docs/site/`: generated outputs only; never
  hand-edit them

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `docs/host-agents.md` | Canonical public route; shipped baseline | shipped |
| `docs/index.md`, `docs/setup.md`, `docs/skills/overview.md`, `docs/api/mcp.md`, `docs/quickstart.md` | Cross-links around the canonical route; shipped baseline | shipped |
| `apps/node/src/cli/registry.ts` | Top-level and `skills` help orientation; shipped baseline | shipped |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Registry-read remediation and next-step guidance; shipped baseline | shipped |
| `docs/api/environment.md` | Residual env-var-first guidance cleanup | Phase 5 |
| `docs/skills/runtime.md` | Residual env-var-first guidance cleanup | Phase 5 |
| `sites/docs/mkdocs.yml` | Nav ownership for the canonical route; already shipped | shipped |
| `docs/internal/design/agent-host-integration.md` | Durable internal rule notes if the preferred flow changes materially again | as needed |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Canonical public host-agent route | `docs/host-agents.md`, `docs/index.md`, `sites/docs/mkdocs.yml` |
| Public install and artifact behavior | `docs/setup.md`, `sites/landing/public/install.sh` |
| Runtime-skills discovery semantics | `docs/skills/overview.md`, `apps/node/src/cli/registry.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| MCP front-door guidance | `docs/api/mcp.md`, `apps/node/src/cli/registry.ts` |
| Residual env-var guidance still needing cleanup | `docs/api/environment.md`, `docs/skills/runtime.md` |
| Generated CLI reference ownership | `sites/docs/source-map.yaml` |
| Durable host-agent design rules | `docs/internal/design/agent-host-integration.md` |
| Historical scope split for this pack | This `plan.md`. Do not read retired onboarding task files; this pack is self-contained. |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- `docs/host-agents.md` is already the canonical public route for post-install
  host-agent orientation
- `clawperator skills for-app <package_id>` remains the primary app-oriented
  discovery surface
- `clawperator mcp serve` remains the MCP transport surface
- top-level CLI help already points at the public host-agent route
- `api/cli.md` is code-derived from `apps/node/src/cli/registry.ts` through
  `sites/docs/source-map.yaml`; never hand-edit it
- public docs guidance must point at authored docs routes, not task files,
  local paths, or GitHub source URLs unless a page is intentionally
  internal-only

**Judgment required:**

- whether the remaining contradiction cleanup belongs in this pack or should be
  moved into a new narrower docs pack
- whether `docs/api/environment.md` and `docs/skills/runtime.md` should be
  narrowed to the installed-home path, cross-link harder to
  `docs/host-agents.md`, or both
- whether any already-aligned surface has regressed enough to justify reopening
  it

## Decision Rules

| Question | Rule |
| --- | --- |
| Should this pack create a new public page? | No. The canonical public page already exists at `docs/host-agents.md`. |
| What should CLI help point at? | Keep pointing at the canonical public route in `docs/host-agents.md`. |
| What should `skills` help emphasize? | Keep the shortest post-install discovery flow: `skills for-app`, `skills search`, `skills get`, then `skills run`. |
| What should registry-read guidance emphasize? | The durable installed home path plus the next command or docs page. Do not regress to env-var-only remediation. |
| Should this pack expand `doctor` into a capability browser? | No. Keep capability discovery on the `skills` surface. |
| Should this pack change `install.sh` messaging directly? | No. Public docs and existing CLI help remain the orientation surfaces here. |

## Failure Modes To Prevent

- a future agent recreates the canonical route or invents a second competing
  "start here" page because this pack still says the work is not started
- required reading omits `docs/host-agents.md`, causing a reader to miss the
  shipped front door
- residual env-var-first docs remain in place even though the pack promises
  registry and discovery guidance alignment
- generated docs are hand-edited instead of regenerated from source
- the pack grows back into install-artifact redesign or new CLI capability work

## Output Contract

When this pack is current:

- it clearly states that the canonical public route already ships at
  `docs/host-agents.md`
- the required-reading and source-of-truth tables include that route
- it does not instruct another agent to redo already-shipped CLI/help
  alignment
- if reopened for implementation, it scopes the remaining work to residual
  docs contradictions such as `docs/api/environment.md` and
  `docs/skills/runtime.md`

## Idempotency

- rereading this pack should steer future agents toward the shipped baseline,
  not toward recreating it
- re-running docs build after any residual docs cleanup should keep the same
  canonical route and nav
- help and error guidance should remain stable across repeated runs; they
  should not accumulate duplicate docs references

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Canonical public host-agent entry path | `docs/host-agents.md` |
| Public docs nav placement | `sites/docs/mkdocs.yml` |
| Top-level and `skills` help orientation | `apps/node/src/cli/registry.ts` and generated `api/cli.md` |
| Registry-read remediation guidance | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Residual env-var-first cleanup targets | `docs/api/environment.md`, `docs/skills/runtime.md` |
| Durable host-agent bridge rules if changed | `docs/internal/design/agent-host-integration.md` |
