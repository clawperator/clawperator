# PRD-1: Docs Entry Points, Agent Discoverability, and Integration Hooks

Workstream: docs-refactor
Priority: 1 (within docs refactor; blocked on API refactor completion)

Originally PRD-6 in `tasks/node/agent-usage/`. Moved here after the API refactor
plan split that work into its own task area.

---

## Problem Statement

The docs already contain the right material. The first-run story is spread across multiple pages. The docs are not pointed to from install output, and doctor failure output links to nothing. A missing integration hook (`scripts/operator_event.sh`) causes repeated visible errors in the OpenClaw gateway log.

The install.sh banner and OPERATOR_NOT_INSTALLED behavior are already fixed in previously merged work (the old PRD-1 readiness gate). This PRD covers everything that must wait for all runtime changes - including the API refactor - to settle.

---

## Evidence

**OpenClaw session logs:**
> I don't know where the docs are, and I haven't looked. I've been operating off CLI --help output.
> After this session, I learned about https://docs.clawperator.com/llms.txt. These would have helped me understand the architecture, validation schema, error codes, and best practices. I didn't know they existed.

**From `docs/index.md` (verified against source):**
`docs/index.md` already lists `llms.txt`, `Agent Quickstart`, `First-Time Setup`, and `OpenClaw First Run`, so the docs have the necessary entry points. The docs are useful once found, but the first-run path is not a single obvious sequence. `docs/agent-quickstart.md` and `docs/openclaw-first-run.md` exist as peers, not a hierarchy.

**From `~/.openclaw/logs/gateway.err.log` (2026-03-21):**
```
[tools] exec failed: zsh:1: no such file or directory: ./scripts/operator_event.sh
[tools] exec failed: zsh:1: no such file or directory: ./scripts/operator_event.sh
```
Two failures at 04:14:29. All other scripts in `scripts/` are present. This script is missing.

**From `docs/index.md`:**
Entry points already exist: `llms.txt`, `Agent Quickstart`, `First-Time Setup`, `OpenClaw First Run`. The issue is ordering and prominence, not absence.

---

## Current Behavior

1. `docs/index.md` lists multiple entry points with no clear priority order for agents.
2. `docs/agent-quickstart.md` and `docs/openclaw-first-run.md` are peers, not a hierarchy.
3. Doctor failure output (`pretty` and `json`) does not link to troubleshooting docs.
4. `./scripts/operator_event.sh` does not exist. Two call attempts fail on each gateway run.
5. `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt` are accurate and comprehensive but not referenced from install output.

---

## Proposed Change

### 1. Make one first-run path canonical in `docs/index.md`

Reorder the agent-facing section of `docs/index.md` so the sequence is:

1. `llms.txt` (machine-readable entry point - read this first)
2. `agent-quickstart.md` (fastest path from install to first command)
3. `openclaw-first-run.md` (if starting from zero with OpenClaw)
4. `first-time-setup.md` (device setup detail)
5. `node-api-for-agents.md` (full API reference)

Label the top of the agent section explicitly: "If you are an AI agent, start here."

### 2. Align all first-run guides with the same command sequence

The recommended first-run sequence across all guides must be consistent with the shipped behavior. Specifically:

- `doctor` is the mandatory pre-step before any device command.
- `doctor` hard-fails on missing APK.
- `operator setup` is the install command when APK is absent.
- All command examples must use the new flat command surface from the API
  refactor: `snapshot` not `observe snapshot`, `click --text` not
  `action click --selector`, `--device` not `--device-id`, `--json` not
  `--json`.

Check `agent-quickstart.md`, `openclaw-first-run.md`, and `first-time-setup.md` for any remaining references to APK absence as advisory or old command forms. Update all three.

### 3. Add docs links to doctor failure output

Three files must change in lockstep:

**a. `apps/node/src/contracts/doctor.ts`**: Add `docsUrl` to the `fix` type:

```typescript
fix?: {
  title: string;
  platform: "mac" | "linux" | "win" | "any";
  steps: Array<{ kind: "shell" | "manual"; value: string }>;
  docsUrl?: string;    // new optional field
};
```

**b. `apps/node/src/cli/commands/doctor.ts`**: Update `renderCheck` to render `docsUrl` in pretty mode:

```typescript
if (check.status !== "pass" && check.fix) {
  lines.push(`    ${check.fix.title}:`);
  for (const step of check.fix.steps) {
    lines.push(`      - ${step.value}`);
  }
  if (check.fix.docsUrl) {
    lines.push(`      Docs: ${check.fix.docsUrl}`);
  }
}
```

