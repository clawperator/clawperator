# Personalized Skills Guidance and Cross-Repo Follow-Through

## Executive Summary

Create a central coordination home for personalized skill work while implementation
creates a small ordered set of user-facing personal wrappers in the active
OpenClaw/AgentSkills surface. This task turns the current scattered
understanding into a reviewable audit trail, concrete wrapper deliverables,
OpenClaw discovery and live-call verification, cross-repo follow-up list, and
durable public documentation under `docs/skills/`.

This task ships in **1 PR across 5 phases**. Phase 1 audits current
personalized-skill behavior and creates `findings.md`. Phase 2 creates and
verifies the two no-argument wrappers. Phase 3 creates and verifies the basic
Netflix wrapper. Phase 4 creates and verifies the experimental unified HVAC
wrapper. Phase 5 adds the durable Clawperator docs page for agent-facing
guidance.

## Status
| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | access to the active OpenClaw/AgentSkills personal skill home and live OpenClaw gateway for runtime validation |

## Goal

Establish a clear, durable policy for personalized skills: when they are valid, how agents should represent user-specific preferences or environment assumptions, when those skills should remain local, and what must change before a personalized skill is promoted as shared or generic.

## Why Now

Recent skill authoring work has repeatedly found that useful skills often depend on one user's labels, rooms, account state, device graph, or workflow preferences. `docs/skills/authoring.md` already acknowledges that personalized local skills are a valid first result, but the guidance is embedded in recording authoring and does not give agents a reusable decision model.

The work also spans other repositories, so this repo needs a central coordination artifact that survives long enough to collect findings, route implementation, and graduate the durable guidance into public docs.

## In Scope

- audit current personalized-skill references and examples in this repo and relevant sibling/downstream repositories
- define the recommended agent policy for personalized skills that know user preferences, labels, account conventions, device graph, and local workflow choices
- distinguish personalized local skills from shared runtime skills and first-party bundled authoring skills
- create the ordered personalized wrapper set defined in this plan
- verify each created skill is discoverable by OpenClaw before moving to the next skill
- live-test each created skill through OpenClaw when the underlying workflow is safe to run
- capture cross-repo work items that need to happen outside this repository
- add a new authored docs page under `docs/skills/` for personalized skill usage guidance by agents
- update `docs/index.md` and `sites/docs/mkdocs.yml` so the new page is discoverable
- keep `docs/skills/authoring.md` aligned by linking to the new durable page instead of duplicating the full policy

## Out of Scope

- fixing bundled-skill symlink behavior or OpenClaw bundled-skill discovery
- redesigning the runtime skills registry format
- adding a product feature for encrypted preference storage unless Phase 1 finds existing code already supports it
- moving personal data into this repository
- publishing any user's private labels, rooms, account identifiers, device names, or credentials
- claiming a personalized skill is generic before the personal assumptions are replaced with explicit inputs or broader selector strategy

## Existing Artifact Scope

N/A - new task pack.

For existing docs:

- `docs/skills/authoring.md` may be edited only to remove duplicated personalized-skill policy, add a short pointer to the new page, and keep recording authoring guidance coherent.
- `docs/skills/overview.md`, `docs/skills/development.md`, and `docs/skills/runtime.md` are out of scope unless Phase 5 needs a short cross-reference.
- `docs/index.md` and `sites/docs/mkdocs.yml` are in scope only for navigation and discoverability.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `tasks/skills/personalized-skills/findings.md` | Execution-time audit trail, examples, decisions, wrapper validation, and cross-repo routing | Phase 1, updated in Phases 2, 3, and 4 |
| `tasks/skills/personalized-skills/finalization-items.md` | Deferred cross-repo work that cannot be completed in the current PR | Phases 2, 3, 4 only if needed |
| `docs/skills/personalized.md` | New durable public guidance for personalized skills | Phase 5 |
| `docs/skills/authoring.md` | Short pointer to the new page; preserve recording-specific guidance | Phase 5 |
| `docs/index.md` | Add personalized skills page to the Skills index | Phase 5 |
| `sites/docs/mkdocs.yml` | Add personalized skills page to docs navigation | Phase 5 |
| `../clawperator-skills/` | Candidate sibling repo for runtime-skill examples, tests, and README or AGENTS updates | Phase 1 audit, Phases 2-4 handoff or implementation |
| Other downstream or personal-skill repos | Candidate homes for implementation work discovered during audit | Phase 1 audit, Phases 2-4 handoff |
| `~/.agents/skills/` | Primary target home for personal AgentSkills wrappers visible to OpenClaw, Codex, Claude Code, and compatible hosts | Phases 2, 3, 4 |
| `~/.openclaw/workspace/skills/` | Workspace-only fallback if Phase 1 proves OpenClaw does not load the target wrapper from `~/.agents/skills/` | Phases 2, 3, 4 only when needed |

## Skill Category Taxonomy

This task uses four categories. Do not conflate them.

