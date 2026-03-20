# Agent Usability Plan (Merged)

This plan supersedes the two prior per-agent plans. See `reconciliation.md` for the
synthesis rationale.

Primary inputs:
- `tasks/node/agent-usage/findings-analysis.md` (this worktree)
- `~/src/clawperator/tasks/node/agent-usage/findings-analysis.md` (other agent)
- `apps/node/src/domain/executions/runExecution.ts`
- `apps/node/src/domain/executions/validateExecution.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/doctor/criticalChecks.ts`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `sites/landing/public/install.sh`
- OpenClaw logs 2026-03-20 and 2026-03-21

---

## Executive Summary

Clawperator is hard for agents on a first run for three compounding reasons, all confirmed in code:

1. **No fast-fail on missing APK.** `readiness.apk.presence` is a `warn`, absent from `CRITICAL_DOCTOR_CHECK_PREFIXES`. `runExecution.ts` validates the payload, resolves the device, and calls `broadcastAgentCommand` without an APK check. The result is a 30-120 second timeout with no useful signal.

2. **Opaque error messages.** `validateExecution.ts` returns `ValidationFailure.details` with a Zod path string (`"actions.2.params"`) but not the action's semantic `id` or `type`. `RESULT_ENVELOPE_TIMEOUT` contains no information about which action was in flight. Both are fixable with additive changes.

3. **Docs exist but are invisible and contradictory.** `llms.txt`, `agent-quickstart.md`, and `openclaw-first-run.md` are accurate and comprehensive. `install.sh` emits no reference to them. Doctor failure output links to nothing. One guide contradicts shipped behavior (APK absence as blocking vs. advisory).

Two secondary gaps, both confirmed in code: `runSkill.ts` fully buffers stdout/stderr until exit (no mid-flight visibility), and `validateSkill.ts` is integrity-only with no execution payload compilation.

The right fix is to compose and enforce existing primitives better, not invent new commands. The one exception is `skills validate --dry-run`, which composes `skills compile-artifact` + `execute --validate-only` into a single command - justified because the three-step manual chain is not reliably followed.

---

## Top Problems, Ordered by Priority

1. **APK absence is not a hard stop.** 30-120 second timeout with no diagnosis. [PRD-1]
2. **Validation and timeout errors lack action-level context.** Agent must guess which action caused the failure. [PRD-2]
3. **Skill payload errors only surface at runtime on a live device.** `skills validate` passes even with schema violations in the compiled artifact. [PRD-3]
4. **Long-running work is a black box.** `runSkill.ts` buffers all output until exit. No log trail exists after timeout. [PRD-4, PRD-5]
5. **Docs are not surfaced at install time or at failure time, and one guide contradicts shipped behavior.** [PRD-6]

---

## Macro Workstreams

### PRD-1: Shared Readiness Gate

Make missing or mismatched Operator APK a blocking failure before live device dispatch. Reuse the existing `checkApkPresence` mechanism rather than inventing a new check. Preserve `--check-only` semantics so the installer's JSON-parsing behavior stays intact.

### PRD-2: Error Message Context

Add action `id` and `type` to `EXECUTION_VALIDATION_FAILED`. Add last-action context to `RESULT_ENVELOPE_TIMEOUT`. Both are additive changes to existing error envelopes.

### PRD-3: Skill Preflight With Payload Dry-run

Add `--dry-run` to `skills validate` that composes the existing `skills compile-artifact` + `execute --validate-only` chain into one command. Catches schema violations before the device is touched.

### PRD-4: Progress Visibility During Skills Run

Add optional `onOutput` callback to `runSkill`. CLI layer wires it to stdout in pretty mode; JSON mode gets no interleaving. `SkillRunResult.output` is unchanged.

### PRD-5: Persistent Logging and Log Retrieval

Add structured NDJSON log output to `~/.clawperator/logs/`. `--log-level` flag and `CLAWPERATOR_LOG_DIR` env var. `RESULT_ENVELOPE_TIMEOUT` error includes `logPath` for the current day's log file.

### PRD-6: Docs and Entry Points

Fix the `RECEIVER_NOT_INSTALLED` contradiction between `first-time-setup.md` and `node-api-doctor.md`. Add post-install docs reference to `install.sh`. Add docs links to doctor failure output. Create `scripts/operator_event.sh` stub. Consolidate first-run entry points into one canonical sequence.

---

## Recommended Sequencing

