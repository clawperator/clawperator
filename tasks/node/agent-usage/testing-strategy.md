# Testing Strategy for Agent Usability PRDs

This document is the cross-cutting testing guide for `plan.md` and `prd-1.md` through
`prd-6.md`. Each PRD contains its own concrete testing plan. This document covers the
shared infrastructure, the minimum bar for merging, the regression anchors that must
stay in place, and the cross-PRD tests that only matter after multiple workstreams land.

---

## Philosophy

We are not optimizing for coverage. We are optimizing for confidence on critical paths
and fast feedback during development. The goal is to catch the bugs that actually hurt —
an over-broad gate, a broken accumulation path, a privacy leak in logs — not to achieve
a number.

The practical rules:
- Every code change needs exactly two tests: a failure test and a happy-path anchor.
  Without both, you cannot tell an over-broad guard from a correct one.
- Write the test before the code change. Run it first — it must fail. Make the change.
  It must pass. Nothing else that was passing should now fail.
- Unit tests run in seconds and need no device. Prefer them. Use integration tests only
  for things unit tests cannot reach (CLI output format, real device behavior).
- When in doubt about whether a test is worth writing, ask: what real bug does this
  catch that nothing else would catch? If the answer is unclear, skip it.

---

## Test Infrastructure

**Fake adb (`scripts/fake_adb.sh`):**
Unit tests for adb-dependent code inject `fake_adb.sh` via an env var instead of
requiring a device. PRD-1 adds three modes via `FAKE_ADB_PACKAGES=present|absent|variant`.
All unit tests must pass with `npm run test` on a machine with no device attached.

**Integration tests:**
Run under `CLAWPERATOR_RUN_INTEGRATION=1` with a connected device. Run on merge or
explicit opt-in, not on every commit.

**Temp directories:**
Tests that write files (PRD-5 log writer, PRD-3 fixtures) use unique temp directories
per test, created in `beforeEach` and cleaned in `afterEach`. Never use
`~/.clawperator/` in unit tests.

**Shared fixtures:**
`test/fixtures/execution-minimal-valid.json` is used across PRDs. Create once; reference
from all PRDs that need it.

---

## Merge Gate

Before merging any PR:

1. `npm run test` passes with no skipped tests added in this PR.
2. Every regression anchor for this PRD (see table below) is present and passing.
3. The happy-path anchor for every changed code path is present and passing.
4. No existing test was deleted or made less strict to make new tests pass.
5. Integration tests pass under `CLAWPERATOR_RUN_INTEGRATION=1` for any change that
   touches device dispatch, logging, or skill execution.

That is the complete gate. Do not add to it.

---

## What Not to Test

These categories have poor return on investment at this stage. Skip them unless there
is a specific failure mode they would catch that nothing else would.

| Category | Why to skip |
| :--- | :--- |
| Timing bounds on `elapsedMs` | Flaky under CI load; checking it is a positive integer is enough |
| URL reachability (`curl docsUrl`) | Network-dependent; verify once manually before shipping |
| Concurrent log append atomicity | Platform-dependent; document the assumption instead |
| All log level permutations | Level filtering is config logic; one test per flag covers it |
| Every invalid action type permutation | Two index cases in PRD-2 cover the extraction logic |
| Generated docs content (`sites/docs/docs/`) | Test the source files and the generator, not the output |

---

## Regression Anchors

Once written, do not delete or weaken these. If a later change causes one to fail,
that is a signal to investigate — not to update the test.

| Anchor | PRD | Failure mode it prevents |
| :--- | :--- | :--- |
| `checkApkPresence` with APK present → `status: "pass"` | 1 | Over-broad gate blocks all commands |
| `runExecution` with APK present → broadcast IS called | 1 | Gate never lets anything through |
| `RECEIVER_VARIANT_MISMATCH` → `status: "warn"`, not `"fail"` | 1 | Dev-APK users hard-blocked |
| `doctor --check-only` → exits 0 regardless of APK state | 1 | Installer bails instead of reading JSON |
| `validateExecution` with valid payload → no throw | 2 | False-positive validation rejections |
| `details.path` and `details.reason` present after PRD-2 change | 2 | Additive change becomes destructive |
| `skills validate` (no flag) on invalid artifact → `ok: true` | 3 | Flag changes existing behavior |
| `runSkill` without `callbacks` → output accumulated and returned | 4 | Existing call sites break |
| `--expect-contains` with split output → operates on full string | 4 | Check moves to per-chunk evaluation |
| Log writer failure → command still completes | 5 | Logging crashes the CLI |
| NDJSON entries are parseable with `JSON.parse` | 5 | Agents fail to read logs |
| `renderCheck` without `docsUrl` → no `Docs:` line | 6 | Phantom lines on all existing checks |

---

## Cross-PRD Tests

Run these after both workstreams have landed. One check per dependency pair.

**PRD-2 → PRD-3:**
Run `skills validate --dry-run test-skill-invalid-artifact --output json`. Verify
the response contains `actionId`, `actionType`, `invalidKeys`, and `hint` — not just
`code` and `message`.

**PRD-2 → PRD-5:**
Trigger a timeout. Verify `details` contains `commandId`, `lastActionId`,
`lastActionCaveat`, `elapsedMs`, `timeoutMs`, and `logPath` simultaneously. Neither
workstream should drop the other's fields.

**PRD-1 → PRD-5:**
Run one execute with APK absent, one with APK present. Verify the log contains
`preflight.apk.missing` and `preflight.apk.pass` respectively.

**PRD-5 → PRD-6:**
Check that the log path documented in `docs/troubleshooting.md` matches the actual
path written by the log infrastructure.

---

## Final Validation (After All PRDs Land)

1. `npm run test` — all unit tests pass, nothing skipped.
2. `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_smoke_core.sh`
3. `CLAWPERATOR_RUN_INTEGRATION=1 ./scripts/clawperator_smoke_skills.sh`
4. The four cross-PRD tests above.
