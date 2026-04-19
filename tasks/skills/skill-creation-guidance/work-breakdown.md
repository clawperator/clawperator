# Skill Creation Guidance And Guardrails Work Breakdown

Parent plan: `tasks/skills/skill-creation-guidance/plan.md`

## Executive Summary

3 PRs, 5 phases across `../clawperator-skills` and `clawperator`.

- PR-1 repairs the local skills-repo author surface, routes it to durable
  main-repo docs, and migrates the seed rules
- PR-2 lands the main-repo scaffold and validator guardrails that Pack A
  depends on
- PR-3 finishes the full local checklist and negative examples once the shared
  baseline is stable

Pack A must not begin until PR-2 is merged or finalized locally.

## Status

| Item | Value |
| --- | --- |
| State | completed |
| Total PRs | 3 |
| Total phases | 5 |
| Completed | 1, 2, 3, 4, 5 |
| Remaining | none |
| Current / Next | pack complete |
| Blockers | none |

## Progress Update

- PR-1 merged in `../clawperator-skills` at `90f1e0ec77dec3b6ff587cb42265702627a7b6db`.
- Completed phases:
  - Phase 1 with commit `62e3894` `docs(skills): repair local authoring surface entrypoints`
  - Phase 2 with commit `c7ffa68` `docs(skills): route authoring entrypoints to main docs`
  - Phase 3 with commit `8a87e76` `fix(skills): harden skill authoring guardrails`
  - Phase 4 with commit `fdb039e` `docs(skills): cross-link runtime skill author guidance`
  - Phase 5 with commit `1552251` `docs(skills): codify runtime skill author checklist`
- PR-1 validations passed:
  - Phase 1 grep checks for migrated rule categories, `test_all.sh`, and findings sections
  - Phase 2 route checks, stale-reference checks, and `../clawperator-skills/docs/` absence check
  - `../clawperator-skills/scripts/test_all.sh`
  - `git diff --check` in both repos
- PR-2 validations passed so far:
- PR-2 validations passed:
  - `npm --prefix apps/node run build`
  - `npm --prefix apps/node run test`
  - `./scripts/docs_build.sh`
- PR-3 validations passed:
  - `../clawperator-skills/scripts/test_all.sh`
  - Phase 5 checklist grep check in `../clawperator-skills/AGENTS.md`
  - `git diff --check` in `../clawperator-skills`
- `tasks/skills/skill-creation-guidance/findings.md` contains the detailed decision log and validation results for all five phases.

## Hard Rules

- Do not spin this back out into a third prerequisite pack. The shared
  prerequisite work is Phase 1 through Phase 4 of this pack.
- Durable workflow and authoring docs live in `clawperator` under
  `docs/skills/`. Do not create `../clawperator-skills/docs/` in this pack.
  Repair skills-repo entrypoints by routing them to durable main-repo docs plus
  local checklist and test-entrypoint surfaces.
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
- Do not start PR-2 until PR-1 is merged or finalized locally. Do not start
  PR-3 until PR-2 is merged or finalized locally. Finalized locally means all
  phases in the prior PR have passing validation commands and `findings.md`
  records the decisions or results from each phase.
- Keep repo ownership strict: PR-1 and PR-3 change only
  `../clawperator-skills`, and PR-2 changes only `clawperator`. Do not mix both
  repos in one PR or commit.
- If execution changes a stable decision from the plan, update both
  `plan.md` and `work-breakdown.md` before continuing.
- Do not move to the next phase until the current phase validation passes and
  `findings.md` records the decision or result that justified the phase.
- Treat each phase acceptance as two-layer: the validation commands must pass,
  and a short human review must confirm output accuracy, scope completeness,
  evidence grounding, and format compliance for the surfaces changed in that
  phase.
