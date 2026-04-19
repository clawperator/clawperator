# Skill Creation Guidance And Guardrails

## Executive Summary

This pack is the durable guidance half of the authorship work, and it also
absorbs the small shared prerequisite that the compiled findings originally
called Pack 0. The job is twofold:

- repair the local skills-repo author surfaces and migrate the private findings
  into repo-owned guidance
- add the low-risk mechanical guardrails that keep new authored skills from
  starting one review cycle behind

This is a 3 PR, 5 phase pack across `../clawperator-skills` and
`clawperator`. PR-1 repairs and restores the local skills-repo author surface.
PR-2 lands the main-repo scaffold and validator guardrails that Pack A depends
on. PR-3 codifies the full local author checklist and negative examples once
the shared baseline is stable.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 3 |
| Total phases | 5 |
| Completed | none |
| Remaining | 1, 2, 3, 4, 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this pack ships, runtime-skill authors working in
`../clawperator-skills` have a truthful local authoring surface, the most
repeated static mistakes are mechanically blocked in `clawperator`, and the
repo no longer depends on `~/.clawperator/findings/skill-drafting/findings.md`
as the de facto source of author guidance.

## Why Now

The findings pass showed a repeated pattern: the core runtime contracts and the
best design notes live in `clawperator`, but the place authors actually work is
`../clawperator-skills`. Today that repo advertises missing docs, has a thinner
local checklist than the review burden demands, and leaves authors to learn the
quality bar from exemplars, review comments, and private findings. That is
workable for maintainers and brittle for everyone else.

## In Scope

- Restore a truthful local authoring surface in `../clawperator-skills`
- Keep `../clawperator-skills/docs/` as the local guidance home; do not solve
  the broken README by deleting the promises without replacement
- Migrate the high-signal content from
  `~/.clawperator/findings/skill-drafting/findings.md` into repo-owned guidance
- Clarify the role of `../clawperator-skills/skill-migration.md`
- Align `scaffoldSkill.ts` with exemplar helper usage by using
  `resolveClawperatorBin`
- Add low-risk static guardrails in `validateSkill.ts` for:
  - `clawperator-skill-type` frontmatter presence and allowed values
  - generated-index freshness after registry changes
- Add or update regression coverage for the new mechanical checks
- Define the runtime-skill testing policy in the skills repo, including:
  - when authored changes must add colocated Node tests that run under
    `../clawperator-skills/scripts/test_all.sh`
  - when shell syntax checks are required
  - when `clawperator skills validate` is required
  - when live-device proof is still mandatory
- Define the authored-skill structure guidance needed to make off-device logic
  testable, including when to extract logic from `run.js` into testable modules
- Cross-link the main repo docs to the restored local author-guidance surface
- Codify the recurring PR-hardening lessons and negative examples in the skills
  repo

## Out of Scope

- The new discovery-first authoring workflow tracked in
  `tasks/skills/agent-assisted-skill-drafting/`
- New runtime verification kinds or changes to `SkillResult`
- Runtime parser hardening beyond the static checks named above
- Rewriting every public doc in `docs/skills/`
- Authoring new runtime skills as part of the guidance work

## Existing Artifact Scope

- `../clawperator-skills/README.md`: fully in scope to repair broken local-doc
  promises and point authors at the right local guidance home
- `../clawperator-skills/AGENTS.md`: fully in scope for the local authoring
  checklist, rule migration, and negative examples
- `../clawperator-skills/docs/`: in scope to restore or rewrite the local docs
  trio as durable, current guidance
- `../clawperator-skills/skill-migration.md`: in scope only to clarify and
  document its role; do not turn it into the main author workflow
- `../clawperator-skills/scripts/test_all.sh`: in scope as the canonical
  skills-repo off-device test entrypoint; document and adjust it only if the
  current `node --test` discovery surface is insufficient for the chosen test
  layout
- `apps/node/src/domain/skills/scaffoldSkill.ts`: in scope for helper alignment
  only; do not redesign the entire scaffold
- `apps/node/src/domain/skills/validateSkill.ts`: in scope for additive static
  checks only; do not widen this pack into runtime parser concerns
