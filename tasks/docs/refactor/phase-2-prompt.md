## Prompt for PR-2: Core Content + Code Changes

```
You are implementing PR-2 of the Clawperator docs refactor. This is the highest-stakes PR: 9 critical documentation pages that agents hit first and most often, plus code changes for doctor docsUrl and AGENTS.md generation.

## CRITICAL: Read These First

Before writing a single line, read these files in order:

1. `tasks/docs/refactor/documentation-drafting-north-star.md` - the governing philosophy for all documentation work
2. `tasks/docs/refactor/plan.md` - full plan (Sections 1a, 2, 3 are most relevant)
3. `tasks/docs/refactor/work-breakdown.md` - task-level breakdown (PR-2 section)

The north star document is your primary guide. Reread it before starting each page.

## Branch

Work on the `docs-refactor/phase-2` branch, created from `main`.

## The One Rule That Matters Most

CODE IS THE SOURCE OF TRUTH.

Existing documentation - including the reference snapshot in `tasks/docs/refactor/reference/` - is advisory only. It may be stale, inaccurate, or misleading. For every fact you write in a doc page:

1. Open the relevant source file in `apps/node/src/`
2. Read the actual code
3. Write the doc based on what the code does, not what old docs say it does

If old docs and code disagree, the code is correct. Period.

Here is the verification reference table. Use it for EVERY page:

| Topic | Verify against |
|-------|---------------|
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Selector flags | `apps/node/src/cli/selectorFlags.ts` |
| Selector types (NodeMatcher) | `apps/node/src/contracts/selectors.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Error codes | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Doctor checks and fix types | `apps/node/src/domain/doctor/checks/`, `apps/node/src/contracts/doctor.ts` |
| Doctor CLI rendering | `apps/node/src/cli/commands/doctor.ts` |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` |
| Device resolution logic | `apps/node/src/cli/commands/devices.ts` |
| Install script | `sites/landing/public/install.sh` |

## Commit Discipline

This project uses Conventional Commits (`docs:`, `feat:`, `fix:`, `test:`).

### Commit often. Very often.

The workflow for EACH page is:

1. Read the relevant code files (see verification table above)
2. Read the reference snapshot for context (NOT as source of truth): `tasks/docs/refactor/reference/`
3. Draft the page in `docs/`
4. Run `./scripts/docs_build.sh` to verify the build passes
5. Commit: `docs: draft <page-name> - verified against <source-files>`
6. Reread what you just wrote. Compare it against the code again. Ask yourself:
   - Did I miss any flags, parameters, or action types?
   - Did I copy wording from old docs without verifying it?
   - Is there any claim here that I cannot point to a specific line of code for?
   - Would an agent be able to construct a valid command from this page alone?
7. Fix issues found in the reread
8. Commit: `docs: refine <page-name> - <what you fixed>`
9. Move to the next page

Do NOT batch multiple pages into one commit. Each page gets at least one commit (draft), ideally two (draft + refinement). For complex pages (setup.md, actions, selectors, errors), expect 2-3 commits.

Natural commit boundaries for PR-2:

1. `docs/setup.md` - 2 commits (draft + refine)
2. `docs/api/overview.md` - 1-2 commits
3. `docs/api/actions.md` - 2-3 commits (many action types to verify)
4. `docs/api/selectors.md` - 2 commits (mutual exclusion rules are tricky)
5. `docs/api/errors.md` - 2 commits (many error codes)
6. `docs/api/devices.md` - 1-2 commits
7. `docs/api/doctor.md` - 1-2 commits
8. `docs/api/serve.md` - 1-2 commits
9. Doctor docsUrl code changes - 2-3 commits (contract + implementation + tests)
10. AGENTS.md from install.sh - 1 commit

## What You Are Writing

You are replacing placeholder pages with real, agent-first documentation. The pages you produce are the primary interface between Clawperator and the AI agents that use it.

The primary consumer of these docs is an LLM agent - not a human. The primary artifact is `llms-full.txt`, a concatenation of all pages. The MkDocs HTML site is a secondary projection.

### Page Schema

Every page follows this structure where applicable:

```
# <Topic>
## Purpose          (1-2 lines: what this enables)
## When to use      (concrete triggers)
## Inputs           (exact parameters / state)
## Behavior         (deterministic description)
## Output           (exact shape)
## Failure modes    (enumerated with recovery)
## Example          (minimal, runnable)
```

Reference pages (actions, errors, selectors) use tabular format instead. The schema is a default, not a straitjacket - adapt it to the page's needs.

### Terminology Rules (enforced)

- "operator" not "receiver"
- "action" not "command" when referring to execution payload actions
- "selector" not "matcher" (except when referencing the `NodeMatcher` type specifically)
- Primary flag name `--device` (not `--device-id`)
- Primary flag name `--timeout` (not `--timeout-ms`)
- Flat CLI surface: `snapshot` not `observe snapshot`, `click --text` not `action click --selector`
- Never shorten "Clawperator" to "Claw"
- Use regular dashes/hyphens, never em dashes

### Cross-referencing Rules

- Each concept is defined on exactly one page
- Other pages cross-reference using relative markdown links: `[Selectors](selectors.md)`
- Do NOT duplicate content across pages
- Actions page says "see [Selectors](selectors.md) for selector parameters"
- Errors page says "see [API Overview](overview.md) for result envelope structure"

## Page-by-Page Instructions

Work these in order. Each task below tells you exactly what to write and what code to verify against.

---

### Page 1: `docs/setup.md`

**Replaces:** placeholder

**What to write:** Single linear path from zero to first successful command. One path, no branching. Every step must have a machine-verifiable success condition (exit code, JSON field, or validation command).

**Sections:**
1. Prerequisites (Node.js, ADB, Android device or emulator)
2. Install CLI (`curl -fsSL https://clawperator.com/install.sh | sh` or `npm install -g clawperator`)
3. Prepare device (enable USB debugging, connect via ADB)
4. Install Operator APK (`clawperator operator setup`)
   - Release: `com.clawperator.operator`
   - Debug/dev: `com.clawperator.operator.dev`
   - When to use `--operator-package`
