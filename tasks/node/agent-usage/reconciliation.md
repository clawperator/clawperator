# Reconciliation Note

Two independent analyses of the same agent usability problem. This document records
where they agreed, where they disagreed, and which position won and why. The merged
plan and PRDs supersede both prior plans.

---

## What Both Agents Agreed On (Shared, High-Confidence Findings)

All of the following are confirmed by code evidence and appear in both analyses:

1. `readiness.apk.presence` is a `warn`, not in `CRITICAL_DOCTOR_CHECK_PREFIXES` - the primary cold-start failure.
2. `execute` / `runExecution.ts` dispatches a broadcast without an APK pre-flight.
3. `runSkill.ts` uses `stdio: ["ignore", "pipe", "pipe"]` with accumulated strings - fully buffered until exit, no mid-flight visibility.
4. `skills validate` / `validateSkill.ts` is integrity-only: file existence and metadata alignment. No execution payload compilation.
5. `RECEIVER_NOT_INSTALLED` in `docs/first-time-setup.md` implies a hard exit, but shipped `doctor` exits 0 on a warning. The contradiction is real.
6. The docs (llms.txt, agent-quickstart, openclaw-first-run) exist and are accurate but are not linked from the install path or from doctor failure output.
7. A new `clawperator status` command and a `clawperator setup` wizard should be rejected. The primitives already exist.

---

## Disagreements and Resolutions

### 1. Error context in `EXECUTION_VALIDATION_FAILED`

Other agent: "already solved but poorly surfaced" - claimed existing `detail/fix/nextActions` cover this.

This agent: "genuinely missing" - `validateExecution.ts:306-331` shows `ValidationFailure.details` only contains `path` (Zod path as a dot-joined string, e.g. `"actions.2.params"`) and `reason` (raw Zod message). The action's semantic `id` and `type` fields are not included. An agent that gets `"actions.2.params"` still has to count through its payload to find the offending action.

**Resolution: this agent is correct. The gap is real and the fix is specific. Included in merged PRD-2.**

### 2. Persistent structured logs

Other agent: deferred - "stronger near-term need is clearer recovery hints, not more files on disk."

This agent: included as PRD-5 (persistent logging) - with `runSkill.ts` evidence showing all output is buffered until process exit, and no log-to-disk path existing anywhere in the CLI.

Resolution: The other agent's PRD-3 (progress and recovery) proposes adding a "progress surface" for long-running work but does not say how without either (a) APK changes for Android-side events, or (b) a log file. Once APK-change-dependent streaming is ruled out of scope (both agents agree on this), a log file is the only way to provide a post-hoc evidence trail. The timeout case - where stdout produces nothing until the process exits - is genuinely unserved.

**Resolution: keep persistent logs. Merged into PRD-4 (progress + logs) alongside the other agent's progress-surface framing.**

### 3. `skills validate --dry-run` vs. "document the compose chain"

Other agent: propose documenting `skills validate` + `skills compile-artifact` + `execute --validate-only` as a three-step preflight in the docs.

This agent: propose a `--dry-run` flag on `skills validate` that runs compile + schema validation as one step.

The other agent's primitives list is accurate and useful context. But asking an agent to reliably run three separate commands as a manual preflight is weaker than making it one testable, documentable, CI-able command. The GloBird incident confirms that the agent did not compose the chain on its own.

**Resolution: use the `--dry-run` flag approach. The other agent's primitives list belongs in the acceptance criteria and implementation notes. Included in merged PRD-3.**

### 4. `./scripts/operator_event.sh` classification

Other agent: "unrelated tooling noise" - OpenClaw scope issue, not a Clawperator problem.

This agent: "genuinely missing" - the script is called from within the Clawperator repo directory by the OpenClaw tool executor. Two separate failures on 2026-03-21.

The other agent noted the `operator.read` scope issue and the gateway port conflict as OpenClaw problems. Those are correct dismissals. The `operator_event.sh` failure is different: it is called at `./scripts/operator_event.sh` which means the working directory was the Clawperator repo. The other Clawperator scripts in `scripts/` are all present. This is a missing script, not an OpenClaw configuration error.

**Resolution: it belongs in the plan. Included in merged PRD-6 (docs and entry points). Flagged as needing OpenClaw tool config review before the script can be written beyond a stub.**

### 5. Docs PRD sequencing

Other agent: docs consolidation is PR-4 (last) because it depends on all runtime semantics settling.

This agent: post-install `install.sh` banner and doctor failure links are PR-3 (independent of runtime changes).

Both are correct for different parts of the docs work. The `install.sh` banner and `operator_event.sh` stub have no runtime dependencies and should ship early. The full docs consolidation and contradiction fix must wait for the readiness gate to land.

**Resolution: split the docs work across two PRs. The banner and stub go into PR-1 (along with the readiness gate, since the doc contradiction fix must land at the same time). Full docs consolidation is PR-6.**

---

## Items the Other Agent Found That Strengthen This Analysis

- `--check-only` semantics: when changing doctor severity, the installer behavior must be preserved. `install.sh` already parses the doctor JSON output and installs the APK conditionally. The fix must keep `--check-only` working non-destructively. Added to merged PRD-1.
- `injectServiceUnavailableHint` in `runExecution.ts`: shows that hint-injection already exists in the execution path. This is the right pattern for adding APK pre-flight output. Added as implementation guidance in merged PRD-1.
- "Prefer composing existing primitives" principle: correctly pushes back on inventing commands. Applied as a constraint in merged PRD-3.
- Progress surface framing (PRD-3): cleaner framing than my pure "NDJSON logs" approach. The merged PRD-4 uses this framing while also including the log-to-disk mechanism.

---

## Items From This Analysis Not in the Other Agent's Work

- `validateExecution.ts` code evidence for the error context gap (PRD-2)
- `runSkill.ts` `stdio` buffering evidence confirming no streaming is possible without changes
- `validateSkill.ts` code evidence confirming no payload compilation
- `operator_event.sh` with log timestamps and repeat-failure evidence
- Specific `criticalChecks.ts` two-line change identified
- `install.sh` post-install banner as a low-effort, high-value discoverability fix
- `RESULT_ENVELOPE_TIMEOUT` last-action context (PRD-2 addition)

---

## Authoritative Output

The merged plan and PRDs in this directory (`plan.md`, `prd-1.md` through `prd-6.md`) are the implementation-ready artifacts. The prior plans from each agent are superseded but preserved for reference.