| Category | Install location | Discovery mechanism |
| --- | --- | --- |
| Runtime skills | `~/.clawperator/skills/` | `clawperator skills list/search/get/run` via `skills-registry.json` |
| Bundled authoring skills | `~/.clawperator/bundled-skills/` -> `~/.claude/skills/`, `~/.codex/skills/`, `~/.agents/skills/` | `clawperator bundled-skills install`; discovered by Claude Code, Codex, or compatible host from the target dir |
| OpenClaw workspace skills | `~/.openclaw/workspace/skills/` | OpenClaw main agent context loading from workspace |
| Personal AgentSkills wrappers | `~/.agents/skills/` (user-owned, not installer-managed) | Codex, Claude Code, and compatible hosts that load `~/.agents/skills/` |

Key rule from `docs/skills/overview.md` and `apps/node/src/domain/host/hostSetup.ts`: the installer does not mirror runtime skills into shared agent skill directories. Keep categories separate. Personal AgentSkills wrappers call the Clawperator CLI; they are not runtime skills.

## Personalized Skill Deliverables

Implement these user-facing personalized skills in this order. Do not expose
the underlying Clawperator runtime skill fan-out as separate user-facing HVAC
skills.

| Order | Skill | Target home | Shape | Underlying runtime skill or behavior | Required OpenClaw validation |
| --- | --- | --- | --- | --- | --- |
| 1 | `home-battery-get-level` | `~/.agents/skills/` unless Phase 1 proves OpenClaw requires `~/.openclaw/workspace/skills/` | no user argument; no private values in committed artifacts | call `clawperator skills run com.solaxcloud.starter.get-battery --output json` with local device selection handled by local config or the runtime default | `openclaw skills list --eligible --json` shows the skill, then an OpenClaw agent request for home battery returns the expected battery result or a truthful runtime blocker |
| 2 | `home-energy-get-yesterday-usage-cost` | same target as order 1 | no user argument; no private values in committed artifacts | call the best current GloBird yesterday-usage runtime path, preferring `com.globird.energy.get-yesterday-usage-cost-replay` when reliable and documenting fallback to `com.globird.energy.get-usage` when findings show the replay is not reliable | `openclaw skills list --eligible --json` shows the skill, then an OpenClaw agent request for yesterday's energy usage/cost returns the expected result or a truthful runtime blocker |
| 3 | `media-netflix-set-my-list-state` | same target as order 1 | basic wrapper with one required user content argument, the title; desired add/remove state comes from request wording; profile/defaults stay local-only | call `clawperator skills run com.netflix.mediaclient.set-my-list-state-replay --output json -- --action <add|remove> --title <title> --profile <local_profile>` | `openclaw skills list --eligible --json` shows the skill, then OpenClaw chooses it for an add/remove My List request and reports success only from verified `skillResult` status |
| 4 | `home-hvac-control` | same target as order 1 | experimental orchestrating wrapper; one user-facing skill for complete HVAC intent | parse a request such as "turn on the a/c, make sure it's on in the living room, use the medium fan level" and internally sequence the needed AirTouch runtime skills, likely power, zone, fan, and mode; do not expose `home-hvac-set-power-state`, `home-hvac-set-zone-state`, `home-hvac-set-mode`, or `home-hvac-set-fan-level` as user-facing skills in this task | `openclaw skills list --eligible --json` shows only the unified HVAC skill, then OpenClaw chooses it for realistic HVAC requests and reports partial or full failure truthfully from the underlying runtime results |

The first two skills are deliberately "dumb" wrappers. Use them to prove the
personal skill home, OpenClaw discovery, OpenClaw invocation, and result
truthfulness loop before implementing argument parsing or multi-step fan-out.

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current public skills docs | `docs/skills/overview.md`, `docs/skills/authoring.md`, `docs/skills/development.md`, `docs/skills/runtime.md` |
| Docs authoring workflow | `.agents/skills/docs-author/SKILL.md`, `docs/internal/documentation-drafting-north-star.md` |
| Docs build workflow | `.agents/skills/docs-build/SKILL.md`, `./scripts/docs_build.sh` |
| Runtime skill registry contract | `apps/node/src/contracts/skills.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Runtime skill execution contract | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/domain/skills/validateSkill.ts` |
| Current bundled-skill install model | `apps/node/src/domain/skills/skillsConfig.ts`, `apps/node/src/cli/commands/bundledSkills.ts` if present, or the current bundled-skills command file |
| Existing personalized-skill mentions | `rg -n "personalized|personalised|preference|user preferences|local labels|device graph|account state" docs .agents/skills tasks apps sites evals` |
| Sibling runtime-skill practice | `../clawperator-skills/README.md`, `../clawperator-skills/AGENTS.md`, `../clawperator-skills/skills/`, `../clawperator-skills/scripts/test_all.sh` when that repo is available |

## Deterministic Versus Judgment

Deterministic - do not re-derive:

- The task is about personalized skills, not bundled-skill symlink behavior.
- The durable public docs destination is `docs/skills/personalized.md`.
- `tasks/` is temporary coordination scaffolding. Any policy that should guide future agents must graduate to `docs/skills/personalized.md`.
- Do not include real private values in docs, task findings, tests, examples, or commits. Use sanitized placeholders such as `Kitchen`, `Bedroom Lamp`, `home-a`, or `user-preferred-mode`.
- A skill that hardcodes one user's labels, rooms, account state, device graph, or preference choices must be described as personalized or local. Do not present it as shared or generic.
- A shared skill must replace personal assumptions with explicit inputs, configuration, discovery, or a broader selector strategy before being documented as reusable.
- Authored public docs work must use `.agents/skills/docs-author/SKILL.md` and validate with `./scripts/docs_build.sh`.

