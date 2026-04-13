# Recording Compare Closeout Work Breakdown

Parent plan: `tasks/recording/compare-closeout/plan.md`

## Executive Summary

Total PRs: 1. Total phases: 4. All phases are in one PR on the existing
`skills/compare` branch. Phase order: P1 (normalization guard, coverage
computation, constant rename, new outcomes), P2 (semantic coverage policy
and structural cross-repo sync test), P3 (docs and framing), P4 (final
verification). One commit per phase except P4 (verification only).

## Status

| Item | Value |
| --- | --- |
| State | in progress |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | P1, P2, P3 |
| Remaining | P4 |
| Current / Next | P4 |
| Blockers | none |

## Hard Rules

- Follow this task pack closely. Do not treat it as optional guidance.
- Use TDD for each closeout behavior change whenever practical:
  add the failing test first, confirm it fails for the expected reason, then
  implement the code change.
- Do not modify any existing test case. Only add new ones.
- Do not modify existing fixture files unless that refresh is required to
  restore truthful alignment with the canonical retained baseline. When a
  fixture refresh is required, keep the change narrowly scoped and document
  why the previous fixture was stale.
- Do not modify `findFirstDivergence`, `comparableActualCheckpoints`,
  `inferredCompareMode`, or `terminalVerificationStatus`. Those functions
  are correct and out of scope.
- Do not build the cross-repo sync test around raw-file equality. It must
  compare structural normalization output and compare behavior so harmless
  metadata differences do not cause false failures.
- Do not modify the CLI handler in `record.ts`.
- Do not modify the behavioral dispatch for `recording compare` in
  `registry.ts`; help text updates are allowed and required in P3.
- Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
  after P1 and P2 to confirm all existing tests still pass alongside new
  ones.
- Run `./scripts/docs_build.sh` after P3.
- Use conventional commit messages exactly as specified in each phase.
- Work on the existing `skills/compare` branch. Do not create a new branch.
- Keep a running execution log in
  `tasks/recording/compare-closeout/findings.md`.
- `findings.md` is for execution control only. Do not treat it as durable
  shipped documentation or part of the compare contract.
- When you complete a phase, add a short entry to `findings.md` covering:
  what changed, what validation ran, what remains, and any newly discovered
  risks or follow-ups.
- If you encounter an undocumented requirement or issue:
  - do it now if it is necessary to keep compare truthful, fail-closed, or
    at the validation bar required by this pack
  - otherwise record it in `findings.md` and defer it
- Do not silently expand scope. If scope grows, `findings.md` should say why.

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
| `apps/node/src/cli/registry.ts` | Update `recording compare` help text so it describes the shipped Solax heuristic path honestly |

Before changing code, create or update:

- `tasks/recording/compare-closeout/findings.md`

Use it as the execution log for this task pack. Keep entries short and
decision-oriented.

Recommended entry shape:

```markdown
## <date or phase label>

- Phase: P1 / P2 / P3 / P4
- Changed: short summary of what was implemented
- Validation: exact commands run and whether they passed
- Discovered: new requirement, issue, or ambiguity found during execution
- Decision: did now / deferred
- Follow-up: only if something was deferred
```

## Test Matrix

The closeout must leave behind an explicit regression matrix for the Solax
heuristic path. At minimum, the implementation should be covered by tests
for all of these classes:

| Class | Expected outcome |
| --- | --- |
| canonical replay baseline success | `literal_match` |
| canonical orchestrated success with full overlap | `semantic_match` or `outcome_matches_path_differs`, depending on fixture path |
| semantic success with healthy alternate path and sufficient overlap | `outcome_matches_path_differs` |
| semantic success with zero overlap | `baseline_uncovered` |
| semantic success with trivial overlap below threshold | `baseline_weakly_covered` |
| non-Solax or weak baseline with zero extracted checkpoints | `normalization_insufficient` |
| non-Solax or weak baseline with partial extracted checkpoints | `normalization_insufficient` |
| verification failure with matching baseline path | `verification_failed` |
| indeterminate verification with matching baseline path | `verification_indeterminate` |
| upstream failed skill result | `upstream_failure` |
| poisoned runtime signal | `runtime_poisoned` |
| unavailable runtime signal | `runtime_unavailable` |
| CLI path for fail-closed outcomes | non-zero exit, typed JSON outcome |
| cross-repo canonical baseline sync when enabled | structural parity with fixture |

If a listed class is already covered by an existing test, do not duplicate it.
Instead, cite the existing test while adding only the missing coverage.

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Compare closeout | P1, P2, P3, P4 | `default` | none |