5. Grant permissions (`clawperator grant-permissions` or the grant script)
6. Verify with doctor (`clawperator doctor --json` - explain what exit code 0 means, what to check in JSON output)
7. First command (`clawperator snapshot --json`)
8. Agent / OpenClaw section:
   - How OpenClaw invokes Clawperator (brain/hand model)
   - Exact programmatic sequence an agent executes
   - How to confirm success without human intervention
   - Common first-run failures and automated recovery
   - When `--device` and `--operator-package` are needed

**Verify against:**
- `sites/landing/public/install.sh` - actual install steps
- `apps/node/src/cli/registry.ts` - commands: `doctor`, `snapshot`, `operator`, `grant-permissions`
- `apps/node/src/domain/doctor/checks/` - what doctor actually checks
- `scripts/clawperator_grant_android_permissions.sh` - what permissions are granted

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/first-time-setup.md`
- `tasks/docs/refactor/reference/docs/agent-quickstart.md`
- `tasks/docs/refactor/reference/docs/openclaw-first-run.md`
- `tasks/docs/refactor/reference/docs/running-clawperator-on-android.md`
- `tasks/docs/refactor/reference/docs/android-operator-apk.md`

---

### Page 2: `docs/api/overview.md`

**Replaces:** placeholder

**What to write:** Execution model, result envelope, core concepts. This is the conceptual foundation - keep it concise. All detailed mechanics go to dedicated pages.

**Sections:**
1. What Clawperator is (2-3 lines: deterministic actuator, brain/hand model)
2. Execution payload shape (commandId, taskId, source, steps[])
3. Result envelope shape (envelope.status, stepResults[].success, error codes)
4. How status and stepResults relate
5. Pointers to dedicated pages (actions, selectors, errors, devices, etc.)

**Key constraint:** Must not exceed one screen of concepts + one envelope definition + one execution flow. If you find yourself writing more, you are putting content on the wrong page.

**Verify against:**
- `apps/node/src/contracts/execution.ts` - ExecutionPayload, ExecutionStep types
- `apps/node/src/contracts/result.ts` - TerminalResult, StepResult types

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/execution-model.md`
- `tasks/docs/refactor/reference/docs/architecture.md`
- `tasks/docs/refactor/reference/docs/node-api-for-agents.md`

