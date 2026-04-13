# Recording Compare Closeout Work Breakdown

Parent plan: `tasks/recording/compare-closeout/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 4. All phases are in one PR on the existing
`skills/compare` branch. Phase order: P1 (normalization guard, coverage
computation, constant rename, new outcomes), P2 (semantic baseline-coverage
check and cross-repo sync test), P3 (docs and framing), P4 (final
verification). One commit per phase except P4 (verification only).

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
- Do not modify any existing fixture file. Only add new ones.
- Do not modify `findFirstDivergence`, `comparableActualCheckpoints`,
  `inferredCompareMode`, or `terminalVerificationStatus`. Those functions
  are correct and out of scope.
- Do not modify the CLI registration in `registry.ts` or the handler in
  `record.ts`. The new outcomes flow through the existing
  `isMeaningfulCompareDivergence` check, which already controls exit codes.
- Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
  after P1 and P2 to confirm all existing tests still pass alongside new
  ones.
- Run `./scripts/docs_build.sh` after P3.
- Use conventional commit messages exactly as specified in each phase.
- Work on the existing `skills/compare` branch. Do not create a new branch.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/recording/compare-closeout/plan.md` | Stable contract, scope, decision rules, and the exact new report fields and outcome behavior you must implement |
| `apps/node/src/domain/recording/compareRecording.ts` | The implementation you are modifying. Read the whole file. Pay attention to: `RecordingCompareOutcome` (type union you will extend), `RecordingCompareReport` (interface you will extend), `normalizeRecordingExportForCompare` (function where the guard goes), `compareRecordingBaselineWithSkillResult` (function where coverage computation and early return go), `determineOutcome` (function where the baseline-coverage check goes), `isMeaningfulCompareDivergence` (function where new outcomes must be handled), `summarizeOutcome` (function where new outcomes must be handled) |
| `apps/node/src/test/unit/recordingCompare.test.ts` | Existing tests. Understand the fixture-loading pattern, the `readJsonFixture` helper, the `runCli` helper, and the describe block structure before adding new tests |
| `apps/node/src/test/fixtures/recording-compare/` | List all existing fixture files. Do not modify them. New fixtures must follow the same naming convention |
| `apps/node/src/domain/recording/recordingEventTypes.ts` | The `RecordingExportArtifact` interface. You need this to create valid non-Solax export fixtures |
| `docs/api/recording.md` | Find the `### Compare` section. You will add normalization scope and new outcome documentation here |
| `docs/skills/authoring.md` | Find the existing compare-related content. You will add a cross-repo sync note near it |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Compare closeout | P1, P2, P3, P4 | `default` | none |

## Phase P1: Normalization Guard, Coverage Computation, New Outcomes

### Agent Tier

`default`

### Goal

