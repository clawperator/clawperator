# Skill Creation Guidance Findings

## Goal

Start `tasks/skills/skill-creation-guidance/` by repairing the local
author-surface truth in `../clawperator-skills`, migrating the highest-value
private drafting rules into repo-owned guidance, and recording the exact
follow-up routing decisions needed for Phase 2.

## Current local author surface

- `../clawperator-skills/README.md` previously promised a local `docs/` author
  surface that is absent in this checkout.
- Missing local-doc destinations verified during Phase 1:
  - `docs/skill-development-workflow.md`
  - `docs/skill-authoring-guidelines.md`
  - `docs/device-prep-and-runtime-tips.md`
  - `docs/blocked-terms-policy.md`
- `../clawperator-skills/AGENTS.md` already held some repo-local conventions,
  but it did not yet carry the seed drafting rules migrated from
  `~/.clawperator/findings/skill-drafting/findings.md`.
- The top-level repo surfaces needed an immediate truthful route to the local
  checklist seed, `scripts/test_all.sh`, and main-repo contract docs without
  promising a local docs tree that this pack will not create.

## README link decision

- Durable workflow and authoring docs stay in `clawperator` under `docs/skills/`.
- Phase 1 keeps top-level routing truthful without introducing final
  cross-repo link structure:
  - `README.md` points authors to `AGENTS.md`
  - `README.md` points authors to `scripts/test_all.sh`
  - `README.md` points authors to `scripts/generate_skill_indexes.sh`
  - `README.md` keeps the already-valid main-repo docs references
- Phase 2 final routing decision:
  - `README.md` now routes authors to `https://github.com/clawperator/clawperator/blob/main/docs/skills/authoring.md`
  - `README.md` now routes authors to `https://github.com/clawperator/clawperator/blob/main/docs/skills/development.md`
  - local `AGENTS.md` for the repo checklist and negative examples
  - local `scripts/test_all.sh` for off-device Node tests
  - local `scripts/generate_skill_indexes.sh` for registry and generated-index refresh
  - `skill-migration.md` only as a secondary migration and audit log

## Migrated rules

- Verification claims must stay truthful. Use `verification: null` when the
  runtime cannot actually prove the declared matcher path.
- Registry-linked skill changes must regenerate generated indexes in the same
  change.
- Shared helper resolution should prefer `skills/utils/common.js`, especially
  `resolveClawperatorBin` and `resolveOperatorPackage`, over copied ad hoc
  precedence logic.
- Diagnostics must describe only state that is still true when emitted and must
  not smuggle raw stdout or stderr blobs into `error.message`.
- Parsers, screenshot decoders, and image math must be explicit, narrow, and
  defensive around malformed inputs.
- Privacy hygiene applies to code, examples, retained artifacts, PR bodies,
  comments when practical, and commit messages.

## Mechanical guardrails shipped

- None in Phase 1.
- Phase 1 records the intended Phase 3 guardrail scope only:
  - scaffold output should use `resolveClawperatorBin`
  - static validation should cover `clawperator-skill-type`
  - static validation should cover generated-index freshness without failing on
    timestamp-only churn

## Testing matrix decisions

- Phase 1 seed guidance now routes authors to `./scripts/test_all.sh` when a
  change adds or modifies pure off-device JS logic.
- Phase 1 retains `./scripts/generate_skill_indexes.sh` as the required refresh
  path for registry-linked metadata changes.
- Shell syntax checks remain part of the local validation checklist.
- Phase 2 now introduces the high-level structure rule in top-level skills-repo
  surfaces:
  - keep `scripts/run.js` thin when possible
  - extract testable off-device logic into importable modules
  - colocate `*.test.js` where `./scripts/test_all.sh` can find them
  - keep live-device proof for UI-behavior changes
- The full authored-skill testing matrix still belongs to later phases:
  colocated `*.test.js` expectations, `skills validate`, and live-device proof
  boundaries are not fully closed in Phase 1.

## Discoverability routes

- Phase 1 truthful routes:
  - `../clawperator-skills/README.md`
  - `../clawperator-skills/AGENTS.md`
  - `../clawperator-skills/scripts/test_all.sh`
  - `../clawperator-skills/scripts/generate_skill_indexes.sh`
  - existing main-repo docs references in the top-level skills-repo surfaces
- Phase 2 final routes now in place:
  - README routes to durable main-repo docs plus local checklist and test entrypoints
  - AGENTS stays the local checklist surface and points back to the durable main-repo docs
  - `skill-migration.md` is explicitly secondary to README and AGENTS

## Validation commands

- `rg -n "resolveClawperatorBin|generated index|verification|diagnostic|parser|privacy" ../clawperator-skills/AGENTS.md`
- `rg -n "test_all.sh" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md`
- `rg -n "README link decision|Current local author surface|Discoverability routes" tasks/skills/skill-creation-guidance/findings.md`
- `git diff --check` in `../clawperator-skills`
- `git diff --check` in `clawperator`

Phase 1 validation result on 2026-04-19:

- All three phase validation `rg` checks passed.
- `git diff --check` passed in both repositories.
- Human review confirmed the Phase 1 surfaces no longer point at missing local
  docs and now expose `scripts/test_all.sh` from a top-level author surface.

Phase 2 validation result on 2026-04-19:

- Verified `../clawperator-skills/docs/` does not exist.
- Verified README and AGENTS now reference `skill-migration.md` only as a
  secondary migration and audit surface.
- Verified README and AGENTS route to durable main-repo docs plus local
  `test_all.sh` and `generate_skill_indexes.sh` entrypoints.
- Verified the old missing local-doc names no longer appear in README or AGENTS.
- `../clawperator-skills/scripts/test_all.sh` passed with 14 tests green.
- `git diff --check` passed in both repositories after the Phase 2 edits.

## Observations

- `../clawperator-skills` already had uncommitted Phase 1-aligned edits in
  `README.md` and `AGENTS.md` when this execution started. Those edits were
  treated as in-flight work to refine, not as unrelated changes to revert.
- The pack uses `findings.md` in `clawperator` as the execution log while PR-1
  ownership stays with `../clawperator-skills`. For now this log is treated as
  execution bookkeeping rather than a PR-1 content surface.

## Problems encountered

- The pack has one scope ambiguity: Phase 1 requires maintaining
  `tasks/skills/skill-creation-guidance/findings.md` in `clawperator`, while
  the PR table also says PR-1 should change only `../clawperator-skills`.
  Current working assumption: keep `findings.md` updated locally as the phase
  decision record, but keep the reviewable PR-1 content changes in the skills repo.
- Existing Phase 1 wording in `README.md` and `AGENTS.md` still implied a local
  docs restoration path. That wording needed refinement to stay consistent with
  the stable plan decision not to create `../clawperator-skills/docs/`.
- No Phase 2 code or docs blocker surfaced once the final routing destinations
  were made explicit.

## Deferred follow-up

- Phase 3 should add the scaffold and validator guardrails without widening into
  runtime parser enforcement.
- Phase 5 should expand the local checklist into the full testing matrix and
  negative-example guidance.