---

### Page 3: `docs/api/actions.md`

**Replaces:** placeholder

**What to write:** Every action type with parameters, outputs, and failure modes. This is a reference table, not a narrative.

**For each action type, document:**
- Action name (as used in `step.action`)
- Required parameters
- Optional parameters
- Output shape (what appears in stepResult)
- Common failure modes

**Action types to cover (verify this list against the code - do NOT trust this list blindly):**
`click`, `scroll`, `scroll_until`, `scroll_and_click`, `read_text`, `read_value`, `enter_text`, `press_key`, `wait_for_node`, `wait_for_nav`, `snapshot_ui`, `screenshot`, `close`, `sleep`, `open_app`, `open_uri`

**Important:** Selector parameters are documented on the Selectors page. Do not duplicate selector documentation here. Say "see [Selectors](selectors.md)" and move on.

**Verify against:**
- `apps/node/src/contracts/execution.ts` - this is the canonical source for all action types and their parameters. Read the entire file. Every action type, every parameter, every optional field.

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/action-types.md`

---

### Page 4: `docs/api/selectors.md`

**Replaces:** placeholder

**IMPORTANT:** This page MUST contain the marker `<!-- CODE-DERIVED: selector-flags -->` at the appropriate location. The build will inject the generated selector flag table at this marker. Your authored content goes around the marker.

**What to write:**
1. What selectors are (NodeMatcher contract)
2. Shorthand CLI flags vs JSON `--selector` flag
3. The generated flag table (marker location)
4. Mutual exclusion rules:
   - `--selector` is mutually exclusive with all shorthand flags
   - `--coordinate` is mutually exclusive with other selector flags
   - Element flags vs container flags
5. Container matching semantics
6. NodeMatcher type definition (from code)

**Verify against:**
- `apps/node/src/cli/selectorFlags.ts` - ELEMENT_SELECTOR_VALUE_FLAGS, CONTAINER_SELECTOR_VALUE_FLAGS arrays
- `apps/node/src/contracts/selectors.ts` - NodeMatcher interface, ContainerMatcher
- `apps/node/src/cli/registry.ts` - how --selector flag is handled

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/node-api-for-agents.md` (selector sections)

---

### Page 5: `docs/api/errors.md`

**Replaces:** placeholder

**IMPORTANT:** This page MUST contain the marker `<!-- CODE-DERIVED: error-codes -->` at the appropriate location. The build will inject the generated error code table at this marker.

**What to write:**
1. Error classification (Node CLI errors vs Android-side errors vs per-step errors)
2. Fast triage: how to read envelope.status + stepResults to classify failures
3. The generated error code table (marker location)
4. Recovery patterns keyed to error classes
5. Specific guidance for key error codes: `MISSING_SELECTOR`, `MISSING_ARGUMENT`, `UNKNOWN_COMMAND` (note: has `suggestion` field), `OPERATOR_NOT_INSTALLED`, `OPERATOR_VARIANT_MISMATCH`

**Verify against:**
- `apps/node/src/contracts/errors.ts` - every error code, the ErrorCode type, the StructuredError interface
- `apps/node/src/contracts/result.ts` - how errors appear in the result envelope

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/error-handling.md`

---

### Page 6: `docs/api/devices.md`

**Replaces:** placeholder

**What to write:** Device targeting, package model, multi-device determinism.

**Sections:**
1. Device identification (ADB serial as deviceId)
2. `--device` flag (alias: `--device-id`) - when required, when optional
3. Device resolution rules: single device = auto, multiple = must specify, zero = error
4. `--operator-package` flag: release (`com.clawperator.operator`) vs debug (`com.clawperator.operator.dev`)
5. Multi-device patterns: always pass `--device` when multiple connected
6. `clawperator devices` command output

**Verify against:**
- `apps/node/src/cli/registry.ts` - devices command, --device flag across commands
- `apps/node/src/cli/commands/devices.ts` - device resolution logic

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/device-and-package-model.md`
- `tasks/docs/refactor/reference/docs/multi-device-workflows.md`

