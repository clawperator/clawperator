# Personalized Skills Guidance and Cross-Repo Follow-Through Work Breakdown

Parent plan: `tasks/skills/personalized-skills/plan.md`

## Executive Summary

1 PR, 5 phases. Phase 1 uses `thinking` for audit and synthesis. Phase 2
uses `default` for the two no-argument wrappers. Phase 3 uses `default` for
the basic Netflix wrapper. Phase 4 uses `thinking` for the experimental unified
HVAC controller. Phase 5 uses `thinking` for public docs authoring and
refinement.

Current state is planning complete, execution not started.

## Status
| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none for Phase 1; Phases 2-4 require active OpenClaw and personal skill-home access |

## Hard Rules

- Do not work on bundled-skill symlink behavior in this task.
- Create `findings.md` at the start of Phase 1 using the required structure below. Do not invent the format during execution.
- Do not include real private labels, room names, device names, account identifiers, credentials, phone numbers, addresses, or personal routines in committed artifacts.
- Use sanitized placeholders for examples and state what kind of private value they represent.
- Do not claim a personalized local skill is generic or shared unless personal assumptions have been replaced with explicit inputs, configuration, discovery, or generalized selectors.
- Do not leave durable policy only in `tasks/`. Phase 5 must create `docs/skills/personalized.md`.
- Create the required personalized skills in this order: `home-battery-get-level`, `home-energy-get-yesterday-usage-cost`, `media-netflix-set-my-list-state`, then `home-hvac-control`.
- Do not create user-facing HVAC split wrappers such as `home-hvac-set-power-state`, `home-hvac-set-zone-state`, `home-hvac-set-mode`, or `home-hvac-set-fan-level` in this task. `home-hvac-control` is the only user-facing HVAC skill deliverable.
- After adding each skill, verify OpenClaw discovery before moving to the next skill.
- For the first two no-argument wrappers, call OpenClaw through `openclaw agent --message ... --json` and record the real result or blocker in `findings.md`.
- Use `.agents/skills/docs-author/SKILL.md` for Phase 5. Do not hand-edit generated docs under `sites/docs/.build/` or `sites/docs/site/`.
- If Phases 2-4 discover work that cannot be completed in this PR, create or update `finalization-items.md` with enough detail for a later agent to act without reconstructing context.
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
| `tasks/skills/fix-repeatable-skills/findings.md` | Prior evidence: registry resolution order, specific AirTouch/Netflix/SolaX skill IDs, stale OpenClaw workspace skill paths, skillResult truthfulness requirements, and zone-label examples. Read before Phase 1 to avoid re-deriving what is already known. Do not duplicate its content; reference and extend it. |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Audit, create required personal wrappers, verify OpenClaw discovery and live behavior, and publish personalized-skill guidance | 1, 2, 3, 4, 5 | thinking, default, default, thinking, thinking | none |

## Cross-Repo Routing Rules

Use these statuses for `Cross-Repo Work Items` in `findings.md`. The four
required personalized skill deliverables are not optional cross-repo items; do
not mark them `deferred` unless Phase 1 records a blocker and the user accepts
deferral.

| Status | Criterion |
| --- | --- |
| `implemented` | Change made in the target repo or personal skill home in this task; validation confirmed |
| `handoff-ready` | Target path is known and the item is actionable, but it is outside the required wrapper sequence or cannot be safely changed now; `finalization-items.md` has enough detail for another agent |
| `deferred` | A real access barrier, timing constraint, missing information, or unsafe live mutation prevents action now; `finalization-items.md` records the blocker |
| `out-of-scope` | Explicitly outside this task's boundary, such as bundled-skill symlink mechanics, runtime registry redesign, or private data storage features |

Default to `handoff-ready` over `deferred` when the path is known but the item
is simply not part of the required wrapper sequence. Default to `out-of-scope`
only when the item violates a hard exclusion in `plan.md`.

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

## Required Personalized Skill Status
| Order | Skill | Target home | Status | OpenClaw discovery result | OpenClaw live-call result |
| --- | --- | --- | --- | --- | --- |

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
2. Confirm which personal skill home OpenClaw loads. Run:

```bash
openclaw skills list --eligible --json
```

   Look for entries with `"source": "agents-skills-personal"`. If present, `~/.agents/skills/` is confirmed as the active personal skill home and the target for Phases 2-4. If absent but entries with `"source": "openclaw-workspace"` appear, record in `findings.md` that `~/.openclaw/workspace/skills/` is required instead and update the target in the Required Personalized Skill Status table.

3. Search this repo for current personalized-skill language:

