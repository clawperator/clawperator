# PRD-3: Doctor-first Agent Entry Points

Workstream: WS-3
Priority: 3
Proposed PR: PR-3

---

## Problem Statement

Clawperator has comprehensive documentation for agents: `llms.txt`, `agent-quickstart.md`, `openclaw-first-run.md`, and a full error handling guide. None of this was encountered by the agent in the GloBird incident. The agent operated from CLI `--help` output alone for the entire session - including the debugging phase.

The gap is not a documentation gap. It is a discoverability gap. Nothing in the install path, the runtime output, or the failure messages points agents to the documentation that exists.

A secondary gap: `./scripts/operator_event.sh` does not exist, but OpenClaw's tool executor calls it from the Clawperator repo directory. Two call attempts failed with "no such file or directory" on 2026-03-21.

---

## Evidence

**From `tasks/node/agent-usage/issues.md`, Issue #10:**
> There's no "Agent Quickstart" that says "Stop. Before you run any commands, read this."
> After this session, I learned about: `https://docs.clawperator.com/llms.txt`
> These would have helped me understand the architecture, validation schema, error codes, and best practices. I didn't know they existed.

**From `sites/landing/public/llms.txt`:**
File exists with accurate, LLM-targeted content covering architecture, action schema, error codes, and agent patterns.

**From `sites/docs/static/llms.txt`:**
File exists. Notes: "prefer this docs site over marketing homepage for technical behavior."

**From `sites/landing/public/install.sh`:**
Post-install output emits a success banner but no docs URL reference. The final user-facing output is a summary of what was installed (CLI, APK, skills). No reference to `llms.txt` or `docs.clawperator.com`.

**From `~/.openclaw/logs/gateway.err.log` (2026-03-21):**
```
[tools] exec failed: zsh:1: no such file or directory: ./scripts/operator_event.sh
[tools] exec failed: zsh:1: no such file or directory: ./scripts/operator_event.sh
```
Two separate failures, same missing script. No such file exists in `scripts/`.

---

## Current Behavior

### Install

`install.sh` completes and prints a summary: CLI installed, APK downloaded, skills installed, doctor passed/failed. No docs URL. No reference to `llms.txt` or agent-specific guidance.

### Doctor failures

Doctor failure output (both `pretty` and `json`) includes the check `summary`, `detail`, and `fix.steps`. It does not link to `docs/troubleshooting.md` or any docs page.

### `operator_event.sh`

The script does not exist. Two silent failures per OpenClaw gateway log. The intended behavior of this hook is unknown without reviewing the OpenClaw tool configuration.

---

## Proposed Change

### 1. Post-install docs reference in `install.sh`

After the success summary, emit:

```
Clawperator is installed and ready.

  Docs:        https://docs.clawperator.com
  Agent guide: https://docs.clawperator.com/llms.txt
  Quickstart:  clawperator doctor --output json

If you are an AI agent, read the agent guide before running any commands.
```

This should appear even when the install is partially successful (APK failed to install, skills not installed) so that agents in degraded states still see the docs reference.

### 2. Docs links in doctor failure output

When `clawperator doctor` reports a critical failure:
- Append to the `fix.steps` list a final step: `{ kind: "docs", value: "https://docs.clawperator.com/troubleshooting" }`
- In `pretty` output, render this as a trailing line: `Docs: https://docs.clawperator.com/troubleshooting`
- In `json` output, include it in the `fix` object as a `docsUrl` field

When doctor outputs a `RECEIVER_NOT_INSTALLED` failure (after WS-1 makes it critical):
- Include the specific install command in `fix.steps`
- Add `docsUrl: "https://docs.clawperator.com/getting-started/first-time-setup"`

### 3. `operator_event.sh` - investigation and resolution

Before writing this script, review the OpenClaw tool configuration to determine:
- What arguments does OpenClaw pass to this script?
- What output format does it expect?
- What should happen on success vs. failure?
- Is this a notification hook, a state reporter, or something else?