---

### Page 7: `docs/api/doctor.md`

**Replaces:** placeholder

**What to write:** Every readiness check, what it validates, fix behavior, remediation.

**Sections:**
1. Purpose: verify device + host readiness before automation
2. Usage: `clawperator doctor [--json] [--device <serial>] [--operator-package <pkg>]`
3. Check categories and what they validate
4. Output format (DoctorReport shape)
5. Fix structure (DoctorCheckResult.fix)
6. Common failures and remediation

**Verify against:**
- `apps/node/src/contracts/doctor.ts` - DoctorCheckResult, DoctorReport interfaces
- `apps/node/src/domain/doctor/checks/buildChecks.ts` - build/version checks
- `apps/node/src/domain/doctor/checks/deviceChecks.ts` - device connectivity checks
- `apps/node/src/domain/doctor/checks/hostChecks.ts` - host environment checks
- `apps/node/src/domain/doctor/checks/readinessChecks.ts` - operator readiness checks
- `apps/node/src/cli/commands/doctor.ts` - how doctor renders output

Read every check file. Each check has an id, conditions, and fix steps. Document all of them.

**Reference material (advisory only):**
- `tasks/docs/refactor/reference/docs/reference/node-api-doctor.md`

---

### Page 8: `docs/api/serve.md`

**Replaces:** placeholder

**What to write:** HTTP/SSE server contract, every endpoint, request/response shapes.

**Sections:**
1. Purpose: local HTTP server for remote agent control
2. Starting: `clawperator serve [--port <number>] [--host <string>]`
3. Every endpoint with method, path, request body, response shape
4. SSE event stream (if applicable)
5. Error responses

**Verify against:**
- `apps/node/src/cli/commands/serve.ts` - this is a 612-line file. Read it thoroughly. Every `app.get()`, `app.post()`, `app.use()` call defines an endpoint. Document them all.
- `apps/node/src/cli/registry.ts` - serve command flags

This page has no good reference material in the old docs. You are writing it primarily from the serve.ts source code. That is correct and expected.

---

### Task 9: Doctor docsUrl Code Changes

**This is code work, not documentation.**

**Goal:** Add `docsUrl` field to doctor check results so agents can find relevant docs for each check.

**Changes:**

1. Add `docsUrl?: string` to the fix type in `apps/node/src/contracts/doctor.ts`:
   ```typescript
   fix?: {
     title: string;
     platform: "mac" | "linux" | "win" | "any";
     steps: Array<{ kind: "shell" | "manual"; value: string }>;
     docsUrl?: string;  // <-- add this
   };
   ```

2. Update `apps/node/src/cli/commands/doctor.ts` to render docsUrl in pretty mode output (e.g., "Docs: <url>" line when present).

3. Populate docsUrl in readiness checks in `apps/node/src/domain/doctor/checks/`:
   - Install/setup checks -> `https://docs.clawperator.com/setup/`
   - Device checks -> `https://docs.clawperator.com/api/devices/`
   - Operator checks -> `https://docs.clawperator.com/troubleshooting/operator/`
   - Only add docsUrl where a relevant page exists

4. Add unit tests:
   - T1: docsUrl present in JSON output when fix has one
   - T2: docsUrl absent when fix has none
   - T3: docsUrl rendered in pretty mode
   - T4: docsUrl URLs point to real pages (validate against mkdocs.yml nav)

**Validation:**
- `npm --prefix apps/node run build` succeeds
- `npm --prefix apps/node run test` passes

**Commits:** Contract change first, then implementation, then tests.

---

### Task 10: AGENTS.md from install.sh

**Goal:** Generate `~/.clawperator/AGENTS.md` during CLI installation.

