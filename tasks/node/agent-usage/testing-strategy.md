# Testing Strategy for Agent Usability PRDs

This document is the cross-cutting testing guide for `plan.md` and `prd-1.md` through
`prd-6.md`. Each PRD now contains its own concrete testing plan (fixtures, TDD sequence,
unit/integration/manual tests, and failure modes). This document covers what the PRDs
do not: the infrastructure each test plan depends on, the minimum bar for merging any PR,
the regression anchors that must never be deleted, cross-PRD dependencies that span
multiple workstreams, and the explicit list of tests that are too expensive or brittle
to be worth running.

---

## Test Infrastructure

**Fake adb (`scripts/fake_adb.sh`):**
Unit tests for adb-dependent code inject `fake_adb.sh` instead of requiring a device.
The PRD-1 testing plan adds two env var modes (`FAKE_ADB_PACKAGES=present/absent/variant`)
to the existing script. All unit tests must pass with `npm run test` on a machine with
no device attached.

**Integration tests:**
Any test labeled as an integration test in a PRD requires `CLAWPERATOR_RUN_INTEGRATION=1`
and a connected device (physical or emulator). These run on merge or explicit opt-in, not
on every commit.

**Temp directories for file-system tests:**
Tests that write to disk (PRD-5 log writer, PRD-3 compiled artifacts) must use unique
temp directories created in `beforeEach` and cleaned in `afterEach`. Never use
`~/.clawperator/` in unit tests.

**Shared fixtures:**
`test/fixtures/execution-minimal-valid.json` and `test/fixtures/execution-sentinel.json`
are shared across PRDs. Create them once; reference them from all PRDs that need them.

---

## Cross-Cutting Testing Strategy

### 1. Use tests to drive implementation (not confirm it)

The canonical sequence for every code change in this project:

1. Write the test first. Run it. Watch it fail.
2. Write the minimum code to make it pass.
3. Re-run all tests. If anything that was passing is now failing, stop and investigate
   before committing.
4. Commit the test and the code in the same commit.

This is the only way to distinguish "the gate blocks what it should block" from "the gate
blocks everything including what it should not." A green test written after the code
cannot tell you which one you have.

Each PRD specifies the order in which to write its tests. Follow that order. The
happy-path anchor always comes first.

### 2. The minimum viable test for any change

Every code change in these PRDs must have at least two tests before it can merge:

- **A failure test** — the new condition fires correctly.
- **A happy-path anchor** — the existing working path still works after the change.

These are not aspirational. They are the floor. A failure test without a happy-path
anchor cannot distinguish a correct guard from an over-broad guard. This has already
caused a review finding in PRD-1 (the original plan had no happy-path anchor for the
APK pre-flight).

### 3. What counts as "done testing" for a PR

Before a PR is merged, all of the following must be true:

1. `npm run test` passes with no skipped tests added in the PR.
2. Every regression anchor listed in the table below for this PRD is present and passing.
3. The happy-path anchor for every changed code path is present and passing.
4. No existing test was deleted or made less strict to make the new tests pass.
5. Integration tests pass under `CLAWPERATOR_RUN_INTEGRATION=1` on a connected device
   for any change that touches device dispatch, logging, or skill execution.

This is five conditions, not twenty. A PR that satisfies all five is done. Do not add
test coverage beyond this unless a specific failure mode is identified that none of the
existing tests would catch.

### 4. Tests that are not worth writing

The following test categories have a poor return on investment for a project at this
stage. Skip them unless there is a specific, identified failure mode they would catch
that nothing else would catch.

| Category | Why to skip |
| :--- | :--- |
| Timing bounds (e.g., `elapsedMs < timeoutMs + 500`) | Flaky under CI load; a positive integer check is sufficient |
| URL reachability in CI (`curl docsUrl → HTTP 200`) | Network-dependent, offline CI breaks; do one manual check before shipping |
| Concurrent append atomicity | Platform-dependent, hard to make reliable; document the assumption instead |
| Every permutation of log level | Flag parsing is covered by one test; level filtering is configuration logic, not algorithmic |
| `onOutput` callback throws and skill continues | High setup cost, low real-world risk; caller bug, not a library bug |
| Exhaustive action type validation | PRD-2 covers the extraction logic with 2-3 cases; more cases add no information |
| Generated docs content (`sites/docs/docs/`) | Generated output; test the source files and the generator, not the output |

