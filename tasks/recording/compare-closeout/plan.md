# Recording Compare Closeout

## Executive Summary

Close the remaining gaps in the W4 `recording compare` implementation before
the branch is PR-ready. The core compare engine (file loading, CLI surface,
divergence finding, exit codes) is sound. Three design-level gaps remain:

1. Heuristic normalization is Solax-specific but not fail-closed for
   non-Solax baselines.
2. Semantic compare is too permissive: any agent-driven run with verified
   terminal state is compare-success even if zero baseline checkpoints
   appeared in the actual run.
3. Cross-repo baseline drift between the canonical skills-repo retained
   baseline and the Clawperator test fixture has no mechanical check.

This task fixes all three at the engine level, not just in docs. Docs are
updated to match the corrected behavior.

Total PRs: 1. Total phases: 4. All work is on the existing
`skills/compare` branch in the Clawperator repo. One small skills-repo
change (adding declared checkpoints to the retained baseline) is in scope
for P3.

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

Make the `skills/compare` branch honestly PR-ready by fixing three concrete
engine-level problems found during EM-level review:

1. Heuristic normalization must be fail-closed: if the Solax-specific
   heuristics do not extract all 4 expected checkpoints, compare refuses
   with a typed outcome instead of proceeding with a partial or misleading
   baseline.
2. Semantic compare must require minimal baseline-checkpoint coverage:
   an agent-driven run that claims terminal verification but contains
   zero baseline checkpoint IDs is suspicious and must not be classified
   as success.
3. Cross-repo baseline drift must have a mechanical check, not just a
   documentation note.

Plus honest docs framing and test coverage for the new behavior.

## Why Now

The compare branch has 5 commits of working implementation, live-proved
against Solax replay and orchestrated runs. Tests pass. Docs build succeeds.
But EM review found three design-level gaps that make the tool misleading
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
- `normalizationStrategy` field in the report so consumers know which
  normalization path was used
- rename of `DEFAULT_BASELINE_CHECKPOINT_ORDER` to
  `SOLAX_BASELINE_CHECKPOINT_ORDER`
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
- skills-repo changes beyond adding declared checkpoints to the retained
  baseline

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

- `RecordingCompareOutcome` type union: two new members added
- `RecordingCompareReport` interface: three new fields added
- `compareRecordingBaselineWithSkillResult`: normalization guard and
  baseline-coverage computation added
- `determineOutcome`: baseline-coverage check added for semantic mode
- `isMeaningfulCompareDivergence`: two new outcomes handled
- `summarizeOutcome`: two new cases added
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
| `../clawperator-skills/.../references/` | Skills repo | not changed in this task |

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
- `baseline_uncovered` trigger: `baselineCoverage.covered === 0` and
  `baselineCoverage.declared > 0` in semantic mode with verified terminal
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
| semantic mode, terminal verification verified, baseline coverage > 0 | `outcome_matches_path_differs` (existing behavior, exit 0) |
| semantic mode, terminal verification verified, baseline coverage === 0 AND baseline declared > 0 | `baseline_uncovered` (new, exit 1) |
| semantic mode, terminal verification verified, baseline declared === 0 | cannot happen after normalization guard |

New outcomes:

| Outcome | Meaningful divergence? | Exit code | Summary |
| --- | --- | --- | --- |
| `normalization_insufficient` | yes | 1 | baseline normalization could not extract the required checkpoint set from this recording export |
| `baseline_uncovered` | yes | 1 | terminal verification passed but no baseline checkpoints appeared in the actual run |

Report shape additions (all three are new required fields on
`RecordingCompareReport`):

```typescript
baselineCoverage: {
  declared: number;  // count of baseline checkpoint IDs
  covered: number;   // count of baseline IDs found in actual run
};
normalizationStrategy: "solax_heuristic";
```

`baselineCoverage` is always populated, including in the
`normalization_insufficient` early return (where `declared` is the count
that normalization did extract, even if insufficient, and `covered` is
computed against the actual checkpoints).

## Failure Modes To Prevent

- changing the compare engine behavior for any existing test case
- introducing a new fixture that does not match an explicit test
- allowing a non-Solax baseline to silently produce a misleading compare
  report
- allowing an agent-driven run with zero baseline-checkpoint coverage to
  be classified as success
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
- report `baselineCoverage` and `normalizationStrategy` in every compare
  report
- have honest normalization scope in public docs
- have an opt-in cross-repo baseline sync test

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
   should require a minimum fraction of baseline-checkpoint coverage (e.g.,
   50%) rather than just `> 0`. This determines whether
   `outcome_matches_path_differs` becomes a more meaningful signal.

5. **Non-Solax proving case.** Prove compare against a second app flow
   (not Solax) to validate that the declared-checkpoint path works for
   real. The Solax case tests the engine; a second case tests genericity.

This successor pack should not start until the closeout is merged and the
Solax proving case is stable on `main`.
