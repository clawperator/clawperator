# Agent Usage Findings

Investigation into why Clawperator is hard for agents on a first run.
Conducted: 2026-03-21

---

## Sources Inspected

- `tasks/node/agent-usage/issues.md` - hypothesis list authored by an agent after the GloBird incident
- `~/.openclaw/logs/gateway.log` (last 400 lines)
- `~/.openclaw/logs/gateway.err.log` (last 400 lines)
- `/tmp/openclaw/openclaw-2026-03-20.log` (full, 100 lines)
- `/tmp/openclaw/openclaw-2026-03-21.log` (full, 335 lines)
- `apps/node/src/domain/doctor/criticalChecks.ts`
- `apps/node/src/domain/doctor/checks/readinessChecks.ts`
- `apps/node/src/domain/doctor/DoctorService.ts`
- `docs/openclaw-first-run.md`
- `docs/agent-quickstart.md`
- `docs/node-api-for-agents.md`
- `docs/reference/error-handling.md`
- `sites/landing/public/llms.txt`
- `sites/docs/static/llms.txt`
- `sites/landing/public/install.sh`

---

## Summary of What Went Wrong

The GloBird skill failure (the concrete incident behind issues.md) had three distinct causes:

1. The Operator APK had been deliberately uninstalled earlier in the session. No pre-flight checked for it. `execute` broadcast into the void for 30-120 seconds and returned `RESULT_ENVELOPE_TIMEOUT`.
2. A stale `format: "ascii"` parameter in the skill's `snapshot_ui` action caused `EXECUTION_VALIDATION_FAILED`. The error did not identify which action or which parameter was invalid.
3. The agent did not know documentation existed. It was operating from CLI `--help` output and skill SKILL.md files alone.

These are three separate failure modes: environment readiness, error message quality, and documentation discoverability. They compounded each other into a confusing debugging session.

---

## Evidence from Logs

### `operator_event.sh` not found (2026-03-21)

```
[2026-03-20T18:14:29.809Z] [ERROR] [tools] exec failed:
  zsh:1: no such file or directory: ./scripts/operator_event.sh
  Command not found
```

This error appears twice in `/tmp/openclaw/openclaw-2026-03-21.log`. The `[tools]` prefix is OpenClaw's shell-tool executor. The path `./scripts/operator_event.sh` is relative, implying OpenClaw ran this from inside the Clawperator repo directory. No such script exists in `scripts/`.

**Classification: genuinely missing** - an OpenClaw tool config expects this script to exist in the Clawperator repo and it has never been created.

### `missing scope: operator.read` (2026-03-21)

```
[tools] missing scope: operator.read  (status, system-presence, config.get)
```

Three RPC calls failed immediately after the agent connected to the OpenClaw gateway. The connection itself succeeded but the token used lacked `operator.read`. This is an OpenClaw credential/scope configuration issue, not a Clawperator issue.

**Classification: out of scope for this investigation** - pure OpenClaw infrastructure.

### Gateway startup loop (2026-03-15)

The `gateway.err.log` shows ~30 repeated `Gateway failed to start: another gateway instance is already listening` errors over 5 minutes. This is an OpenClaw restart/port-conflict issue, not Clawperator. Out of scope.

---

## Evidence from Repo Inspection

### Finding 1: APK absence is a `warn`, not a `fail`, in doctor

`apps/node/src/domain/doctor/checks/readinessChecks.ts`:

```typescript
return {
  id: "readiness.apk.presence",
  status: "warn",                        // <-- warn, not fail
  code: ERROR_CODES.RECEIVER_NOT_INSTALLED,
  summary: "Operator APK not installed.",
  ...
};
```

`apps/node/src/domain/doctor/criticalChecks.ts`:

```typescript
export const CRITICAL_DOCTOR_CHECK_PREFIXES = [
  "host.node.version",
  "host.adb.presence",
  "host.adb.server",
  "host.java.version",
  "device.discovery",
  "device.capability",
  "build.android.assemble",
  "build.android.install",
  "build.android.launch",
  "readiness.version.compatibility",
  "readiness.handshake",
  "readiness.smoke",
  // "readiness.apk.presence" is NOT here
];
```

