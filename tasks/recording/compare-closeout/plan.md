# Recording Compare Closeout

## Executive Summary

Close the remaining gaps in the W4 `recording compare` implementation before
the branch is PR-ready. The core compare engine (file loading, CLI surface,
divergence finding, exit codes) is sound. Four design-level gaps remain:

1. Heuristic normalization is Solax-specific but not fail-closed for
   non-Solax baselines.
2. Semantic compare is too permissive: any agent-driven run with verified
   terminal state is compare-success even when baseline coverage is too weak
   to be a trustworthy signal.
3. Cross-repo baseline drift between the canonical skills-repo retained
   baseline and the Clawperator test fixture has no mechanical check.
4. The current sync-check idea is too brittle if it compares raw JSON
   artifacts instead of structural compare behavior.

This task fixes all four at the engine level, not just in docs. Docs are
updated to match the corrected behavior.

Total PRs: 1. Total phases: 4. All work is on the existing
`skills/compare` branch in the Clawperator repo. No skills-repo source edit
is required for closeout; the canonical retained baseline is read as
validation input only.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1, P2, P3, P4 |
| Current / Next | P1 |
| Blockers | none |

## Goal

Make the `skills/compare` branch honestly PR-ready by fixing four concrete
engine-level problems found during EM-level review:

1. Heuristic normalization must be fail-closed: if the Solax-specific
   heuristics do not extract all 4 expected checkpoints, compare refuses
   with a typed outcome instead of proceeding with a partial or misleading
   baseline.
2. Semantic compare must require meaningful baseline-checkpoint coverage:
   an agent-driven run that claims terminal verification but covers only a
   trivial slice of the baseline must not be classified as success.
3. Cross-repo baseline drift must have a mechanical check, not just a
   documentation note.
4. The mechanical sync check must compare durable structure, not raw file
   bytes or session-level incidental metadata.

Plus honest docs framing and test coverage for the new behavior.

## Why Now

The compare branch has 5 commits of working implementation, live-proved
against Solax replay and orchestrated runs. Tests pass. Docs build succeeds.
But EM review found four design-level gaps that make the tool misleading
for non-Solax baselines and overly permissive for agent-driven runs. These
gaps must be closed at the engine level before the branch can be reviewed
as a PR.

## In Scope

- fail-closed normalization guard requiring all 4 Solax heuristic checkpoints
- new `normalization_insufficient` outcome for baselines where heuristic
  normalization cannot extract the full expected checkpoint set
- baseline-coverage computation in the compare report
- new `baseline_uncovered` outcome for semantic mode where terminal
  verification passed but zero baseline checkpoints appeared in the actual
  run
- new `baseline_weakly_covered` outcome for semantic mode where terminal
  verification passed but baseline coverage is nonzero yet below the
  minimum trusted threshold
- `normalizationStrategy` field in the report so consumers know which
  normalization path was used
- `minimumSemanticCoverage` field in the report so consumers can see the
  policy the engine applied
- rename of `DEFAULT_BASELINE_CHECKPOINT_ORDER` to
  `SOLAX_BASELINE_CHECKPOINT_ORDER`
- CLI-path tests for the new fail-closed outcomes and exit-code behavior
- opt-in cross-repo baseline sync test
- honest normalization scope qualification in `docs/api/recording.md`
- cross-repo sync note in `docs/skills/authoring.md`
- new outcomes documented in `docs/api/recording.md`
- docs-site rebuild

## Out of Scope

- making normalization pluggable or configurable (follow-on)
- per-skill declared checkpoint baselines (follow-on)
- changing the CLI surface or flag set
- changing the exit-code contract for USAGE responses
- changing the compare engine logic for outcomes that already work
  correctly (literal_match, semantic_match, baseline_drift,
  verification_failed, verification_indeterminate, upstream_failure,
  runtime_poisoned, runtime_unavailable)
- skills-repo source edits

## Existing Artifact Scope

This task edits artifacts that already exist on the `skills/compare` branch.

Existing content preserved as-is:

- all existing fixture files under
  `apps/node/src/test/fixtures/recording-compare/`
- all existing test cases in `recordingCompare.test.ts`
- the CLI registration in `registry.ts`
- the `cmdRecordCompare` handler in `record.ts`
- `loadRecordingExportBaselineFile` and `loadSkillResultFromSkillsRunFile`
- `findFirstDivergence` and `comparableActualCheckpoints`
- `inferredCompareMode` and `terminalVerificationStatus`

Existing content modified:

- `RecordingCompareOutcome` type union: three new members added
- `RecordingCompareReport` interface: three new fields added
- `compareRecordingBaselineWithSkillResult`: normalization guard and
  baseline-coverage computation added
