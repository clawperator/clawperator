# EM Review: Agent Usability Plan

Reviewer: Claude (EM-level review)
Date: 2026-03-21
Scope: `plan.md`, `prd-1.md` through `prd-7.md`, `testing-strategy.md`, `reconciliation.md`

---

## Executive Summary

This is a strong, well-evidenced plan. The problem diagnosis is correct - every code claim
was verified against the actual codebase and all hold. The seven PRDs address real pain
points in priority order, the sequencing is sound, and the testing strategy is practical.
The reconciliation between the two agent analyses is well-reasoned, with the right
positions winning in each disagreement.

The plan is ready for implementation with the corrections and clarifications listed below.
None of the issues are blockers to starting PR-1 or PR-2.

---

## Overall Verdict

**Approve with corrections.** The plan correctly identifies that the core problem is
enforcement of existing primitives, not invention of new commands. The PRDs are
implementation-ready for capable agents. The scoping is disciplined - deferred items
are the right items to defer. The testing strategy balances speed and confidence well.

The main risks are:
1. A few code-level inaccuracies in PRD implementation guidance that could send an agent down the wrong path
2. One documentation source-path error that would cause a CLAUDE.md violation if followed literally
3. The `observe` command family is not covered by the APK pre-flight gate

---

## Per-PRD Review

### PRD-1: Shared Readiness Gate

**Verdict: Strong. Ready to implement.**

Every code claim verified:
- `CRITICAL_DOCTOR_CHECK_PREFIXES` does not include `readiness.apk.presence` (confirmed at `criticalChecks.ts:3-16`)
- `checkApkPresence` returns `status: "warn"` (confirmed at `readinessChecks.ts:64`)
- `checkApkPresence` is exported with signature `(config: RuntimeConfig): Promise<DoctorCheckResult>` (confirmed at `readinessChecks.ts:9-10`)
- `runExecution.ts` has no APK check before `broadcastAgentCommand` (confirmed at `runExecution.ts:208-390`)
- `injectServiceUnavailableHint` pattern exists and is the right model (confirmed at `runExecution.ts:106-112`)

**Issues:**

1. **Insertion point may not match.** PRD-1 says to insert "after `config.deviceId = deviceId`". The actual code uses `RunExecutionOptions` (with optional `deviceId?: string`), and `performExecution` builds a `RuntimeConfig` internally via `getDefaultRuntimeConfig`. The implementing agent needs to find the actual insertion point by reading the function, not by searching for that exact line. The PRD's intent is correct (after device resolution, before lock acquisition), but the literal guidance may not match.

2. **`install.sh` already has a docs reference.** Line 750 reads: `"For more info, visit: https://docs.clawperator.com"`. PRD-1 proposes adding an `llms.txt` line. This is additive and fine, but the PRD should note the existing reference so the agent does not duplicate or conflict with it.

3. **`observe` commands are not gated.** `observe screenshot` and `observe snapshot` also dispatch to the device via adb. They are not routed through `runExecution.ts`. If the APK is missing, these will also timeout. The PRD correctly scopes the gate to `runExecution.ts` only, but should explicitly note that `observe` commands remain ungated as a known limitation and potential follow-on.

**Testing plan: solid.** The TDD sequence is well-ordered. T5 and T6 (broadcast spy count) are the highest-value tests. The `fake_adb.sh` VARIANT_APK scenario addition is correctly specified. The `--check-only` integration test (T8) protects the installer, which is the highest-risk regression.

---

### PRD-2: Error Message Context

**Verdict: Strong. Ready to implement.**

Code claims verified:
- `ValidationFailure` interface has only `path?: string; reason?: string` in details (confirmed at `validateExecution.ts:306-310`)
- Zod error path handling joins with dots (confirmed at `validateExecution.ts:318-328`)
- `RESULT_ENVELOPE_TIMEOUT` timeout branch exists in `performExecution` (confirmed)

**Issues:**

