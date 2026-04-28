# Personalized Skills Guidance and Cross-Repo Follow-Through Work Breakdown

Parent plan: `tasks/skills/personalized-skills/plan.md`

## Executive Summary

1 PR, 3 phases. Phase 1 uses `thinking` for audit and synthesis. Phase 2 uses `default` for cross-repo implementation routing and handoffs. Phase 3 uses `thinking` for public docs authoring and refinement.

Current state is planning complete, execution not started.

## Status
| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none for Phase 1; Phase 2 may depend on sibling/downstream repo access |

## Hard Rules

- Do not work on bundled-skill symlink behavior in this task.
- Create `findings.md` at the start of Phase 1 using the required structure below. Do not invent the format during execution.
- Do not include real private labels, room names, device names, account identifiers, credentials, phone numbers, addresses, or personal routines in committed artifacts.
- Use sanitized placeholders for examples and state what kind of private value they represent.
- Do not claim a personalized local skill is generic or shared unless personal assumptions have been replaced with explicit inputs, configuration, discovery, or generalized selectors.
- Do not leave durable policy only in `tasks/`. Phase 3 must create `docs/skills/personalized.md`.
- Use `.agents/skills/docs-author/SKILL.md` for Phase 3. Do not hand-edit generated docs under `sites/docs/.build/` or `sites/docs/site/`.
- If Phase 2 discovers work that cannot be completed in this PR, create or update `finalization-items.md` with enough detail for a later agent to act without reconstructing context.
- If a plan deviation changes scope or durable policy, update `plan.md` before committing that phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/skills/personalized-skills/plan.md` | Stable contract, scope boundaries, and deterministic rules |
| `docs/skills/authoring.md` | Current personalized local skill guidance embedded in recording authoring |
| `docs/skills/overview.md` | Current runtime versus bundled authoring skill taxonomy |
| `docs/skills/development.md` | Current local skill development loop and validation shape |
| `docs/skills/runtime.md` | Current runtime execution and output rules |
| `.agents/skills/docs-author/SKILL.md` | Required workflow for the public docs phase |
| `docs/internal/documentation-drafting-north-star.md` | Governing documentation philosophy and review bar |
| `apps/node/src/contracts/skills.ts` | Runtime skill registry contract that docs must not contradict |
| `apps/node/src/domain/skills/runSkill.ts` | Runtime execution contract that docs must not contradict |
| `apps/node/src/domain/skills/validateSkill.ts` | Current validation behavior and limits |
| `../clawperator-skills/README.md` if available | Sibling runtime-skills repo entrypoint and local conventions |
| `../clawperator-skills/AGENTS.md` if available | Sibling runtime-skills repo checklist and recurring review failures |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Audit, route cross-repo work, and publish personalized-skill guidance | 1, 2, 3 | thinking, default, thinking | none |

## Findings Structure

Create `tasks/skills/personalized-skills/findings.md` in Phase 1 with this exact top-level structure:

```md
# Personalized Skills Findings

## Audit Commands
<Commands run and short results.>

## Current Repo Evidence
| Path | Signal | Implication |
| --- | --- | --- |

## Sibling Or Downstream Repo Evidence
| Repo | Path | Signal | Implication |
| --- | --- | --- | --- |

## Recommended Policy
<Concise policy bullets for personalized local skills, shared skills, privacy, and promotion criteria.>

## Privacy And Safety Boundaries
<What must not be committed, logged, or documented; placeholder policy.>

## Cross-Repo Work Items
| ID | Repo | Path or surface | Required action | Status |
| --- | --- | --- | --- | --- |

## Docs Draft Notes
<Specific points that must graduate to docs/skills/personalized.md.>