### 5. Regression prevention for the highest-risk changes

The three changes most likely to silently break something:

**PRD-1 gate in `runExecution.ts`:** An over-broad guard blocks all commands even when
the APK is present. The happy-path anchor (T6 in PRD-1: APK present → broadcast IS
called) is the only thing that catches this. It must be written before the guard is
added, not after.

**PRD-2 `validateExecution.ts` enrichment:** The new fields must be additive. The
regression anchor (T2 in PRD-2: existing `details.path` and `details.reason` still
present) must survive every refactor of this function. If it breaks, existing agent
error-handling code silently stops receiving the fields it depends on.

**PRD-4 streaming change:** `SkillRunResult.output` must still contain the full
accumulated string even when `onOutput` is also provided. The anchor (T3 in PRD-4:
output still full string with callback active) prevents `--expect-contains` from
silently starting to operate on empty strings.

---

## Regression Anchors (Never Delete These)

The following tests protect the most critical behaviors from silent regression. Once
written, do not delete or weaken them. If a later change makes one of these tests fail,
that is a signal to investigate, not to update the test.

| Anchor | PRD | Failure mode it prevents |
| :--- | :--- | :--- |
| `checkApkPresence` with APK present → `status: "pass"` | 1 | Over-broad gate blocks all commands |
| `runExecution` with APK present → broadcast IS called | 1 | Gate never lets anything through |
| `RECEIVER_VARIANT_MISMATCH` → `status: "warn"`, not `"fail"` | 1 | Accidental severity escalation |
| `doctor --check-only` → exits 0 regardless of APK state | 1 | Breaking the installer's JSON-parsing flow |
| `validateExecution` with valid payload → no throw | 2 | False-positive validation rejections |
| `details.path` and `details.reason` present after PRD-2 change | 2 | Additive change becoming destructive |
| `skills validate` without `--dry-run` on invalid artifact → `ok: true` | 3 | Changing existing behavior of base command |
| `runSkill` without `callbacks` → output accumulated and returned | 4 | Breaking existing callers of `runSkill` |
| `--expect-contains` with split output → operates on full accumulated string | 4 | Check moved accidentally to per-chunk evaluation |
| Log writer failure → command still completes | 5 | Logging crashing the CLI |
| Log writer creates parseable NDJSON entries | 5 | Agents failing to read logs |
| `renderCheck` without `docsUrl` → no `Docs:` line emitted | 6 | Phantom docs lines on existing checks |

---

## Cross-PRD Test Dependencies

These are integration-level checks that must be run after multiple PRDs have landed.
Each one verifies that two workstreams did not silently interfere with each other.

**PRD-2 → PRD-3:**
`--dry-run` failure output uses the PRD-2 enriched error format. After both land, run
`skills validate --dry-run test-skill-invalid-artifact --output json` and verify the
response contains `actionId`, `actionType`, `invalidKeys`, and `hint` (not just `code`
and `message`).

**PRD-2 → PRD-5:**
`RESULT_ENVELOPE_TIMEOUT` gains fields from both PRDs. After both land, trigger a
timeout and verify `details` contains `commandId`, `taskId`, `lastActionId`,
`lastActionCaveat`, `elapsedMs`, `timeoutMs`, and `logPath` simultaneously. Neither
workstream should have dropped the other's fields.

**PRD-1 → PRD-5:**
`preflight.apk.pass` and `preflight.apk.missing` events are emitted by the gate added in
PRD-1 and logged by the infrastructure added in PRD-5. After both land, run one execute
with APK absent and one with APK present; verify each corresponding event appears in the
log file.

**PRD-5 → PRD-6:**
`docs/troubleshooting.md` documents `~/.clawperator/logs/` as the log path. Verify the
actual path written by the PRD-5 infrastructure matches the path documented in the PRD-6
docs update. Mismatches here mean agents following the docs read the wrong file.

---

## Final Validation Before the Last PR

After all six PRDs have landed, run:

1. `npm run test` — all unit tests, no skipped.
2. `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_smoke_core.sh`
3. `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_smoke_skills.sh`
4. All four cross-PRD tests listed above.

If all four pass with no regressions from the baseline before this work started, the
project is done.
