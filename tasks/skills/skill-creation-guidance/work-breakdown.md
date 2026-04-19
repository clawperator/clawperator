# Skill Creation Guidance And Guardrails Work Breakdown

Parent plan: `tasks/skills/skill-creation-guidance/plan.md`

## Executive Summary

3 PRs, 5 phases across `../clawperator-skills` and `clawperator`.

- PR-1 repairs the local skills-repo author surface and migrates the seed rules
- PR-2 lands the main-repo scaffold and validator guardrails that Pack A
  depends on
- PR-3 finishes the full local checklist and negative examples once the shared
  baseline is stable

Pack A must not begin until PR-2 is merged or finalized locally.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 3 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do not spin this back out into a third prerequisite pack. The shared
  prerequisite work is Phase 1 through Phase 4 of this pack.
- Keep `../clawperator-skills/docs/` as the local guidance home. Do not "fix"
  the README by deleting the local-doc promises without replacement.
- Migrate the high-value rules from
  `~/.clawperator/findings/skill-drafting/findings.md` into repo-owned guidance
  before expanding the broader checklist.
- Treat `../clawperator-skills/scripts/test_all.sh` as the canonical off-device
  test entrypoint for the skills repo. Do not teach authors one-off ad hoc
  commands when a colocated `*.test.js` can run under `node --test`.
- Treat `skill-migration.md` as an audit surface, not as the primary author
  contribution guide.
- `scaffoldSkill.ts` must use `resolveClawperatorBin`. Do not leave the
  scaffold behind the exemplar quality bar.
- `validateSkill.ts` changes in this pack are limited to the named static
  checks. Do not widen the pack into runtime parser or verification-contract
  changes.
- The finished guidance must define a testing matrix that tells authors:
  - when a change needs a colocated `*.test.js`
  - when shell syntax checks are required
  - when `clawperator skills validate` is required
  - when live-device proof is still mandatory
- The finished guidance must also define a structure rule: keep `run.js` thin
  and extract testable off-device logic into importable modules under
  `skills/**/scripts/` or `skills/utils/` when practical.
- Guidance discoverability is part of the deliverable. Do not leave the durable
  author rules buried in deep docs that are unreachable from top-level author
  surfaces.
- Use `.agents/skills/docs-author/SKILL.md` for any main-repo docs changes.
- Create `tasks/skills/skill-creation-guidance/findings.md` during execution
  and update it after every meaningful validation or design decision.
- One commit per phase. Do not batch the skills-repo doc restoration, main-repo
  guardrails, and final checklist codification into one opaque commit.
- Pack A stays blocked until Phase 4 is done and PR-2 is merged or finalized
  locally.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| # | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/skills/skill-creation-guidance/plan.md` | Stable contract, phase boundaries, and deterministic decisions |