Make compare fail-closed when heuristic normalization cannot extract the
full Solax checkpoint set. Add baseline-coverage metrics to the report.
Rename the Solax-specific constant.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/compareRecording.ts`
- `apps/node/src/test/unit/recordingCompare.test.ts`
- `apps/node/src/test/fixtures/recording-compare/` (2 new fixtures)

### Steps

1. In `compareRecording.ts`, rename the constant `DEFAULT_BASELINE_CHECKPOINT_ORDER`
   (line 84) to `SOLAX_BASELINE_CHECKPOINT_ORDER`. Update the one reference
   to it at line 267. Search the file for any other references and update
   them. There should be exactly 2 occurrences total (declaration and usage).

2. Add two new members to the `RecordingCompareOutcome` type union.
   Place them after `"runtime_unavailable"`:
   ```typescript
   | "normalization_insufficient"
   | "baseline_uncovered";
   ```

3. Add three new fields to the `RecordingCompareReport` interface.
   Place them after the `actual` field and before `firstDivergence`:
   ```typescript
   baselineCoverage: {
     declared: number;
     covered: number;
   };
   normalizationStrategy: "solax_heuristic";
   ```

4. Add a helper function to compute baseline coverage. Place it after
   the `comparableActualCheckpoints` function (around line 284):
   ```typescript
   function computeBaselineCoverage(
     baseline: NormalizedRecordingBaseline,
     actualCheckpoints: ComparableActualCheckpoint[]
   ): { declared: number; covered: number } {
     const actualIds = new Set(actualCheckpoints.map((c) => c.id));
     const declared = baseline.checkpoints.length;
     const covered = baseline.checkpoints.filter((c) => actualIds.has(c.id)).length;
     return { declared, covered };
   }
   ```

5. In `summarizeOutcome`, add cases for the two new outcomes:
   ```typescript
   case "normalization_insufficient":
     return "baseline normalization could not extract the required checkpoint set from this recording export";
   case "baseline_uncovered":
     return "terminal verification passed but no baseline checkpoints appeared in the actual run";
   ```

6. In `isMeaningfulCompareDivergence`, confirm the function already returns
   `true` for the new outcomes. It uses an inclusion list of the three
   success outcomes (`literal_match`, `semantic_match`,
   `outcome_matches_path_differs`), so any outcome not in that list
   automatically returns `true`. No code change needed here, but verify
   by reading the function.

7. Modify `compareRecordingBaselineWithSkillResult`. The current function
   body is approximately:
   ```typescript
   const baseline = normalizeRecordingExportForCompare(artifact);
   const actualCheckpoints = comparableActualCheckpoints(skillResult);
   const compareMode = inferredCompareMode(skillResult, options.mode ?? "auto");
   const firstDivergence = findFirstDivergence(baseline, actualCheckpoints, skillResult.status);
   const pathMatches = firstDivergence === undefined;
   const outcome = determineOutcome({ compareMode, pathMatches, skillResult });
   return { compareMode, outcome, ... };
   ```

   After the `baseline` assignment and BEFORE the `actualCheckpoints`
   assignment, add the normalization guard:
   ```typescript
   if (baseline.checkpoints.length < SOLAX_BASELINE_CHECKPOINT_ORDER.length) {
     const actualCps = comparableActualCheckpoints(skillResult);
     const coverage = computeBaselineCoverage(baseline, actualCps);
     const mode = inferredCompareMode(skillResult, options.mode ?? "auto");
     return {
       compareMode: mode,
       outcome: "normalization_insufficient",
       summary: summarizeOutcome("normalization_insufficient", undefined),
       pathMatches: false,
       terminalVerificationStatus: terminalVerificationStatus(skillResult),
       baseline: {
         appPackage: baseline.appPackage,
         checkpointIds: baseline.checkpoints.map((c) => c.id),
       },
       actual: {
         skillId: skillResult.skillId,
         sourceKind: skillResult.source.kind,
         status: skillResult.status,
         runtimeState: skillResult.diagnostics?.runtimeState,
         checkpointIds: actualCps.map((c) => c.id),
       },
       baselineCoverage: coverage,
       normalizationStrategy: "solax_heuristic",
     };
   }
   ```

   Then, in the normal (non-early-return) path, add coverage computation
   and include the new fields in the returned report. After
   `const actualCheckpoints = comparableActualCheckpoints(skillResult);`
   add:
   ```typescript
   const baselineCoverage = computeBaselineCoverage(baseline, actualCheckpoints);
   ```

   And in the return statement, add these fields alongside the existing ones:
   ```typescript
   baselineCoverage,
   normalizationStrategy: "solax_heuristic",
   ```

8. Create fixture
   `apps/node/src/test/fixtures/recording-compare/non-solax-scroll-only.export.json`.
   This is a valid `RecordingExportArtifact` with events from
   `com.example.notes` that are all `scroll` type. Scroll events match
   none of the four checkpoint patterns, so normalization produces 0
   checkpoints.

   Use this exact content:
   ```json
   {
     "exportVersion": 1,
     "session": {
       "sessionId": "notes-demo-20260413",
       "schemaVersion": 1,
       "startedAt": 1776000000000,
       "operatorPackage": "com.clawperator.operator.dev"
     },
     "snapshotMode": "omit",
     "events": [
       {
         "seq": 0,
         "ts": 1776000001000,
         "deltaMsSincePrevious": null,
         "type": "scroll",
         "packageName": "com.example.notes",
         "resourceId": "com.example.notes:id/note_list",
         "scrollX": 0,
         "scrollY": 200,
         "maxScrollX": 0,
         "maxScrollY": 1000,
         "snapshot": { "present": false, "xml": null }
       },
       {
         "seq": 1,
         "ts": 1776000002000,
         "deltaMsSincePrevious": 1000,
         "type": "scroll",
         "packageName": "com.example.notes",
         "resourceId": "com.example.notes:id/note_list",
         "scrollX": 0,
         "scrollY": 400,
         "maxScrollX": 0,
         "maxScrollY": 1000,
         "snapshot": { "present": false, "xml": null }
       }
     ],
     "counts": {
       "totalEvents": 2,
       "byType": { "scroll": 2 }
     },
     "packageTransitions": [],
     "timeline": {
       "firstEventTs": 1776000001000,
       "lastEventTs": 1776000002000,
       "durationMs": 1000
     }
   }
   ```

9. Create fixture
   `apps/node/src/test/fixtures/recording-compare/non-solax-generic-events.export.json`.
   This is a valid `RecordingExportArtifact` with events from
   `com.example.notes` that include a `window_change`, a `click` with text
   "New Note", and a `text_change`. Normalization will extract `app_opened`
   (from window_change) and `target_text_entered` (from text_change) but
   NOT `discharge_to_row_focused` (no "discharge" text) and NOT
   `save_completed` (no "save" or "confirm" text). That produces 2 of 4
   required checkpoints, which is below the threshold.

   Use this exact content:
   ```json
   {
     "exportVersion": 1,
     "session": {
       "sessionId": "notes-demo-20260413-b",
       "schemaVersion": 1,
       "startedAt": 1776000000000,
       "operatorPackage": "com.clawperator.operator.dev"
     },
     "snapshotMode": "omit",
     "events": [
       {
         "seq": 0,
         "ts": 1776000001000,
         "deltaMsSincePrevious": null,
         "type": "window_change",
         "packageName": "com.example.notes",
         "className": "com.example.notes.MainActivity",
         "title": "My Notes",
         "snapshot": { "present": true, "xml": null }
       },
       {
         "seq": 1,
         "ts": 1776000003000,
         "deltaMsSincePrevious": 2000,
         "type": "click",
         "packageName": "com.example.notes",
         "resourceId": "com.example.notes:id/btn_new",
         "text": "New Note",
         "contentDesc": null,
         "bounds": { "left": 800, "top": 1800, "right": 1000, "bottom": 2000 },
         "snapshot": { "present": true, "xml": null }
       },
       {
         "seq": 2,
         "ts": 1776000005000,
         "deltaMsSincePrevious": 2000,
         "type": "text_change",
         "packageName": "com.example.notes",
         "resourceId": "com.example.notes:id/note_body",
         "text": "Hello world",
         "snapshot": { "present": false, "xml": null }
       }
     ],
     "counts": {
       "totalEvents": 3,
       "byType": { "window_change": 1, "click": 1, "text_change": 1 }
     },
     "packageTransitions": [],
     "timeline": {
       "firstEventTs": 1776000001000,
       "lastEventTs": 1776000005000,
       "durationMs": 4000
     }
   }
   ```

10. Add tests in `recordingCompare.test.ts`. In the
    `"recording compare normalization"` describe block, add:

    ```typescript
    it("produces zero checkpoints for a non-Solax recording with only scroll events", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-scroll-only.export.json");
      const normalized = normalizeRecordingExportForCompare(baseline);
      assert.strictEqual(normalized.checkpoints.length, 0);
      assert.strictEqual(normalized.appPackage, "com.example.notes");
    });

    it("produces fewer than the required checkpoint count for a non-Solax recording with generic events", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-generic-events.export.json");
      const normalized = normalizeRecordingExportForCompare(baseline);
      assert.ok(normalized.checkpoints.length > 0, "should extract some checkpoints");
      assert.ok(normalized.checkpoints.length < 4, "should not extract all 4 Solax checkpoints");
      assert.strictEqual(normalized.appPackage, "com.example.notes");
    });
    ```

    In the `"recording compare outcomes"` describe block, add:

    ```typescript
    it("reports normalization_insufficient for a non-Solax baseline with zero extractable checkpoints", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-scroll-only.export.json");
      const skillResult = await readJsonFixture<SkillResult>("solax-result-success.skillresult.json");
      const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
      assert.strictEqual(report.outcome, "normalization_insufficient");
      assert.strictEqual(report.normalizationStrategy, "solax_heuristic");
      assert.strictEqual(report.baselineCoverage.declared, 0);
      assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
    });

    it("reports normalization_insufficient for a non-Solax baseline with partial generic checkpoints", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("non-solax-generic-events.export.json");
      const skillResult = await readJsonFixture<SkillResult>("solax-result-success.skillresult.json");
      const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
      assert.strictEqual(report.outcome, "normalization_insufficient");
      assert.ok(report.baselineCoverage.declared < 4, "declared count should be less than 4");
      assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
    });
    ```

    Also verify existing tests now include the new report fields. Add one
    assertion to the FIRST existing test in the `"recording compare outcomes"`
    block (the `"reports literal match"` test). After the existing
    assertions, add:

    Wait - the hard rule says "do not modify any existing test case." So
    do NOT add assertions to existing tests. Instead, add a dedicated test:

    ```typescript
    it("includes baselineCoverage and normalizationStrategy in a successful compare report", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
      const skillResult = await readJsonFixture<SkillResult>("solax-result-replay-success.skillresult.json");
      const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
      assert.strictEqual(report.outcome, "literal_match");
      assert.strictEqual(report.normalizationStrategy, "solax_heuristic");
      assert.strictEqual(report.baselineCoverage.declared, 4);
      assert.strictEqual(report.baselineCoverage.covered, 4);
    });
    ```

11. Build and test:
    ```bash
    npm --prefix apps/node run build && npm --prefix apps/node run test
    ```
    All tests must pass (existing 961 + new ones).

### Acceptance Criteria

- `DEFAULT_BASELINE_CHECKPOINT_ORDER` no longer exists anywhere in the
  codebase. `SOLAX_BASELINE_CHECKPOINT_ORDER` exists in its place.
- `"normalization_insufficient"` and `"baseline_uncovered"` are in the
  `RecordingCompareOutcome` type union.
- `isMeaningfulCompareDivergence` returns `true` for both new outcomes.
- `summarizeOutcome` handles both new outcomes without throwing.
- Every `RecordingCompareReport` includes `baselineCoverage` and
  `normalizationStrategy`.
- A non-Solax export with scroll-only events produces
  `normalization_insufficient`.
- A non-Solax export with generic events (window_change + click + text_change
  but no "discharge" or "save" text) also produces
  `normalization_insufficient`.
- A Solax export that produces all 4 checkpoints proceeds normally and
  returns `literal_match` with `baselineCoverage.declared === 4` and
  `baselineCoverage.covered === 4`.
- Two new fixture files exist and match the exact content specified above.
- Five new tests exist and pass.
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
fix(recording): add normalization guard and baseline coverage to compare
```

