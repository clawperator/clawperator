# Agent-Assisted Skill Drafting

## Executive Summary

This pack turns the compiled authorship findings into one concrete workflow:
keep recording as the proving workflow, but add a discovery-first front door
for cases where the agent does not yet know the app route well enough to
record truthfully. This is a 1 PR, 4 phase pack in `clawperator`, but it is
blocked until the prerequisite guardrails in
`tasks/skills/skill-creation-guidance/` PR-2 are merged or landed locally.

The stable design choice in this pack is the hybrid model. We are not extending
`skill-author-by-recording` into a giant all-in-one skill. We are adding a
packaged sibling authoring skill named
`skill-author-by-agent-discovery`, and that new skill routes into the existing
recording workflow when a reusable runtime skill should actually be authored.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | `tasks/skills/skill-creation-guidance/` PR-2 must merge or be finalized locally first |

## Goal

After this pack ships, a host-facing agent that receives a request like "make a
Clawperator skill that opens Netflix, searches for House of Cards, and adds it
to My List" has one truthful first step when no installed runtime skill exists:
run a bounded discovery workflow that produces a structured routing artifact,
then either hand off to `skill-author-by-recording`, continue as one-shot raw
automation, escalate to a human, or decline with a reason.

## Why Now

`skill-author-by-recording` is already a strong proving workflow, but it starts
too late for unfamiliar app routes. The current system answers "what skill can
I run?" well and answers "what should I do when nothing exists yet?" poorly.
That gap is currently filled by improvisation, which biases agents toward
over-authoring and weak first drafts.

## In Scope

- Add a packaged sibling authoring skill named
  `skill-author-by-agent-discovery`
- Define the discovery artifact contract that the new skill must produce before
  any reusable runtime skill is authored
- Lock the routing table for the zero-results case:
  - reuse existing skill
  - proceed to recording
  - fulfill as one-shot direct automation
  - escalate to human
  - decline
- Clarify the boundary between the new discovery skill and
  `skill-author-by-recording`
- Wire the new packaged skill through install and agent discovery surfaces
- Document the host-agent zero-results route and the discovery-to-proving
  handoff
- Prove the workflow against the anchor scenario and record the evidence in an
  execution-time `findings.md`

## Out of Scope

- Authoring the Netflix skill itself
- Adding new runtime verification kinds, new `SkillResult` contract fields, or
  other runtime-contract work
- Adding new general-purpose Node CLI probe commands
- Rewriting `skill-author-by-recording` into a discovery-plus-proving mega-skill
- Rewriting `../clawperator-skills/AGENTS.md` or the broader skills-repo
  quality bar work tracked in `tasks/skills/skill-creation-guidance/`

## Existing Artifact Scope

- `.agents/skills/skill-author-by-recording/`: in scope only for additive
  boundary and handoff clarification; preserve its recording-first proving
  workflow and self-test expectations
- `apps/node/src/domain/skills/copyAuthoringSkills.ts`: in scope only for
  additive packaging and wiring behavior; do not redesign authoring-skills
  install semantics
- `sites/landing/public/install.sh`: in scope only for the authoring-skill
  discovery guide block and related install-time guidance
- `docs/host-agents.md`: in scope for the explicit zero-results route
- `docs/skills/authoring.md`: in scope for the discovery-to-proving handoff and
  packaged authoring-skill explanation
- `tasks/skills/authorship/findings-compiled.md`: preserved as the problem
  statement; do not rewrite it during implementation

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `.agents/skills/skill-author-by-agent-discovery/` | New discovery-first authoring skill, prompt contract, and `agents/openai.yaml` metadata | Phase 1 |
| `apps/node/authoring-skills/skill-author-by-agent-discovery` | New packaged-skill symlink entry | Phase 2 |
| `.agents/skills/skill-author-by-recording/SKILL.md` | Additive handoff and boundary clarification only | Phase 1 |
| `apps/node/src/domain/skills/copyAuthoringSkills.ts` | Install and discovery wiring only if the new packaged skill needs additive support | Phase 2 |
| `apps/node/src/test/unit/authoringSkills.test.ts` | Packaging and install regression coverage | Phase 2 |
| `apps/node/src/test/unit/authoringSkillsPack.test.ts` | Packaged authoring-skills tree coverage | Phase 2 |
| `docs/host-agents.md` | Host-agent zero-results route | Phase 3 |
| `docs/skills/authoring.md` | Discovery-to-proving handoff and authoring-skill front-door guidance | Phase 3 |
| `docs/internal/design/agent-host-integration.md` | Additive durable routing note only if the public docs need a matching internal rule | Phase 3 |
| `sites/landing/public/install.sh` | Install-time authoring-skill discovery hints | Phase 2 |
| `tasks/skills/agent-assisted-skill-drafting/findings.md` | Execution-time proof of the new workflow | Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Problem statement and stable recommendations | `tasks/skills/authorship/findings-compiled.md` |
| Current proving workflow | `.agents/skills/skill-author-by-recording/SKILL.md`, `docs/skills/authoring.md` |
| Host-agent discovery route | `docs/host-agents.md`, `docs/internal/design/agent-host-integration.md` |
| Packaged authoring-skill installation | `apps/node/src/domain/skills/copyAuthoringSkills.ts`, `sites/landing/public/install.sh` |
| Authoring-skills CLI and test coverage | `apps/node/src/cli/commands/authoringSkills.ts`, `apps/node/src/test/unit/authoringSkills.test.ts`, `apps/node/src/test/unit/authoringSkillsPack.test.ts` |
| Runtime skill discovery precedence | `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Dependency pack that must land first | `tasks/skills/skill-creation-guidance/plan.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Implement the hybrid model. The new front door is a sibling skill named
  `skill-author-by-agent-discovery`. Do not rename it in this pack.