The consequence: `clawperator doctor` passes (exits 0, no halt) when the APK is not installed. The next `execute` or `skills run` then dispatches an adb broadcast to a receiver that does not exist, waits for a result envelope that will never arrive, and returns `RESULT_ENVELOPE_TIMEOUT` after 30-120 seconds. There is no intermediate signal that the APK is missing.

`readiness.version.compatibility` is critical, but it fires a version probe that itself requires the APK to be installed - so if the APK is absent the version check never executes usefully either.

**Classification: genuinely missing enforcement** - the code path to detect the problem exists; the decision to make it blocking does not.

### Finding 2: No pre-flight APK check in `execute`

`execute` dispatches its payload via `broadcastAgentCommand` without first querying `pm list packages`. The APK presence check only runs if the caller explicitly invokes `clawperator doctor`. There is no automatic guard.

**Classification: genuinely missing** - the check mechanism exists (in `readinessChecks.ts`) but is not wired into the execution path.

### Finding 3: `EXECUTION_VALIDATION_FAILED` does not identify the offending action or parameter

From issues.md (confirmed by examining the GloBird incident):

> `Unrecognized key(s) in object: 'format'` - Doesn't tell me which action has the problem.

The current validation layer returns the schema violation message but strips the action `id` and action `type` from the error context. An agent must manually diff its payload against the schema to find the culprit.

**Classification: genuinely missing** - the Zod schema path information is available at validation time but not forwarded to the error envelope.

### Finding 4: `enter_text` `clear: true` silently no-ops

From `tasks/agent-ui-loop/api-improvement-suggestions.md` (GAP-02, marked HIGH):

> Node accepts `clear: true` but Android receiver silently ignores it. Agents believe fields are cleared; they're appended to instead.

This is a live silent contract violation. Not the primary pain point of the first-run scenario but a real failure mode in any form-filling skill.

**Classification: genuinely missing implementation** - contract says one thing, Android does another.

### Finding 5: `clawperator skills validate` exists but does not dry-run execution payloads

The CLI reference includes `skills validate <skill_id>` and `skills validate --all`. The current implementation checks skill metadata and required files. It does not execute the skill's compile step and validate the resulting execution payload against the action schema.

The GloBird skill would have passed `skills validate` even with the invalid `format: "ascii"` parameter, because the validation only checks the skill's file structure, not the payload it generates.

**Classification: partially solved** - structural validation exists; payload dry-run does not.

### Finding 6: No persistent log output from the CLI

There is no log-to-disk mechanism in the CLI. `DoctorService`, `execute`, and `skills run` write only to stdout/stderr. On timeout, the agent receives `RESULT_ENVELOPE_TIMEOUT` with no additional evidence about which phase failed, whether adb delivered the broadcast, or what the Android side saw.

**Classification: genuinely missing** - no `~/.clawperator/logs/` path exists.

### Finding 7: Documentation exists but is not surfaced at install time

Both `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt` exist with accurate, LLM-targeted content. `docs/agent-quickstart.md` and `docs/openclaw-first-run.md` are comprehensive. The agent in the GloBird incident had none of this; it operated from CLI `--help` alone.

The `install.sh` script does not emit a reference to `llms.txt` or the docs site after installation. Doctor output does not link to docs when it detects failures.

**Classification: already solved but poorly surfaced** - the docs are there; the problem is that nothing points agents to them at the moment they need them.

### Finding 8: `operator_event.sh` - missing Clawperator integration script

The OpenClaw gateway log shows repeated attempts to execute `./scripts/operator_event.sh` from the Clawperator repo directory. No such script exists. All other `scripts/` entries follow the `clawperator_*` naming pattern and are smoke/validation tools. `operator_event.sh` has no stub, no comment, and no reference in docs.

This implies an OpenClaw tool configuration was written to call a Clawperator-side hook that was never created. Until this script exists (even as a stub), the `[tools]` invocations will silently fail.

**Classification: genuinely missing** - but requires OpenClaw-side tool config review to confirm scope and intended behavior.

### Finding 9: Skills progress is a black box during execution

