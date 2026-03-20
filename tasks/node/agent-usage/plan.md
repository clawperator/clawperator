# Agent Usability Improvement Plan

Primary input: `tasks/node/agent-usage/findings-analysis.md`
Date: 2026-03-21

---

## Executive Summary

Clawperator is hard for agents on a first run for three compounding reasons:

1. **Silent setup failures.** When the Operator APK is missing, nothing fails fast. `execute` broadcasts into the void for 30-120 seconds and returns a timeout with no useful context. Doctor detects the problem but reports it as a warning and does not halt - so an agent that ran doctor and saw no errors is still walking into a guaranteed timeout.

2. **Opaque error messages.** When a payload is malformed, the error names the schema violation but not the action that caused it. When a command times out, the error says nothing about which phase of the pipeline failed. Agents cannot self-correct without guessing.

3. **Documentation that exists but is invisible.** Both `llms.txt` surfaces are comprehensive and accurate. `agent-quickstart.md` and `openclaw-first-run.md` are complete. But `install.sh` emits no doc reference after installation, doctor failures link to nothing, and the agent in the GloBird incident operated from `--help` output alone for the entire session.

All three causes are fixable with focused, bounded changes. None require new commands or architectural changes. The most important fix (WS-1) is a two-line change to `criticalChecks.ts` plus a pre-flight guard in the execute path.

---

## Top Problems, Ordered by Priority

1. **APK absence is not a hard stop.** `readiness.apk.presence` is a `warn`, not in `CRITICAL_DOCTOR_CHECK_PREFIXES`, and `execute` has no pre-flight. Result: guaranteed timeout with no diagnosis. [WS-1]

2. **Validation and timeout errors lack action-level context.** `EXECUTION_VALIDATION_FAILED` does not identify which action or parameter is invalid. `RESULT_ENVELOPE_TIMEOUT` does not report which action was in flight. [WS-2]

3. **Docs are not surfaced at the moments agents need them.** Install completes silently. Doctor failures emit no links. The agent reads `--help` and guesses. [WS-3]

4. **`skills validate` does not catch bad execution payloads.** Structural validation passes even when the compiled artifact has schema violations. Stale API usage like `format: "ascii"` survives until runtime. [WS-4]

5. **No persistent log output.** On timeout or partial failure, there is no evidence trail. Agents and operators cannot triage without a live device in hand. [WS-5]

6. **`./scripts/operator_event.sh` does not exist.** OpenClaw's tool executor calls this script from the Clawperator repo directory and gets a hard failure. Requires OpenClaw tool config review to determine intended behavior before the script can be written. [WS-3 or separate]

---

## Macro Workstreams

### WS-1: Fast-fail on missing APK

**Goal:** Eliminate the 30-120s timeout-before-diagnosis loop.

Changes:
- Add `readiness.apk.presence` to `CRITICAL_DOCTOR_CHECK_PREFIXES` in `criticalChecks.ts`
- Change `status: "warn"` to `status: "fail"` for `RECEIVER_NOT_INSTALLED` in `readinessChecks.ts`
- Add an APK presence pre-flight check at the start of the `execute` command handler, before broadcasting
- Document the new fast-fail behavior in `docs/troubleshooting.md` and `docs/reference/node-api-doctor.md`
- Update `docs/reference/error-handling.md` to clarify that `RECEIVER_NOT_INSTALLED` is now a hard stop

PRD: `prd-1.md`

### WS-2: Richer error context

**Goal:** Give agents enough context in error responses to self-correct without user intervention.

Changes:
- Enrich `EXECUTION_VALIDATION_FAILED`: include offending action `id`, action `type`, and invalid parameter name in the error envelope
- Enrich `RESULT_ENVELOPE_TIMEOUT`: include the last action `id` and `type` that was dispatched before the timeout
- Update `docs/reference/error-handling.md` with the new envelope fields
- Update `docs/node-api-for-agents.md` error section

PRD: `prd-2.md`

### WS-3: Doctor-first agent entry points

**Goal:** Ensure agents encounter documentation at the moment they need it, not after the debugging session ends.

Changes:
- Add a post-install banner to `install.sh` that emits the docs URL and `llms.txt` reference
- Add a docs/troubleshooting link to doctor failure output (both `pretty` and `json` format)
- Create `./scripts/operator_event.sh` (after OpenClaw tool config review confirms intended behavior)
- Consider adding an `AGENTS.md` entry point to the skills repo root (deferred to skills repo discussion)

PRD: `prd-3.md`

### WS-4: Skills validate with payload dry-run

**Goal:** Catch stale or invalid execution payloads at skill authoring time, not at runtime on a live device.

Changes:
- Extend `skills validate` to optionally compile the skill artifact and validate the resulting execution payload against the action schema
- Add a `--dry-run` flag (or make it the default for validate) that runs compile + schema validation without touching a device
- Report the offending action `id`, `type`, and parameter when validation fails
- Update `docs/skills/skill-development-workflow.md` to include validate as a pre-commit step

PRD: `prd-4.md`

