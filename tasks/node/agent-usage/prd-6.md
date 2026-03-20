# PRD-6: Docs, Entry Points, and Missing Integration Hooks

Workstream: WS-6
Priority: 6
Proposed PR: PR-6

Merged from both agents. Other agent's PRD-4 (docs consolidation) plus this analysis's
PRD-3 items (doctor failure links, operator_event.sh). The install.sh banner and the
doc contradiction fix ship in PR-1. This PR handles the remainder.

---

## Problem Statement

The docs already contain the right material. The first-run story is spread across multiple pages, one of which contradicts the shipped behavior that PR-1 fixes. The docs are not pointed to from install output, and doctor failure output links to nothing. A missing integration hook (`scripts/operator_event.sh`) causes repeated visible errors in the OpenClaw gateway log.

The install.sh banner and RECEIVER_NOT_INSTALLED contradiction are fixed in PR-1 because they accompany the readiness gate change. This PRD covers everything that must wait for all runtime changes to settle.

---

## Evidence

**From `tasks/node/agent-usage/issues.md`, Issue #10:**
> I don't know where the docs are, and I haven't looked. I've been operating off CLI --help output.
> After this session, I learned about https://docs.clawperator.com/llms.txt. These would have helped me understand the architecture, validation schema, error codes, and best practices. I didn't know they existed.

**From `~/src/clawperator/tasks/node/agent-usage/findings-analysis.md` (other agent):**
> `docs/index.md` already lists `llms.txt`, `Agent Quickstart`, `First-Time Setup`, and `OpenClaw First Run`, so the docs have the necessary entrypoints.
> The docs are useful once found, but the first-run path is not a single obvious sequence.
> `docs/agent-quickstart.md` and `docs/openclaw-first-run.md` exist, but they are separate starting points.

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
5. `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt` are accurate and comprehensive but not referenced from install output (that fix is in PR-1).

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

The recommended first-run sequence across all guides must be consistent with the shipped behavior after PR-1 lands. Specifically:

- `doctor` is the mandatory pre-step before any device command.
- `doctor` hard-fails on missing APK (after PR-1).
- `operator setup` is the install command when APK is absent.

Check `agent-quickstart.md`, `openclaw-first-run.md`, and `first-time-setup.md` for any remaining references to APK absence as advisory. Update all three to match the PR-1 behavior.

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

**c. `apps/node/src/domain/doctor/checks/readinessChecks.ts`**: Populate `docsUrl` in the `RECEIVER_NOT_INSTALLED` fix:

```typescript
fix: {
  title: "Install Operator APK",
  platform: "any",
  docsUrl: "https://docs.clawperator.com/getting-started/first-time-setup",
  steps: [...]
}
```

Only add `docsUrl` to checks where a specific, stable docs page exists. The initial set: `RECEIVER_NOT_INSTALLED`, `RECEIVER_VARIANT_MISMATCH`, and `DEVICE_DEV_OPTIONS_DISABLED`. Do not add it to all checks as a bulk change.

Required tests:
- Unit test: `renderCheck` output for a check with `fix.docsUrl` includes the `Docs:` line.
- Unit test: `renderCheck` output for a check without `fix.docsUrl` does not include a `Docs:` line.
- Unit test: `JSON.parse(cmdDoctor({ format: "json", ... }))` output for `RECEIVER_NOT_INSTALLED` includes `fix.docsUrl`.
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
- Emits one line to stderr: `operator_event.sh: stub - not yet implemented (see tasks/node/agent-usage/prd-6.md)`

**Do not merge a silent no-op stub.** A silent exit-0 with no output masks the failure and could suppress real events that OpenClaw expected to receive. The stderr note keeps the stub visible in log inspection.

**Do not merge this item without the OpenClaw review.** If the review cannot be completed in this PR, drop the item and create a follow-up issue. An uninvestigated stub is preferable to leaving the "no such file" error, but a confirmed implementation is required before this is done.

### 5. `llms.txt` alignment

After all PRs land, verify that both `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt` accurately describe the final shipped behavior. Specifically:
- APK absence is a hard failure (not advisory)
- `skills validate --dry-run` exists
- Persistent logs are at `~/.clawperator/logs/`
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
- `agent-quickstart.md`, `openclaw-first-run.md`, `first-time-setup.md` alignment with PR-1 behavior
- Doctor failure output: `docsUrl` in `fix` object
- `scripts/operator_event.sh` stub (after OpenClaw review)
- `llms.txt` final alignment after all PRs land