```bash
rg -n "personalized|personalised|preference|user preferences|local labels|device graph|account state|personal assumptions|local skill" docs .agents/skills tasks apps sites evals
```

4. If `../clawperator-skills/` exists, search it for the same terms and inspect representative personalized or local examples under `../clawperator-skills/skills/`.
5. If the user has named any downstream or personal-skill repos before execution, inspect only those repositories. Do not browse arbitrary private directories looking for personal data.
6. Create `findings.md` using the required structure above.
7. In `Recommended Policy`, explicitly cover:
   - personalized local skills are valid when truthful and scoped
   - agents should name personal assumptions instead of hiding them
   - shared skills require inputs, configuration, discovery, or generalized selectors
   - private values must be sanitized in public artifacts
   - user preferences are useful context, not license to invent or persist sensitive memory without support
   - runtime failures must be surfaced truthfully: report success only when the top-level wrapper status is `success` and verify `skillResult.status` second; do not claim a skill succeeded based on `skillResult.status` alone when the wrapper is `indeterminate` or `failed` (see `docs/skills/runtime.md` trust-order section)
8. Seed `Required Personalized Skill Status` with these rows in this exact order:
   - `home-battery-get-level`
   - `home-energy-get-yesterday-usage-cost`
   - `media-netflix-set-my-list-state`
   - `home-hvac-control`
9. Add cross-repo work candidates with stable IDs such as `XREPO-1`, `XREPO-2`.

### Acceptance Criteria