- The discovery skill does not author a durable runtime skill directly. Its job
  is to produce a structured routing artifact and decide the next step.
- `skill-author-by-recording` remains the proving workflow for reusable skill
  authoring after discovery says `proceed_to_recording`.
- The discovery artifact must contain every required field listed in
  `Decision Rules`. Missing required fields block handoff.
- Do not add new runtime CLI probe commands in this pack. Use existing
  Clawperator surfaces and authoring-skill guidance.
- Keep Pack A blocked until `tasks/skills/skill-creation-guidance/` PR-2 is
  merged or landed locally.

**Judgment required:**

- The exact wording and examples inside the new skill prompt
- Whether `docs/internal/design/agent-host-integration.md` needs a small
  matching durable note in addition to the public docs
- The concrete discovery budget numbers, as long as the result is bounded and
  justified in `findings.md`

## Decision Rules

### Stable workflow decision

| Question | Rule |
| --- | --- |
| What front door should handle the zero-results case? | `skill-author-by-agent-discovery` |
| What workflow proves a reusable new skill after discovery? | `skill-author-by-recording` |
| Should discovery create a durable runtime skill directly? | No. Discovery only routes and hands off. |
| Should this pack add new runtime contracts or verification kinds? | No. Record any need as follow-up. |

### Discovery artifact contract

The discovery phase must produce one artifact with all of the following fields.

| Field | Allowed values | Required when | Purpose |
| --- | --- | --- | --- |
| `recommended_next_step` | `use_existing_skill`, `proceed_to_recording`, `iterate_discovery`, `one_shot_direct_automation`, `escalate_to_human`, `decline` | always | Primary route decision |
| `existing_skill_verdict` | `match`, `partial_match`, `none`, plus queried registry paths | always | Explains whether a new skill is actually needed |
| `target_app_package` | app label, package id, and any sub-route observed | always | Anchors the route to the right app surface |
| `route_confidence` | `high`, `medium`, `low`, plus supporting evidence | always | Decides whether discovery is sufficient |
| `mutation_risk` | `read_only`, `reversible_mutation`, `irreversible_mutation` | always | Guards side effects during proof |
| `evidence_collected` | artifact inventory and failed probes | always | Prevents handoff without evidence |
| `discovery_budget_used` | snapshot count, screenshot count, elapsed time | always | Enforces bounded discovery |
| `skill_classification` | `shared-general` or `personalized-local` | when `recommended_next_step = proceed_to_recording` | Chooses publication target |
| `handoff_target` | `skill-author-by-recording`, `raw-clawperator`, `human`, `none` | always | Makes the next actor explicit |
| `handoff_reasoning` | short justification | always | Keeps the route inspectable |

### Route table

| Situation | Required route |
| --- | --- |
| Installed runtime skill is a clear match | `use_existing_skill` |
| No skill exists, route is understood, and reusable authoring is justified | `proceed_to_recording` |
| No skill exists, route is still uncertain, and discovery budget remains | `iterate_discovery` |
| One-shot fulfillment is better than a reusable skill | `one_shot_direct_automation` |
| Mutation risk is too high or user intent is underspecified | `escalate_to_human` |
| Request cannot be served truthfully | `decline` |

## Failure Modes To Prevent

- The new skill becomes a second proving workflow instead of a discovery route
- The discovery artifact omits key routing or safety fields and still hands off
- Host-facing guidance still leaves "no installed skill found" as a dead end
- Authoring-skill install succeeds but the new skill is not discoverable in all
  three agent directories
- Pack A silently reopens runtime-contract questions that belong in a follow-up
  pack
- Docs and skill prompts disagree about whether discovery, recording, or
  one-shot automation is the correct next step

## Output Contract

After this pack ships:

- a new packaged authoring skill named `skill-author-by-agent-discovery`
  exists and is wired into the normal authoring-skills install flow
- the new skill requires a discovery artifact that matches the contract above
- `skill-author-by-recording` explicitly describes itself as the proving step
  after discovery, not the zero-results router
- `docs/host-agents.md` and `docs/skills/authoring.md` document the zero-results
  route and the discovery-to-proving handoff
- `tasks/skills/agent-assisted-skill-drafting/findings.md` proves the workflow
  on the anchor scenario and records any follow-up gaps discovered during the
  run

## Idempotency

- Re-running authoring-skills install keeps the same packaged skill set and
  restores the same discovery symlinks
- Re-running the discovery workflow on the same request and device state should
  produce the same routing choice unless the observed app state changed
- Re-running docs generation should preserve the same public guidance

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Discovery-to-proving front-door guidance | `docs/skills/authoring.md`, `docs/host-agents.md` |
| Install-distributed authoring-skill discovery surface | `.agents/skills/skill-author-by-agent-discovery/`, `apps/node/authoring-skills/`, `sites/landing/public/install.sh` |
| Stable authoring-skill install behavior | `apps/node/src/domain/skills/copyAuthoringSkills.ts` and related tests |
| Any follow-on runtime-contract need discovered during implementation | `tasks/skills/agent-assisted-skill-drafting/findings.md`, then a new pack if still needed |