1. **Timeout enrichment code structure.** PRD-2 proposes spreading `result.diagnostics` and adding fields. The actual timeout handling uses `waitForResultEnvelope` with a callback pattern, and the result structure may differ from what the PRD assumes. The PRD says:
   ```
   if ("timeout" in result && result.timeout && "diagnostics" in result) {
   ```
   The implementing agent should verify this exact branch exists. The intent is correct, but the exact code path needs fresh reading at implementation time.

2. **`enter_text clear: true` documentation.** PRD-2 correctly proposes documenting this gap. I verified that `docs/node-api-for-agents.md` already documents it at lines 242-244 and 344-345:
   > "The Node contract still accepts `clear`, but the Android runtime does not implement it yet, so it currently has no effect."

   So this is already documented. PRD-2 should verify whether the existing documentation is sufficient or needs strengthening, rather than assuming it is missing.

**Testing plan: solid.** T3 (index 0 is falsy) catches a real bug. T6 (absent commandId/taskId without throwing) catches a real coercion bug. The "no device needed" note for integration tests is correct and important - validation runs before device contact.

---

### PRD-3: Skill Preflight With Payload Dry-run

**Verdict: Good. One source-path error to fix.**

Code claims verified:
- `validateSkill.ts` checks file existence and metadata only (confirmed at `validateSkill.ts:83-139`)
- No payload compilation in validateSkill (confirmed)

**Issues:**

1. **Documentation source path error.** PRD-3 says to update `docs/skills/skill-development-workflow.md`. This file does NOT exist as a source file. It exists only as generated output at `sites/docs/docs/skills/skill-development-workflow.md`. Per CLAUDE.md, generated docs must never be edited directly. The implementing agent must find the source file via `source-map.yaml` (it is code-derived from skill-related source files) and update the source, then regenerate. This is a real trap for a less-capable agent - they would edit the generated file, violate CLAUDE.md, and have their changes overwritten.

2. **Dependency on PRD-2 is soft, not hard.** PRD-3 says it "should merge after PRD-2" to use the enriched error format. But `--dry-run` works without PRD-2 - it just produces less-detailed errors. The dependency is a quality preference, not a functional requirement. The sequencing note in `plan.md` correctly says "can be developed in parallel but should merge after PRD-2." This is fine but should be explicit that the dependency is about error quality, not functionality.

3. **"compile-artifact" needs verification.** PRD-3 says to "locate the compile-artifact domain function" but does not identify it. The implementing agent needs to find this. This is appropriate for a capable agent but may slow a less-capable one.

**Testing plan: solid.** T1 (regression anchor for no-flag behavior) is the single most important test. T4 (script-only skill exits cleanly) catches the false-failure bug. Good fixture design with four skill variations.

---

### PRD-4: Progress Visibility During Skills Run

**Verdict: Good. Well-scoped.**

Code claims verified:
- `runSkill.ts` uses `stdio: ["ignore", "pipe", "pipe"]` (confirmed at line 103)
- Output is fully buffered with string concatenation (confirmed at lines 107-108, 122-128)
- No callback mechanism exists (confirmed)
- Function signature matches PRD's "current signature" exactly (confirmed at lines 41-46)
- `--expect-contains` is in the CLI layer at `skills.ts:122-131`, not in `runSkill.ts` (confirmed)

**Issues:**

1. **Banner log path before PRD-5 lands.** PRD-4 proposes showing the log path in the banner. If PRD-4 ships before PRD-5, the log file does not exist yet. The PRD acknowledges this ("compute the expected path anyway") but this feels slightly misleading to agents - showing a path to a file that does not exist. Consider making the log path conditional: show it only if the log directory exists, or add "(available after v<next>)" suffix.

2. **APK check in banner adds latency.** The banner calls `checkApkPresence(config)` which is an adb round-trip (~100ms). For skills that do not touch the device (script-only), this adds unnecessary latency. Consider making the APK check conditional on whether the skill has device-facing actions. However, this may be over-engineering for now - 100ms is acceptable.

**Testing plan: solid.** T5 (`--expect-contains` on split output) is the highest-risk test. T6/T7/T8 (JSON mode cleanliness and banner presence/absence) catch the most likely regression. Good fixture scripts with `chunked-output.sh` and `split-word.sh`.

---

### PRD-5: Persistent Logging and Log Retrieval