- `findings.md` exists and uses the required structure exactly
- `findings.md` has all four required personalized skill rows in the required order
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
rg -n "home-battery-get-level" tasks/skills/personalized-skills/findings.md
rg -n "home-energy-get-yesterday-usage-cost" tasks/skills/personalized-skills/findings.md
rg -n "media-netflix-set-my-list-state" tasks/skills/personalized-skills/findings.md
rg -n "home-hvac-control" tasks/skills/personalized-skills/findings.md
rg -n "OpenClaw.*symlink|broken.*symlink|bundled-skill symlink" tasks/skills/personalized-skills/findings.md && exit 1 || true
rg -n "REAL_PRIVATE_VALUE|ACTUAL_ACCOUNT|ACTUAL_DEVICE|ACTUAL_ROOM" tasks/skills/personalized-skills/findings.md && exit 1 || true
```

### Expected Commit

```text
docs(tasks): capture personalized skills findings
```

## Phase 2: No-Argument Battery And Energy Wrappers

### Agent Tier

default

### Goal

Create the two simplest personal wrappers first, prove the chosen personal skill
home is visible to OpenClaw, and prove OpenClaw can call them.

### Files or Surfaces To Change

- `tasks/skills/personalized-skills/findings.md`
- `tasks/skills/personalized-skills/finalization-items.md` only if deferred work remains
- `~/.agents/skills/home-battery-get-level/` unless Phase 1 proves OpenClaw requires `~/.openclaw/workspace/skills/home-battery-get-level/`
- `~/.agents/skills/home-energy-get-yesterday-usage-cost/` unless Phase 1 proves OpenClaw requires `~/.openclaw/workspace/skills/home-energy-get-yesterday-usage-cost/`

### Steps

1. Re-read `findings.md` and confirm the target home for the first wrapper.
2. Create `home-battery-get-level` as a no-user-argument wrapper. It should call:

```bash
clawperator skills run com.solaxcloud.starter.get-battery --output json
```

   If the runtime requires device selection on the active host, put the local device rule in the local personal skill or local config only. Do not commit a real device serial to this repo.
3. Verify `home-battery-get-level` appears in `openclaw skills list --eligible --json`, then inspect it with `openclaw skills info home-battery-get-level --json`.
4. Call OpenClaw with a realistic request:

```bash
openclaw agent --message "What is the home battery level? Use the personal skill if one applies." --json
```

5. Record the discovery output and live-call result or blocker in `findings.md`.
6. Create `home-energy-get-yesterday-usage-cost` as a no-user-argument wrapper. Prefer:

```bash
clawperator skills run com.globird.energy.get-yesterday-usage-cost-replay --output json
```

   If Phase 1 or live validation shows that replay remains unreliable, use `com.globird.energy.get-usage` as the current runtime target and document the reason in the skill and `findings.md`.
7. Verify `home-energy-get-yesterday-usage-cost` appears in `openclaw skills list --eligible --json`, then inspect it with `openclaw skills info home-energy-get-yesterday-usage-cost --json`.
8. Call OpenClaw with a realistic request:

```bash
openclaw agent --message "What was yesterday's home energy usage cost? Use the personal skill if one applies." --json
```

9. Record the discovery output and live-call result or blocker in `findings.md`.
10. For unrelated cross-repo candidates discovered in Phase 1, create or update `finalization-items.md` rather than delaying these two required wrappers.

### Acceptance Criteria

- `home-battery-get-level` exists in the chosen personal skill home
- `home-energy-get-yesterday-usage-cost` exists in the chosen personal skill home
- both wrappers require no user arguments
- neither wrapper contains committed real private identifiers
- `openclaw skills list --eligible --json` shows both wrapper names
- both wrappers have been called through `openclaw agent --message ... --json`, or a concrete OpenClaw/gateway blocker is recorded in `findings.md`
- `findings.md` updates the required skill status rows for both wrappers

Human review checklist:

- output accuracy: each wrapper calls the intended runtime skill and reports only verified success
- scope completeness: the two simple wrappers are done before Netflix or HVAC work starts
- evidence grounding: OpenClaw discovery and live-call results are recorded
- format compliance: local private values are not copied into task files

### Validation

```bash
test -f tasks/skills/personalized-skills/findings.md
openclaw skills list --eligible --json | rg -n "home-battery-get-level"
openclaw skills list --eligible --json | rg -n "home-energy-get-yesterday-usage-cost"
openclaw skills info home-battery-get-level --json
openclaw skills info home-energy-get-yesterday-usage-cost --json
openclaw agent --message "What is the home battery level? Use the personal skill if one applies." --json
openclaw agent --message "What was yesterday's home energy usage cost? Use the personal skill if one applies." --json
rg -n "home-battery-get-level" tasks/skills/personalized-skills/findings.md
rg -n "home-energy-get-yesterday-usage-cost" tasks/skills/personalized-skills/findings.md
```

If `finalization-items.md` exists:

```bash
rg -n "XREPO-[0-9]+|owning repo|validation" tasks/skills/personalized-skills/finalization-items.md
```

### Expected Commit

Personal skill files created in `~/.agents/skills/` are not committed to this repository. If that directory is tracked in a personal dotfiles repo, commit them there separately.

For this repo, commit `findings.md` and `finalization-items.md` if either file was created or updated:

```text
docs(tasks): verify home-battery and home-energy personal wrappers
```

## Phase 3: Basic Netflix Wrapper

### Agent Tier

default

### Goal

Create the first argument-bearing personal wrapper after the two simple
wrappers prove discovery and OpenClaw invocation.

### Files or Surfaces To Change

- `tasks/skills/personalized-skills/findings.md`
- `~/.agents/skills/media-netflix-set-my-list-state/` unless Phase 1 proves OpenClaw requires `~/.openclaw/workspace/skills/media-netflix-set-my-list-state/`

### Steps

1. Re-read Phase 2 results in `findings.md`. Do not start Netflix if the personal skill home is still not visible to OpenClaw.
2. Create `media-netflix-set-my-list-state` as a basic personal wrapper.
3. Expose one required user content argument: the Netflix title. Derive add/remove state from request wording such as add/save/remove/unsave. Keep profile/defaults local-only.
4. The wrapper should call:

```bash
clawperator skills run com.netflix.mediaclient.set-my-list-state-replay \
  --output json \
  -- \
  --action '<add|remove>' \
  --title '<title>' \
  --profile '<local_profile>'