- `docs/skills/authoring.md`: in scope only for cross-links and guardrail
  references; do not rewrite the whole public authoring guide

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `../clawperator-skills/README.md` | Repair local author-surface links and routing | PR-1 / Phases 1, 2 |
| `../clawperator-skills/AGENTS.md` | Seed rule migration, then full checklist and negative examples | PR-1 / Phase 2, PR-3 / Phase 5 |
| `../clawperator-skills/docs/skill-development-workflow.md` | Restored local development workflow | PR-1 / Phase 2 |
| `../clawperator-skills/docs/skill-authoring-guidelines.md` | Restored local quality-bar guidance | PR-1 / Phase 2, PR-3 / Phase 5 |
| `../clawperator-skills/docs/device-prep-and-runtime-tips.md` | Restored local runtime/device prep guidance | PR-1 / Phase 2 |
| `../clawperator-skills/skill-migration.md` | Clarify role only | PR-1 / Phase 2 |
| `../clawperator-skills/scripts/test_all.sh` | Canonical off-device test entrypoint for authored logic | PR-1 / Phase 2, PR-3 / Phase 5 |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | Use shared helper pattern in scaffold output | PR-2 / Phase 3 |
| `apps/node/src/domain/skills/validateSkill.ts` | Additive static authoring guardrails | PR-2 / Phase 3 |
| `apps/node/src/test/unit/skills.test.ts` | Regression coverage for new validator rules | PR-2 / Phase 3 |
| `docs/skills/authoring.md` | Cross-link local guidance and validator boundary | PR-2 / Phase 4 |
| `docs/skills/development.md` | Cross-link author checklist only if needed | PR-2 / Phase 4 |
| `tasks/skills/skill-creation-guidance/findings.md` | Execution-time decisions, validations, and deferred follow-up | All phases |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Baseline problem statement | `tasks/skills/authorship/findings-compiled.md` |
| Current skills-repo author surface | `../clawperator-skills/README.md`, `../clawperator-skills/AGENTS.md` |
| Current skills-repo regeneration contract | `../clawperator-skills/scripts/generate_skill_indexes.sh` |
| Current skills-repo off-device test entrypoint | `../clawperator-skills/scripts/test_all.sh` |
| Existing colocated test patterns | `../clawperator-skills/skills/utils/common.test.js`, `../clawperator-skills/skills/com.amazon.mShop.android.shopping.search-products/scripts/amazon_parser.test.js` |
| Current local migration/audit surface | `../clawperator-skills/skill-migration.md` |
| Private findings that must become durable | `~/.clawperator/findings/skill-drafting/findings.md` |
| Scaffold output behavior | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Static validator behavior | `apps/node/src/domain/skills/validateSkill.ts`, `apps/node/src/test/unit/skills.test.ts` |
| Public authoring docs that should cross-link rather than duplicate | `docs/skills/authoring.md`, `docs/skills/development.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Fold the shared prerequisite into this pack. Do not create a third pack.
- Keep `../clawperator-skills/docs/` as the local author-guidance home. Repair
  the README by restoring a truthful local docs surface, not by removing local
  guidance entirely.
- Migrate the high-value rules from
  `~/.clawperator/findings/skill-drafting/findings.md` into
  `../clawperator-skills/AGENTS.md` before expanding the broader checklist.
- `../clawperator-skills/scripts/test_all.sh` is the canonical off-device test
  entrypoint for the skills repo. Local guidance must tell authors to use it,
  not to invent one-off ad hoc test commands.
- Pure off-device logic changes under `skills/**/scripts/*.js` or
  `skills/utils/*.js` must add or update colocated `*.test.js` coverage so
  `node --test` picks them up through `scripts/test_all.sh`.
- `run.js` should stay as thin orchestration when possible. If a skill adds
  parsing, normalization, argument handling, or output-shaping logic that can
  run off-device, extract that logic into a testable module and cover it with a
  colocated `*.test.js`.
- Shell wrappers must at minimum pass the repo shell syntax check. Shell syntax
  checks do not replace Node tests for JS logic or live proof for UI behavior.
- Live-device proof remains mandatory for selector, navigation, recording,
  checkpoint, compare-baseline, and terminal-verification changes even when
  off-device tests also exist.
- Skills-repo guidance must define a clear test matrix for authored changes:
  off-device tests, shell syntax, `skills validate`, and live proof.
- `scaffoldSkill.ts` must emit `resolveClawperatorBin` usage so the scaffold
  matches exemplar practice.
- `validateSkill.ts` must add only the named static checks:
  `clawperator-skill-type` frontmatter and generated-index freshness.
- Do not widen this pack into runtime parser enforcement or new verification
  semantics.
- `skill-migration.md` remains an active migration and audit log, not the
  primary authoring front door.

**Judgment required:**

- How much of the historical deleted docs can be reused verbatim versus
  rewritten for current behavior
- The exact structure of the local checklist and negative examples
- Whether `docs/skills/development.md` needs a small cross-link in addition to
  `docs/skills/authoring.md`

## Decision Rules

| Question | Rule |
| --- | --- |
| How do we repair the README's missing local-doc links? | Restore a truthful local docs trio in `../clawperator-skills/docs/` and point the README and `AGENTS.md` at it. |
| Where do the migrated private findings live first? | `../clawperator-skills/AGENTS.md` as the local checklist seed. |
| What is `skill-migration.md` after this pack? | An active migration and audit log, not the primary contribution guide. |
| What is the canonical off-device test entrypoint for authored skill logic? | `../clawperator-skills/scripts/test_all.sh`. Guidance must route authors there explicitly. |
| When must an authored skill change add a colocated `*.test.js`? | When the change adds or modifies pure off-device JS logic such as parsers, normalizers, argument handling, helper resolution, or output shaping. |
| When is live-device proof still mandatory? | For selector, navigation, recording, artifact-compare, checkpoint, or terminal-verification behavior, regardless of off-device tests. |
| How should skills be structured when they need tests? | Keep `run.js` thin and extract testable logic into importable modules under `skills/**/scripts/` or `skills/utils/`, with colocated `*.test.js` files discoverable by `node --test`. |
| Which mechanical checks belong in this pack? | Only `clawperator-skill-type` frontmatter and generated-index freshness. |
| What helper pattern must the scaffold follow? | `resolveClawperatorBin`, matching the exemplar skills. |
| When can Pack A begin? | After this pack's PR-2 is merged or landed locally. |

## Failure Modes To Prevent

- README still points at missing local docs after the pack is complete
- The skills repo keeps depending on a private home-directory findings file for
  its real author guidance
- The guidance still leaves authors guessing whether a change needs
  `scripts/test_all.sh`, shell syntax checks, `skills validate`, live proof, or
  some combination
- Authors keep embedding parser or normalization logic directly in `run.js`
  without extracting a testable module and colocated `*.test.js`
- The scaffold continues to disagree with the exemplar helper pattern
- The validator grows into runtime parser or verification-contract work
- Local guidance duplicates the main runtime contracts and immediately starts to
  drift
- Pack A starts before the shared prerequisite and mechanical guardrails are in
  place

## Output Contract

After PR-1:

- `../clawperator-skills/README.md` points at a real local docs surface
- `../clawperator-skills/docs/` contains a restored current authoring surface
- `../clawperator-skills/AGENTS.md` contains the migrated seed rules
- local guidance names `../clawperator-skills/scripts/test_all.sh` as the
  canonical off-device test entrypoint
- `skill-migration.md` has an explicit, limited role

After PR-2:

- the scaffold matches exemplar helper usage
- `validateSkill.ts` rejects missing or invalid `clawperator-skill-type`
- the repo catches stale generated indexes after registry changes
- main repo public docs point authors at the restored local guidance without
  duplicating the contract surface

After PR-3:

- the local checklist and negative examples cover the recurring PR-hardening
  lessons from the findings pass
- the local checklist defines a testing and structure matrix that tells authors
  when to add colocated `*.test.js`, when shell syntax is sufficient, when
  `skills validate` is required, and when live-device proof is still mandatory
- authors working in `../clawperator-skills` can learn the quality bar locally
  before opening a PR

## Idempotency

- Re-running local-doc link checks should continue to resolve every README and
  guidance link
- Re-running the scaffold after Phase 3 should continue to emit the same helper
  pattern
- Re-running the validator on unchanged skills should produce stable results

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Local runtime-skill author checklist | `../clawperator-skills/AGENTS.md` |
| Local workflow and prep guidance | `../clawperator-skills/docs/` |
| Skills-repo test entrypoint and authored-test policy | `../clawperator-skills/scripts/test_all.sh`, `../clawperator-skills/AGENTS.md`, `../clawperator-skills/docs/skill-authoring-guidelines.md` |
| Static authoring guardrails | `apps/node/src/domain/skills/scaffoldSkill.ts`, `apps/node/src/domain/skills/validateSkill.ts`, and tests |
| Public pointers back to the local guidance surface | `docs/skills/authoring.md`, and `docs/skills/development.md` only if needed |