Out of scope:
- Adding new documentation content (the content already exists)
- Changing the docs site navigation structure beyond the index
- `AGENTS.md` in the skills repo (separate repo, separate PR)
- Shell profile or env var machinery beyond what setup already does

---

## Dependencies

- PR-1: the APK absence behavior change that the docs must describe
- PR-2: the error format that `node-api-for-agents.md` must document
- PR-3: `--dry-run` behavior for `skill-development-workflow.md`
- PR-4: log path for `troubleshooting.md` and `agent-quickstart.md`

This is the last PR in the sequence.

---

## Risks and Tradeoffs

**Risk: docs stability**
If this PR lands before the runtime changes are stable, the docs will describe behavior that does not yet exist. The sequencing dependency is critical. Do not write PR-6 docs content until all runtime PRs have merged.

**Risk: `docsUrl` field in `fix` object**
Hardcoded docs URLs in doctor output will become stale if the docs site is restructured. Use path-stable URLs. Document them as canonical in the docs site config so they are treated as stable references.

**Risk: `operator_event.sh` stub masking intent**
A silent no-op is worse than the current visible error. The stub must emit a stderr notice. This makes the stub detectable by anyone reviewing the logs.

**Tradeoff: llms.txt update timing**
`llms.txt` should describe current shipped behavior, not aspirational behavior. Only update it in this PR (after all others have merged), not speculatively during earlier PRs.

---

## Testing Plan

### Fixtures

**`renderCheck` test doubles:** The function takes a `DoctorCheckResult`. Construct
minimal objects inline — no file needed.

```typescript
const checkWithDocsUrl: DoctorCheckResult = {
  id: "readiness.apk.presence", status: "fail",
  code: "RECEIVER_NOT_INSTALLED", message: "APK not installed",
  fix: {
    title: "Install Operator APK", platform: "any",
    steps: [{ kind: "shell", value: "clawperator operator setup ..." }],
    docsUrl: "https://docs.clawperator.com/getting-started/first-time-setup"
  }
};

const checkWithoutDocsUrl: DoctorCheckResult = {
  id: "readiness.apk.presence", status: "fail",
  code: "RECEIVER_NOT_INSTALLED", message: "APK not installed",
  fix: {
    title: "Install Operator APK", platform: "any",
    steps: [{ kind: "shell", value: "clawperator operator setup ..." }]
    // no docsUrl field
  }
};
```

### TDD Sequence

The TypeScript type change drives everything. Do the type change first; the compiler
will flag any call site that uses `fix` without `docsUrl` as a required field — confirming
it's optional.

**Step 1 — type change in `contracts/doctor.ts`:**
Add `docsUrl?: string`. Run `npm run build`. Compilation must succeed without touching
any other file (confirms the field is optional, not required).

**Step 2 — before modifying `renderCheck`:**
Write T1 (no `Docs:` line when absent). It passes against the unchanged `renderCheck`.
This is the regression pin.

**Step 3 — modify `renderCheck`:**
Write T2 (includes `Docs:` line when present). It fails. Add the conditional. Both T1
and T2 must pass.

**Step 4 — populate `docsUrl` in `readinessChecks.ts`:**
Write T3 (JSON output includes `fix.docsUrl`). It fails. Add the field. T3 must pass.

### Unit Tests

**T1 — `renderCheck` without `docsUrl` emits no `Docs:` line (regression anchor)**
- Input: `checkWithoutDocsUrl` (no `docsUrl` field)
- Expected: output string does not contain the substring `"Docs:"`
- Failure mode protected: `docsUrl` field added as a phantom line to every check output;
  all existing check output gets a `"Docs: undefined"` line
- When: write before modifying `renderCheck`; must pass before and after the change

**T2 — `renderCheck` with `docsUrl` includes the `Docs:` line**
- Input: `checkWithDocsUrl`
- Expected: output string contains `"Docs: https://docs.clawperator.com/getting-started/first-time-setup"`
- Failure mode protected: the field exists in the type and the check data but never
  reaches the rendered output; doctor failure output silently omits the link

**T3 — doctor JSON output for `RECEIVER_NOT_INSTALLED` includes `fix.docsUrl`**
- Method: call the doctor check function that produces the `RECEIVER_NOT_INSTALLED`
  result and inspect the returned object, or parse the CLI JSON output
- Expected: `check.fix.docsUrl` is a non-empty string beginning with `"https://"`
- Failure mode protected: `docsUrl` in the type and in `renderCheck` but never populated
  in the check definition; JSON output correctly reflects what's in the data, so the
  data itself must be populated