- At least one reviewable commit per phase. Content-heavy phases may use
  draft-plus-refine commits inside the same phase, but do not batch material
  from later phases into an earlier phase commit.
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
| 14 | `docs/skills/authoring.md` | Durable main-repo authoring doc that the skills repo should route authors toward |
| 15 | `docs/skills/development.md` | Optional durable addendum if the workflow/testing guidance needs one more public landing spot |
| 16 | `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 4 |

## PR / Phase Plan

| PR | Repo | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- | --- |
| PR-1 | `../clawperator-skills` | Repair local author surface and route it to durable main-repo docs | 1, 2 | thinking, default | done locally |
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

Status: completed locally on 2026-04-19

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
3. Record the PR-1 repair path in `findings.md`: Phase 1 migrates the seed
   rules and keeps top-level routing truthful, and Phase 2 switches the final
   top-level links to durable main-repo docs plus the local checklist and test
   entrypoints.
4. If Phase 1 touches `README.md` or `AGENTS.md` before the final routing lands,
   keep that wording truthful: route readers toward `AGENTS.md`,
   `../clawperator-skills/scripts/test_all.sh`, and any already-valid
   main-repo docs destinations. Do not point at dead files or promise a local
   docs tree that will not exist.
5. Migrate the highest-value rules from
   `~/.clawperator/findings/skill-drafting/findings.md` into `AGENTS.md` as the
   seed author checklist.
6. Add a short explicit route from the top-level author surface to
   `../clawperator-skills/scripts/test_all.sh` so authors can discover the
   off-device test entrypoint immediately.
7. Record the exact Phase 2 routing destinations in `findings.md` so the next
   phase can switch links without re-deciding structure.
8. Keep the migration scoped: move the durable rules now, not the entire
   history of that file.

### Acceptance Criteria

- `findings.md` records the README-link problem, the chosen repair path, and
  the exact Phase 2 routing destinations
- `AGENTS.md` contains the migrated seed rules from the private findings file
- at least one top-level author surface points at
  `../clawperator-skills/scripts/test_all.sh`
- any Phase 1 top-level routing is truthful and does not point at missing local
  docs

### Validation

```bash
# Verify AGENTS.md has migrated rule categories for all six failure patterns
rg -n "resolveClawperatorBin|generated index|verification|diagnostic|parser|privacy" ../clawperator-skills/AGENTS.md
rg -n "test_all.sh" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
rg -n "README link decision|Current local author surface|Discoverability routes" tasks/skills/skill-creation-guidance/findings.md
```

### Expected Commit

```text
docs(skills): repair local authoring surface entrypoints
```

## Phase 2: Finalize Main-Repo Docs Routing And Clarify `skill-migration.md`

Status: completed locally on 2026-04-19

### Agent Tier

default

### Goal

Finalize the skills-repo top-level author routes so they point at durable
main-repo docs and the local checklist/test entrypoints, and make
`skill-migration.md` an explicitly secondary audit surface.

### Files or Surfaces To Change

- `../clawperator-skills/README.md`
- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/skill-migration.md`

### Steps

1. Replace any temporary Phase 1 routing in `README.md` or `AGENTS.md` with
   final links to durable main-repo docs under `docs/skills/`, using link forms
   that resolve from `clawperator-skills` rather than sibling-relative local
   paths.
2. Keep `AGENTS.md` as the local checklist and repo-conventions surface, and
   make `README.md` the top-level route that sends authors to:
   - durable main-repo workflow and runtime docs
   - `AGENTS.md` for local checklist and negative examples
   - `../clawperator-skills/scripts/test_all.sh` for the off-device Node-test
     entrypoint
   - `../clawperator-skills/scripts/generate_skill_indexes.sh` for generated
     registry/index refresh
3. Update `skill-migration.md` only enough to clarify that it is a migration and
   audit log, not the main contribution guide.
4. Make sure the final top-level routes introduce the authored-skill structure
   and testing model at a high level without inventing a new local docs home:
   - `run.js` stays thin when possible
   - extract testable off-device logic into importable modules
   - colocate `*.test.js` where `scripts/test_all.sh` can pick them up
   - live-device proof still applies to UI behavior
5. Record the final routing layout and any unresolved gaps in `findings.md`.

### Acceptance Criteria

- `README.md` and `AGENTS.md` point only at real, resolvable destinations and
  no longer rely on temporary Phase 1 routing
- `README.md` and `AGENTS.md` no longer promise or reference a nonexistent
  `../clawperator-skills/docs/` tree
- `skill-migration.md` no longer reads like the primary author workflow
- the top-level routes point to durable main-repo docs for workflow/runtime
  guidance instead of duplicating those contracts locally
- the top-level routes introduce the testing and structure model before the
  full checklist lands in PR-3
- the author path is reachable from the top-level skills-repo surfaces without
  repo archaeology

### Validation

```bash
[ ! -d ../clawperator-skills/docs ]
rg -n "skill-migration" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
rg -n "docs/skills/authoring|docs/skills/development|test_all.sh|generate_skill_indexes.sh" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
! rg -n "skill-development-workflow|skill-authoring-guidelines|device-prep-and-runtime-tips|../clawperator-skills/docs/" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md
../clawperator-skills/scripts/test_all.sh
```

### Expected Commit

```text
docs(skills): route authoring entrypoints to main docs
```

## Phase 3: Scaffold And Validator Guardrails

Status: completed locally on 2026-04-19

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
   the allowed values used by the repo. In this pack the target convention is
   `replay` and `orchestrated`, matching `docs/skills/authoring.md`, but the
   validator must preserve only one temporary compatibility exception for the
   one existing checked-in out-of-convention skill
   `au.com.polyaire.airtouch5.set-zone-state`. New or other `script` metadata
   must still fail until a cleanup follow-up lands.
3. Add an additive static check that detects stale generator-owned outputs from
   `../clawperator-skills/scripts/generate_skill_indexes.sh`. Base the check on
   real generated-artifact drift, not raw timestamp fields such as
   `generatedAt`, and make the failure message tell authors to rerun the
   generator.