```

5. Verify the wrapper appears in `openclaw skills list --eligible --json`, then inspect it with `openclaw skills info media-netflix-set-my-list-state --json`.
6. Forward-test through OpenClaw with a safe title/request selected by the implementer or user. If the request would mutate real account state and no safe title is available, record the blocker instead of fabricating success.
7. Record the discovery output and live-call result or blocker in `findings.md`.

### Acceptance Criteria

- `media-netflix-set-my-list-state` exists in the chosen personal skill home
- the wrapper exposes only the user-facing Netflix title as the required content argument; action comes from request wording and profile/defaults stay local-only
- OpenClaw discovers the wrapper
- OpenClaw chooses the wrapper for a Netflix My List add/remove request, or a concrete safe-test blocker is recorded
- success is reported only from verified runtime output

### Validation

```bash
openclaw skills list --eligible --json | rg -n "media-netflix-set-my-list-state"
openclaw skills info media-netflix-set-my-list-state --json
openclaw agent --message "Add <safe_test_title> to my Netflix list. Use the personal skill if one applies." --json
rg -n "media-netflix-set-my-list-state" tasks/skills/personalized-skills/findings.md
```

Replace `<safe_test_title>` with the safe test title chosen during execution,
or record why no live mutation test was run.

### Expected Commit

Personal skill files are not committed to this repo. Commit `findings.md` and `finalization-items.md` if either file was created or updated:

```text
docs(tasks): verify Netflix personal wrapper
```

## Phase 4: Unified HVAC Control Wrapper

### Agent Tier

thinking

### Goal

Create one experimental user-facing HVAC skill that hides the underlying
multi-skill AirTouch implementation details from OpenClaw and the user.

### Files or Surfaces To Change

- `tasks/skills/personalized-skills/findings.md`
- `tasks/skills/personalized-skills/finalization-items.md` only if HVAC is partially implemented or blocked
- `~/.agents/skills/home-hvac-control/` unless Phase 1 proves OpenClaw requires `~/.openclaw/workspace/skills/home-hvac-control/`

### Steps

1. Re-read Phase 2 and Phase 3 results in `findings.md`.
2. Create `home-hvac-control` as the only user-facing HVAC wrapper in this task. This wrapper is a personal AgentSkills wrapper: a `SKILL.md` at `~/.agents/skills/home-hvac-control/SKILL.md`. It is NOT a Clawperator orchestrated runtime skill (which would require `skill.json.agent` and live in the runtime skills registry under `~/.clawperator/skills/`). The multi-step sequencing happens because the `SKILL.md` instructs the OpenClaw agent to run multiple `clawperator skills run` commands in sequence, not because Clawperator's own runtime orchestrates them.
3. Do not create or expose `home-hvac-set-power-state`, `home-hvac-set-zone-state`, `home-hvac-set-mode`, or `home-hvac-set-fan-level`.
4. Implement the wrapper so it can accept a natural request such as: "turn on the a/c, make sure it's on in the living room, use the medium fan level".
5. Internally sequence the required Clawperator runtime skills based on parsed intent. Candidate runtime skills from prior findings are:
   - `au.com.polyaire.airtouch5.set-power-state`
   - `au.com.polyaire.airtouch5.set-zone-state`
   - `au.com.polyaire.airtouch5.set-fan-level`
   - `au.com.polyaire.airtouch5.set-mode`
6. Keep local aliases such as `living room` -> `living` local to the personal skill or local config. Do not commit real private values.
7. Surface partial failures truthfully. If power succeeds but zone or fan fails, report the exact partial result and underlying runtime failure.
8. Verify the wrapper appears in `openclaw skills list --eligible --json`, then inspect it with `openclaw skills info home-hvac-control --json`.
9. Forward-test through OpenClaw with at least one realistic multi-part request when safe.
10. Record the discovery output, execution sequence, and live-call result or blocker in `findings.md`.

### Acceptance Criteria

- `home-hvac-control` exists in the chosen personal skill home
- no separate user-facing HVAC split wrappers are introduced by this task
- OpenClaw discovers `home-hvac-control`
- OpenClaw chooses `home-hvac-control` for a multi-part HVAC request
- the wrapper sequences multiple runtime skills when the request requires it
- partial and full failures are reported truthfully from the underlying runtime results

### Validation

```bash
openclaw skills list --eligible --json | rg -n "home-hvac-control"
openclaw skills info home-hvac-control --json
openclaw skills list --eligible --json | rg -n "home-hvac-set-power-state|home-hvac-set-zone-state|home-hvac-set-mode|home-hvac-set-fan-level" && exit 1 || true
openclaw agent --message "Turn on the a/c, make sure it's on in the living room, and use the medium fan level. Use the personal skill if one applies." --json
rg -n "home-hvac-control" tasks/skills/personalized-skills/findings.md
```

### Expected Commit

Personal skill files are not committed to this repo. Commit `findings.md` and `finalization-items.md` if either file was created or updated:

```text
docs(tasks): verify unified HVAC personal wrapper
```

## Phase 5: Durable Public Documentation

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
- the `## Verification` section covers the `skillResult` two-level trust order: check top-level wrapper status first, then `skillResult.status`; cite or link to `docs/skills/runtime.md`
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
# New page exists
test -f docs/skills/personalized.md
# Page has required heading
rg -n "# Personalized Skills" docs/skills/personalized.md
# authoring.md links to the new page
rg -n "personalized\.md\|personalized skills" docs/skills/authoring.md
# index.md lists the new page
rg -n "personalized\.md\|Personalized" docs/index.md
# mkdocs.yml includes the new page
rg -n "personalized\.md" sites/docs/mkdocs.yml
# No literal private-value placeholders leaked into the page
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
