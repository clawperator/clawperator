# Agent Usage Issues

This file tracks issues and improvements related to agent/LLM usage of the Clawperator API.

## Open Issues

### 1. Missing Operator APK Not Detected Early

**Problem:**
When the Clawperator Operator APK is not installed on the device, API calls (like `execute`, `skills run`, `observe screenshot`) timeout with `RESULT_ENVELOPE_TIMEOUT` instead of failing fast with a clear error.

**Current Behavior:**
1. `clawperator doctor` detects `RECEIVER_NOT_INSTALLED` but reports it as a **warning** (not critical)
2. `clawperator execute` sends broadcasts without checking if the APK is installed
3. Commands timeout after 30-120 seconds with `RESULT_ENVELOPE_TIMEOUT`
4. Skills inherit this timeout behavior since they use `execute` internally

**Expected Behavior:**
- Doctor should mark `RECEIVER_NOT_INSTALLED` as **critical** (blocks execution)
- Execute should check APK presence before sending broadcasts and fail fast with `OPERATOR_NOT_INSTALLED`
- Skills should run a verification phase as step 0 (check APK installed and version compatible)

**Impact:**
- Poor UX for agents/LLMs using the API — timeouts are confusing and slow
- Wasted time waiting for commands that can never succeed
- Difficult to diagnose without running `doctor` separately

**Suggested Fix:**
1. Change `RECEIVER_NOT_INSTALLED` from `warn` to `fail` in Doctor checks
2. Add APK presence check at the start of `execute` command
3. Add `--validate` flag to skills run that checks prerequisites before execution
4. Consider auto-running doctor checks before execute/skills commands

**Related:**
- Similar issue with `RECEIVER_VARIANT_MISMATCH` (debug vs release APK)
- Version compatibility checks exist but only warn, don't block

---

### 2. No Logging / "Flying Blind"

**Problem:**
When skills or commands fail, there is no persistent logging to help diagnose issues. Agents/LLMs have no visibility into:
- What the Operator APK is doing on the device
- Whether broadcasts were received
- What errors occurred internally
- State transitions during execution

**Current Behavior:**
- No log files written to disk
- Only stdout/stderr from the CLI
- On timeout, zero information about what went wrong
- Agents must guess or ask the user

**Real Example:**
> GloBird skill timed out. Is it the app? The APK? The device? No logs to check. Had to manually verify APK was installed (it wasn't, but we had uninstalled it earlier and I forgot).

**Expected Behavior:**
- Clawperator writes structured logs to `~/.clawperator/logs/` (or configurable path)
- Agents can `tail -f` logs during skill execution
- Logs include: broadcast sent, response received, errors, timing, device state
- Log level configurable (debug, info, warn, error)

**Suggested Fix:**
1. Add `--log-dir` flag to all commands
2. Write JSON-structured logs (one line per event)
3. Include correlation IDs so agents can filter logs for a specific command
4. Document the log location so agents know where to look

---

### 3. No Troubleshooting Guide for Agents

**Problem:**
When things go wrong, there's no quick reference for agents to diagnose common issues. The current flow requires:
- Knowing to run `clawperator doctor`
- Knowing how to interpret doctor output
- Knowing to check APK installation
- Knowing to check device connectivity

**Current Behavior:**
- Agent must guess or ask the user
- No "if X then try Y" decision tree
- Documentation exists but is scattered

**Expected Behavior:**
- Single troubleshooting doc with common failure modes
- Decision tree format (LLM-friendly)
- Linked from error messages where possible

**Suggested Structure:**
```
If RESULT_ENVELOPE_TIMEOUT:
  1. Run `clawperator doctor`
  2. Check RECEIVER_NOT_INSTALLED or RECEIVER_VARIANT_MISMATCH
  3. If missing, install APK: `clawperator operator setup --apk ...`
  4. If variant mismatch, uninstall and reinstall correct variant

If EXECUTION_VALIDATION_FAILED:
  1. Check skill script for invalid parameters
  2. Verify parameter names match API schema
  3. Common issue: `format` param removed from snapshot_ui
```

---

### 4. Agent as "Brain" — Skill Execution Needs Observation

**Problem:**
Currently, agents run skills as one-shot commands and wait for output. This is insufficient because:
- Skills can hang, timeout, or fail silently
- No real-time feedback during execution
- Agent can't intervene or adapt mid-execution
- No way to capture partial progress on failure

**Current Behavior:**
```
Agent: run skill
CLI:    (30-120 seconds of silence)
CLI:    {result or timeout}
Agent:  interpret result
```

**Expected Behavior:**
```
Agent: run skill with --stream-events
CLI:    [event] action_started: open_app
CLI:    [event] action_completed: open_app
CLI:    [event] action_started: click
CLI:    [event] action_failed: click (element not found)
Agent:  (can react immediately, no need to wait for timeout)
```

**Meta-Point:**
The agent (me) needs to be a better "brain" by:
1. **Observing** — Not just waiting for final output, but watching progress
2. **Checking** — Verifying prerequisites before starting (APK installed? device ready?)
3. **Reacting** — Adapting when things go wrong instead of just failing
4. **Logging** — Keeping state so I don't forget what we did 5 minutes ago

**Suggested Fix:**
1. Add `--stream-events` or `--jsonl` flag to skills run
2. Output one JSON line per event (action start, complete, error)
3. Agent can parse events in real-time
4. Document the "agent as brain" pattern for skill execution

---

## Lessons Learned (Agent Notes)

From debugging the GloBird skill failure:

1. **I forgot we uninstalled the APK** — I should have checked immediately when the timeout occurred
2. **I didn't know where logs were** — There were no logs to check
3. **I didn't run doctor proactively** — Would have caught the missing APK immediately
4. **The error message was unhelpful** — `RESULT_ENVELOPE_TIMEOUT` could mean many things

**Better flow for next time:**
```
Before running any skill:
  1. Run `clawperator doctor` — verify device + APK
  2. Start tailing logs (if they existed)
  3. Run skill with streaming output
  4. Watch for events, react to failures immediately
```

---

*Last updated: 2026-03-20*
