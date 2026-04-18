# Agent-Assisted Skill Drafting Work Breakdown

Parent plan: `tasks/skills/agent-assisted-skill-drafting/plan.md`

## Executive Summary

1 PR, 4 phases, all in `clawperator`. The pack stays blocked until
`tasks/skills/skill-creation-guidance/` PR-2 lands, because Pack A assumes the
skills authoring surface, scaffold helper, and validator baseline are already
repaired. Once unblocked, the execution order is:

- Phase 1: create the new discovery-first authoring skill and lock the
  discovery artifact contract
- Phase 2: wire install and packaged-skill discovery surfaces
- Phase 3: update host and authoring docs for the zero-results route
- Phase 4: prove the workflow end to end and capture findings

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

## Hard Rules

- Do not start this pack until `tasks/skills/skill-creation-guidance/` PR-2 is
  merged or finalized locally.
- Use the hybrid model exactly as written in the plan: discovery routes,
  recording proves.
- Name the new packaged skill `skill-author-by-agent-discovery`. Do not rename
  it during execution.
- The discovery skill must require every field listed in the plan's discovery
  artifact contract. Missing required fields block handoff.
- The discovery skill must not author a durable runtime skill directly.
- Do not add new Node runtime contracts or new general-purpose CLI probes in
  this pack.
- Use the branch-local Node build for any CLI validation. Do not rely on a
  globally installed `clawperator` binary.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase instead of
  re-deriving the docs workflow.
- Create `tasks/skills/agent-assisted-skill-drafting/findings.md` during
  Phase 4 and append to it as validation progresses.
- One commit per phase. Do not batch the new skill, install wiring, docs, and
  proof into one opaque commit.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| # | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/skills/agent-assisted-skill-drafting/plan.md` | Stable contract, dependency, and route decisions |
| 2 | `tasks/skills/authorship/findings-compiled.md` | Problem statement, route taxonomy, and required discovery fields |
| 3 | `tasks/skills/skill-creation-guidance/plan.md` | Dependency pack that must land first |
| 4 | `.agents/skills/skill-author-by-recording/SKILL.md` | Existing proving workflow and wording conventions |
| 5 | `docs/skills/authoring.md` | Current public authoring front door |
| 6 | `docs/host-agents.md` | Current host-agent discovery route |
| 7 | `docs/internal/design/agent-host-integration.md` | Durable host-agent assumptions |
| 8 | `apps/node/src/domain/skills/copyAuthoringSkills.ts` | Packaged authoring-skill install and discovery wiring |
| 9 | `apps/node/src/cli/commands/authoringSkills.ts` | Install, update, and list CLI behavior |
| 10 | `apps/node/src/test/unit/authoringSkills.test.ts` | Packaging and install regression coverage |
| 11 | `apps/node/src/test/unit/authoringSkillsPack.test.ts` | Packaged authoring-skills tree expectations |
| 12 | `sites/landing/public/install.sh` | Install-time authoring-skill discovery guide |
| 13 | `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 3 |

## PR / Phase Plan

| PR | Repo | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `clawperator` | Add the discovery-first authoring skill, wire install/discovery surfaces, update docs, and prove the route | 1, 2, 3, 4 | thinking, default, thinking, thinking | `tasks/skills/skill-creation-guidance/` PR-2 merged or finalized locally |

## Findings File Requirement

Create `tasks/skills/agent-assisted-skill-drafting/findings.md` during Phase 4
with these sections:

- Goal
- Dependency state
- Anchor scenario
- Discovery artifact produced
- Commands run
- Installed authoring-skill checks
- Observations
- Problems encountered
- Fixes attempted
- Final route result
- Deferred follow-up

This file is execution-time evidence. Do not pre-author it before validation.

## Phase 1: Discovery Skill Contract And Boundary

### Agent Tier

thinking

### Goal

Create `skill-author-by-agent-discovery` as the new packaged discovery-first
authoring skill and lock the boundary between discovery and proving so weaker
agents do not improvise a second authoring workflow.

### Files or Surfaces To Change

- `.agents/skills/skill-author-by-agent-discovery/SKILL.md`
- `.agents/skills/skill-author-by-agent-discovery/agents/openai.yaml`
- `.agents/skills/skill-author-by-recording/SKILL.md`

### Steps

1. Create the new skill directory under `.agents/skills/` and author
   `SKILL.md`.
2. In the new skill, define the discovery workflow in a way that explicitly:
   - checks for an existing installed runtime skill first
   - produces the required discovery artifact
   - routes to exactly one next step
   - forbids direct durable skill authoring inside discovery
3. Add `agents/openai.yaml` metadata for the new skill so agent discovery
   surfaces stay aligned with the actual workflow.
4. Update `skill-author-by-recording` only enough to say:
   - discovery now exists as a sibling front door
   - recording remains the proving step after a discovery result of
     `proceed_to_recording`
5. Make the anchor scenario explicit in at least one example inside the new
   skill prompt.

### Acceptance Criteria

- `.agents/skills/skill-author-by-agent-discovery/` exists with both
  `SKILL.md` and `agents/openai.yaml`
- the new skill requires every discovery artifact field from the plan
- `skill-author-by-recording` describes itself as the proving workflow after
  discovery, not the zero-results router
- the new skill prompt explicitly supports the anchor scenario

### Validation

```bash
test -f .agents/skills/skill-author-by-agent-discovery/SKILL.md
test -f .agents/skills/skill-author-by-agent-discovery/agents/openai.yaml
rg -n "recommended_next_step|existing_skill_verdict|route_confidence|mutation_risk|handoff_target" .agents/skills/skill-author-by-agent-discovery/SKILL.md
rg -n "discovery|proving|skill-author-by-agent-discovery" .agents/skills/skill-author-by-recording/SKILL.md
```

### Expected Commit

```text
feat(authoring): add discovery-first skill drafting front door
```

## Phase 2: Install Wiring And Packaged Discovery

### Agent Tier

default

### Goal

Make the new discovery skill behave like a real packaged first-party authoring
skill: installed, listed, and rediscovered through the existing authoring-skill
machinery.

### Files or Surfaces To Change

- `apps/node/authoring-skills/skill-author-by-agent-discovery`
- `apps/node/src/domain/skills/copyAuthoringSkills.ts` if additive handling is required
- `apps/node/src/test/unit/authoringSkills.test.ts`
- `apps/node/src/test/unit/authoringSkillsPack.test.ts`
- `sites/landing/public/install.sh`

### Steps

1. Add the packaged authoring-skill symlink entry under
   `apps/node/authoring-skills/`.
2. Inspect the existing packaging logic and update it only if the new skill
   reveals a hard-coded single-skill assumption.
3. Update the authoring-skills unit tests so they expect both packaged skills
   and continue to verify install, update, and discovery symlink behavior.
4. Update the install-time authoring guide in `install.sh` so a newly installed
   host agent can discover both front doors and understands when to use each.
5. Verify that the new packaged skill is discoverable via the branch-local CLI.

### Acceptance Criteria

- `apps/node/authoring-skills/skill-author-by-agent-discovery` points at the
  new repo-local skill directory
- authoring-skills tests pass with both packaged skills present
- install-time guidance mentions both discovery and recording authoring skills
- the branch-local CLI lists both installed authoring skills after install

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js authoring-skills install --format json
node apps/node/dist/cli/index.js authoring-skills list --format json
```