```
PR-1  PRD-1 + PRD-6 (partial)
      - criticalChecks.ts: add readiness.apk.presence
      - readinessChecks.ts: RECEIVER_NOT_INSTALLED warn -> fail
      - runExecution.ts: APK pre-flight before broadcastAgentCommand
      - install.sh: post-install docs banner
      - docs: fix first-time-setup.md / node-api-doctor.md contradiction
      - scripts/operator_event.sh: stub (pending OpenClaw tool config review)
      Risk: low. Pure enforcement + additive UX. --check-only preserved.
      Depends on: nothing.

PR-2  PRD-2
      - validateExecution.ts: add actionId, actionType to ValidationFailure.details
      - runExecution.ts: pass last-action context into RESULT_ENVELOPE_TIMEOUT
      - docs: error-handling.md, node-api-for-agents.md
      Risk: low-medium. Additive envelope change. Backward-compatible.
      Depends on: nothing (independent of PR-1).

PR-3  PRD-3
      - skills validate: --dry-run flag composing compile-artifact + execute --validate-only
      - docs: skill-development-workflow.md
      Risk: medium. Requires compile-artifact to be usable without a device.
      Depends on: PR-2 (uses enriched error format in dry-run output).

PR-4  PRD-4
      - runSkill.ts: add optional onOutput callback (no direct stdout writes)
      - cli/commands/skills.ts: wire onOutput in pretty mode, not in json mode
      Risk: low. Purely additive to runSkill signature; backward-compatible.
      Depends on: nothing (independent).

PR-5  PRD-5
      - NDJSON log infrastructure: ~/.clawperator/logs/clawperator-YYYY-MM-DD.log
      - --log-level global flag; CLAWPERATOR_LOG_DIR and CLAWPERATOR_LOG_LEVEL env vars
      - RESULT_ENVELOPE_TIMEOUT: add logPath (absolute) to details
      - docs: troubleshooting.md log section, agent-quickstart.md note
      Risk: medium. New filesystem surface; payload-privacy discipline required.
      Depends on: PR-1 (pre-flight events), PR-2 (extends timeout enrichment).

PR-6  PRD-6 (remainder)
      - docs/index.md, agent-quickstart.md, openclaw-first-run.md consolidation
      - llms.txt alignment with shipped semantics
      - doctor failure output: docs links (contracts/doctor.ts, renderCheck, tests)
      - scripts/operator_event.sh stub (pending OpenClaw tool config review)
      Risk: low. Docs and thin contract change. Must not over-promise behavior.
      Depends on: PR-1, PR-2, PR-3, PR-4, PR-5 settled (so docs reflect final behavior).
```

Rationale for splitting PRD-6 across PR-1 and PR-6: the `install.sh` banner and the doc contradiction fix have no code dependencies and should ship immediately with the readiness gate (they describe the same change). The remaining consolidation must wait for all runtime changes to settle or the docs will age immediately.

---

## Key Risks

**Risk: installer behavior after severity change**
`install.sh` already parses `doctor --format json` output and conditionally installs the APK based on the result. Changing `RECEIVER_NOT_INSTALLED` from `warn` to `fail` in `readinessChecks.ts` must be accompanied by verifying that the installer's JSON parsing still handles the new severity correctly. Use `--check-only` where the installer needs non-destructive inspection semantics.

**Risk: `--check-only` vs. blocking mode confusion**
There must be exactly one clear semantic: `clawperator doctor` blocks on missing APK; `clawperator doctor --check-only` reports without blocking. Document this distinction explicitly.

**Risk: runSkill stdout streaming breaks expect-contains**
`skills run` supports `--expect-contains` which checks the complete output. Streaming stdout to the caller while also capturing it for this check requires both. Ensure the streaming change does not break the `--expect-contains` contract.

**Risk: operator_event.sh stub masking intent**
If OpenClaw expects specific output from this script, a no-op stub will silently break the integration. The stub must emit a warning to stderr so the silence is visible. Requires OpenClaw tool config review before any real implementation.

**Risk: dry-run compile for device-dependent skills**
Some skill scripts may query device state when generating their payload. Dry-run will fail or produce incomplete results for these. Keep `--dry-run` as an explicit opt-in; document the limitation; do not make it the default until impact on existing skills is assessed.

---

## Open Questions

1. Does the OpenClaw tool configuration that calls `./scripts/operator_event.sh` pass arguments? What output does it expect? This must be confirmed before writing anything beyond a stub.
2. Should `RECEIVER_VARIANT_MISMATCH` also become a hard failure, or stay a `warn`? The current `--receiver-package` workaround makes it recoverable without reinstalling. Keep as `warn` for now.

Resolved:
- Gate scoping: APK pre-flight lives in `runExecution.ts` only. `runSkill.ts` is not gated. Skills that call `execute` get the check naturally; skills that call `adb` directly are a pre-existing bypass.
- Session cache: not viable (each CLI call is a new process). Fresh adb call per invocation; on-disk TTL stamp is a possible follow-on if needed.

---

## Explicitly Deferred

- `clawperator status` command: `clawperator doctor --output json` already answers the core question. Insufficient evidence that a cached status surface is needed more than a faster doctor path.
- Full per-action streaming from Android side: requires Operator APK changes. Not achievable in a Node/CLI-only change.
- `AGENTS.md` or `CLAUDE.md` in the skills repo: useful maintenance improvement, not a first-run fix. Skills repo is a separate repo; coordinate separately.
- `enter_text clear: true` no-op: requires Android receiver changes. Document the gap in `docs/node-api-for-agents.md` as a known limitation in PR-2.
- Log compression and archival: out of scope for initial log infrastructure.

---

## What Success Looks Like

1. A cold-start agent whose APK is missing gets a specific, instant error with an install command - not a 30-120 second timeout.
2. A `EXECUTION_VALIDATION_FAILED` error names the action `id`, `type`, and the invalid parameter.
3. `clawperator skills validate <id> --dry-run` catches schema violations before the device is touched.
4. After any timeout, `~/.clawperator/logs/` contains a trace showing which phase of the pipeline failed.
5. `skills run` produces visible output during execution, not just at completion.
6. `install.sh` emits a docs reference. Doctor failures link to recovery guidance.
7. The docs and shipped behavior agree about what `RECEIVER_NOT_INSTALLED` means.