## Open Questions
<Only questions that block implementation or documentation accuracy.>
```

## Phase 1: Audit And Policy Findings

### Agent Tier

thinking

### Goal

Create a grounded findings file that captures current evidence, recommended policy, privacy boundaries, and cross-repo work candidates for personalized skills.

### Files or Surfaces To Change

- `tasks/skills/personalized-skills/findings.md`

### Steps

1. Read all required files in order.
2. Search this repo for current personalized-skill language:

```bash
rg -n "personalized|personalised|preference|user preferences|local labels|device graph|account state|personal assumptions|local skill" docs .agents/skills tasks apps sites evals
```

3. If `../clawperator-skills/` exists, search it for the same terms and inspect representative personalized or local examples under `../clawperator-skills/skills/`.
4. If the user has named any downstream or personal-skill repos before execution, inspect only those repositories. Do not browse arbitrary private directories looking for personal data.
5. Create `findings.md` using the required structure above.
6. In `Recommended Policy`, explicitly cover:
   - personalized local skills are valid when truthful and scoped
   - agents should name personal assumptions instead of hiding them
   - shared skills require inputs, configuration, discovery, or generalized selectors
   - private values must be sanitized in public artifacts
   - user preferences are useful context, not license to invent or persist sensitive memory without support
7. Add cross-repo work candidates with stable IDs such as `XREPO-1`, `XREPO-2`.

### Acceptance Criteria

- `findings.md` exists and uses the required structure exactly
- every recommendation is traceable to current repo docs, code contracts, sibling repo evidence, or explicit user direction
- cross-repo candidates include repo, path or surface, required action, and status
- no real private values are committed

Human review checklist:

- output accuracy: recommendations do not exceed the evidence
- scope completeness: findings focus on personalized skills and not bundled-skill symlink mechanics
- evidence grounding: important claims point to paths or observed examples
- format compliance: findings use the required section order and table shapes

### Validation

```bash
test -f tasks/skills/personalized-skills/findings.md
rg -n "OpenClaw.*symlink|broken.*symlink|bundled-skill symlink" tasks/skills/personalized-skills/findings.md && exit 1 || true
rg -n "REAL_PRIVATE_VALUE|ACTUAL_ACCOUNT|ACTUAL_DEVICE|ACTUAL_ROOM" tasks/skills/personalized-skills/findings.md && exit 1 || true
```

### Expected Commit

```text
docs(tasks): capture personalized skills findings
```

## Phase 2: Cross-Repo Routing And Handoffs

### Agent Tier

default

### Goal

Convert Phase 1 findings into explicit implementation status: complete quick local coordination updates when safe, and preserve any work that must happen in another repository.

### Files or Surfaces To Change

- `tasks/skills/personalized-skills/findings.md`
- `tasks/skills/personalized-skills/finalization-items.md` only if deferred work remains
- sibling or downstream repositories named in `findings.md`, when available and explicitly in scope for the current execution

### Steps

1. Re-read `findings.md`.
2. For each `Cross-Repo Work Items` row, choose exactly one status:
   - `implemented`
   - `handoff-ready`
   - `deferred`
   - `out-of-scope`
3. Implement only small, clearly bounded changes in sibling/downstream repos when the target repo is available, the owner surface is obvious, and validation is known.
4. For anything not implemented, create or update `finalization-items.md` with:
   - item ID
   - owning repo
   - deferred action
   - why it was deferred
   - exact file or surface to inspect
   - validation or acceptance expectation
5. Update the status column in `findings.md` so it agrees with any `finalization-items.md` entries.
6. Do not edit public docs in this phase except to fix a blocking contradiction discovered during routing.

### Acceptance Criteria

- every cross-repo work item has one of the four allowed statuses
- deferred work appears in `finalization-items.md` with enough context to execute later
- implemented sibling-repo work, if any, is separately validated in that repo and summarized in `findings.md`
- no durable policy is left only as an untracked conversation note

Human review checklist:

- output accuracy: item statuses match what actually happened
- scope completeness: no cross-repo item is silently dropped
- evidence grounding: handoffs name paths and validation expectations
- format compliance: `finalization-items.md`, if present, is actionable rather than vague

### Validation

```bash
test -f tasks/skills/personalized-skills/findings.md
rg -n "\\| XREPO-[0-9]+ \\|" tasks/skills/personalized-skills/findings.md
rg -n "\\| (implemented|handoff-ready|deferred|out-of-scope) \\|" tasks/skills/personalized-skills/findings.md
```

If `finalization-items.md` exists:

```bash
rg -n "XREPO-[0-9]+|owning repo|validation" tasks/skills/personalized-skills/finalization-items.md
```

### Expected Commit

```text
docs(tasks): route personalized skills follow-up
```

## Phase 3: Durable Public Documentation

### Agent Tier

thinking

### Goal

Create the durable personalized-skill guidance page for agents and wire it into the public docs.

### Files or Surfaces To Change

- `docs/skills/personalized.md`
- `docs/skills/authoring.md`
- `docs/index.md`
- `sites/docs/mkdocs.yml`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for this phase.
2. Read `docs/internal/documentation-drafting-north-star.md` before drafting.
3. Draft `docs/skills/personalized.md` from `findings.md`, current code contracts, and current docs. The page must include:
   - `# Personalized Skills`
   - `## Purpose`
   - `## When To Use`
   - `## What Counts As Personalized`
   - `## Agent Rules`
   - `## Privacy Boundaries`
   - `## Local Versus Shared`
   - `## Promotion Checklist`
   - `## Examples`
   - `## Verification`
4. In `Examples`, use sanitized examples only. Show categories such as room labels, device graph, preferred mode, or account-specific navigation without real private values.
5. Update `docs/skills/authoring.md` so the existing personalized-versus-shared section becomes a short pointer to `personalized.md`, preserving any recording-specific nuance that belongs there.
6. Add the new page to `docs/index.md` under `## Skills`.
7. Add the new page to `sites/docs/mkdocs.yml` under the Skills nav.
8. Run docs validation.
9. Reread the draft against `findings.md` and the relevant code/docs contracts. Refine the page in a second docs commit if the first draft missed policy, overclaimed code support, or duplicated existing pages.

### Acceptance Criteria

- `docs/skills/personalized.md` exists with all required sections
- the new page explains personalized local skills as valid but scoped
- the new page states privacy boundaries clearly and uses sanitized examples only
- the new page gives agents a concrete local-versus-shared decision model
- `docs/skills/authoring.md` links to the new page instead of duplicating the full policy
- `docs/index.md` and `sites/docs/mkdocs.yml` include the new page
- `./scripts/docs_build.sh` passes

Human review checklist:

- output accuracy: the page does not document unsupported storage, memory, or registry behavior
- scope completeness: the page covers user preferences, local labels, account state, device graph, privacy, and promotion to shared skills
- evidence grounding: claims come from `findings.md`, code contracts, existing docs, or explicit user direction
- format compliance: required sections are present and docs nav/index are updated

### Validation

```bash
test -f docs/skills/personalized.md
rg -n "Personalized Skills|personalized.md" docs/skills/personalized.md docs/skills/authoring.md docs/index.md sites/docs/mkdocs.yml
rg -n "REAL_PRIVATE_VALUE|ACTUAL_ACCOUNT|ACTUAL_DEVICE|ACTUAL_ROOM" docs/skills/personalized.md && exit 1 || true
./scripts/docs_build.sh
```

### Expected Commit

First docs draft:

```text
docs(skills): add personalized skills guidance
```

Refinement if needed after reread:

```text
docs(skills): refine personalized skills guidance
```