**If the intended behavior is identifiable:** Write the script with that behavior. Follow the `clawperator_*` naming convention used by all other scripts in `scripts/`, or create a dedicated `scripts/hooks/` directory if this is the first of multiple hook scripts.

**If the intended behavior cannot be confirmed before this PR ships:** Create a stub that:
- Accepts any arguments (ignores them)
- Exits 0
- Emits a single line to stderr: `operator_event.sh: stub - not yet implemented`

This suppresses the OpenClaw tool executor error while flagging that the stub needs to be replaced.

**Note:** This item is flagged as an open question in the findings. Do not merge the stub without confirming what OpenClaw expects the script to do. A no-op stub that silently drops intended behavior is worse than the current visible failure.

### 4. `AGENTS.md` in the skills repo (deferred)

Adding an `AGENTS.md` at the root of the public skills repo (`../clawperator-skills`) would give agents a prominent entry point when they first encounter the skills bundle. Deferred to a separate PR targeting the skills repo. Not in scope for this PR.

---

## Why This Matters for Agent Success

Documentation discoverability is the cheapest possible fix per unit of agent confusion removed. The docs exist. The cost of not finding them is the entire GloBird debugging session, plus every future session where an agent encounters the same missing-APK, bad-parameter, or timeout pattern.

Adding a docs URL to `install.sh` takes one line. Adding a docs link to doctor failure output takes five lines. These changes ensure that the agent, on the very first run, encounters the guidance that would have prevented the incident.

---

## Scope Boundaries

In scope:
- `install.sh` post-install banner
- Doctor failure output: docs link in `fix.steps` and `pretty` output
- `operator_event.sh` investigation and stub/implementation
- `docs/troubleshooting.md`: ensure it has a clear, scannable entry point structure

Out of scope:
- `AGENTS.md` in skills repo (separate PR)
- Any change to the docs content itself (docs are already accurate)
- Doctor logic changes (covered by WS-1)

---

## Dependencies

None at the code level. However, the `operator_event.sh` item requires an OpenClaw tool config review before it can be implemented correctly. If that review is not complete before this PR, ship the other changes (install.sh, doctor links) and leave the script as a follow-on.

---

## Risks and Tradeoffs

**Risk: install.sh banner noise**
Adding more text to the install output could make the banner harder to scan. Keep the docs reference short (3 lines max). Use a visual separator line to distinguish it from the installation summary.

**Risk: `operator_event.sh` stub masking real intent**
If the stub exits 0 silently and OpenClaw expected specific output, the integration will be broken in a non-visible way. The stub must emit something (even a warning to stderr) to remain detectable.

**Tradeoff: docs URL stability**
The URL `https://docs.clawperator.com/troubleshooting` must remain stable. If the docs site is restructured, the hardcoded URL in doctor output becomes stale. Mitigation: use a redirect-friendly path or document the URL as a stable canonical reference in the docs site config.

---

## Validation Plan

1. Run `install.sh` on a clean environment. Verify docs URL appears in post-install output.
2. Run `install.sh` when APK download fails. Verify docs URL still appears.
3. Run `clawperator doctor` with APK absent (after WS-1 lands). Verify `fix` output includes docs URL in both `pretty` and `json` modes.
4. Verify `./scripts/operator_event.sh` exists and exits 0.
5. Verify OpenClaw tool executor no longer logs "no such file or directory" for this script.

---

## Acceptance Criteria

- `install.sh` post-install output includes `https://docs.clawperator.com` and `https://docs.clawperator.com/llms.txt` in a clearly labelled banner.
- `clawperator doctor --output json` includes a `docsUrl` field in the `fix` object for critical failures.
- `clawperator doctor --output pretty` prints a `Docs:` line for critical failures.
- `./scripts/operator_event.sh` exists and exits 0 (even as a stub).
- OpenClaw tool executor no longer produces "no such file or directory" errors for this script path.
