## 2026-04-13 P1

- Phase: P1
- Changed: Added the two non-Solax baseline export fixtures, added five compare regression tests, renamed the Solax checkpoint constant, and made compare fail closed with `normalization_insufficient` plus `baselineCoverage`, `normalizationStrategy`, and `minimumSemanticCoverage` on every report.
- Validation: `npm --prefix apps/node run build`; `node --test dist/test/unit/recordingCompare.test.js` first failed for the expected missing outcome and missing report-field reasons, then passed after the implementation change; `npm --prefix apps/node run build && npm --prefix apps/node run test` passed; `grep -r "DEFAULT_BASELINE_CHECKPOINT_ORDER" apps/node/src/` returned 0 results; `grep -r "SOLAX_BASELINE_CHECKPOINT_ORDER" apps/node/src/` returned 3 matches.
- Discovered: The direct compare test must be rerun only after the fresh build completes or it can exercise stale compiled output.
- Decision: Do now for the engine/report changes; defer semantic-coverage outcomes and cross-repo structural sync to P2.
- Follow-up: P2 will add `baseline_uncovered`, `baseline_weakly_covered`, semantic coverage policy enforcement, and the opt-in structural cross-repo sync test.

## 2026-04-13 P2

- Phase: P2
- Changed: Added zero-coverage and single-coverage semantic fixtures plus the saved-wrapper CLI fixture, enforced semantic fail-closed outcomes with `baseline_uncovered` and `baseline_weakly_covered`, and added the opt-in structural cross-repo sync guard that compares normalized baseline structure and compare behavior instead of raw JSON bytes.
- Validation: `npm --prefix apps/node run build`; `node --test dist/test/unit/recordingCompare.test.js` first failed for the expected semantic-permissiveness reasons, then passed after the `determineOutcome` change; `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills node --test dist/test/unit/recordingCompare.test.js` passed once the sync test resolved relative paths against the repo root; `npm --prefix apps/node run build && npm --prefix apps/node run test` failed once on an unrelated flaky `skills.test.js` timeout assertion, that assertion passed immediately in isolation, and the full command then passed on rerun.
- Discovered: The task-pack example `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills npm --prefix apps/node run test` only works if the sync test resolves relative skills-root input against the Clawperator repo root rather than `apps/node`.
- Decision: Do now, because the opt-in sync guard needed to match the documented validation path to be supportable.
- Follow-up: P3 will update CLI/help/docs wording so the shipped Solax-specific path and the new fail-closed outcomes are documented honestly.

## 2026-04-13 P3

- Phase: P3
- Changed: Updated `docs/api/recording.md` to document the Solax-only normalization scope, new outcomes, semantic coverage policy, report fields, and the real Solax proving-skill example; updated `docs/skills/authoring.md` with the cross-repo sync note and fixture-backed trust-bar wording; updated `apps/node/src/cli/registry.ts` help text so `recording compare` states the shipped Solax heuristic scope honestly.
- Validation: `./scripts/docs_build.sh` passed; `grep -n "Solax" apps/node/src/cli/registry.ts` returned the new help note; `grep -c "normalization_insufficient" docs/api/recording.md` returned `5`; `grep -c "baseline_uncovered" docs/api/recording.md` returned `3`; `grep -c "baseline_weakly_covered" docs/api/recording.md` returned `3`; `grep -c "com.example.demo.capture-state" docs/api/recording.md` returned `0`; `grep -c "CLAWPERATOR_SKILLS_ROOT" docs/skills/authoring.md` returned `1`.
- Discovered: The docs build regenerated `sites/docs/static/llms-full.txt` and `sites/landing/public/llms-full.txt`; no manual edits were needed in generated staging pages.
- Decision: Commit the authored doc updates together with the regenerated `llms-full.txt` artifacts so the docs projection stays aligned with the new wording.
- Follow-up: P4 is verification only.