**Changes:** Update `sites/landing/public/install.sh` to write `~/.clawperator/AGENTS.md` after successful installation.

**Content of generated file:**
```markdown
# Clawperator

Deterministic Android automation runtime for AI agents.

## Quick start

clawperator doctor --json    # verify readiness
clawperator snapshot --json  # capture device state
clawperator click --text "Settings" --json  # tap an element

## Documentation

- Docs index: https://docs.clawperator.com/llms.txt
- Full docs: https://docs.clawperator.com/llms-full.txt
- Setup guide: https://docs.clawperator.com/setup/
```

Adapt the content as needed, but it must:
- Use flat CLI commands (not old nested forms)
- Include llms.txt and llms-full.txt URLs
- Include setup page URL
- Be brief (agents will fetch llms-full.txt for details)

**Verify:** Read the current install.sh to understand the install flow and find the right place to add the file write.

---

## Build and Validation

After EACH page, run:
```bash
./scripts/docs_build.sh
```
This runs the full pipeline: assembly -> MkDocs build -> llms-full generation -> route validation. It must pass before you commit.

After ALL pages are done, also run:
```bash
npm --prefix apps/node run build && npm --prefix apps/node run test
```
This validates the doctor docsUrl code changes.

## Important Constraints

- Never shorten "Clawperator" to "Claw" in code, docs, comments, or commits.
- Use regular dashes/hyphens, never em dashes.
- `docs/api/cli.md` is code-derived and gitignored - do NOT edit it.
- Pages with `<!-- CODE-DERIVED: -->` markers: the marker must remain in your authored file in `docs/`. The build expands it in `.build/`. Do not manually write the generated table content.
- Cross-reference other pages using relative markdown links: `[Actions](actions.md)`, `[Setup](../setup.md)`
- All pages live in `docs/` (the authored source). The build copies them to `sites/docs/.build/`.
- Do not edit anything in `sites/docs/.build/` or `sites/docs/site/` - these are generated.

## Common Mistakes to Avoid

1. **Copying old docs verbatim.** Old docs are stale. Read code first, write from code.
2. **Trusting action type lists from old docs.** The canonical list is in `contracts/execution.ts`. Read it.
3. **Using old CLI syntax.** It is `snapshot`, not `observe snapshot`. It is `click --text`, not `action click --selector`.
4. **Using "receiver" anywhere.** The correct term is "operator".
5. **Forgetting CODE-DERIVED markers.** `api/errors.md` and `api/selectors.md` MUST have their markers.
6. **Writing prose where a table suffices.** Agents parse tables better than paragraphs.
7. **Duplicating content across pages.** Cross-reference instead.
8. **Batching multiple pages into one commit.** One page per commit minimum.
9. **Not rereading your draft.** Your first pass will have errors. Reread it, compare to code, fix, commit again.

## Final PR-2 Validation Checklist

Before declaring PR-2 done:

- [ ] `./scripts/docs_build.sh` succeeds
- [ ] `npm --prefix apps/node run build && npm --prefix apps/node run test` passes
- [ ] All 9 content pages are non-placeholder and verified against code
- [ ] Each commit message cites what code was verified against
- [ ] `api/errors.md` contains `<!-- CODE-DERIVED: error-codes -->` marker
- [ ] `api/selectors.md` contains `<!-- CODE-DERIVED: selector-flags -->` marker
- [ ] Zero occurrences of "receiver" in new pages: `grep -ri "receiver" docs/setup.md docs/api/`
- [ ] Zero occurrences of old CLI syntax: `grep -r "observe snapshot\|action click\|action press" docs/`
- [ ] Zero occurrences of deprecated flags: `grep -r "\-\-timeout-ms\|--device-id" docs/` (--device-id may appear as alias mention, but must not be the primary form)
- [ ] Doctor docsUrl unit tests pass
- [ ] `~/.clawperator/AGENTS.md` generation added to install.sh
- [ ] Remaining 11 pages are still placeholders (expected - they ship in PR-3)
- [ ] `llms-full.txt` contains all 22 pages with 9 having real content
```
