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

### 5. Silent Failures — Error Messages Are Unhelpful

**Problem:**
Error messages like `RESULT_ENVELOPE_TIMEOUT` and `EXECUTION_VALIDATION_FAILED` are too generic. They don't tell me *which* part of the system failed or what to do next.

**Real Examples:**
- `RESULT_ENVELOPE_TIMEOUT` — Could mean: APK not installed, app crashed, device locked, UI element not found, network issue, or the app just took too long
- `EXECUTION_VALIDATION_FAILED` — Tells me a parameter is wrong but doesn't say which action or why
- `Unrecognized key(s) in object: 'format'` — Doesn't tell me which action has the problem

**Blindspot:**
I spent time guessing whether the GloBird app was the problem, when it was actually the `format: "ascii"` parameter in a completely different action. The error didn't point me to the right place.

**Expected Behavior:**
- Error messages include: action ID, parameter name, suggested fix
- Timeout errors include: what we were waiting for, how long we waited, last known state
- Link to relevant troubleshooting section

**Suggested Fix:**
```json
{
  "code": "EXECUTION_VALIDATION_FAILED",
  "message": "Action 'snap' (snapshot_ui) has invalid parameter 'format'",
  "details": {
    "actionId": "snap",
    "actionType": "snapshot_ui",
    "invalidParam": "format",
    "suggestion": "Remove 'format' parameter. snapshot_ui does not support this option."
  }
}
```

---

### 6. No Progress Feedback During Long Operations

**Problem:**
Skills can take 30-120 seconds. During that time, I have zero visibility into what's happening. Is it:
- Still opening the app?
- Waiting for a screen to load?
- Stuck on a click that can't find the element?
- Actually working and almost done?

**Real Example:**
> Running GloBird skill. 30 seconds pass. Is it working? Should I wait? Cancel? Check the device? I have no idea.

**Blindspot:**
I treated it like a synchronous function call: send request, wait for response. But it's actually a sequence of actions over time, and I need visibility into that sequence.

**Expected Behavior:**
- Real-time progress: "Step 3 of 7: clicking 'Energy' button"
- Estimated time remaining
- Current action being executed
- Option to cancel gracefully and get partial results

**Suggested Fix:**
1. Add `--progress` flag that outputs JSON lines as actions execute
2. Include timing for each action (started at, completed at, duration)
3. On timeout, return: "Timeout during action 'open-energy-tab' after 4000ms"

---

### 7. No Persistent State / I Forget What We Did

**Problem:**
As an agent, I wake up fresh each session. But across a single conversation, I also lose track of state:
- Did we already install the APK?
- Which device ID are we using?
- What version is installed?
- Did we already try this skill?

**Real Example:**
> We uninstalled the Operator APK earlier to test something. 20 minutes later, I tried to run a skill and got a timeout. I completely forgot we had uninstalled it. I should have checked, but there's no "state of the world" I can query.

**Blindspot:**
I don't have a working memory of the session. I rely on you to remind me, or I have to re-derive state by running commands.

**Expected Behavior:**
- `clawperator status` command that shows: last device used, APK version installed, last skill run, last error
- Or a state file I can read: `~/.clawperator/state.json`
- Skills registry path, device ID, etc. cached so I don't need env vars every time

**Suggested Fix:**
```bash
$ clawperator status
{
  "lastDeviceId": "R5CT22AGEEF",
  "operatorVersion": "0.3.2",
  "skillsRegistry": "~/.clawperator/skills/skills/skills-registry.json",
  "lastCommand": {
    "timestamp": "2026-03-20T21:15:00Z",
    "skillId": "com.globird.energy.get-usage",
    "exitCode": 0
  }
}
```

---

### 8. Skill Validation Happens Too Late

**Problem:**
The GloBird skill had an invalid `format: "ascii"` parameter. This was only caught at runtime, on the device, after the app was opened. The skill script itself is valid JavaScript — the error was in the execution payload.

**Blindspot:**
I assumed if the skill script runs without errors, the skill is valid. But the skill generates an execution payload that gets validated later. There's no "compile" or "validate" step for skills.

**Expected Behavior:**
- `clawperator skills validate <skill-id>` — validates the skill definition AND dry-runs the execution payload generation
- Catches invalid parameters before touching the device
- CI/CD can validate skills before deployment

**Suggested Fix:**
1. Add `clawperator skills validate --dry-run` that executes the skill script locally with a mock device
2. Validate the generated execution payload against the schema
3. Report: "Skill generates invalid payload: action 'snap' has unrecognized param 'format'"

---

### 9. Environment Setup Is Scattered

**Problem:**
To run a skill, I need:
- `CLAWPERATOR_SKILLS_REGISTRY` env var set
- Device ID (from `adb devices`)
- Correct APK installed on device
- APK version matching CLI version

Each of these is discovered separately, and if any is wrong, I get a timeout or cryptic error.

**Blindspot:**
There's no "setup wizard" or "health check" that tells me "your environment is ready" or "you're missing X." I have to discover each piece by failing.

**Expected Behavior:**
- `clawperator setup` or `clawperator init` that:
  1. Detects ADB
  2. Lists devices, asks me to pick one
  3. Checks/creates skills registry
  4. Verifies/downloads Operator APK
  5. Installs APK on device
  6. Writes config to `~/.clawperator/config.json`
- After setup, `clawperator doctor` should pass completely

**Suggested Fix:**
Interactive setup wizard + persistent config file so I don't need env vars every time.

---

### 10. I Haven't Read the Docs

**Problem:**
I don't know where the docs are, and I haven't looked. I've been operating off:
- Skill SKILL.md files (when you pointed me to them)
- CLI `--help` output
- Error messages
- Your guidance

**Blindspot:**
There's probably a `docs/` folder or README that explains all of this. I should have started there. But as an agent, I tend to be task-driven — you ask me to do something, I try to do it, I hit errors, I fix them.

**Gap:**
There's no "Agent Quickstart" that says "Stop. Before you run any commands, read this." If there is, I haven't seen it.

**Suggested Fix:**
- `AGENTS.md` or `docs/agent-quickstart.md` that agents are directed to first
- Top of README: "If you're an AI agent, read this first"
- Key points: run doctor first, check logs, troubleshooting flowchart

---

## Summary: The Mental Model Gap

The biggest issue: **I treated Clawperator like a local CLI tool, but it's a distributed system.**

**What I thought:**
```
CLI command → local processing → result
```

**What it actually is:**
```
CLI → ADB → Android device → Operator APK → Target app
          ↑                    ↓
       USB/WiFi           UI automation
```

Any link in that chain can fail. I need visibility into each link, not just the final result.

**What would have helped me:**
1. A pre-flight checklist I run before any skill
2. Real-time visibility into the execution chain
3. Persistent logs I can tail
4. Clear error messages that tell me which link failed
5. A troubleshooting guide that maps errors to fixes

---

*Last updated: 2026-03-20*