### WS-5: Structured persistent logs

**Goal:** Give agents an evidence trail to triage failures without needing a live device.

Changes:
- Write JSON-structured logs to `~/.clawperator/logs/clawperator-YYYY-MM-DD.log`
- Include `commandId`/`taskId` correlation IDs in each log entry
- Log key events: broadcast dispatched, result envelope received, timeout fired, pre-flight checks run
- Document the log path in `docs/troubleshooting.md`
- Add `--log-level` flag (default `info`, options `debug|info|warn|error`)

PRD: `prd-5.md`

---

## Recommended Sequencing Across PRs

```
PR-1  WS-1: Fast-fail on missing APK
      - criticalChecks.ts: add apk.presence
      - readinessChecks.ts: warn -> fail
      - execute: pre-flight guard
      - docs: troubleshooting, error-handling, node-api-doctor updates
      Risk: low. Pure enforcement change; no new behavior.

PR-2  WS-2: Richer error context
      - EXECUTION_VALIDATION_FAILED enrichment
      - RESULT_ENVELOPE_TIMEOUT last-action context
      - docs: error-handling, node-api-for-agents updates
      Risk: low-medium. Envelope shape change; agents reading errors must handle new fields.
      Depends on: none (independent of PR-1)

PR-3  WS-3: Doctor-first entry points
      - install.sh post-install banner
      - doctor failure output: docs links
      - operator_event.sh (after OpenClaw review)
      Risk: low. UX-only changes; no contract changes.
      Depends on: none (independent)

PR-4  WS-4: Skills validate payload dry-run
      - skills validate --dry-run
      - skill-development-workflow.md update
      Risk: medium. Requires skill compile path to be invocable in isolation.
      Depends on: PR-2 (uses same enriched validation error format)

PR-5  WS-5: Structured persistent logs
      - log-to-disk infrastructure
      - correlation ID wiring
      - --log-level flag
      - troubleshooting.md update
      Risk: medium. New file system surface; needs configurable path and rotation.
      Depends on: none (independent, but more useful after PR-1 pre-flights are in place)
```

**Recommended order:** PR-1, PR-3, PR-2, PR-5, PR-4

Rationale: PR-1 eliminates the primary confusion source immediately. PR-3 requires no code changes to the runtime and can ship alongside PR-1. PR-2 improves the errors that still occur after PR-1. PR-5 provides the log trail that makes PR-2 errors even more actionable. PR-4 is most valuable once the runtime contract is stable.

---

## Key Risks and Open Questions

**Risk: APK pre-flight latency in execute**
Adding an adb `pm list packages` call to every `execute` invocation adds ~100ms. This is acceptable for CLI usage but could matter for agents running tight loops. Mitigation: check against a cached result written by the most recent `operator setup` or `doctor` run; invalidate on device change.

**Open question: `operator_event.sh` intended behavior**
The OpenClaw tool executor calls `./scripts/operator_event.sh` from the Clawperator repo directory. The script does not exist. Before writing it, the OpenClaw-side tool configuration must be reviewed to determine: what arguments does it pass? what output does it expect? what does it do on success vs. failure? Without this, any stub risks silently masking expected behavior.

**Open question: streaming architecture**
Full per-action streaming from `skills run` requires the Android Operator APK to emit action-level events. This is not achievable in a pure Node/CLI change. A narrower version - streaming the CLI-side log to stdout as JSONL - is achievable without APK changes but does not surface Android-side action results. Product decision needed before PRD-5-streaming is written.

**Risk: envelope shape change in WS-2**
Adding fields to `EXECUTION_VALIDATION_FAILED` and `RESULT_ENVELOPE_TIMEOUT` changes the error envelope contract. Agents that pattern-match on `error.message` alone are unaffected. Agents that parse `error.details` will see new fields. This is additive and backward-compatible.

**Deferred: `enter_text clear: true`**
Requires Android receiver changes plus a coordinated CLI/APK release. Document the gap explicitly in `docs/node-api-for-agents.md` as a known limitation until the fix ships.

**Deferred: `clawperator status` command**
The core need (is my environment ready, which device am I targeting) is met by `clawperator doctor --output json --check-only`. Implementing a separate `status` command duplicates the surface without clear incremental value. Close this issue as "doctor is the status surface; make it faster and link to it better."

---

## What Success Looks Like

A new OpenClaw agent, on a fresh Clawperator install, should:

1. Run `install.sh`, see a post-install banner pointing to `llms.txt` and the docs site.
2. Run `clawperator doctor` before anything else (prompted by install banner or agent-quickstart).
3. If the APK is missing, get a hard failure with a specific install command - not a warning that allows the next command to time out.
4. If a skill fails with `EXECUTION_VALIDATION_FAILED`, see the exact action and parameter that caused the error in the error envelope.
5. If a skill times out, see the last action that was in flight in the timeout envelope.
6. Find `~/.clawperator/logs/` with a structured log that traces what happened.
7. Never wait 30-120 seconds for a timeout that could have been caught in under 1 second.