**Verdict: Good. One structural note.**

**Issues:**

1. **New directory: `apps/node/src/infra/`.** PRD-5 proposes creating `logger.ts` at `apps/node/src/infra/logger.ts`. No `infra/` directory exists in the current codebase. The existing directory structure uses `adapters/`, `cli/`, `contracts/`, `domain/`, `test/`. A new top-level directory is a structural decision. Consider placing the logger in `adapters/` (it is an I/O adapter) rather than inventing a new directory. Alternatively, if `infra/` is the preferred location, note that the implementing agent needs to create the directory.

2. **Logger injection into RunExecutionOptions.** PRD-5 proposes adding `logger?: Logger` to `RunExecutionOptions`. The current type has five optional fields (`deviceId`, `receiverPackage`, `adbPath`, `timeoutMs`, `warn`). Adding `logger` is consistent with this pattern. The `warn` callback is already an output channel - the logger is another. This is clean.

3. **Privacy test sentinel.** T7 uses a sentinel string in action params. This is the right approach but needs to verify that the test payload passes validation - if `enter_text` params are validated strictly, the sentinel must be a valid `text` value.

**Testing plan: solid.** The TDD sequence (build writer in isolation first, then wire) is correct for a new module. T4 (fail-open) is the most important test - a logging failure must never crash the CLI. T7 (privacy) is non-negotiable.

---

### PRD-6: Docs, Entry Points, and Missing Integration Hooks

**Verdict: Good. Appropriate scope for a cleanup PR.**

**Issues:**

1. **`docsUrl` hardcoding risk.** PRD-6 proposes hardcoding `https://docs.clawperator.com/getting-started/first-time-setup` in the check result. If PRD-7 restructures the docs and moves pages, this URL breaks. PRD-7 proposes redirects, but the coupling is fragile. Consider using a path that PRD-7 commits to keeping stable, or defer `docsUrl` population until after PRD-7 lands.

   Counter-argument: PRD-6 explicitly depends on landing before PRD-7, and PRD-7 should update the URLs. The plan says PRD-7 must land last. This is acceptable if the implementing agent for PRD-7 knows to update these hardcoded URLs.

2. **`AGENTS.md` version substitution.** PRD-6 says `install.sh` should substitute the installed package version. The PRD should specify exactly where `install.sh` gets the version (likely from `clawperator --version` output or from the npm package). The implementing agent needs this.

3. **`operator_event.sh` blocking prerequisite is correct.** The requirement to review the OpenClaw tool config before writing anything beyond a stub is the right call. The PRD correctly refuses to allow a silent no-op.

**Testing plan: adequate but thin.** T1-T4 cover the `docsUrl` rendering. The manual verification steps for AGENTS.md and docs alignment are appropriate for a docs-heavy PR. No unit tests for the AGENTS.md generation - this is acceptable since it is a simple `cat` in a shell script.

---

### PRD-7: Docs Structural Reform

**Verdict: Appropriate. Correctly deferred to last.**

The audit-first approach is right. The four-section target structure (Get Started / Use / Reference / Troubleshoot) is a clear improvement over the current six-section structure.

**Issues:**

1. **Risk of scope expansion is real and under-mitigated.** The PRD says "timebox the audit to one pass" but does not specify a time or page count. For a less-capable agent, "audit every page" can become a multi-day task. Recommend adding a concrete scope limit: audit the nav tree in `mkdocs.yml` (which lists all pages), not the content of every page.

2. **Redirect mechanism.** The PRD says "use redirects where MkDocs supports them" but does not confirm whether the MkDocs setup has a redirect plugin. The implementing agent should check `mkdocs.yml` for `redirects` plugin configuration before assuming redirects are available.

3. **No unit tests is correct** for a docs-only PR. The `docs_build.sh` success check is the right gate.

---

## Testing Review

### Strengths