## Phase P2: Semantic Baseline-Coverage Check and Cross-Repo Sync Test

### Agent Tier

`default`

### Goal

Make semantic compare require at least one baseline checkpoint to appear in
the actual run before classifying the result as success. Add an opt-in
cross-repo baseline sync test.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/compareRecording.ts`
- `apps/node/src/test/unit/recordingCompare.test.ts`
- `apps/node/src/test/fixtures/recording-compare/` (1 new fixture)

### Steps

1. Modify `determineOutcome` in `compareRecording.ts`. The function
   currently takes `{ compareMode, pathMatches, skillResult }`. Add a
   fourth parameter `baselineCoverage: { declared: number; covered: number }`.

   Find this block in the function body:
   ```typescript
   if (verificationStatus === "verified") {
     if (compareMode === "literal") {
       return pathMatches ? "literal_match" : "baseline_drift";
     }
     return pathMatches ? "semantic_match" : "outcome_matches_path_differs";
   }
   ```

   Replace the last line of that block with:
   ```typescript
   if (pathMatches) {
     return "semantic_match";
   }
   if (baselineCoverage.declared > 0 && baselineCoverage.covered === 0) {
     return "baseline_uncovered";
   }
   return "outcome_matches_path_differs";
   ```

2. Update the call site in `compareRecordingBaselineWithSkillResult` to pass
   `baselineCoverage` to `determineOutcome`. The call currently looks like:
   ```typescript
   const outcome = determineOutcome({
     compareMode,
     pathMatches,
     skillResult,
   });
   ```
   Change it to:
   ```typescript
   const outcome = determineOutcome({
     compareMode,
     pathMatches,
     skillResult,
     baselineCoverage,
   });
   ```

   Also update the `determineOutcome` function signature and its `options`
   type to include `baselineCoverage`.

3. Create fixture
   `apps/node/src/test/fixtures/recording-compare/solax-result-zero-coverage.skillresult.json`.
   This is a bare `SkillResult` with:
   - `source.kind: "agent"` (agent-driven, so compare uses semantic mode)
   - `status: "success"`
   - `terminalVerification.status: "verified"` (verified terminal state)
   - checkpoint IDs that do NOT overlap with the Solax baseline checkpoint
     IDs (`app_opened`, `discharge_to_row_focused`, `target_text_entered`,
     `save_completed`). Use completely different IDs like
     `login_completed`, `settings_opened`, `value_changed`,
     `confirmation_dismissed`.
   - This forces `baselineCoverage.covered === 0` with
     `baselineCoverage.declared === 4`, triggering `baseline_uncovered`.

   Use this exact content:
   ```json
   {
     "contractVersion": "1.0.0",
     "skillId": "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
     "source": {
       "kind": "agent",
       "agentCli": "codex"
     },
     "goal": {
       "kind": "set_discharge_limit",
       "percent": 40
     },
     "inputs": {
       "percent": 40
     },
     "status": "success",
     "checkpoints": [
       { "id": "login_completed", "status": "ok" },
       { "id": "settings_opened", "status": "ok" },
       { "id": "value_changed", "status": "ok" },
       { "id": "confirmation_dismissed", "status": "ok" }
     ],
     "terminalVerification": {
       "status": "verified",
       "expected": { "kind": "text", "text": "Discharge to 40%" },
       "observed": { "kind": "text", "text": "Discharge to 40%" }
     },
     "diagnostics": {
       "runtimeState": "healthy"
     }
   }
   ```

4. Add tests. In the `"recording compare outcomes"` describe block, add:

   ```typescript
   it("reports baseline_uncovered when an agent-driven run has verified terminal state but zero baseline checkpoint coverage", async () => {
     const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
     const skillResult = await readJsonFixture<SkillResult>("solax-result-zero-coverage.skillresult.json");
     const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
     assert.strictEqual(report.compareMode, "semantic");
     assert.strictEqual(report.outcome, "baseline_uncovered");
     assert.strictEqual(report.terminalVerificationStatus, "verified");
     assert.strictEqual(report.baselineCoverage.declared, 4);
     assert.strictEqual(report.baselineCoverage.covered, 0);
     assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
   });

   it("still reports outcome_matches_path_differs when an agent-driven run has baseline coverage and verified terminal state", async () => {
     const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
     const skillResult = await readJsonFixture<SkillResult>("solax-result-success-path-differs.skillresult.json");
     const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
     assert.strictEqual(report.compareMode, "semantic");
     assert.strictEqual(report.outcome, "outcome_matches_path_differs");
     assert.ok(report.baselineCoverage.covered > 0, "should have nonzero baseline coverage");
   });
   ```

5. Add the opt-in cross-repo baseline sync test. Create a new describe
   block in `recordingCompare.test.ts`:

   ```typescript
   describe("recording compare cross-repo baseline sync", () => {
     it("skills-repo retained baseline matches the Clawperator test fixture", async () => {
       const skillsRoot = process.env.CLAWPERATOR_SKILLS_ROOT;
       if (!skillsRoot) {
         return; // skip when skills repo is not configured
       }
       const canonicalPath = join(
         skillsRoot,
         "skills",
         "com.solaxcloud.starter.set-discharge-to-limit-orchestrated",
         "references",
         "compare-baseline.export.json"
       );
       const canonical = JSON.parse(await readFile(canonicalPath, "utf-8"));
       const fixture = await readJsonFixture("solax-baseline-success.export.json");
       assert.deepStrictEqual(fixture, canonical);
     });
   });
   ```

   Note: `readFile` is already imported at the top of the test file. The
   `join` function is also already imported.

6. Build and test:
   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```

   Optionally verify the cross-repo sync test:
   ```bash
   CLAWPERATOR_SKILLS_ROOT=../clawperator-skills npm --prefix apps/node run test
   ```