`clawperator skills run` produces no output until the command exits. A 30-second skill execution is 30 seconds of silence. There is no `--progress` or streaming mode. The agent cannot distinguish "working normally" from "stuck waiting for a UI element."

**Classification: genuinely missing** - no streaming exists.

### Finding 10: `clawperator status` does not exist

issues.md proposes a `status` command that would return the last device used, installed APK version, skills registry path, and last command. No such command exists. `clawperator doctor` partially overlaps this need but is slow (runs handshake, smoke test) and has no caching.

**Classification: genuinely missing** - but the value is questionable. See open questions below.

---

## Contradictions Between Docs and Code

| Claim in docs | Reality in code | Verdict |
| :--- | :--- | :--- |
| `openclaw-first-run.md` says doctor detects `RECEIVER_NOT_INSTALLED` and implies setup should stop | Doctor emits a `warn` and does not halt; `execute` proceeds anyway | Docs are aspirationally correct but enforcement is missing |
| `openclaw-first-run.md` Step 5 says "if doctor does not pass, stop and fix" | Doctor passes even with APK missing (warn is not a halt) | Doc intent is right; code doesn't enforce it |
| `skills validate` documented in CLI reference as checking skill readiness | Implementation checks file structure only, not generated payload validity | Docs over-promise what validate actually confirms |
| `error-handling.md` correctly lists `RECEIVER_NOT_INSTALLED` as an environment targeting error requiring "fix environment first" | But nothing in the execution path prevents the timeout from happening first | Docs are correct; execution path doesn't follow the guidance |

---

## What Is Already Implemented

- `clawperator doctor` with `readiness.apk.presence` check (passes as warn)
- `readiness.version.compatibility` as critical (correctly halts on version mismatch after APK is present)
- `clawperator skills validate` (structural, not payload-level)
- `docs/agent-quickstart.md` (comprehensive)
- `docs/openclaw-first-run.md` (comprehensive, task-oriented)
- `docs/reference/error-handling.md` (correct triage guidance)
- `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt` (accurate, LLM-targeted)
- `snapshot_ui` now returns `SNAPSHOT_EXTRACTION_FAILED` on failure (previously silent)
- `EXECUTION_VALIDATION_FAILED` surfaces schema messages (but not action context)

---

## What Is Missing

1. `readiness.apk.presence` is not a critical/halting check - execute can proceed without APK
2. No pre-flight APK check wired into `execute` or `skills run`
3. Validation errors do not include action `id` and action `type`
4. `enter_text clear: true` accepted by Node, silently ignored by Android
5. `skills validate` does not dry-run execution payload compilation
6. No persistent log output to disk
7. No streaming/progress output from `skills run`
8. `./scripts/operator_event.sh` does not exist
9. `install.sh` does not emit docs URL or llms.txt reference post-install
10. Doctor failure output does not link to relevant docs or troubleshooting page

---

## Recommended Macro Workstreams

### WS-1: Hard-fail on missing APK (highest ROI)

Make `readiness.apk.presence` a critical check. Add an APK presence pre-flight to `execute`. This single change eliminates the 30-120s timeout-before-diagnosis loop that caused the GloBird incident and is the #1 source of agent confusion.

### WS-2: Richer error context

Enrich `EXECUTION_VALIDATION_FAILED` with the offending action `id` and `type`. Make `RESULT_ENVELOPE_TIMEOUT` report the last action in flight. These two changes give agents the information needed to self-correct without user intervention.

### WS-3: Doctor-first agent entry points

Surface docs at install time and at doctor failure time. Add docs URL reference to `install.sh` post-install banner. Add troubleshooting links to doctor failure output. Create `./scripts/operator_event.sh` stub (or confirm it should not exist). These changes ensure agents encounter documentation at the moment they need it, not after the debugging session ends.

### WS-4: Skills validate with payload dry-run

Extend `skills validate` to optionally compile the skill artifact and validate the resulting execution payload against the action schema. This catches stale API usage (like `format: "ascii"`) at authoring time, not at runtime on a live device.

### WS-5: Structured persistent logs