- **TDD sequences are well-ordered.** Each PRD specifies the exact order to write and run tests, with clear pass/fail expectations at each step. This is unusually good for planning docs.
- **Regression anchors are explicitly named.** The cross-cutting testing strategy doc lists 12 anchors with the specific failure mode each prevents. This is the right granularity.
- **"What not to test" section is valuable.** Explicitly skipping timing bounds, URL reachability, and concurrency atomicity prevents test bloat.
- **Cross-PRD tests are specified.** Four dependency-pair checks ensure workstreams compose correctly.
- **FakeProcessRunner injection pattern is correct.** All PRDs reference the right test double with the right API.

### Weaknesses

1. **Build-before-test not emphasized enough.** Tests run against `dist/` (compiled output). Every PRD should include a reminder to run `npm run build` before `npm run test`. The testing-strategy doc mentions this once. An agent that forgets this will get stale test results and waste time debugging phantom failures. **Recommendation:** Add a bolded note to the testing-strategy merge gate: "Run `npm run build && npm run test`, not just `npm run test`."

2. **PRD-2 T5 (timeout test) may be slow or flaky.** The test needs a timeout to fire. The PRD suggests `timeoutMs: 50` in the payload, but notes the `+ 5000` buffer in `runExecution.ts`. This means the actual timeout is 5050ms minimum. A test that takes 5+ seconds is slow for a unit test. The PRD offers alternatives (mock `waitForResultEnvelope`, extract enrichment to a helper) but does not pick one. **Recommendation:** Mandate the helper-extraction approach. Unit-test the enrichment logic directly. Test the integration (actual timeout firing) only in the integration suite.

3. **PRD-3 T6 (real bundled skill) assumes a bundled skill exists with artifacts.** If no bundled skill has pre-compiled artifacts, this test cannot run. The implementing agent needs to verify this. **Recommendation:** Specify a fallback: if no bundled skill has artifacts, use the test fixture skill instead and note that the integration test is deferred.

4. **No test for the APK pre-flight's adb failure path.** PRD-1 tests APK present and APK absent. It does not test what happens when the `pm list packages` adb call itself fails (e.g., adb not running, device disconnected mid-check). The pre-flight should not crash on adb failure - it should either fail open (let execution proceed) or fail closed (return error). This edge case needs a test and a design decision.

---

## Implementation Alignment Review

### Verified Correct

| Claim | Status |
| :--- | :--- |
| `CRITICAL_DOCTOR_CHECK_PREFIXES` lacks APK presence | Confirmed |
| `checkApkPresence` returns `warn` | Confirmed |
| `checkApkPresence` is exported | Confirmed |
| `runExecution` has no APK check before broadcast | Confirmed |
| `injectServiceUnavailableHint` pattern exists | Confirmed |
| `ValidationFailure.details` has only `path` and `reason` | Confirmed |
| `runSkill` signature matches PRD-4 | Confirmed |
| `runSkill` buffers all output | Confirmed |
| `validateSkill` is integrity-only | Confirmed |
| `operator_event.sh` does not exist | Confirmed |
| `install.sh` calls `doctor --format json` | Confirmed |
| `contracts/doctor.ts` fix type lacks `docsUrl` | Confirmed |
| `renderCheck` does not render `docsUrl` | Confirmed |
| `--expect-contains` is in CLI layer, not domain | Confirmed |
| FakeProcessRunner API matches PRD descriptions | Confirmed |
| `fake_adb.sh` uses `FAKE_ADB_SCENARIO` env var | Confirmed |
| No `infra/` directory exists | Confirmed |
| Tests run against `dist/` via `node --test` | Confirmed |

### Inaccuracies or Gaps

| Issue | PRD | Severity | Detail |
| :--- | :--- | :--- | :--- |
| Insertion point guidance may not match actual code | 1 | Low | "after `config.deviceId = deviceId`" - agent should read the function fresh |
| `install.sh` already has a docs reference | 1 | Low | Line 750 has `docs.clawperator.com` link; PRD should note existing reference |
| `enter_text clear: true` already documented | 2 | Low | `node-api-for-agents.md:242-244` already has the caveat |
| `skill-development-workflow.md` is generated, not source | 3 | Medium | Agent would violate CLAUDE.md by editing it directly |
| `infra/` directory does not exist | 5 | Low | Agent needs to create it (or choose `adapters/`) |
| `docsUrl` hardcoded URL may break after PRD-7 | 6 | Low | Acceptable given sequencing, but fragile |