### Acceptance Criteria

- `determineOutcome` accepts a `baselineCoverage` parameter.
- In semantic mode with verified terminal state, a run with zero baseline
  coverage returns `baseline_uncovered` (exit 1).
- In semantic mode with verified terminal state, a run with nonzero
  baseline coverage returns `outcome_matches_path_differs` (exit 0,
  existing behavior preserved).
- The zero-coverage fixture exists with completely non-overlapping
  checkpoint IDs.
- Two new outcome tests pass.
- The cross-repo sync test exists and is skipped by default (no env var).
- When `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills` is set, the sync
  test runs and passes (assuming the skills repo baseline matches the
  fixture).
- All existing tests still pass with no modifications.
- Build succeeds.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```

### Expected Commit

```text
fix(recording): require baseline coverage for semantic compare success
```

## Phase P3: Docs and Honest Framing

### Agent Tier

`default`

### Goal

Update docs to reflect the corrected compare behavior: normalization scope,
new outcomes, and cross-repo sync guidance.

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

   - v1 baseline normalization uses Solax-specific heuristics to extract
     four structural checkpoints from the recording export: `app_opened`
     (first in-app window_change), `discharge_to_row_focused` (first click
     matching "discharge"), `target_text_entered` (last text_change with
     non-empty text), and `save_completed` (last click matching "save" or
     "confirm")
   - compare requires all four checkpoints to be extractable from the
     baseline export; if normalization produces fewer, compare returns
     `normalization_insufficient` instead of proceeding with a partial
     baseline
   - recording exports from other app flows will produce
     `normalization_insufficient` until per-skill declared checkpoint
     baselines are supported in a future release
   - every compare report includes `normalizationStrategy: "solax_heuristic"`
     so consumers know which normalization path was used
   ```