JSON mode already serializes the full `DoctorReport` object, so `docsUrl` will appear automatically once it is in the type and populated in the check result. No separate JSON formatter change is needed.

**c. `apps/node/src/domain/doctor/checks/readinessChecks.ts`**: Populate `docsUrl` in the `OPERATOR_NOT_INSTALLED` fix:

```typescript
fix: {
  title: "Install Operator APK",
  platform: "any",
  docsUrl: "https://docs.clawperator.com/getting-started/first-time-setup",
  steps: [...]
}
```

Only add `docsUrl` to checks where a specific, stable docs page exists. The initial set: `OPERATOR_NOT_INSTALLED`, `RECEIVER_VARIANT_MISMATCH`, and `DEVICE_DEV_OPTIONS_DISABLED`. Do not add it to all checks as a bulk change.

Required tests:
- Unit test: `renderCheck` output for a check with `fix.docsUrl` includes the `Docs:` line.
- Unit test: `renderCheck` output for a check without `fix.docsUrl` does not include a `Docs:` line.
- Unit test: `JSON.parse(cmdDoctor({ format: "json", ... }))` output for `OPERATOR_NOT_INSTALLED` includes `fix.docsUrl`.
- Type-level: TypeScript compilation verifies `docsUrl` is optional (not required) in the `fix` type.

### 4. `scripts/operator_event.sh`: investigation and stub

This is a **blocking prerequisite** for this item - review the OpenClaw tool configuration before writing any code:
- What command invokes this script? What is the exact call path in the OpenClaw tool config?
- What arguments are passed?
- What output format or exit code does OpenClaw expect?
- Is the missing script the root cause, or does the failure indicate a deeper contract issue between OpenClaw and Clawperator?

If the intended behavior is confirmed and straightforward: implement it, following the `clawperator_*` naming convention and `set -euo pipefail` header used by other scripts in `scripts/`.

If the intended behavior is non-trivial or requires a human decision: create a stub with all of the following properties:
- Accepts any arguments
- Exits 0
- Emits one line to stderr: `operator_event.sh: stub - not yet implemented (see tasks/docs/refactor/prd-1-entry-points.md)`

**Do not merge a silent no-op stub.** A silent exit-0 with no output masks the failure and could suppress real events that OpenClaw expected to receive. The stderr note keeps the stub visible in log inspection.

**Do not merge this item without the OpenClaw review.** If the review cannot be completed in this PR, drop the item and create a follow-up issue. An uninvestigated stub is preferable to leaving the "no such file" error, but a confirmed implementation is required before this is done.

### 5. `~/.clawperator/AGENTS.md` generated by `install.sh`

Create a machine-readable context file at `~/.clawperator/AGENTS.md` that install.sh
writes (or overwrites) on each run. This is the Clawperator equivalent of a project
`CLAUDE.md` — an auto-discovered orientation file for any agent operating in this
environment.

Content template (adjust version and URLs before writing):

```markdown
# Clawperator Agent Context

Clawperator is a deterministic Android UI actuator. You are the brain; Clawperator is
the hand. Read docs before issuing commands.

## Quick reference

- Docs: https://docs.clawperator.com
- Machine-readable guide: https://docs.clawperator.com/llms.txt
- Version: <installed-version>

## Workflow

1. Run `clawperator doctor` before any device command.
2. If APK missing: `clawperator operator setup --apk <path> --device <id>`
3. Run skills: `clawperator skills run <skill-id> --device <id>`
4. On timeout or failure: check logs at ~/.clawperator/logs/

## Logs

Structured NDJSON logs: ~/.clawperator/logs/clawperator-YYYY-MM-DD.log
Filter by commandId to trace a specific execution.

## Skills

Installed skills registry: ~/.clawperator/skills/registry.json
List available skills: `clawperator skills list`
Validate before run: `clawperator skills validate <id> --dry-run`
```

Implementation:
- Write this file from `install.sh` after the installation banner. Use
  `cat > "$HOME/.clawperator/AGENTS.md"` with the version substituted.
- **Version source**: `install.sh` does not have a single `CLAWPERATOR_VERSION` variable.
  After the `npm install -g clawperator` step completes, capture the installed version:
  ```bash
  CLAWPERATOR_VERSION=$(clawperator --version 2>/dev/null || echo "unknown")
  ```
  Use `$CLAWPERATOR_VERSION` in the AGENTS.md template substitution. Place this capture
  immediately after the npm install step, before the banner is written.
