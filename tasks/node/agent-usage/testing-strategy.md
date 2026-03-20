# Testing Strategy for Agent Usability PRDs

This document is the testing supplement for `plan.md` and `prd-1.md` through `prd-6.md`.
It covers gaps in the per-PRD validation plans, the test-driven implementation order for
each workstream, regression anchors that must not be deleted, cross-PRD test dependencies,
and the infrastructure assumptions tests depend on.

---

## Honest Assessment of the Current Validation Plans

The current validation plans have three structural weaknesses:

**1. Post-hoc verification, not implementation drivers.**
Every test is written in "verify at the end" style. None of the plans say what to write
first. This produces tests that confirm what the code does rather than tests that prove
it does what was intended. For contract-changing work (PRD-1, PRD-2) this is a
meaningful risk: a gate that blocks everything and a gate that blocks only missing APKs
can both pass the currently described tests.

**2. Happy-path regression coverage is absent.**
Every validation plan tests the new failure case. None explicitly test that the system
still works normally after the change. A gate added to `runExecution.ts` that is too
broad will not be caught by any test in the current PRD-1 plan.

**3. Edge cases for optional and boundary conditions are underspecified.**
Missing: absent optional fields (commandId/taskId), action at index 0 vs. last index,
empty artifact arrays, onOutput throwing, concurrent log writes, NDJSON parseability,
logPath pointing to the actual file written.

These are fixed below per PRD. The existing test descriptions are kept; the additions
are labeled `[MISSING - ADD]`.

---

## Test Infrastructure Assumptions

The existing `scripts/fake_adb.sh` provides a scriptable adb double. Unit tests for
adb-dependent code should inject a fake adb path rather than requiring a connected
device. The unit test suite (`npm run test`) must run without any device.

Integration tests (labeled "Integration test" in the validation plans) require a
connected device or emulator and run under `CLAWPERATOR_RUN_INTEGRATION=1`.

The distinction matters for CI: unit tests run on every PR; integration tests run on
merge or on explicit opt-in.

---

## PRD-1: Readiness Gate - Test Order and Missing Coverage

**Implementation order (write these first):**

1. Unit: `isCriticalDoctorCheck("readiness.apk.presence")` → `true`. This drives the
   two-line `criticalChecks.ts` change. Write it before changing the file.
2. Unit: `checkApkPresence` with mock "package not listed" → `status: "fail"`. Write
   before changing `readinessChecks.ts`.
3. Unit: `checkApkPresence` with mock "package listed" → `status: "pass"`. Write at
   the same time as (2). **This is the happy-path anchor.** Without it, a regression
   that always returns fail goes undetected.
4. Unit: `runExecution` with mock failed APK check → returns `RECEIVER_NOT_INSTALLED`
   before `broadcastAgentCommand` is called. Write before adding the preflight guard.
5. Unit: `runExecution` with mock passing APK check + mock successful broadcast →
   returns `ok: true`. **This is the second happy-path anchor.** Without it, an
   over-broad gate is invisible.
6. Integration: execute fails fast with APK absent.
7. Integration: execute succeeds with APK present.

**Missing tests `[ADD]`:**

- `checkApkPresence` with mock "package listed" → `status: "pass"`. (Happy path,
  regression anchor. Currently missing from the validation plan.)
- `RECEIVER_VARIANT_MISMATCH` case: mock shows wrong variant installed → result is
  `status: "warn"`, not `"fail"`. (Explicit regression test that the severity change
  was scoped correctly and did not accidentally promote the variant mismatch case.)
- `runExecution` with APK present → `broadcastAgentCommand` IS called, not skipped.
  (Regression anchor: the gate must not over-fire.)
- `install.sh` JSON parsing: the installer reads `doctor --format json` output with
  `status: "fail"` for the APK check and still proceeds to install, not bails. This
  is a script-level regression test for the installer's conditional logic.
- `doctor --output json` with APK absent → JSON is parseable and contains `status:
  "fail"` in the APK check, plus `fix.steps` with the install command.