4. Add regression coverage in `apps/node/src/test/unit/skills.test.ts`. Name
   and implement every case below before committing:
   - scaffold output contains `resolveClawperatorBin` and does not call the
     bare `"clawperator"` string directly
   - skill with missing `clawperator-skill-type` frontmatter → `validateSkill`
     returns a rejection that names the missing field
   - skill with an unrecognized `clawperator-skill-type` value → `validateSkill`
     returns a rejection that names the bad value
   - skill with a valid `clawperator-skill-type` (e.g., `"replay"`) →
     `validateSkill` passes that check
   - skill with a valid `clawperator-skill-type` of `"orchestrated"` →
     `validateSkill` also passes that check
   - the one existing checked-in out-of-convention skill
     `au.com.polyaire.airtouch5.set-zone-state` with
     `clawperator-skill-type: script` → allowlisted compatibility path still
     passes until a cleanup follow-up migrates it
   - a newly introduced or different skill with
     `clawperator-skill-type: script` → `validateSkill` rejects it
   - registry change without regenerated index → the freshness check returns a
     rejection that points to
     `../clawperator-skills/scripts/generate_skill_indexes.sh`
   - unchanged generated fixtures → the freshness check does not fail on
     timestamp-only churn
   - registry change with a regenerated index → the freshness check passes
5. Record the exact guardrails shipped in `findings.md`, including whether any
   live checked-in out-of-convention `clawperator-skill-type: script`
   instances still exist and what compatibility rule was chosen for them in
   this pack.

### Acceptance Criteria

- the scaffold output matches exemplar helper usage on `resolveClawperatorBin`
- `validateSkill.ts` rejects missing or invalid `clawperator-skill-type` and
  enforces `replay` / `orchestrated` as the active convention while preserving
  only the explicit temporary exception for
  `au.com.polyaire.airtouch5.set-zone-state`
- `validateSkill.ts` or its associated check rejects stale generated indexes
  with an actionable rerun message
- unit tests cover the new guardrails, including the no-op freshness case
- `findings.md` records the `script`-compatibility decision if any live
  checked-in out-of-convention instances still exist
- the documented boundary still makes clear that validator checks do not replace
  `scripts/test_all.sh` or live-device proof

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
# Verify the scaffold template source was updated
rg -n "resolveClawperatorBin" apps/node/src/domain/skills/scaffoldSkill.ts
rg -n "clawperator-skill-type|generate_skill_indexes.sh" apps/node/src/domain/skills/validateSkill.ts
```

### Expected Commit

```text
fix(skills): harden skill authoring guardrails
```

## Phase 4: Main-Repo Docs Alignment

Status: completed locally on 2026-04-19

### Agent Tier

default

### Goal

Make the main repo's public authoring docs the durable home for workflow and
testing guidance, and explain the validator-versus-checklist boundary without
copying the full local checklist into public docs.

### Files or Surfaces To Change

- `docs/skills/authoring.md`
- `docs/skills/development.md` only if needed

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the docs workflow.
2. In `docs/skills/authoring.md`, make the durable workflow and testing route
   explicit for runtime-skill authors and add clear links back to the
   skills-repo entrypoints they will actually use while editing that repo.
3. Make the public authoring page name the current host-visible discovery
   command for installed authoring workflows:
   `clawperator authoring-skills list`.
4. Explain the validator boundary using the specific checks shipped in Phase 3,
   and make the durable-doc split explicit:
   - `validateSkill` catches `clawperator-skill-type` frontmatter and stale
     generated indexes, but does not replace off-device tests or live proof
   - `../clawperator-skills/scripts/test_all.sh` is the skills-repo off-device
     test entrypoint
   - `docs/skills/authoring.md` owns the durable workflow/testing guidance
   - the local skills-repo checklist remains required for repo-specific
     truthfulness rules and author quality bar
   Do not duplicate the full PR-3 checklist or Phase 3 implementation details;
   point authors to `validateSkill` output and the local checklist where
   appropriate.
5. Touch `docs/skills/development.md` only if it needs one small cross-link for
   discoverability.
6. Record the public-doc link targets in `findings.md`.

### Acceptance Criteria

- `docs/skills/authoring.md` is a durable home for the workflow/testing route
  and points authors at the relevant skills-repo entrypoints
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

Status: completed locally on 2026-04-19

### Agent Tier

thinking

### Goal

Finish the local skills-repo quality bar by codifying the recurring
PR-hardening lessons and negative examples in a way authors can apply before
they open a PR.

### Files or Surfaces To Change

- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/README.md` only if small route wording needs alignment

### Steps

1. Promote the 13 PR-hardening lessons from the findings pass into the local
   checklist, with grouped rules and concrete negative examples. Record a
   one-to-one mapping in `findings.md` from each lesson or recurring failure
   pattern to the section that now owns it.
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
- `findings.md` records where each recurring lesson now lives
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
rg -n "Verification drift|Generated index drift|Shared helper bypass|Diagnostics|Parser ambiguity|Privacy|test_all.sh|node --test|live-device|run.js" ../clawperator-skills/AGENTS.md
```

### Expected Commit

```text
docs(skills): codify runtime skill author checklist
```
