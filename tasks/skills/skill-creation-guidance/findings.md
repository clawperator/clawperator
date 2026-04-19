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

- Phase 3 shipped these guardrails in `clawperator`:
  - `scaffoldSkill.ts` now emits exemplar-style helper usage with
    `resolveClawperatorBin` and `resolveOperatorPackage` instead of calling the
    bare `"clawperator"` string directly
  - scaffolded `SKILL.md` files now include
    `clawperator-skill-type: replay` in frontmatter so the low-level scaffold
    stays immediately valid under the active convention
  - `validateSkill.ts` now rejects missing `clawperator-skill-type` frontmatter
  - `validateSkill.ts` now rejects unsupported `clawperator-skill-type` values
    and enforces `replay` and `orchestrated` as the active convention
  - the only temporary compatibility path preserved is
    `au.com.polyaire.airtouch5.set-zone-state` with
    `clawperator-skill-type: script`
  - `validateSkill.ts` now checks generator-owned outputs for stale registry
    drift when the repo contains `scripts/generate_skill_indexes.sh`
  - generated-index freshness ignores timestamp-only churn such as
    `generatedAt`
  - bundled Node test fixtures that exercise validation and skill execution now
    carry explicit `clawperator-skill-type` frontmatter so the new validation
    floor does not force unrelated run-path tests through a false failure mode

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
- Phase 3 regression coverage now explicitly proves:
  - scaffold output contains `resolveClawperatorBin`
  - missing and invalid `clawperator-skill-type` fail validation
  - `replay` and `orchestrated` pass validation
  - the one allowlisted `script` skill still passes while other `script` values fail
  - stale generated indexes fail validation with a rerun message
  - timestamp-only generated drift does not fail freshness checks
- Phase 5 codifies the full local testing matrix in `../clawperator-skills/AGENTS.md`:
  - pure off-device JS logic must add or update colocated `*.test.js` and run
    `./scripts/test_all.sh`
  - shell wrapper changes must run shell syntax checks
  - authored-skill changes must run
    `clawperator skills validate <skill_id> --dry-run`
  - registry-linked metadata changes must run
    `./scripts/generate_skill_indexes.sh`
  - selector, navigation, checkpoint, compare-baseline, recording, and terminal
    verification changes still require live-device proof

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
- Phase 4 public-doc routes now in place:
  - `docs/skills/authoring.md` names `clawperator authoring-skills list --json`
    as the host-visible authoring-workflow discovery command
  - `docs/skills/authoring.md` points runtime-skill authors back to the
    `clawperator-skills` `README.md` and `AGENTS.md` entrypoints
  - `docs/skills/authoring.md` points authors to
    `./scripts/test_all.sh` for off-device JS tests and
    `./scripts/generate_skill_indexes.sh` for registry-linked refresh work
  - public docs now explain that `skills validate` is the static gate, not the
    whole testing story

## Validation commands

- `rg -n "resolveClawperatorBin|generated index|verification|diagnostic|parser|privacy" ../clawperator-skills/AGENTS.md`
- `rg -n "test_all.sh" ../clawperator-skills/README.md ../clawperator-skills/AGENTS.md`
- `rg -n "README link decision|Current local author surface|Discoverability routes" tasks/skills/skill-creation-guidance/findings.md`
- `git diff --check` in `../clawperator-skills`
- `git diff --check` in `clawperator`
- `npm --prefix apps/node run build`
- `npm --prefix apps/node run test`
- `rg -n "resolveClawperatorBin" apps/node/src/domain/skills/scaffoldSkill.ts`
- `rg -n "clawperator-skill-type|generate_skill_indexes.sh" apps/node/src/domain/skills/validateSkill.ts`

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

Phase 3 validation result on 2026-04-19:

- `npm --prefix apps/node run build` passed.
- `npm --prefix apps/node run test` passed with 1067 tests green.
- Verified scaffold source now contains `resolveClawperatorBin`.
- Verified validator source now contains both `clawperator-skill-type` and
  `generate_skill_indexes.sh` checks.
- `git diff --check` passed before the Phase 3 commit path.

Phase 4 validation result on 2026-04-19:

- `./scripts/docs_build.sh` passed end to end.
- Human review confirmed `docs/skills/authoring.md` now points authors to the
  `clawperator-skills` README, AGENTS checklist, `test_all.sh`, and
  `generate_skill_indexes.sh` without duplicating the full local checklist.
- Human review confirmed the public page names
  `clawperator authoring-skills list --json` as the current host-visible
  discovery surface and explains the validator-versus-checklist boundary using
  the Phase 3 guardrails.

Phase 5 validation result on 2026-04-19:

- `../clawperator-skills/scripts/test_all.sh` passed with 14 tests green.
- The required grep check passed for:
  - `Verification drift`
  - `Generated index drift`
  - `Shared helper bypass`
  - `Diagnostics`
  - `Parser ambiguity`
  - `Privacy`
  - `test_all.sh`
  - `node --test`
  - `live-device`
  - `run.js`
- `git diff --check` passed in `../clawperator-skills`.
- Human review confirmed `AGENTS.md` now:
  - distinguishes mechanical validator guardrails from author-only checklist work
  - defines when to add colocated `*.test.js`
  - names `skills/utils/common.test.js` and `amazon_parser.test.js` as the
    structure examples
  - includes sanitized negative examples for each recurring failure pattern

## Observations

- `../clawperator-skills` already had uncommitted Phase 1-aligned edits in
  `README.md` and `AGENTS.md` when this execution started. Those edits were
  treated as in-flight work to refine, not as unrelated changes to revert.
- The pack uses `findings.md` in `clawperator` as the execution log while PR-1
  ownership stays with `../clawperator-skills`. For now this log is treated as
  execution bookkeeping rather than a PR-1 content surface.
- Phase 5 lesson-to-section ownership in `../clawperator-skills/AGENTS.md`:
  - lesson 1 and recurring failure pattern 1 -> `Verification drift`
  - lesson 2 and recurring failure pattern 2 -> `Generated index drift`
  - lesson 3 and recurring failure pattern 3 -> `Shared helper bypass`
  - lessons 4, 5, 7, and 12 and recurring failure pattern 4 ->
    `Diagnostics Truthfulness`
  - lessons 6, 8, 9, 10, and 11 and recurring failure pattern 5 ->
    `Parser ambiguity and robustness`
  - lesson 13 and recurring failure pattern 6 -> `Privacy Hygiene`
  - structure guidance for extracted logic and colocated tests ->
    `Structure Rule: Keep run.js Thin`
  - testing-matrix ownership -> `Testing Matrix`,
    `Mechanical Guardrails Versus Author Checklist`, and
    `Validation Checklist`

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
- Phase 3 widened the touched file set beyond the three headline implementation
  files because bundled Node test fixtures needed `SKILL.md` frontmatter to
  stay truthful under the new validator rule. That fixture update is part of
  keeping the regression suite aligned with shipped behavior, not a plan change.

## Deferred follow-up

- The separate `tasks/skills/agent-assisted-skill-drafting/` pack remains
  intentionally out of scope for this execution.
- The one legacy compatibility exception for
  `au.com.polyaire.airtouch5.set-zone-state` still needs its own cleanup pass
  if the repo wants to retire `clawperator-skill-type: script` completely.