- `determineOutcome`: baseline-coverage thresholds added for semantic mode
- `isMeaningfulCompareDivergence`: three new outcomes handled
- `summarizeOutcome`: three new cases added
- `normalizeRecordingExportForCompare`: constant renamed, no logic change
- `docs/api/recording.md`: normalization scope, new outcomes, example fix
- `docs/skills/authoring.md`: cross-repo sync note

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/domain/recording/compareRecording.ts` | Clawperator repo | normalization guard, coverage computation, new outcomes |
| `apps/node/src/test/unit/recordingCompare.test.ts` | Clawperator repo | new test cases |
| `apps/node/src/test/fixtures/recording-compare/` | Clawperator repo | new fixtures |
| `docs/api/recording.md` | Clawperator repo | normalization scope, new outcomes |
| `docs/skills/authoring.md` | Clawperator repo | cross-repo sync note |
| `../clawperator-skills/.../references/` | Skills repo | canonical retained baseline read by the opt-in structural sync test |

## Source Of Truth

| Area | Verify against |
| --- | --- |
| Compare behavior | `apps/node/src/domain/recording/compareRecording.ts` |
| CLI surface and flags | `apps/node/src/cli/registry.ts` |
| Exit-code contract | `apps/node/src/cli/stdoutExitCode.ts` |
| Compare tests | `apps/node/src/test/unit/recordingCompare.test.ts` |
| Compare fixtures | `apps/node/src/test/fixtures/recording-compare/` |
| Recording docs | `docs/api/recording.md` |
| Authoring docs | `docs/skills/authoring.md` |
| Retained baseline | `../clawperator-skills/skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json` |
| Docs build | `./scripts/docs_build.sh` |

## Deterministic Versus Judgment

Deterministic:

- constant rename
- normalization guard threshold: all 4 Solax checkpoints required
  (`SOLAX_BASELINE_CHECKPOINT_ORDER.length`)
- baseline-coverage computation: set intersection of baseline checkpoint
  IDs and actual checkpoint IDs
- `baselineUncovered` trigger: `baselineCoverage.covered === 0` and
  `baselineCoverage.declared > 0` in semantic mode with verified terminal
- `baselineWeaklyCovered` trigger:
  `baselineCoverage.covered > 0 && baselineCoverage.covered < minimumSemanticCoverage`
  in semantic mode with verified terminal
- `minimumSemanticCoverage`: `2` for the shipped Solax heuristic path.
  Rationale: `1` can be satisfied by a trivial anchor such as
  `app_opened`, which is too weak to make semantic compare helpful.
- new outcome membership in `isMeaningfulCompareDivergence`
- fixture structure and test assertions
- docs-site rebuild

Judgment:

- exact wording of the normalization scope paragraph in docs
- exact wording of the cross-repo sync note

## Decision Rules

Normalization guard behavior:

| Condition | Result |
| --- | --- |
| heuristic normalization produces `SOLAX_BASELINE_CHECKPOINT_ORDER.length` checkpoints (currently 4) | proceed normally |
| heuristic normalization produces fewer than `SOLAX_BASELINE_CHECKPOINT_ORDER.length` checkpoints from a non-empty export | return report with `outcome: "normalization_insufficient"` |
| export has 0 events | return report with `outcome: "normalization_insufficient"` (empty export cannot produce a meaningful baseline) |

Semantic compare baseline-coverage behavior:

| Condition | Result |
| --- | --- |
| semantic mode, terminal verification verified, baseline coverage === 0 AND baseline declared > 0 | `baseline_uncovered` (new, exit 1) |
| semantic mode, terminal verification verified, baseline coverage > 0 but `< minimumSemanticCoverage` | `baseline_weakly_covered` (new, exit 1) |
| semantic mode, terminal verification verified, baseline coverage >= `minimumSemanticCoverage` | `outcome_matches_path_differs` (existing behavior, exit 0) |
| semantic mode, terminal verification verified, baseline declared === 0 | cannot happen after normalization guard |

New outcomes:

| Outcome | Meaningful divergence? | Exit code | Summary |
| --- | --- | --- | --- |
| `normalization_insufficient` | yes | 1 | baseline normalization could not extract the required checkpoint set from this recording export |
| `baseline_uncovered` | yes | 1 | terminal verification passed but no baseline checkpoints appeared in the actual run |
| `baseline_weakly_covered` | yes | 1 | terminal verification passed but baseline coverage was too weak to treat compare as trustworthy |

Report shape additions (all three are new required fields on
`RecordingCompareReport`):

```typescript
baselineCoverage: {
  declared: number;  // count of baseline checkpoint IDs
  covered: number;   // count of baseline IDs found in actual run
};
normalizationStrategy: "solax_heuristic";
minimumSemanticCoverage: number;
```

`baselineCoverage` is always populated, including in the
`normalization_insufficient` early return (where `declared` is the count
that normalization did extract, even if insufficient, and `covered` is
computed against the actual checkpoints). Note: in the
`normalization_insufficient` case, `declared` may be 0, 1, 2, or 3 -
it reflects the partial extraction count, not the full Solax-expected 4.
Consumers should not interpret `declared` as the policy-required count;
that role belongs to `SOLAX_BASELINE_CHECKPOINT_ORDER.length`.

Cross-repo sync behavior:

| Condition | Result |
| --- | --- |
| `CLAWPERATOR_SKILLS_ROOT` unset | skip structural sync test |
| canonical baseline file missing under `CLAWPERATOR_SKILLS_ROOT` | fail test with a clear path error |
| canonical baseline parses but normalizes differently from the Clawperator fixture | fail test |
| canonical baseline normalizes identically and produces the same compare outcome for the canonical success fixture | pass |

## Failure Modes To Prevent

- changing the compare engine behavior for any existing test case
- introducing a new fixture that does not match an explicit test
- allowing a non-Solax baseline to silently produce a misleading compare
  report
- allowing an agent-driven run with zero or trivial baseline-checkpoint
  coverage to be classified as success
- building a cross-repo sync check that fails on harmless session-level
  metadata drift instead of meaningful compare drift
- only testing helper-level compare reports and forgetting to pin the CLI
  exit-code behavior for the new fail-closed outcomes
- documenting normalization scope as an apology instead of an honest scope
  statement
- forgetting to handle new outcomes in `summarizeOutcome` or
  `isMeaningfulCompareDivergence`
- forgetting to rebuild docs

## Output Contract

After this task, the `skills/compare` branch must:

- build and pass all tests including new ones
- rebuild docs without errors
- fail with `normalization_insufficient` for any non-Solax baseline that
  does not produce all 4 expected checkpoints
- fail with `baseline_uncovered` for semantic runs where terminal
  verification passed but zero baseline checkpoints appeared
- fail with `baseline_weakly_covered` for semantic runs where terminal
  verification passed but baseline coverage is below the minimum trusted
  threshold
- report `baselineCoverage`, `normalizationStrategy`, and
  `minimumSemanticCoverage` in every compare report
- have honest normalization scope in public docs
- prove the new fail-closed outcomes on the CLI path, not only through
  direct compare helper tests
- have an opt-in cross-repo baseline sync test that compares structure and
  compare behavior, not raw bytes

## Idempotency

All code and docs changes are deterministic edits. Rerunning the task from
scratch produces the same result. The opt-in cross-repo test is
deterministic when the skills repo is at a known commit.

## Durable Follow-Up

After this task pack is executed and the branch is merged:

- `tasks/recording/compare-closeout/` should be deleted
- `tasks/recording/compare/` can be deleted (it is already marked complete)

### Generic Compare Successor Program

The closeout makes compare fail-closed and honest for its Solax-only
normalization. Making compare genuinely generic requires a separate task
pack with at least these milestones:

1. **Per-skill baseline checkpoint declaration.** The retained baseline
   export or a sidecar file carries an explicit list of expected checkpoint
   IDs. Compare uses declared checkpoints directly instead of running
   heuristic extraction. This replaces the Solax-specific normalization as
   the primary path.

2. **Checkpoint declaration ownership.** Define who owns the checkpoint
   IDs: the recording export (authoring-time evidence), `skill.json`
   (runtime contract), or a standalone baseline manifest. Decide whether
   declared checkpoints must match `skill.json.contract` checkpoint
   identities.

3. **Cross-repo fixture provenance.** Generate the Clawperator test
   fixture from the canonical skills-repo baseline so drift is
   mechanically impossible. Replace the current manual-copy workflow with
   a script or build step.

4. **Semantic compare coverage threshold.** Decide whether semantic success
   should continue to use the closeout threshold (`minimumSemanticCoverage`
   count) or move to a per-baseline fraction or declared required subset.
   The closeout ships a Solax-specific threshold of `2`; generic compare
   must make that policy explicit and data-driven.

5. **Non-Solax proving case.** Prove compare against a second app flow
   (not Solax) to validate that the declared-checkpoint path works for
   real. The Solax case tests the engine; a second case tests genericity.

This successor pack should not start until the closeout is merged and the
Solax proving case is stable on `main`.