| 2 | `tasks/skills/authorship/findings-compiled.md` | Full problem statement, failure patterns, and PR-hardening lessons |
| 3 | `../clawperator-skills/README.md` | Current broken local-doc promises |
| 4 | `../clawperator-skills/AGENTS.md` | Current local checklist and rules surface |
| 5 | `../clawperator-skills/skill-migration.md` | Current audit surface whose role must be clarified |
| 6 | `~/.clawperator/findings/skill-drafting/findings.md` | Private rule source that must become durable |
| 7 | `../clawperator-skills/scripts/generate_skill_indexes.sh` | Generated-index contract that the validator must respect |
| 8 | `../clawperator-skills/scripts/test_all.sh` | Canonical off-device test entrypoint today |
| 9 | `../clawperator-skills/skills/utils/common.test.js` | Existing colocated helper-test pattern |
| 10 | `../clawperator-skills/skills/com.amazon.mShop.android.shopping.search-products/scripts/amazon_parser.test.js` | Existing per-skill parser-test pattern |
| 11 | `apps/node/src/domain/skills/scaffoldSkill.ts` | Current scaffold helper divergence |
| 12 | `apps/node/src/domain/skills/validateSkill.ts` | Current static validation surface |
| 13 | `apps/node/src/test/unit/skills.test.ts` | Validator regression coverage surface |
| 14 | `docs/skills/authoring.md` | Public doc that should point to the local author surface |
| 15 | `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 4 |

## PR / Phase Plan

| PR | Repo | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `../clawperator-skills` | Repair local author surface and restore truthful docs | 1, 2 | thinking, default | none |
| PR-2 | `clawperator` | Add scaffold and validator guardrails, then cross-link main-repo docs | 3, 4 | thinking, default | PR-1 merged or finalized locally |
| PR-3 | `../clawperator-skills` | Codify the full local checklist, testing matrix, and negative examples | 5 | thinking | PR-2 merged or finalized locally |

## Findings File Requirement

Create `tasks/skills/skill-creation-guidance/findings.md` during Phase 1 with
these sections:

- Goal
- Current local author surface
- README link decision
- Migrated rules
- Mechanical guardrails shipped
- Testing matrix decisions
- Discoverability routes
- Validation commands
- Observations
- Problems encountered
- Deferred follow-up

This file is an execution log and decision record, not a prewritten placeholder.

## Phase 1: Local Author-Surface Decision And Seed Rule Migration

### Agent Tier

thinking

### Goal

Repair the broken local author surface in `../clawperator-skills` and migrate
the highest-value private findings into repo-owned guidance before any broader
checklist work begins.

### Files or Surfaces To Change

- `../clawperator-skills/README.md`
- `../clawperator-skills/AGENTS.md`
- `tasks/skills/skill-creation-guidance/findings.md`

### Steps

1. Create `findings.md` with the required sections before the first content
   change.
2. Record the current broken README-linked author surfaces in `findings.md`.
3. Update `README.md` so it points at the intended local docs trio in
   `../clawperator-skills/docs/` rather than missing files.
4. Migrate the highest-value rules from
   `~/.clawperator/findings/skill-drafting/findings.md` into `AGENTS.md` as the
   seed author checklist.
5. Add a short explicit route from the top-level author surface to
   `../clawperator-skills/scripts/test_all.sh` so authors can discover the
   off-device test entrypoint immediately.
6. Make sure the top-level author surfaces point readers toward the restored
   durable guidance, not just toward raw repo layout.
7. Keep the migration scoped: move the durable rules now, not the entire
   history of that file.

### Acceptance Criteria

- `findings.md` records the README-link problem and the chosen repair path
- `README.md` points at real local docs targets under `../clawperator-skills/docs/`
- `AGENTS.md` contains the migrated seed rules from the private findings file
- the top-level author surface points at `../clawperator-skills/scripts/test_all.sh`
- the top-level author surface points at the restored durable guidance

### Validation

```bash
rg -n "docs/skill-development-workflow.md|docs/skill-authoring-guidelines.md|docs/device-prep-and-runtime-tips.md" ../clawperator-skills/README.md
rg -n "resolveClawperatorBin|generated index|diagnostic|privacy" ../clawperator-skills/AGENTS.md
rg -n "test_all.sh" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
rg -n "skill-development-workflow|skill-authoring-guidelines|device-prep-and-runtime-tips" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
```

### Expected Commit

```text
docs(skills): repair local authoring surface entrypoints
```

## Phase 2: Restore Local Docs Trio And Clarify `skill-migration.md`

### Agent Tier

default

### Goal

Restore a truthful, current local docs trio in `../clawperator-skills/docs/`
and make `skill-migration.md` an explicitly secondary audit surface.

### Files or Surfaces To Change

- `../clawperator-skills/docs/skill-development-workflow.md`
- `../clawperator-skills/docs/skill-authoring-guidelines.md`
- `../clawperator-skills/docs/device-prep-and-runtime-tips.md`
- `../clawperator-skills/README.md`
- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/skill-migration.md`

### Steps

1. Restore or rewrite the three local docs pages so they describe current
   behavior and point back to canonical contract docs where appropriate.
2. Use `README.md` and `AGENTS.md` to route authors toward those local pages for
   workflow and checklist help.
3. Update `skill-migration.md` only enough to clarify that it is a migration and
   audit log, not the main contribution guide.
4. Make sure the restored local docs introduce the authored-skill structure and
   testing model at a high level:
   - `run.js` stays thin when possible
   - extract testable off-device logic into importable modules
   - colocate `*.test.js` where `scripts/test_all.sh` can pick them up
   - live-device proof still applies to UI behavior
5. Keep the local pages concise and practical. Do not duplicate the entire
   runtime contract from the main repo.
6. Record the final local-doc layout and any unresolved gaps in `findings.md`.

### Acceptance Criteria

- all three local docs files exist under `../clawperator-skills/docs/`
- `README.md` and `AGENTS.md` point at them
- `skill-migration.md` no longer reads like the primary author workflow
- the local docs point back to the main repo contracts instead of duplicating
  them wholesale
- the local docs introduce the testing and structure model before the full
  checklist lands in PR-3
- the local docs are reachable from the top-level author surfaces without
  repo archaeology

### Validation

```bash
test -f ../clawperator-skills/docs/skill-development-workflow.md
test -f ../clawperator-skills/docs/skill-authoring-guidelines.md
test -f ../clawperator-skills/docs/device-prep-and-runtime-tips.md
rg -n "skill-migration" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
rg -n "skill-development-workflow|skill-authoring-guidelines|device-prep-and-runtime-tips" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
rg -n "test_all.sh|node --test|live-device|run.js" ../clawperator-skills/docs/skill-development-workflow.md ../clawperator-skills/docs/skill-authoring-guidelines.md
```

### Expected Commit

```text
docs(skills): restore local skill authoring guides
```

## Phase 3: Scaffold And Validator Guardrails

### Agent Tier

thinking

### Goal

