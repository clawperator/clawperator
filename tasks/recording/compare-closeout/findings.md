## 2026-04-13 P1

- Phase: P1
- Changed: Added the two non-Solax baseline export fixtures, added five compare regression tests, renamed the Solax checkpoint constant, and made compare fail closed with `normalization_insufficient` plus `baselineCoverage`, `normalizationStrategy`, and `minimumSemanticCoverage` on every report.
- Validation: `npm --prefix apps/node run build`; `node --test dist/test/unit/recordingCompare.test.js` first failed for the expected missing outcome and missing report-field reasons, then passed after the implementation change; `npm --prefix apps/node run build && npm --prefix apps/node run test` passed; `grep -r "DEFAULT_BASELINE_CHECKPOINT_ORDER" apps/node/src/` returned 0 results; `grep -r "SOLAX_BASELINE_CHECKPOINT_ORDER" apps/node/src/` returned 3 matches.
- Discovered: The direct compare test must be rerun only after the fresh build completes or it can exercise stale compiled output.
- Decision: Do now for the engine/report changes; defer semantic-coverage outcomes and cross-repo structural sync to P2.
- Follow-up: P2 will add `baseline_uncovered`, `baseline_weakly_covered`, semantic coverage policy enforcement, and the opt-in structural cross-repo sync test.