Write JSON-structured logs to `~/.clawperator/logs/`. Include correlation IDs matching `commandId`/`taskId`. Document the log path. This gives agents (and operators) evidence to triage timeouts without needing a device in hand.

### WS-6 (deferred): Streaming skill output and `clawperator status`

Real-time streaming from `skills run` and a lightweight `status` command are valuable but have higher implementation cost and lower urgency than WS-1 through WS-5. Defer until the fast-fail and error quality improvements are shipped and the remaining failure modes are assessed.

---

## Open Questions and Uncertainties

1. **`operator_event.sh` intended behavior**: What is OpenClaw expecting this script to do? Is it a notification hook, a state reporter, or something else? This needs OpenClaw-side tool config review before the script can be written. Without that, a stub that exits 0 and emits nothing will suppress the error but may silently drop intended behavior.

2. **APK pre-flight scope**: Should the pre-flight in `execute` be a full `checkApkPresence` call (queries device via adb) or a lighter cached result from a recent doctor run? The adb round-trip is fast (~100ms) but adds latency to every execute call. A cached result (e.g., from a state file written by doctor) would be faster but could be stale.

3. **`clawperator status` value**: The core need is "is my environment ready" and "which device am I targeting." `clawperator doctor --output json` already answers the first. A `status` command that just re-runs a subset of doctor checks may not be worth the implementation surface. Alternatively, a lightweight `~/.clawperator/state.json` written by doctor and `operator setup` could serve as a passive cache without requiring a new command.

4. **Streaming architecture**: `skills run` currently wraps a skill script subprocess and waits for its exit. True per-action streaming would require the Android runtime to emit action-level events, which means Operator APK changes. This is a significant scope increase. A smaller version - streaming the CLI-side execution log rather than Android-side events - might be achievable without APK changes but would not surface per-action Android results.

5. **`enter_text clear: true` fix**: Requires Android receiver changes (Operator APK) and corresponding CLI/doc updates. Not a pure Node/CLI fix. Needs explicit product decision on whether to implement, document the gap, or remove the parameter from the contract.

---

## Brainstorm Ideas to Reject or Defer

- **Auto-running doctor before every execute**: Too slow. The right fix is a targeted pre-flight (APK presence check only), not re-running the full doctor suite on every command.
- **Interactive `clawperator setup` wizard**: The current `install.sh` + `operator setup` + `doctor` flow already covers the setup sequence. An interactive wizard adds maintenance surface for minimal gain. Better to make the existing flow fail louder.
- **`--stream-events` requiring Android APK changes**: Defer. Not feasible without an Operator APK release cycle. The smaller win (CLI-side structured logs) is achievable independently.
- **`clawperator status` as a new top-level command**: Likely not worth it as a standalone command. Better served by making `doctor --output json` faster (skip handshake on `--check-only`) and documenting it as the agent status surface.

---

## Decision Log

| Issue | Classification | Rationale |
| :--- | :--- | :--- |
| APK absence = warn not fail | Genuinely missing enforcement | Code gap confirmed in criticalChecks.ts and readinessChecks.ts |
| No pre-flight in execute | Genuinely missing | No APK check in execution path; mechanism exists in readinessChecks.ts |
| Validation errors lack action context | Genuinely missing | Zod path info available at validation time, not forwarded |
| Docs not surfaced at install | Already solved, poorly surfaced | Both llms.txt files exist; install.sh emits no doc reference |
| operator_event.sh missing | Genuinely missing | Script absent from scripts/; needs OpenClaw tool config review |
| skills validate misses payload | Partially solved | Structural check exists; payload dry-run does not |
| No persistent logs | Genuinely missing | No disk log path in any CLI command |
| Streaming progress | Genuinely missing | No streaming in skills run; APK changes needed for full solution |
| clawperator status command | Unclear value | doctor --output json covers the need; defer decision |
| enter_text clear no-op | Genuinely missing (Android) | Requires APK changes; out of scope for Node-only workstreams |
| missing scope: operator.read | Out of scope | Pure OpenClaw credential configuration issue |
| Gateway port conflict loop | Out of scope | Pure OpenClaw restart issue |