Raise the main-repo floor so newly authored skills start from the exemplar
helper pattern and the static validator catches the cheapest repeated mistakes.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/test/unit/skills.test.ts`

### Steps

1. Update `scaffoldSkill.ts` so the generated `run.js` uses
   `resolveClawperatorBin`, matching the exemplar skills.
2. Add an additive static check in `validateSkill.ts` that requires
   `clawperator-skill-type` frontmatter on `SKILL.md` and validates it against
   the allowed values used by the repo.
3. Add an additive static check that detects registry changes without refreshed
   generated indexes.
4. Update `docs/skills/authoring.md` or the Pack B findings if the validator
   boundary needs an explicit note that these checks do not replace repo tests
   or live proof for authored skills.
5. Add focused regression coverage in `apps/node/src/test/unit/skills.test.ts`
   for both new checks.
6. Record the exact guardrails shipped in `findings.md`.

### Acceptance Criteria

- the scaffold output matches exemplar helper usage on `resolveClawperatorBin`
- `validateSkill.ts` rejects missing or invalid `clawperator-skill-type`
- `validateSkill.ts` or its associated check rejects stale generated indexes
- unit tests cover the new guardrails
- the documented boundary still makes clear that validator checks do not replace
  `scripts/test_all.sh` or live-device proof

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
fix(skills): harden skill authoring guardrails
```

## Phase 4: Main-Repo Docs Alignment

### Agent Tier

default

### Goal

Point the main repo's public authoring docs at the restored local skills-repo
guidance and explain the validator-versus-checklist boundary without copying
the full local checklist into public docs.

### Files or Surfaces To Change

- `docs/skills/authoring.md`
- `docs/skills/development.md` only if needed

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the docs workflow.
2. In `docs/skills/authoring.md`, add explicit links to the restored local
   skills-repo guidance for author workflow, checklist, and device/runtime prep.
3. Make the public authoring page name the current host-visible discovery
   command for installed authoring workflows:
   `clawperator authoring-skills list`.
4. Explain the boundary:
   - `validateSkill` catches a bounded static subset
   - `../clawperator-skills/scripts/test_all.sh` is the skills-repo off-device
     test entrypoint
   - the local skills-repo checklist remains required for truthfulness and
     author quality bar
5. Touch `docs/skills/development.md` only if it needs one small cross-link for
   discoverability.
6. Record the public-doc link targets in `findings.md`.

### Acceptance Criteria

- `docs/skills/authoring.md` points authors at the restored local guidance
- the docs explain validator guardrails versus checklist guardrails correctly
- the docs point at the skills-repo off-device test entrypoint instead of
  implying `skills validate` is the whole test story
- the docs point at `clawperator authoring-skills list` as the current
  host-visible discovery surface for installed authoring workflows
- docs build succeeds

### Validation

```bash
./scripts/docs_build.sh
```

### Expected Commit

```text
docs(skills): cross-link runtime skill author guidance
```

## Phase 5: Full Local Checklist And Negative Examples

### Agent Tier

thinking

### Goal

Finish the local skills-repo quality bar by codifying the recurring
PR-hardening lessons and negative examples in a way authors can apply before
they open a PR.

### Files or Surfaces To Change

- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/docs/skill-authoring-guidelines.md`
- `../clawperator-skills/README.md` only if small route wording needs alignment

### Steps

1. Promote the 13 PR-hardening lessons from the findings pass into the local
   checklist, with grouped rules and concrete negative examples.
2. Add a durable testing matrix that tells authors exactly when to run and when
   to extend:
   - `../clawperator-skills/scripts/test_all.sh`
   - shell syntax checks for `scripts/*.sh`
   - `clawperator skills validate <skill_id> --dry-run`
   - live-device proof on the real target surface
3. Make the local checklist explicit about which items are:
   - mechanically enforced by `validateSkill`
   - still checklist-only and must be reviewed by the author
4. Add a structure rule with concrete examples:
   - keep `run.js` thin when possible
   - move parser, normalizer, and helper logic into importable modules
   - colocate `*.test.js` next to that logic so `node --test` discovers it
   - use existing examples such as `skills/utils/common.test.js` and
     `amazon_parser.test.js` as the pattern
5. Keep examples sanitized. Do not leak local paths, real device ids, or other
   private data into the new guidance.
6. Keep the local guidance pointed at current behavior. Do not preserve stale
   historical process just because it existed in old docs.
7. Record any remaining unowned rule gaps in `findings.md` as deferred follow-up
   rather than silently widening the pack.

### Acceptance Criteria

- every recurring failure pattern from the compiled findings has a durable local
  rule
- the local checklist contains an explicit testing matrix for authored-skill
  changes
- the local checklist distinguishes mechanical guardrails from author-only
  checklist items
- the local checklist defines when to add colocated `*.test.js` and how to
  structure logic so `scripts/test_all.sh` can exercise it
- negative examples are concrete and sanitized
- `findings.md` records any remaining deferred rule gaps

### Validation

```bash
../clawperator-skills/scripts/test_all.sh
rg -n "Verification drift|Generated index drift|Shared helper bypass|Diagnostics|Parser ambiguity|Privacy|test_all.sh|node --test|live-device|run.js" ../clawperator-skills/AGENTS.md ../clawperator-skills/docs/skill-authoring-guidelines.md
```

### Expected Commit

```text
docs(skills): codify runtime skill author checklist
```