### CLI / Contract Regression

**T4 — doctor JSON output remains parseable after adding `docsUrl`**
- Command: `clawperator doctor --output json` (device in any state)
- Expected: `JSON.parse(stdout)` succeeds; `report.checks` is an array
- Failure mode protected: serialization broken by a new field (e.g., a circular
  reference or an object where a string was expected)

**T5 — TypeScript compilation passes without `docsUrl` in `fix`**
- Build step: `npm run build` on a codebase that has checks without `docsUrl`
- Expected: zero type errors
- Failure mode protected: field accidentally made required; every existing check that
  does not set `docsUrl` becomes a compile error

### Docs Verification

PRD-6 is primarily docs work. The tests above cover the one runtime code change
(`renderCheck` + type). The rest is manual review.

**D1 — docs consistency check (manual)**
- Open `docs/index.md`, `docs/agent-quickstart.md`, `docs/openclaw-first-run.md`,
  `docs/first-time-setup.md` side by side
- Verify: none describe APK absence as advisory after PR-1 lands; all name the install
  command; no guide contradicts another on the doctor behavior
- Verify: `docs/index.md` agent section leads with `llms.txt` and `agent-quickstart.md`

**D2 — `llms.txt` alignment check (manual)**
- Open both `sites/landing/public/llms.txt` and `sites/docs/static/llms.txt`
- Verify each of the following shipped behaviors is described accurately:
  - APK absence is a hard failure (not advisory)
  - `skills validate --dry-run` exists and what it does
  - Logs at `~/.clawperator/logs/`
  - `enter_text clear: true` is a no-op

### `operator_event.sh` Verification

**T6 — stub exits 0 and emits stderr notice**
- Command: `./scripts/operator_event.sh` (with no arguments)
- Expected: exit code 0; stderr contains the word "stub" or "not implemented"
- Command: `./scripts/operator_event.sh foo bar baz` (with arbitrary arguments)
- Expected: same — accepts any arguments, still exits 0
- Failure mode protected: silent exit-0 stub with no stderr; OpenClaw log shows no
  error but the intent is lost

**T7 — OpenClaw gateway log clean**
- After `operator_event.sh` is in place, trigger a gateway run
- Expected: no `"no such file or directory: ./scripts/operator_event.sh"` in the gateway
  error log
- Failure mode protected: script file not executable, wrong path, or placed in wrong
  directory

### What to Skip

- Do not write automated URL reachability tests in CI (curl to `docsUrl` in a test).
  Network-dependent tests are flaky in offline or rate-limited CI environments. Manually
  verify the URL returns HTTP 200 once before shipping; rely on the docs site's own
  link-checker CI for ongoing reachability.
- Do not test the docs site build output (`sites/docs/docs/`) directly — it is generated
  output. Test the source files only.
- Skip testing every check that does NOT have `docsUrl` — T1 covers the regression
  anchor for the "absent field" case; additional cases add no information.

### Manual Verification

**M1 — doctor failure output looks right in a terminal**
- Run `clawperator doctor` with APK absent
- Confirm: pretty output shows a `Docs:` line under the fix section for `RECEIVER_NOT_INSTALLED`
- Confirm: the URL is the correct full URL (not relative, not `undefined`)
- Confirm: other doctor checks that do NOT have `docsUrl` do not show a `Docs:` line

---

## Acceptance Criteria

- `docs/index.md` agent section labels `llms.txt` as the machine-readable starting point.
- All first-run guides describe APK absence as a blocking failure with the install command.
- `contracts/doctor.ts`: `fix.docsUrl` is an optional field in the `DoctorCheckResult.fix` type.
- `cli/commands/doctor.ts`: `renderCheck` renders `Docs: <url>` in pretty output when `fix.docsUrl` is set.
- `clawperator doctor --output json` for `RECEIVER_NOT_INSTALLED` includes `fix.docsUrl`.
- `clawperator doctor --output pretty` for `RECEIVER_NOT_INSTALLED` includes a `Docs:` line.
- Existing checks without `docsUrl` are unaffected (TypeScript `docsUrl?` optional).
- `./scripts/operator_event.sh` exists, exits 0, and emits a detectable stderr notice (stub) OR has confirmed behavior from OpenClaw review.
- OpenClaw review outcome is documented before merging the stub.
- Both `llms.txt` files accurately describe all behavior shipped in PRs 1-4.
- No guide contradicts shipped `doctor` behavior.