2. In the same file, find the "Current v1 compare outcomes:" list (around
   line 403). Add the two new outcomes at the end:
   ```
   - `normalization_insufficient`
   - `baseline_uncovered`
   ```

3. In the same file, find the "Current interpretation rules:" list (around
   line 415). Add interpretations for the new outcomes:
   ```
   - `normalization_insufficient` means the baseline export did not produce
     the required checkpoint set through heuristic normalization; compare
     cannot proceed and does not attempt path or terminal comparison
   - `baseline_uncovered` means terminal verification passed for an
     agent-driven run, but no baseline checkpoint IDs appeared in the
     actual run at all; this is suspicious because the baseline is
     effectively irrelevant to the path the skill took
   ```

4. In the same file, find the "Exit-code contract:" list. Add:
   ```
   - exit non-zero for `normalization_insufficient`
   - exit non-zero for `baseline_uncovered`
   ```

5. In the same file, find the "Successful semantic compare example:" JSON
   block. After the existing JSON block, add a note:
   ```
   Every compare report includes `baselineCoverage` and
   `normalizationStrategy`:

   - `baselineCoverage.declared` is the number of baseline checkpoint IDs
   - `baselineCoverage.covered` is how many of those IDs appeared in the
     actual run
   - `normalizationStrategy` is `"solax_heuristic"` in v1
   ```

