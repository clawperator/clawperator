# Recording Compare Closeout Work Breakdown

Parent plan: `tasks/recording/compare-closeout/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 4. All phases are in one PR on the existing
`skills/compare` branch. Phase order: P1 (sanity guard and constant rename),
P2 (CLI mode override tests), P3 (docs qualification), P4 (rebuild and
verify). One commit per phase.

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

## Hard Rules

- Do not modify any existing test case. Only add new ones.
- Do not modify the compare engine logic in `determineOutcome`,
  `findFirstDivergence`, or `comparableActualCheckpoints`. Those functions
  are correct and out of scope.
- Do not modify the CLI registration in `registry.ts` or the handler in
  `record.ts` except if the new outcome requires a handler change (it should
  not - `isMeaningfulCompareDivergence` already controls exit codes).
- Do not modify any existing fixture file. Only add new ones.
- Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
  after P1 and P2. Run `./scripts/docs_build.sh` after P3. All must pass
  before committing.
- Use conventional commit messages exactly as specified in each phase.
- Work on the existing `skills/compare` branch. Do not create a new branch.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/compare-closeout/plan.md` | Stable contract, scope, and decision rules for this task |
| `apps/node/src/domain/recording/compareRecording.ts` | The implementation you are modifying. Read the whole file. Pay attention to `normalizeRecordingExportForCompare`, `RecordingCompareOutcome`, `isMeaningfulCompareDivergence`, and `summarizeOutcome`. |
| `apps/node/src/test/unit/recordingCompare.test.ts` | Existing tests. Understand the fixture-loading pattern and test structure before adding new tests. |
| `apps/node/src/test/fixtures/recording-compare/` | List all fixture files. Understand which fixtures exist and what they test. |
| `docs/api/recording.md` | The docs section you will add the normalization scope note to. Find the `### Compare` section. |
| `docs/skills/authoring.md` | The docs file you will add the cross-repo sync note to. |
| `apps/node/src/cli/registry.ts` | The CLI registration for `recording compare`. You should not need to change this, but read the handler to confirm the new outcome flows through correctly. |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Compare closeout fixes | P1, P2, P3, P4 | `default` | none |

## Phase P1: Normalization Sanity Guard and Constant Rename

### Agent Tier

`default`

### Goal

Add a sanity guard so `recording compare` fails visibly when normalization
produces 0 checkpoints from a non-empty recording export. Rename the
Solax-specific constant to be honest about its scope.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/compareRecording.ts`
- `apps/node/src/test/unit/recordingCompare.test.ts`
- `apps/node/src/test/fixtures/recording-compare/` (one new fixture)

### Steps

1. In `compareRecording.ts`, rename the constant `DEFAULT_BASELINE_CHECKPOINT_ORDER`
   (currently on line 84) to `SOLAX_BASELINE_CHECKPOINT_ORDER`. Update all
   references to it in the same file. There is exactly one reference at
   line 267 inside `normalizeRecordingExportForCompare`.

2. Add `"normalization_empty"` to the `RecordingCompareOutcome` type union.
   Place it after `"runtime_unavailable"`.

3. In `isMeaningfulCompareDivergence`, confirm the new outcome is NOT in
   the success list. It already will not be, because the function uses an
   inclusion list of the three success outcomes. But verify this explicitly
   by reading the function.

4. In `summarizeOutcome`, add a case for `"normalization_empty"`:
   ```
   case "normalization_empty":
     return "baseline normalization produced no checkpoints from a non-empty recording export; compare cannot proceed";
   ```

5. In `compareRecordingBaselineWithSkillResult`, add the sanity guard AFTER
   the call to `normalizeRecordingExportForCompare` and BEFORE the call to
   `comparableActualCheckpoints`. The guard checks:
   - `artifact.events.length > 0` (the export is non-empty)
   - `baseline.checkpoints.length === 0` (normalization produced nothing)

   When both are true, return an early `RecordingCompareReport` with:
   - `compareMode`: use `inferredCompareMode(skillResult, options.mode ?? "auto")`
   - `outcome`: `"normalization_empty"`
   - `summary`: use `summarizeOutcome("normalization_empty", undefined)`
   - `pathMatches`: `false`
   - `terminalVerificationStatus`: `terminalVerificationStatus(skillResult)`
   - `baseline`: `{ appPackage: baseline.appPackage, checkpointIds: [] }`
   - `actual`: populated from `skillResult` as usual

6. Create a new fixture file
   `apps/node/src/test/fixtures/recording-compare/non-solax-baseline.export.json`.
   This must be a valid `RecordingExportArtifact` with at least 3 events
   from a non-Solax app (e.g. `com.example.notes`) that does NOT contain
   any click with "discharge" or "save" text. It should have a
   `window_change`, a `click` with generic text (e.g. "New Note"), and a
   `text_change`. The normalization function will find `app_opened` from the
   window_change but will not find `discharge_to_row_focused`,
   `target_text_entered` (it will find the text_change but that only
   produces one checkpoint), or `save_completed`. The result should be
   fewer than the 4 Solax checkpoints.

   Wait - re-read the normalization logic carefully. `app_opened` matches
   the first `window_change` in the primary package. `target_text_entered`
   matches the last `text_change` with non-empty text. `save_completed`
   matches the last click containing "save" or "confirm". Only
   `discharge_to_row_focused` is truly Solax-specific (requires "discharge"
   in event strings).

   So for a fixture that produces 0 checkpoints, you need an export with
   events that are all outside the primary package, OR events that do not
   match any of the four patterns. The simplest approach: create an export
   with only `scroll` events from the primary package. Scroll events do not
   match any of the four checkpoint patterns.

   Correct fixture: a valid export with `exportVersion: 1`, a valid
   `session` block, `snapshotMode: "omit"`, and events that are all
   `scroll` type from `com.example.notes`. This produces 0 checkpoints
   because none of the four patterns match scroll events.

7. Add two new tests in `recordingCompare.test.ts`:

   a. In the `"recording compare normalization"` describe block, add:
      ```
      it("produces an empty checkpoint list for a non-Solax recording with no matching event patterns", async () => {
        const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-baseline.export.json");
        const normalized = normalizeRecordingExportForCompare(baseline);
        assert.strictEqual(normalized.checkpoints.length, 0);
        assert.strictEqual(normalized.appPackage, "com.example.notes");
      });
      ```

   b. In the `"recording compare outcomes"` describe block, add:
      ```
      it("reports normalization_empty when baseline normalization produces no checkpoints from a non-empty export", async () => {
        const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-baseline.export.json");
        const skillResult = await readJsonFixture<SkillResult>("solax-result-success.skillresult.json");
        const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
        assert.strictEqual(report.outcome, "normalization_empty");
        assert.strictEqual(report.baseline.checkpointIds.length, 0);
        assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
      });
      ```

8. Build and test:
   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```
   All 961+ tests must pass.