### Expected Commit

```text
feat(authoring): wire packaged discovery skill install flow
```

## Phase 3: Host-Agent Route And Discovery-To-Proving Docs

### Agent Tier

thinking

### Goal

Document the zero-results host-agent route and the new discovery-to-proving
higher-level workflow so agents and humans stop treating "no skill found" as an
implicit instruction to improvise.

### Files or Surfaces To Change

- `docs/host-agents.md`
- `docs/skills/authoring.md`
- `docs/internal/design/agent-host-integration.md` only if a matching durable
  internal rule is needed

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the docs workflow.
2. In `docs/host-agents.md`, add the explicit zero-results route:
   - check existing runtime skills
   - run `skill-author-by-agent-discovery` when no skill exists
   - follow the discovery route result instead of guessing
3. In `docs/skills/authoring.md`, document the hybrid model:
   - discovery-first for unfamiliar routes
   - recording-first for proving reusable skills after discovery
4. If needed, add one small durable note in
   `docs/internal/design/agent-host-integration.md` so the public docs and
   internal design assumptions stay aligned.
5. Keep the docs scoped to the workflow. Do not broaden into general task
   planning or Pack B guidance.

### Acceptance Criteria

- `docs/host-agents.md` explicitly describes the zero-results route
- `docs/skills/authoring.md` explains the discovery-to-proving handoff
- any internal-design note is additive and consistent with the public docs
- docs build succeeds

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(authoring): document discovery-to-proving workflow
```

## Phase 4: Anchor-Scenario Proof And Findings

### Agent Tier

thinking

### Goal

Prove that the new front door works on the anchor scenario, is discoverable
after install, and hands off cleanly into the existing recording workflow
without inventing a second proving path.

### Files or Surfaces To Change

- `tasks/skills/agent-assisted-skill-drafting/findings.md`

### Steps

1. Create `findings.md` with the required sections before the first validation
   command and append after each meaningful step.
2. Rebuild the branch-local Node CLI and reinstall authoring skills using the
   branch-local build.
3. Verify that the installed authoring-skills list includes:
   - `skill-author-by-agent-discovery`
   - `skill-author-by-recording`
4. Run the new discovery skill against the anchor scenario in a Codex or local
   host-agent execution context and capture the produced discovery artifact in
   `findings.md`.
5. Verify that the produced artifact contains every required field and that its
   selected route is explicit and singular.
6. If the result is `proceed_to_recording`, verify that the handoff target is
   the existing recording skill rather than a newly improvised path.
7. Record any gaps that remain after the proof as follow-up items in
   `findings.md`. Do not silently widen the pack.

### Acceptance Criteria

- `findings.md` exists and records the install checks, anchor-scenario run, and
  final route result
- both authoring skills are discoverable through the installed branch-local CLI
- the anchor-scenario discovery artifact contains every required field
- the recorded route is explicit, singular, and consistent with the plan

### Validation

```bash
npm --prefix apps/node run build
node apps/node/dist/cli/index.js authoring-skills install --format json
node apps/node/dist/cli/index.js authoring-skills list --format json
./scripts/docs_build.sh
```

### Expected Commit

```text
test(authoring): prove discovery-first skill drafting workflow
```