6. In the same file, find the verification example that uses
   `com.example.demo.capture-state` (around line 497). Replace the skill id
   with `com.solaxcloud.starter.set-discharge-to-limit-orchestrated` and
   update the baseline path to:
   `./skills/com.solaxcloud.starter.set-discharge-to-limit-orchestrated/references/compare-baseline.export.json`

7. In `docs/skills/authoring.md`, find the existing compare-related content
   (search for "compare" - there is substantial content around lines
   107-116 and 667-686). Near the "Durable compare-baseline rule:" section
   (around line 110), add:

   ```
   Cross-repo baseline sync:

   - the Clawperator test fixtures under
     `apps/node/src/test/fixtures/recording-compare/` must stay in sync
     with the canonical retained baseline in the skills repo
   - when the canonical baseline changes, update the corresponding
     Clawperator test fixture in the same PR or the next available PR
   - to verify sync:
     `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills npm --prefix apps/node run test`
   ```

8. Rebuild docs:
   ```bash
   ./scripts/docs_build.sh
   ```
   Must succeed end to end.

### Acceptance Criteria

- `docs/api/recording.md` has a normalization scope paragraph that
  explicitly names the Solax heuristics and says non-Solax exports produce
  `normalization_insufficient`.
- The two new outcomes appear in the outcomes list and interpretation rules.
- The exit-code contract includes the two new outcomes.
- The `baselineCoverage` and `normalizationStrategy` fields are documented.
- The example skill id is the actual Solax proving skill, not a generic
  placeholder.