Judgment required:

- Which sibling or downstream repositories contain actionable personalized-skill work.
- Whether a discovered item outside the four required wrapper deliverables should be implemented immediately, recorded as a handoff, or deferred to `finalization-items.md`.
- How to phrase agent guidance so it is useful without encouraging agents to store sensitive personal data casually.
- Whether existing docs should link to the new page or retain a short local summary for context.

## Decision Rules

| Question | Rule |
| --- | --- |
| Should this effort create a task pack? | Yes. The work is cross-repo, synthesis-heavy, and needs a durable handoff plus final documentation. |
| Where does durable guidance live? | `docs/skills/personalized.md`. Do not leave the final policy only in `tasks/`. |
| Where do execution findings live? | Create `tasks/skills/personalized-skills/findings.md` during Phase 1 using the structure in `work-breakdown.md`. |
| What if a finding belongs in another repo? | Record the repo, path, recommended change, evidence, and current status in `findings.md`. If it cannot be completed now, add `finalization-items.md`. |
| Which personalized skills must exist after this task? | The four skills in `Personalized Skill Deliverables`: `home-battery-get-level`, `home-energy-get-yesterday-usage-cost`, `media-netflix-set-my-list-state`, and `home-hvac-control`, unless Phase 1 records a blocker and the user accepts deferral. |
| What is a personalized skill? | A skill whose successful behavior depends on one user's labels, rooms, devices, account state, preferences, or local conventions. |
| When is personalization acceptable? | When the skill is explicitly local or user-scoped, the personal assumptions are named, and sensitive values are sanitized or stored outside public artifacts. |
| When can a personalized skill become shared? | Only after personal assumptions are converted into inputs, configuration, discovery, generalized selectors, or documented setup requirements. |
| How should examples mention private values? | Use placeholders and explain the category of value. Do not include real private values. |
| How should docs be authored? | Use `.agents/skills/docs-author/SKILL.md`; update nav and index in the same phase as the new page. |

## Failure Modes To Prevent

- spending this task on bundled-skill symlink mechanics instead of personalized-skill policy
- leaving useful recommendations trapped in `tasks/` after cleanup
- documenting personalized skills as second-class or invalid when they are often the truthful first result
- calling a hardcoded local workflow generic
- leaking real user labels, room names, device names, account identifiers, or credentials
- turning personalized skills into an unbounded memory feature without code support
- duplicating the full policy across multiple docs pages instead of linking to the new canonical page
- creating cross-repo TODOs without enough evidence or path detail for another agent to execute them

## Output Contract

After Phase 1:

- `tasks/skills/personalized-skills/findings.md` exists
- findings include current repo evidence, available sibling-repo evidence, proposed policy, privacy boundaries, and cross-repo work candidates

After Phase 2:

- `home-battery-get-level` exists in the chosen personal skill home
- `home-energy-get-yesterday-usage-cost` exists in the chosen personal skill home
- both skills are visible in `openclaw skills list --eligible --json`
- both skills have been forward-tested through `openclaw agent --message ... --json` when safe, with results or blockers recorded in `findings.md`

After Phase 3:

- `media-netflix-set-my-list-state` exists in the chosen personal skill home
- the skill is visible in `openclaw skills list --eligible --json`
- the skill has been forward-tested through OpenClaw with at least one add/remove request when safe, with results or blockers recorded in `findings.md`

After Phase 4:

- `home-hvac-control` exists in the chosen personal skill home
- no separate user-facing HVAC power, zone, mode, or fan wrappers are introduced by this task
- the skill is visible in `openclaw skills list --eligible --json`
- the skill has been forward-tested through OpenClaw with at least one realistic multi-part HVAC request when safe, with results or blockers recorded in `findings.md`

After Phase 5:

- `docs/skills/personalized.md` exists and is linked from `docs/index.md` and `sites/docs/mkdocs.yml`
- `docs/skills/authoring.md` points to the new page for the full personalized-skill policy
- `./scripts/docs_build.sh` passes

## Idempotency

- Re-running the audit may add dated findings, but it must not duplicate existing findings sections.
- Re-running wrapper creation must update the existing personal skill directory in place, not create duplicate names in multiple homes.
- Re-running docs edits must preserve a single nav entry and a single index entry for `docs/skills/personalized.md`.
- Re-running Phases 2-4 must update item statuses rather than adding duplicate cross-repo work rows.

## Durable Follow-Up

- Permanent agent-facing guidance belongs in `docs/skills/personalized.md`.
- Any runtime or authoring contract changes discovered during execution belong in the owning code or repo-local docs for that surface.
- Any unresolved cross-repo work that remains after this PR belongs in `tasks/skills/personalized-skills/finalization-items.md` until it is moved to the owning repository.