---

## PRD-2: Error Context - Test Order and Missing Coverage

**Implementation order:**

1. Unit: `validateExecution` with a payload containing a known-invalid param
   (`format: "ascii"` on `snapshot_ui`) → `ValidationFailure.details` includes
   `actionId` and `actionType`. Write before modifying `validateExecution.ts`.
2. Unit: `validateExecution` with a fully valid payload → `Execution` returned, no
   throw. **Happy-path anchor.** This must be in place before any schema change.
3. Unit: `validateExecution` with invalid param at index 0, at middle index, at last
   index → `actionId` is correct in all three cases. (The Zod path extraction uses
   `path[1]` as the numeric index - verify it's correct for each position.)
4. Unit: timeout enrichment with payload that has `commandId` and `taskId` → both
   present in error details.
5. Unit: timeout enrichment with payload that omits `commandId` → `details.commandId`
   is absent, no throw.

**Missing tests `[ADD]`:**

- `validateExecution` with a valid payload → no throw, returns `Execution`. (Happy
  path. Without this, a change that adds false positives to validation goes
  undetected.)
- Action extraction at index 0 (not just middle index). The Zod path is `actions.0.
  params.format` when the first action is invalid; verify `actionId` is extracted
  from index 0 correctly.
- `commandId`/`taskId` absent from payload → `details.commandId` and `details.taskId`
  are `undefined`, not the string `"undefined"`, and the error does not throw.
- `elapsedMs` is a positive integer and less than `timeoutMs + 500ms`. (Sanity bound -
  catches a clock inversion bug.)
- Existing error shape regression: `error.code`, `error.message`, `details.path`, and
  `details.reason` are all present and unchanged for a known-invalid payload. The new
  fields are additive; the old fields must not be removed or renamed.

---

## PRD-3: Skill Preflight / Dry-run - Test Order and Missing Coverage

**Implementation order:**

1. Unit: `skills validate` (no flag) on a skill with an invalid artifact → `ok: true`.
   This is the existing behavior. Write this test first to pin it, then add `--dry-run`
   without breaking it.
2. Unit: `skills validate --dry-run` on same skill → `ok: false`, `SKILL_VALIDATION_
   FAILED`, with `details.actionId` from PRD-2.
3. Unit: `skills validate --dry-run` on a skill with a valid artifact → `ok: true`.
   (Happy-path anchor.)
4. Unit: `skills validate --dry-run` on a script-only skill (no artifacts) → `ok: true`
   with `dryRun.payloadValidation: "skipped"` and a non-empty `reason`.
5. Unit: `skills validate --dry-run` on a skill with two artifacts, both invalid →
   both failures are reported, not just the first.

**Missing tests `[ADD]`:**

- Happy path: valid artifact-backed skill passes `--dry-run`. (Currently missing from
  the validation plan.)
- Multiple artifact failures: a skill with two artifacts, each with a different schema
  violation, produces two failure entries. (Without this, a "return on first failure"
  bug goes undetected.)
- Empty artifacts array (`"artifacts": []`) behaves identically to a script-only skill:
  integrity passes, `dryRun.payloadValidation: "skipped"`.
- Schema consistency: the schema used in `--dry-run` artifact validation is the same
  module as `execute --validate-only`. Enforce this at the import level (one shared
  schema import), and write a smoke test that compiles a skill and validates the
  output with `execute --validate-only` to confirm they agree.
- `--dry-run` output in `json` mode is valid parseable JSON. (The output format must
  be consistent regardless of whether the check passes or fails.)

---

## PRD-4: Progress Streaming - Test Order and Missing Coverage

**Implementation order:**

1. Unit: `runSkill` without `callbacks` → accumulates stdout, returns `SkillRunResult`.
   Pin the existing behavior before touching the signature.
2. Unit: `runSkill` with `callbacks.onOutput` → callback receives each stdout chunk
   before the promise resolves.
3. Unit: `runSkill` with `callbacks.onOutput` → `SkillRunResult.output` still contains
   full accumulated string (not empty, not just the last chunk).
4. Unit: `runSkill` with a script that writes to stderr → `onOutput` receives chunks
   with `stream: "stderr"`.
5. Integration: `skills run --output json` → stdout contains only the final JSON
   envelope, no interleaved chunk text.

**Missing tests `[ADD]`:**

- `onOutput` receives `stream: "stderr"` chunks for stderr output. (Currently the
  validation plan only mentions stdout.)
- `onOutput` that throws → `runSkill` catches the error, logs it to stderr, and
  continues accumulating. The skill process is not killed and `SkillRunResult` is
  still returned. (Without this, a misbehaving caller crashes the domain helper.)
- Skill that produces no output → `SkillRunResult.output` is `""`, not undefined. No
  callback invocations, no error.
- `--expect-contains` with streaming active → check passes when the full accumulated
  output contains the string, even if no single chunk contained it. (Regression for
  the check being accidentally moved to per-chunk.)

---

## PRD-5: Persistent Logging - Test Order and Missing Coverage

**Implementation order:**

1. Unit: log writer creates the file and writes a single valid NDJSON entry. Parse it
   with `JSON.parse` in the test to confirm parseability.
2. Unit: log writer appends to an existing file rather than overwriting it.
3. Unit: log writer when directory does not exist → creates the directory and writes.
4. Unit: log writer when directory cannot be created (permissions) → emits one warning
   to stderr, returns without throwing.
5. Unit: `broadcast.dispatched` event is logged with `commandId` matching the
   execution payload's `commandId`.
6. Unit: `timeout.fired` event is logged, and `logPath` in the `RESULT_ENVELOPE_
   TIMEOUT` error details is the absolute path to the file that was written.

**Missing tests `[ADD]`:**

- Log entries are valid NDJSON: each line is parseable with `JSON.parse`. (Currently
  missing. A comma-separated JSON array, pretty-printed JSON, or truncated entry would
  all fail an agent trying to read the log.)
- `logPath` in the timeout error is the same absolute path as the file that was
  written during that invocation. Test by writing to `CLAWPERATOR_LOG_DIR=/tmp/test`
  and checking that `error.details.logPath` matches the file in `/tmp/test/`.
- `CLAWPERATOR_LOG_LEVEL` env var is respected as an alternative to `--log-level`.
  (Currently the plan only tests the flag.)
- Payload body exclusion: write an execution with a `enter_text` action whose `text`
  param contains a known sentinel string, then verify the sentinel does not appear in
  any log line at any log level.
- Concurrent invocations: run two `execute` calls in parallel against the same log
  file. Read the log after both complete. Every line must be parseable and no line may
  be split or interleaved. (Tests append atomicity - `fs.appendFile` with NDJSON lines
  under 4KB is typically atomic on most OSes, but this should be confirmed under test.)
- `preflight.apk.pass` and `preflight.apk.missing` events are logged (depends on PRD-1
  gate being in place). This is a cross-PRD regression anchor: verify the pre-flight
  from PRD-1 actually emits its log event.

---

## PRD-6: Docs - Test Order and Missing Coverage

**Implementation order:**

1. Unit: `renderCheck` with a check that has `fix.docsUrl` → output includes `Docs:
   <url>` line. Write before modifying `renderCheck`.
2. Unit: `renderCheck` with a check that has no `fix.docsUrl` → output does not
   include a `Docs:` line. (Regression: the field is optional and absent checks must
   not gain a phantom `Docs:` line.)
3. Unit: doctor `json` output for the `RECEIVER_NOT_INSTALLED` check includes
   `fix.docsUrl`.
4. TypeScript compilation: `fix` object without `docsUrl` compiles without error.

**Missing tests `[ADD]`:**

- `docsUrl` in `fix` does not appear in the output of checks that do not have it set.
  Specifically: run doctor pretty output against a report that mixes checks with and
  without `docsUrl`, and verify only the checks with `docsUrl` emit a `Docs:` line.
- `clawperator doctor --output json | python3 -m json.tool` (or equivalent JSON
  schema validation) passes. The `docsUrl` addition must not break JSON output
  parseability.
- Automated URL reachability: at minimum, verify that the `docsUrl` values used in the
  code are valid URL strings (format check), and add a CI step or smoke test that
  verifies the target pages return HTTP 200. This prevents dead docs links being baked
  into error output.

---

## Regression Anchors (Never Delete These)

The following tests must not be removed once written. They protect the most critical
behaviors from silent regression:

| Anchor | PRD | What it prevents |
| :--- | :--- | :--- |
| `checkApkPresence` with package present → `status: "pass"` | 1 | Over-broad gate that blocks everything |
| `runExecution` with APK present → broadcast IS called | 1 | Gate that never lets anything through |
| `RECEIVER_VARIANT_MISMATCH` → `status: "warn"`, not `"fail"` | 1 | Accidental severity escalation |
| `doctor --check-only` → exits 0 regardless of check results | 1 | Breaking the installer |
| `validateExecution` with a currently valid payload → no throw | 2 | False positive validation rejections |
| Existing `details.path` and `details.reason` present after PRD-2 change | 2 | Additive contract becoming destructive |
| `skills validate` without `--dry-run` on invalid artifact → `ok: true` | 3 | Changing existing behavior |
| `runSkill` without `callbacks` → still accumulates and returns correctly | 4 | Breaking existing callers |
| `--expect-contains` after streaming change → operates on full output | 4 | Subtle breakage in expect-contains callers |
| Log writer failure → command still completes | 5 | Logging breaking the CLI |
| Log entries are parseable NDJSON | 5 | Agents failing to read logs |
| `renderCheck` without `docsUrl` → no `Docs:` line emitted | 6 | Phantom docs lines in existing check output |

---

## Cross-PRD Test Dependencies

These are test cases that span two workstreams and must be maintained as each PRD lands:

**PRD-2 → PRD-3:**
PRD-3's `--dry-run` output uses the enriched `EXECUTION_VALIDATION_FAILED` format from
PRD-2. After both land, verify that a `--dry-run` failure response includes `actionId`,
`actionType`, `invalidKeys`, and `hint` (not just `code` and `message`). This is a
combined regression test.

**PRD-2 → PRD-5:**
PRD-5 adds `logPath` to `RESULT_ENVELOPE_TIMEOUT`. PRD-2 added `commandId`, `taskId`,
`lastActionId`, and `lastActionCaveat` to the same error. After both land, verify all
PRD-2 fields AND `logPath` coexist in the error details. Neither workstream should
silently remove the other's fields.

**PRD-1 → PRD-5:**
PRD-5 logs `preflight.apk.pass` and `preflight.apk.missing` events that are produced
by the gate added in PRD-1. After both land, verify these events appear in the log on
a real execute invocation with APK absent, and on an invocation with APK present.

**PRD-5 → PRD-6:**
PRD-6 docs reference `~/.clawperator/logs/` and the NDJSON format. After PRD-5 ships,
run the docs validation (`./scripts/validate_docs_routes.py` or equivalent) to confirm
the log path documented in troubleshooting.md matches the actual default path in the
log infrastructure.

---

## What "Done With Testing" Looks Like

For each PR, before merging:

1. `npm run test` passes with no skipped tests added in this PR.
2. All new unit tests are in the same file as the code they test (colocated where the
   project structure allows, or in the `__tests__` adjacent directory).
3. Every regression anchor for this PRD is present and passing.
4. The happy-path test for the changed code path is present and passing.
5. Integration tests pass under `CLAWPERATOR_RUN_INTEGRATION=1` on a connected device.
6. No existing test was deleted or made less strict to make the new tests pass.

For the overall sequence, after all PRDs land:

7. Run the full cross-PRD regression anchors listed above.
8. Run `./scripts/clawperator_smoke_core.sh` and `./scripts/clawperator_smoke_skills.sh`
   end-to-end and confirm no regressions from the baseline before this work started.