## Phase P1: Normalization Guard, Coverage Computation, New Outcomes

### Agent Tier

`default`

### Goal

Make compare fail-closed when heuristic normalization cannot extract the
full Solax checkpoint set. Add baseline-coverage metrics plus the minimum
semantic-coverage policy to the report. Rename the Solax-specific constant.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/compareRecording.ts`
- `apps/node/src/test/unit/recordingCompare.test.ts`
- `apps/node/src/test/fixtures/recording-compare/` (3 new fixtures)

### Steps

1. In `compareRecording.ts`, rename the constant `DEFAULT_BASELINE_CHECKPOINT_ORDER`
   (line 84) to `SOLAX_BASELINE_CHECKPOINT_ORDER`. Update the one reference
   to it at line 267. Search the file for any other references and update
   them. There should be exactly 2 occurrences total (declaration and usage).

2. Add three new members to the `RecordingCompareOutcome` type union.
   Place them after `"runtime_unavailable"`:
   ```typescript
   | "normalization_insufficient"
   | "baseline_uncovered"
   | "baseline_weakly_covered";
   ```

3. Add three new fields to the `RecordingCompareReport` interface.
   Place them after the `actual` field and before `firstDivergence`:
   ```typescript
   baselineCoverage: {
     declared: number;
     covered: number;
   };
   normalizationStrategy: "solax_heuristic";
   minimumSemanticCoverage: number;
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

5. Add a new constant near `SOLAX_BASELINE_CHECKPOINT_ORDER`:
   ```typescript
   const SOLAX_MINIMUM_SEMANTIC_COVERAGE = 2;
   ```
   Rationale: a single overlapping checkpoint such as `app_opened` is too
   weak to make semantic compare helpful or trustworthy.

6. In `summarizeOutcome`, add cases for the three new outcomes:
   ```typescript
   case "normalization_insufficient":
     return "baseline normalization could not extract the required checkpoint set from this recording export";
   case "baseline_uncovered":
     return "terminal verification passed but no baseline checkpoints appeared in the actual run";
   case "baseline_weakly_covered":
     return "terminal verification passed but baseline coverage was too weak to treat compare as trustworthy";
   ```

7. In `isMeaningfulCompareDivergence`, confirm the function already returns
   `true` for the new outcomes. It uses an inclusion list of the three
   success outcomes (`literal_match`, `semantic_match`,
   `outcome_matches_path_differs`), so any outcome not in that list
   automatically returns `true`. No code change needed here, but verify
   by reading the function.