### Acceptance Criteria

- `DEFAULT_BASELINE_CHECKPOINT_ORDER` no longer exists anywhere in the
  codebase. `SOLAX_BASELINE_CHECKPOINT_ORDER` exists in its place.
- `"normalization_empty"` is in the `RecordingCompareOutcome` type union.
- `isMeaningfulCompareDivergence("normalization_empty")` returns `true`.
- `summarizeOutcome` handles `"normalization_empty"` without throwing.
- A non-Solax export with events but no matching patterns produces a report
  with `outcome: "normalization_empty"` and exit code 1.
- The new fixture `non-solax-baseline.export.json` is a valid
  `RecordingExportArtifact` with at least 1 event.
- Two new tests exist and pass.
- All existing tests still pass with no modifications.
- Build succeeds.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

```bash
grep -r "DEFAULT_BASELINE_CHECKPOINT_ORDER" apps/node/src/
# Must return 0 results
```

```bash
grep -r "SOLAX_BASELINE_CHECKPOINT_ORDER" apps/node/src/
# Must return at least 2 results (declaration and usage)
```

### Expected Commit

```text
fix(recording): add normalization sanity guard and rename Solax constant
```

## Phase P2: CLI Mode Override Tests

### Agent Tier

`default`

### Goal

Add CLI integration tests that exercise the explicit `--mode literal` and
`--mode semantic` override flags.

### Files or Surfaces To Change

- `apps/node/src/test/unit/recordingCompare.test.ts`

### Steps

1. In the `"recording compare CLI"` describe block, add two new test cases:

   a. Explicit `--mode literal` override on an agent-driven result:
      ```
      it("respects explicit --mode literal override on an agent-driven result", async () => {
        const { stdout, code } = await runCli([
          "recording",
          "compare",
          "--baseline",
          join(fixturesRoot, "solax-baseline-success.export.json"),
          "--result",
          join(fixturesRoot, "solax-skills-run-success.json"),
          "--mode",
          "literal",
          "--output",
          "json",
        ]);

        assert.strictEqual(code, 0, stdout);
        const parsed = JSON.parse(stdout) as { compareMode?: string };
        assert.strictEqual(parsed.compareMode, "literal");
      });
      ```

      Note: `solax-skills-run-success.json` wraps an agent-driven
      `SkillResult` (`source.kind: "agent"`). Without the override,
      compare would auto-select `semantic`. With `--mode literal`, compare
      must use `literal`. The checkpoints in this fixture match the
      baseline, so the outcome should be `literal_match` with exit 0.

   b. Explicit `--mode semantic` override on a script-driven result:
      ```
      it("respects explicit --mode semantic override on a script-driven result", async () => {
        const { stdout, code } = await runCli([
          "recording",
          "compare",
          "--baseline",
          join(fixturesRoot, "solax-baseline-success.export.json"),
          "--result",
          join(fixturesRoot, "solax-skills-run-replay-success.json"),
          "--mode",
          "semantic",
          "--output",
          "json",
        ]);

        assert.strictEqual(code, 0, stdout);
        const parsed = JSON.parse(stdout) as { compareMode?: string };
        assert.strictEqual(parsed.compareMode, "semantic");
      });
      ```

      Note: `solax-skills-run-replay-success.json` wraps a script-driven
      `SkillResult` (`source.kind: "script"`). Without the override,
      compare would auto-select `literal`. With `--mode semantic`, compare
      must use `semantic`. The outcome should still be success (either
      `semantic_match`) with exit 0.

