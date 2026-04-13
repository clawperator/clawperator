# Recording Compare Closeout

## Executive Summary

Close the remaining gaps in the W4 `recording compare` implementation before
the branch is PR-ready. The core compare engine is sound: mode selection,
outcome determination, divergence finding, and the CLI surface all work
correctly and pass all 961 tests. Three targeted fixes are required, plus
test and docs improvements.

Total PRs: 1. Total phases: 4. All work is on the existing
`skills/compare` branch in the Clawperator repo. No skills-repo changes.

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
problems found during EM-level review:

1. Baseline normalization is Solax-hardcoded but docs present compare as
   generic. Fix the docs, not the engine.
2. Normalization silently produces garbage for non-Solax baselines. Add a
   sanity guard so the tool fails visibly instead of misleading.
3. CLI test coverage has gaps for explicit `--mode` overrides. Add them.

Plus non-blocking code quality and documentation improvements.

## Why Now

The compare branch has 5 commits of working implementation, live-proved
against Solax replay and orchestrated runs. Tests pass. Docs build succeeds.
But the EM review found the implementation's public framing does not match its
actual scope: the normalization function is Solax-specific but the CLI and docs
present it as generic. This gap must be closed before the branch can be
reviewed as a PR.

## In Scope

- honest qualification of normalization scope in `docs/api/recording.md`
- normalization sanity guard in `compareRecording.ts`
- test for the sanity guard
- CLI tests for explicit `--mode literal` and `--mode semantic` overrides
- rename internal constant to make Solax scope explicit
- cross-repo baseline sync guidance in `docs/skills/authoring.md`
- docs-site rebuild

## Out of Scope

- making normalization generic or pluggable (future work)
- changing the compare engine or outcome logic
- changing the CLI surface or flag set
- changing the exit-code contract for USAGE responses (this is a CLI-wide
  pattern, not a compare-specific issue)
- skills-repo changes
- any changes to the Solax proving skill

## Existing Artifact Scope

This task edits artifacts that already exist on the `skills/compare` branch.
Existing content that is preserved as-is:

- the entire `compareRecording.ts` compare engine below normalization
- all existing fixture files under `apps/node/src/test/fixtures/recording-compare/`
- all existing test cases in `recordingCompare.test.ts`
- the CLI registration in `registry.ts`
- the `cmdRecordCompare` handler in `record.ts`

Existing content that is modified:

- `normalizeRecordingExportForCompare` in `compareRecording.ts`: add a sanity
  guard and rename the constant
- `recordingCompare.test.ts`: add new test cases (do not modify existing ones)
- `docs/api/recording.md`: add normalization scope qualification
- `docs/skills/authoring.md`: add cross-repo baseline sync note

## Surfaces and Ownership

| Surface | Owner | Role |
| --- | --- | --- |
| `apps/node/src/domain/recording/compareRecording.ts` | Clawperator repo | normalization sanity guard and constant rename |
| `apps/node/src/test/unit/recordingCompare.test.ts` | Clawperator repo | new test cases |
| `apps/node/src/test/fixtures/recording-compare/` | Clawperator repo | new non-Solax fixture |
| `docs/api/recording.md` | Clawperator repo | normalization scope qualification |
| `docs/skills/authoring.md` | Clawperator repo | cross-repo sync note |

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
| Docs build | `./scripts/docs_build.sh` |

## Deterministic Versus Judgment

Deterministic:

- constant rename (`DEFAULT_BASELINE_CHECKPOINT_ORDER` to
  `SOLAX_BASELINE_CHECKPOINT_ORDER`)
- sanity guard threshold (0 checkpoints from a non-empty export)
- new test case structure (same pattern as existing tests)
- docs-site rebuild

Judgment:

- exact wording of the normalization scope qualification in docs
- exact wording of the cross-repo sync note

## Decision Rules

Sanity guard behavior:

| Condition | Result |
| --- | --- |
| export has events, normalization produces >= 1 checkpoint | proceed normally |
| export has events, normalization produces 0 checkpoints | return a report with outcome `normalization_empty` and `compareMode` set to the inferred mode |
| export has 0 events | existing behavior (produces 0 checkpoints, no guard needed because the export is genuinely empty) |

`normalization_empty` is a new outcome value. It must:

- be added to the `RecordingCompareOutcome` type union
- be treated as a meaningful divergence by `isMeaningfulCompareDivergence`
  (returns `true`, so exit code is non-zero)
- have a summary string that explains what happened
- not require changes to the CLI handler or exit-code logic

Compare mode override tests:

| Test | CLI args | Expected `compareMode` in output |
| --- | --- | --- |
| literal override on agent-driven result | `--mode literal` with agent `SkillResult` | `"literal"` |
| semantic override on script-driven result | `--mode semantic` with script `SkillResult` | `"semantic"` |

## Failure Modes To Prevent

- changing the compare engine behavior for any existing test case
- introducing a new fixture that does not match an explicit test
- documenting normalization scope in a way that sounds like an apology
  instead of an honest scope statement
- forgetting to rebuild docs after editing `docs/api/recording.md` or
  `docs/skills/authoring.md`
- adding the new outcome to the type union but forgetting to handle it in
  `summarizeOutcome` or `isMeaningfulCompareDivergence`

## Output Contract

After this task, the `skills/compare` branch must:

- build and pass all tests including new ones
- rebuild docs without errors
- have no Solax-specific language in the generic normalization constant name
- have honest normalization scope in public docs
- fail visibly for non-Solax baselines that produce 0 checkpoints
- have explicit `--mode` override CLI coverage

## Idempotency

All changes are deterministic edits. Rerunning the task from scratch produces
the same result.

## Durable Follow-Up

After this task pack is executed and the branch is merged:

- `tasks/recording/compare-closeout/` should be deleted
- `tasks/recording/compare/` can be deleted (it is already marked complete)
- future work to make normalization generic or pluggable should be tracked
  separately, not in this task pack