- `docs/skills/authoring.md` has a cross-repo baseline sync note with
  the exact validation command.
- `./scripts/docs_build.sh` succeeds.

### Validation

```bash
./scripts/docs_build.sh
```

```bash
grep -c "normalization_insufficient" docs/api/recording.md
# Must return at least 2
```

```bash
grep -c "baseline_uncovered" docs/api/recording.md
# Must return at least 2
```

```bash
grep -c "com.example.demo.capture-state" docs/api/recording.md
# Must return 0
```

```bash
grep -c "CLAWPERATOR_SKILLS_ROOT" docs/skills/authoring.md
# Must return at least 1
```

### Expected Commit

```text
docs(recording): document normalization scope and new compare outcomes
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

4. Confirm no stale references:
   ```bash
   grep -r "DEFAULT_BASELINE_CHECKPOINT_ORDER" apps/node/src/
   # Must return 0 results
   ```

   ```bash
   grep -c "com.example.demo.capture-state" docs/api/recording.md
   # Must return 0
   ```

5. Confirm new outcomes are handled:
   ```bash
   grep -c "normalization_insufficient" apps/node/src/domain/recording/compareRecording.ts
   # Must return at least 3 (type union, summarizeOutcome, guard)
   ```

   ```bash
   grep -c "baseline_uncovered" apps/node/src/domain/recording/compareRecording.ts
   # Must return at least 3 (type union, summarizeOutcome, determineOutcome)
   ```

6. If all pass, no commit is needed for this phase.

### Acceptance Criteria

- Build succeeds.
- All tests pass (existing 961 + new ones, 0 failures).
- Docs build succeeds.
- No stale constant references.
- No placeholder skill ids in docs.
- Both new outcomes appear in the implementation at least 3 times each.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test && ./scripts/docs_build.sh
```

### Expected Commit

No commit. Verification only.