2. Build and test:
   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```

### Acceptance Criteria

- Two new CLI tests exist that exercise explicit `--mode` overrides.
- Both tests verify that `compareMode` in the output matches the
  explicitly requested mode, not the auto-detected mode.
- Both tests pass.
- All existing tests still pass.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
test(recording): add CLI mode override tests for recording compare
```

## Phase P3: Docs Qualification

### Agent Tier

`default`

### Goal

Add honest normalization scope qualification to `docs/api/recording.md` and
a cross-repo baseline sync note to `docs/skills/authoring.md`.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`

### Steps

1. In `docs/api/recording.md`, find the `### Compare` section. Locate the
   paragraph that starts "What compare treats as authoritative:" (around
   line 389). After the bullet list that ends with "compare ignores the
   duplicated `terminal_state_verified` checkpoint id", add a new
   paragraph:

   ```
   Normalization scope:

   - v1 baseline normalization is proven against recording exports from the
     Solax discharge-limit skill flow
   - the normalization heuristics extract four structural checkpoints:
     app_opened (first in-app window_change), discharge_to_row_focused
     (first click matching "discharge"), target_text_entered (last
     text_change with non-empty text), and save_completed (last click
     matching "save" or "confirm")
   - recording exports from other app flows may not produce meaningful
     checkpoints through this normalization path; compare will report
     `normalization_empty` when no checkpoints can be derived
   - generic or configurable normalization is planned for a future release
   ```

   Also find the example that uses `com.example.demo.capture-state` in the
   verification section (around line 497). Replace the skill id with
   `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` so the
   example matches the actual proven scope. Update the baseline path in that
   example to match:
   `./skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json`

2. In `docs/skills/authoring.md`, find the section that discusses recording
   baselines or compare (search for "compare" or "baseline"). Add a note
   about cross-repo sync. If there is no existing section about compare
   baselines, add a short paragraph after the existing recording-related
   content:

   ```
   When a retained compare baseline is copied into
   `apps/node/src/test/fixtures/recording-compare/` as a test fixture,
   keep both copies in sync. If the canonical baseline in the skills repo
   changes, update the corresponding Clawperator test fixture in the same
   change or the next available PR.
   ```

3. Rebuild docs:
   ```bash
   ./scripts/docs_build.sh
   ```
   Must succeed end to end.

### Acceptance Criteria

- `docs/api/recording.md` has a normalization scope paragraph that
  explicitly says v1 is proven against Solax and other apps may get
  `normalization_empty`.
- The example skill id in the verification section is the actual Solax
  proving skill, not a generic placeholder.
- `docs/skills/authoring.md` has a cross-repo sync note for compare
  baselines.
- `./scripts/docs_build.sh` succeeds.

### Validation

```bash
./scripts/docs_build.sh
```

```bash
grep -c "normalization_empty" docs/api/recording.md
# Must return at least 1
```

```bash
grep -c "com.example.demo.capture-state" docs/api/recording.md
# Must return 0
```

### Expected Commit

```text
docs(recording): qualify normalization scope and add baseline sync guidance
```

## Phase P4: Final Verification

### Agent Tier

`fast`

### Goal

Run the full validation suite and confirm everything passes together.

### Files or Surfaces To Change

None. This is a verification-only phase.

### Steps

1. Build:
   ```bash
   npm --prefix apps/node run build
   ```

2. Test:
   ```bash
   npm --prefix apps/node run test
   ```

3. Docs:
   ```bash
   ./scripts/docs_build.sh
   ```

4. Confirm no stale references to the old constant name:
   ```bash
   grep -r "DEFAULT_BASELINE_CHECKPOINT_ORDER" apps/node/src/
   ```
   Must return 0 results.

5. Confirm no `com.example.demo.capture-state` in recording docs:
   ```bash
   grep -r "com.example.demo.capture-state" docs/
   ```
   Must return 0 results.

6. If all pass, no commit is needed for this phase.

### Acceptance Criteria

- Build succeeds.
- All tests pass (961+ tests, 0 failures).
- Docs build succeeds.
- No stale constant references.
- No placeholder skill ids in docs.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test && ./scripts/docs_build.sh
```

### Expected Commit

No commit. Verification only.