- Overwrite on each install (it is always regenerated, never hand-edited).
- The file path (`~/.clawperator/AGENTS.md`) must be stable since agents will discover it by convention.

**Skills-directory AGENTS.md (separate repo deliverable):** The `clawperator-skills`
repository should add an `AGENTS.md` at the root of its skills directory
(`~/.clawperator/skills/AGENTS.md` after install), covering skills-specific usage
guidance, authoring conventions, and the `--dry-run` workflow. This file is outside
the scope of this PR but must be tracked as a follow-up in the `clawperator-skills`
repo. The implementing agent owns this: create the GitHub issue when this PR merges.

### 6. `llms.txt` alignment

After the API refactor lands, verify that both `sites/landing/public/llms.txt`
and `sites/docs/static/llms.txt` accurately describe the final shipped
behavior. Specifically:
- APK absence is a hard failure (not advisory)
- CLI uses flat commands (`snapshot`, `click --text`, etc.), not `action`/`observe`
- Flag names use the new short forms (`--device`, `--json`, `--timeout`)
- `skills validate --dry-run` exists
- Persistent NDJSON logs are at `~/.clawperator/logs/`; `--log-level` flag controls verbosity
- `RESULT_ENVELOPE_TIMEOUT` error includes `logPath` pointing to the current day's log
- `enter_text clear: true` is a known no-op

The `llms.txt` files should be the last thing updated, once all behavior is settled.

---

## Why This Matters for Agent Success

An agent that reads `llms.txt` before running any commands has a correct mental model of the system, knows to run `doctor` first, and knows where logs are. Without this, the first session is a discovery loop. The docs exist; the routing to them is what needs to change.

The `operator_event.sh` fix stops a visible recurring error in the OpenClaw gateway log that, if left unfixed, adds noise to every debugging session and may mask real failures.

---

## Scope Boundaries

In scope:
- `docs/index.md` agent section reordering
- `agent-quickstart.md`, `openclaw-first-run.md`, `first-time-setup.md` alignment with shipped behavior and new CLI surface
- Doctor failure output: `docsUrl` in `fix` object
- `scripts/operator_event.sh` stub (after OpenClaw review)
- `~/.clawperator/AGENTS.md` generated by `install.sh`
- `llms.txt` final alignment after all PRs land

Out of scope:
- Adding new documentation content (the content already exists)
- Docs structural reform (PRD-2 - must land after this PRD)
- `AGENTS.md` in the `clawperator-skills` repo (separate repo - tracked as a follow-up
  issue to be filed when this PR merges)
- Shell profile or env var machinery beyond what setup already does

---

## Dependencies

- **API refactor (all phases)**: the new CLI command surface must be stable
  before this PRD writes docs against it. All command examples, flag names,
  and help text references must use the post-refactor surface.
- **Previously merged runtime PRDs** (readiness gate, error context, dry-run
  validation, persistent logging): these are already shipped and their behavior
  must be accurately described.

This is the first deliverable after the API refactor completes.

---

## Risks and Tradeoffs

**Risk: docs stability**
If this PR lands before the API refactor is complete, the docs will describe behavior that does not yet exist. The sequencing dependency is critical. Do not write this PRD's content until all API refactor phases have merged.

**Risk: `docsUrl` field in `fix` object**
Hardcoded docs URLs in doctor output will become stale if the docs site is restructured.
PRD-2 restructures the docs and will rename pages. The implementing agent for PRD-2 must
check and update all `docsUrl` values hardcoded in this PRD as part of that work. The
three initial `docsUrl` values are in `readinessChecks.ts` for `OPERATOR_NOT_INSTALLED`,
`RECEIVER_VARIANT_MISMATCH`, and `DEVICE_DEV_OPTIONS_DISABLED`. Document these as
explicit search targets in the PRD-2 implementation notes.

**Risk: `operator_event.sh` stub masking intent**
A silent no-op is worse than the current visible error. The stub must emit a stderr notice. This makes the stub detectable by anyone reviewing the logs.

**Tradeoff: llms.txt update timing**
`llms.txt` should describe current shipped behavior, not aspirational behavior. Only update it in this PR (after all others have merged), not speculatively during earlier PRs.

---

## Testing Plan

### Fixtures

Inline `DoctorCheckResult` objects — construct in test body, no files needed:
- One check with `fix.docsUrl` set to a full `https://` URL
- One check without `fix.docsUrl` (the field is absent, not set to `undefined`)

### TDD Sequence