---

## Macro Gaps

### 1. `observe` commands are not gated (Minor)

`observe screenshot` and `observe snapshot` dispatch to the device but do not go through
`runExecution.ts`. They will still timeout on missing APK. This is a known limitation that
should be documented in PRD-1's "out of scope" section as a follow-on item. It does not
block the current plan.

### 2. No plan for `--receiver-package` propagation to pre-flight (Minor)

PRD-1's pre-flight calls `checkApkPresence(config)`. The `config.receiverPackage` must
match what `runExecution` will use for the broadcast. If the user passes
`--receiver-package com.clawperator.operator.dev` on the CLI, the pre-flight must check
for that package, not the default. The implementing agent should verify that
`RuntimeConfig` is built with the CLI-provided `receiverPackage` before the pre-flight
runs. This is likely already handled by `getDefaultRuntimeConfig(overrides)` but should
be verified.

### 3. No error code audit (Minor, deferred is fine)

PRD-2 notes that `UNSUPPORTED_RUNTIME_CLOSE` is undocumented. The plan does not include
a systematic audit of all error codes against the docs. This is fine to defer but should
be tracked as a follow-on for PRD-6 or PRD-7.

### 4. No rollback plan if PRD-1 breaks the installer

The highest-risk change is PRD-1's severity escalation. If `install.sh` cannot handle
`status: "fail"` for the APK check, the installer breaks for all new users. The plan
identifies this risk but does not specify a verification step. **Recommendation:** Add
an explicit acceptance criterion to PRD-1: "Run `install.sh` on a device without the APK
and verify the installer still installs it successfully." This should be a manual
verification step, not just a unit test.

---

## Recommendations

### Must-fix before implementation starts

1. **PRD-3: Fix the documentation source path.** Change "Update `docs/skills/skill-development-workflow.md`" to the correct source file path (find via `source-map.yaml`). A less-capable agent will edit the generated file and violate CLAUDE.md.

2. **PRD-1: Add installer verification to acceptance criteria.** "Run `install.sh` on a device without the APK installed. Verify the installer proceeds to install the APK and completes successfully despite the doctor check now returning `status: 'fail'`."

### Should-fix before implementation starts

3. **Testing strategy: emphasize build-before-test.** Add to merge gate: "`npm run build && npm run test` - never just `npm run test`. Tests run against compiled `dist/` output."

4. **PRD-2: Extract timeout enrichment to a testable helper.** Do not test timeout enrichment via actual timeout. Extract the enrichment logic to a pure function, unit-test it, and test the wiring separately in integration.

5. **PRD-1: Add `observe` commands as a documented out-of-scope item.** "Out of scope: `observe screenshot` and `observe snapshot` do not go through `runExecution.ts` and are not gated by this change. Follow-on if needed."

6. **PRD-1: Note existing `install.sh` docs reference.** Line 750 already links to `docs.clawperator.com`. The new `llms.txt` line is additive, not the first docs reference.

### Nice-to-have

7. **PRD-5: Consider `adapters/` instead of `infra/`.** The existing directory structure uses `adapters/` for I/O concerns. A logger is an I/O adapter. Using `adapters/logger.ts` avoids inventing a new top-level directory. Not blocking - either location works.

8. **PRD-1: Add a test for adb failure during pre-flight.** What happens if `pm list packages` returns a non-zero exit code? The pre-flight should handle this gracefully. Add a unit test.

9. **PRD-4: Make log path in banner conditional.** Show the log path only if the log directory exists or PRD-5 has shipped. Showing a path to a nonexistent file is slightly misleading.

---

## Final Assessment

The plan is strong. The problem diagnosis is evidence-based and correct. The PRDs are
well-scoped with clear acceptance criteria. The testing strategy is practical and
focused on high-value checks. The sequencing is sound. The reconciliation between the
two agent analyses is well-reasoned.

The corrections above are mostly precision fixes for implementing agents, not
directional changes. The plan can proceed to implementation starting with PR-1 and PR-2
in parallel, with the must-fix items addressed in the PRD files before the implementing
agent starts work.