8. Modify `compareRecordingBaselineWithSkillResult`. The current function
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
       minimumSemanticCoverage: SOLAX_MINIMUM_SEMANTIC_COVERAGE,
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
   minimumSemanticCoverage: SOLAX_MINIMUM_SEMANTIC_COVERAGE,
   ```

9. Create fixture
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

10. Create fixture
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

11. Add tests in `recordingCompare.test.ts`. In the
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

    Add a dedicated test for the new report fields (do not modify existing
    tests):

    ```typescript
    it("includes baselineCoverage and normalizationStrategy in a successful compare report", async () => {
      const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
      const skillResult = await readJsonFixture<SkillResult>("solax-result-replay-success.skillresult.json");
      const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
      assert.strictEqual(report.outcome, "literal_match");
      assert.strictEqual(report.normalizationStrategy, "solax_heuristic");
      assert.strictEqual(report.minimumSemanticCoverage, 2);
      assert.strictEqual(report.baselineCoverage.declared, 4);
      assert.strictEqual(report.baselineCoverage.covered, 4);
    });
    ```

12. Build and test:
    ```bash
    npm --prefix apps/node run build && npm --prefix apps/node run test
    ```
    All tests must pass (existing 961 + new ones).

13. Before committing, review the Test Matrix above and confirm P1 now
    covers the two normalization-insufficient classes plus one success-path
    report-shape assertion. Do not assume later phases will backfill missing
    normalization coverage.

### Acceptance Criteria

- `DEFAULT_BASELINE_CHECKPOINT_ORDER` no longer exists anywhere in the
  codebase. `SOLAX_BASELINE_CHECKPOINT_ORDER` exists in its place.
- `"normalization_insufficient"`, `"baseline_uncovered"`, and
  `"baseline_weakly_covered"` are in the
  `RecordingCompareOutcome` type union.
- `isMeaningfulCompareDivergence` returns `true` for all three new outcomes.
- `summarizeOutcome` handles all three new outcomes without throwing.
- Every `RecordingCompareReport` includes `baselineCoverage` and
  `normalizationStrategy`.
- Every `RecordingCompareReport` includes
  `minimumSemanticCoverage === 2`.
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

## Phase P2: Semantic Coverage Policy and Structural Cross-Repo Sync Test

### Agent Tier

`default`

### Goal

Make semantic compare require more than trivial baseline coverage before it
is allowed to classify a verified agent-driven run as success. Add an
opt-in developer-side cross-repo sync guard that compares structure and
compare behavior, not raw file bytes.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/compareRecording.ts`
- `apps/node/src/test/unit/recordingCompare.test.ts`
- `apps/node/src/test/fixtures/recording-compare/` (3 new fixtures)

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
   if (baselineCoverage.covered < SOLAX_MINIMUM_SEMANTIC_COVERAGE) {
     return "baseline_weakly_covered";
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

4. Create fixture
   `apps/node/src/test/fixtures/recording-compare/solax-result-single-coverage.skillresult.json`.
   This is a bare `SkillResult` with:
   - `source.kind: "agent"`
   - `status: "success"`
   - `terminalVerification.status: "verified"`
   - exactly one overlapping baseline checkpoint ID, and that overlap is
     only `app_opened`
   - all other checkpoint IDs are non-overlapping

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
       { "id": "app_opened", "status": "ok" },
       { "id": "login_completed", "status": "ok" },
       { "id": "settings_opened", "status": "ok" },
       { "id": "value_changed", "status": "ok" }
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

5. Create fixture
   `apps/node/src/test/fixtures/recording-compare/solax-skills-run-single-coverage.json`.
   Create it by copying `solax-skills-run-success.json` and replacing its
   top-level `skillResult` object with the exact contents of
   `solax-result-single-coverage.skillresult.json`. Leave the rest of the
   wrapper shape intact so the CLI test still exercises wrapper parsing.

6. Add tests. In the `"recording compare outcomes"` describe block, add:

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

   it("reports baseline_weakly_covered when an agent-driven run covers only one baseline checkpoint", async () => {
     const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
     const skillResult = await readJsonFixture<SkillResult>("solax-result-single-coverage.skillresult.json");
     const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
     assert.strictEqual(report.compareMode, "semantic");
     assert.strictEqual(report.outcome, "baseline_weakly_covered");
     assert.strictEqual(report.baselineCoverage.declared, 4);
     assert.strictEqual(report.baselineCoverage.covered, 1);
     assert.strictEqual(report.minimumSemanticCoverage, 2);
     assert.strictEqual(isMeaningfulCompareDivergence(report.outcome), true);
   });

   it("still reports outcome_matches_path_differs when an agent-driven run has baseline coverage and verified terminal state", async () => {
     // This fixture has 4/4 baseline checkpoint overlap (app_opened,
     // discharge_to_row_focused, target_text_entered, save_completed),
     // so it satisfies the minimum semantic coverage threshold of 2.
     const baseline = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
     const skillResult = await readJsonFixture<SkillResult>("solax-result-success-path-differs.skillresult.json");
     const report = compareRecordingBaselineWithSkillResult(baseline, skillResult);
     assert.strictEqual(report.compareMode, "semantic");
     assert.strictEqual(report.outcome, "outcome_matches_path_differs");
     assert.ok(report.baselineCoverage.covered >= 2, "should satisfy minimum semantic coverage");
   });
   ```

7. In the `"recording compare CLI"` describe block, add:

   ```typescript
   it("returns exit code 1 with normalization_insufficient for a baseline that does not satisfy the Solax heuristic set", async () => {
     const { stdout, code } = await runCli([
       "recording",
       "compare",
       "--baseline",
       join(fixturesRoot, "non-solax-generic-events.export.json"),
       "--result",
       join(fixturesRoot, "solax-skills-run-success.json"),
       "--output",
       "json",
     ]);

     assert.strictEqual(code, 1, stdout);
     const parsed = JSON.parse(stdout) as { outcome?: string; normalizationStrategy?: string };
     assert.strictEqual(parsed.outcome, "normalization_insufficient");
     assert.strictEqual(parsed.normalizationStrategy, "solax_heuristic");
   });

   it("returns exit code 1 with baseline_weakly_covered for a semantic run below the minimum coverage threshold", async () => {
     const { stdout, code } = await runCli([
       "recording",
       "compare",
       "--baseline",
       join(fixturesRoot, "solax-baseline-success.export.json"),
       "--result",
       join(fixturesRoot, "solax-skills-run-single-coverage.json"),
       "--output",
       "json",
     ]);

     assert.strictEqual(code, 1, stdout);
     const parsed = JSON.parse(stdout) as { outcome?: string; minimumSemanticCoverage?: number };
     assert.strictEqual(parsed.outcome, "baseline_weakly_covered");
     assert.strictEqual(parsed.minimumSemanticCoverage, 2);
   });
   ```

8. Add the opt-in cross-repo baseline sync test. Create a new describe
   block in `recordingCompare.test.ts`:

   ```typescript
   describe("recording compare cross-repo baseline sync", () => {
     it("skills-repo retained baseline matches the Clawperator fixture structurally", async () => {
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
       const canonical = await loadRecordingExportBaselineFile(canonicalPath);
       const fixture = await readJsonFixture<RecordingExportArtifact>("solax-baseline-success.export.json");
       assert.deepStrictEqual(
         normalizeRecordingExportForCompare(canonical),
         normalizeRecordingExportForCompare(fixture)
       );

       const successFixture = await readJsonFixture<SkillResult>("solax-result-success.skillresult.json");
       const canonicalReport = compareRecordingBaselineWithSkillResult(canonical, successFixture);
       const fixtureReport = compareRecordingBaselineWithSkillResult(fixture, successFixture);
       assert.strictEqual(canonicalReport.outcome, fixtureReport.outcome);
       assert.deepStrictEqual(canonicalReport.baseline.checkpointIds, fixtureReport.baseline.checkpointIds);
     });
   });
   ```

   Add any required imports from `compareRecording.ts` rather than using raw
   JSON equality. The test should fail only when compare-relevant structure
   drifts.

   Whether this sync guard passes, fails, or is skipped because
   `CLAWPERATOR_SKILLS_ROOT` is not set, record that result in
   `tasks/recording/compare-closeout/findings.md`.

9. Build and test:
   ```bash
   npm --prefix apps/node run build && npm --prefix apps/node run test
   ```

   Optionally verify the cross-repo sync test:
   ```bash
   CLAWPERATOR_SKILLS_ROOT=../clawperator-skills npm --prefix apps/node run test
   ```

   If the sync guard fails because the checked-in Clawperator fixture is
   stale relative to the canonical retained baseline, refresh the fixture in
   this task. That refresh is allowed even though the default rule is to
   avoid modifying existing fixtures.

10. Before committing, review the Test Matrix above and confirm P2 now
    covers both semantic fail-closed classes (`baseline_uncovered`,
    `baseline_weakly_covered`), preserves the healthy alternate-path success
    case, and exercises the CLI path for at least one fail-closed semantic
    outcome.

### Acceptance Criteria

- `determineOutcome` accepts a `baselineCoverage` parameter.
- In semantic mode with verified terminal state, a run with zero baseline
  coverage returns `baseline_uncovered` (exit 1).
- In semantic mode with verified terminal state, a run with baseline
  coverage of `1` returns `baseline_weakly_covered` (exit 1).
- In semantic mode with verified terminal state, a run with baseline
  coverage that meets the minimum threshold returns
  `outcome_matches_path_differs` (exit 0, existing behavior preserved).
- The zero-coverage fixture exists with completely non-overlapping
  checkpoint IDs.
- The single-coverage fixture exists and overlaps only on `app_opened`.
- The wrapper fixture `solax-skills-run-single-coverage.json` exists and
  preserves the normal `skills run --json` top-level shape.
- Three new outcome tests pass.
- Two new CLI tests pass for the fail-closed outcomes.
- The cross-repo sync test exists and is skipped by default (no env var).
- When `CLAWPERATOR_SKILLS_ROOT=../clawperator-skills` is set, the sync
  test runs and passes when the canonical baseline remains structurally
  aligned with the fixture.
- If the canonical retained baseline is already out of sync, the task may
  refresh the checked-in fixture and should do so rather than leaving the
  pack in a detect-but-don't-fix state.
- The closeout summary and `findings.md` both describe the sync guard as a
  developer-side validation aid for this branch, not as CI-enforced
  durability or a fully solved retained-baseline ownership story.
- All existing tests still pass with no modifications.
- Build succeeds.
- The compare Test Matrix is satisfied either by new tests in this phase or
  by explicitly cited existing tests.

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
new outcomes, semantic-coverage policy, report fields, and cross-repo sync
guidance.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `apps/node/src/cli/registry.ts`

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
   - this closeout makes the Solax heuristic path honest and fail-closed;
     it does not make compare generic
   ```

2. In the same file, find the "Current v1 compare outcomes:" list (around
   line 403). Add the three new outcomes at the end:
   ```
   - `normalization_insufficient`
   - `baseline_uncovered`
   - `baseline_weakly_covered`
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
   - `baseline_weakly_covered` means terminal verification passed for an
     agent-driven run, but the overlap with the baseline was below the
     minimum trusted threshold for the Solax heuristic path
   ```

4. In the same file, find the "Exit-code contract:" list. Add:
   ```
   - exit non-zero for `normalization_insufficient`
   - exit non-zero for `baseline_uncovered`
   - exit non-zero for `baseline_weakly_covered`
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
   - `minimumSemanticCoverage` is `2` in v1 for the Solax heuristic path
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
   - this is a developer-side guard for the closeout branch, not the final
     durability mechanism; the generic compare follow-on should wire
     canonical-baseline provenance into CI or another required validation path
   ```

8. In `apps/node/src/cli/registry.ts`, update the `HELP_RECORDING_COMPARE`
   text so it matches the shipped closeout scope. The help must say, in one
   short note block, that:

   - v1 compare currently uses the Solax heuristic normalization path
   - compare fails closed when the retained baseline does not satisfy that
     heuristic checkpoint set
   - generic per-skill compare is follow-on work, not part of the shipped
     W4 closeout

   Keep the surface concise. Do not add a long essay to CLI help.

9. Rebuild docs:
   ```bash
   ./scripts/docs_build.sh
   ```
   Must succeed end to end.

10. Add or update one short documentation line that points future readers to
    the fact that the current trust bar is enforced by fixture-backed tests,
    not by a generic per-skill compare contract.

### Acceptance Criteria

- `docs/api/recording.md` has a normalization scope paragraph that
  explicitly names the Solax heuristics and says non-Solax exports produce
  `normalization_insufficient`.
- `docs/api/recording.md` explicitly says this closeout is Solax-specific
  and fail-closed, not generic compare completion.
- `apps/node/src/cli/registry.ts` help text for `recording compare`
  explicitly describes the shipped Solax heuristic path honestly.
- The three new outcomes appear in the outcomes list and interpretation
  rules.
- The exit-code contract includes the three new outcomes.
- The `baselineCoverage` and `normalizationStrategy` fields are documented.
- The `minimumSemanticCoverage` field and Solax v1 threshold are documented.
- The example skill id is the actual Solax proving skill, not a generic
  placeholder.
- `docs/skills/authoring.md` has a cross-repo baseline sync note with
  the exact validation command.
- `./scripts/docs_build.sh` succeeds.
- The docs make clear that this closeout is backed by fixture-driven
  regression coverage for the current Solax heuristic path.

### Validation

```bash
./scripts/docs_build.sh
```

```bash
grep -n "Solax" apps/node/src/cli/registry.ts
# Must show the new compare help note
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
grep -c "baseline_weakly_covered" docs/api/recording.md
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

   ```bash
   grep -c "baseline_weakly_covered" apps/node/src/domain/recording/compareRecording.ts
   # Must return at least 3 (type union, summarizeOutcome, determineOutcome)
   ```

6. If all pass, no commit is needed for this phase.

7. If `npm --prefix apps/node run test` is still red, do not call the
   branch PR-ready in the closeout summary. Report the current failing
   validation honestly, separate compare-specific results from unrelated
   failures, and stop short of a PR-ready conclusion.

8. In the closeout summary and final `findings.md` entry, state the accepted
   limitations explicitly:
   - the cross-repo sync guard is opt-in and developer-side for this branch,
     not CI-enforced durability
   - `minimumSemanticCoverage = 2` is a temporary Solax-specific trust policy,
     not a generic semantic-compare contract

### Acceptance Criteria

- Build succeeds.
- All tests pass on the current branch state, including the full
  `npm --prefix apps/node run test` suite.
- Docs build succeeds.
- No stale constant references.
- No placeholder skill ids in docs.
- All three new outcomes appear in the implementation at least 3 times each.
- If the full Node suite is not green, the task does not claim PR readiness.
- The final closeout summary explicitly calls out the accepted limitations of
  the opt-in sync guard and the temporary Solax-specific semantic threshold.

### Validation

```bash
npm --prefix apps/node run build && npm --prefix apps/node run test && ./scripts/docs_build.sh
```

### Expected Commit

No commit. Verification only.