1. Write T1 (no phantom `Docs:` line). Passes unchanged — this is the regression pin.
2. Add `docsUrl?: string` to `contracts/doctor.ts`. Run `npm run build`. Must compile
   with no new errors (confirms the field is optional, not required).
3. Modify `renderCheck`. Write T2 (includes `Docs:` line). Fails; add conditional;
   passes. T1 must still pass.
4. Populate `docsUrl` in `readinessChecks.ts`. Write T3 (JSON output includes the field).
   Fails; populate; passes.

### Unit Tests

**T1 — `renderCheck` without `docsUrl` emits no `Docs:` line (regression anchor)**
- Input: check with `fix` containing `title` and `steps` but no `docsUrl`
- Expected: output string does not contain the substring `"Docs:"`
- Protects: field added as phantom line to all check output; every check gets
  `"Docs: undefined"`; must pass before and after the change

**T2 — `renderCheck` with `docsUrl` includes the `Docs:` line**
- Input: check with `fix.docsUrl = "https://docs.clawperator.com/..."`
- Expected: output contains `"Docs: https://docs.clawperator.com/..."`
- Protects: field in type and data but never rendered; doctor failure output silently
  omits the link

**T3 — doctor JSON output for `OPERATOR_NOT_INSTALLED` includes `fix.docsUrl`**
- Method: call the readiness check function and inspect the returned object; or parse
  `clawperator doctor --json`
- Expected: `check.fix.docsUrl` starts with `"https://"`
- Protects: `docsUrl` in contract and renderer but never populated in the check
  definition; JSON reflects what is in the data

**T4 — TypeScript compiles without errors when `docsUrl` is absent**
- Method: `npm run build` on a codebase that has checks without `docsUrl`
- Expected: zero type errors
- Protects: field accidentally made required; every existing check without `docsUrl`
  becomes a compile error

### `AGENTS.md` Verification (Manual)

- Run `cat ~/.clawperator/AGENTS.md` after `install.sh` completes; file must exist
- Version in the file must match `clawperator --version` output
- Log path in the file must match today's NDJSON log path format
- All URLs must be `https://` (no relative links)

### Docs Review (Manual)

- `docs/index.md`: agent section leads with `llms.txt` then `agent-quickstart.md`
- `agent-quickstart.md`, `openclaw-first-run.md`, `first-time-setup.md`: all describe
  APK absence as a blocking failure with the install command; none contradict each other
- Both `llms.txt` files: accurately describe `skills validate --dry-run`, persistent
  logs path, `enter_text clear: true` limitation

### `operator_event.sh` Verification

- `./scripts/operator_event.sh` (no args): exits 0; stderr contains "stub" or "not
  implemented"
- With arbitrary args: same behavior
- After placing the stub: trigger a gateway run; OpenClaw log shows no "no such file or
  directory" error for this script

### Manual Verification

- `clawperator doctor` with APK absent: `Docs:` line appears under the fix section for
  `OPERATOR_NOT_INSTALLED`; URL is a valid `https://` URL; other checks without
  `docsUrl` do not show a `Docs:` line

---

## Acceptance Criteria

- `install.sh` writes `~/.clawperator/AGENTS.md` with version, log path, docs URLs,
  and the four-step workflow. File is overwritten on re-install.
- A GitHub issue for `clawperator-skills` AGENTS.md is filed when this PR merges.
- `docs/index.md` agent section labels `llms.txt` as the machine-readable starting point.
- All first-run guides describe APK absence as a blocking failure with the install command.
- `contracts/doctor.ts`: `fix.docsUrl` is an optional field in the `DoctorCheckResult.fix` type.
- `cli/commands/doctor.ts`: `renderCheck` renders `Docs: <url>` in pretty output when `fix.docsUrl` is set.
- `clawperator doctor --json` for `OPERATOR_NOT_INSTALLED` includes `fix.docsUrl`.
- `clawperator doctor` (pretty mode) for `OPERATOR_NOT_INSTALLED` includes a `Docs:` line.
- Existing checks without `docsUrl` are unaffected (TypeScript `docsUrl?` optional).
- `./scripts/operator_event.sh` exists, exits 0, and emits a detectable stderr notice (stub) OR has confirmed behavior from OpenClaw review.
- OpenClaw review outcome is documented before merging the stub.
- Both `llms.txt` files accurately describe all shipped behavior including the
  new flat CLI command surface from the API refactor.
- No guide contradicts shipped `doctor` behavior.
- All command examples in docs use the new CLI surface (flat commands, short
  flag names).
