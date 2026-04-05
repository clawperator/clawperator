# Star Hint Work Breakdown

Parent plan: `tasks/star-hint/plan.md`

## Executive Summary

1 PR, 4 phases, all in one branch. No merge gates. Phase 1 creates the hint module
and tests it. Phase 2 wires it into the CLI (flag registration, 5 call sites). Phase 3
adds the bash hint to the install script. Phase 4 appends support notes to 3 docs
surfaces. Total work is bounded - no discovery or classification steps.

| PR | Phases | Agent tier |
| --- | --- | --- |
| PR-1 | 1, 2, 3, 4 | default, default, fast, fast |

Current state: planning.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Do NOT call `gh`, `gh --version`, any GitHub API, or any network endpoint from
  within any Node or shell code added in this task. This is an absolute prohibition.
- All hint output must go to `process.stderr` in Node code and `>&2` in shell code.
  Never write hint text to stdout.
- Never show the hint when `process.stderr.isTTY !== true`. The check must happen
  inside `maybeShowStarHint` itself.
- Never show the hint in the JSON output path, HTTP API responses, or SSE streams.
- All state I/O in `starHint.ts` must be wrapped in try/catch. Errors are silently
  swallowed. The hint module must never throw.
- `--disable-star-suggestions` must be added to `FLAG_VALUE_ARITY` in `cli/index.ts`
  (arity 0) and to the `globalFlags` list at ~line 242-246 in `cli/index.ts`, or it
  will cause "unrecognized flag" errors for callers who pass it.
- `maybeShowStarHint` must be awaited before `process.exit(0)` in the `--version` and
  `--help` early-exit paths. A `.then()` or unawaited call will be cut off by exit.
- Only add the 4 trigger points specified in the plan. Do not add any additional calls.
- One logical commit per phase. Do not batch all phases into one commit.
- Do not edit generated docs (`sites/docs/.build/`, `sites/docs/site/`).
- Do not run `./scripts/docs_build.sh` for this task - the docs changes are in authored
  source files (`docs/`, `README.md`, `sites/landing/public/index.md`) and do not
  require docs-site regeneration.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/star-hint/plan.md` | Stable contract, exact hint text, decision tables - do not re-derive |
| `apps/node/src/cli/index.ts` lines 44-340 | FLAG_VALUE_ARITY, getGlobalOpts, main() flow, existing --version and --help paths, HandlerContext construction |
| `apps/node/src/cli/registry.ts` | HandlerContext type definition - find and add disableStar field |
| `apps/node/src/cli/commands/doctor.ts` | Doctor success path - understand getDoctorExitCode and where to insert hint call |
| `apps/node/src/cli/commands/skills.ts` lines 141-290 | cmdSkillsRun result.ok branch - find exact insertion point |
| `apps/node/src/adapters/logger.ts` | expandHomePath() and homedir() usage - reuse the same pattern for state file path |
| `apps/node/package.json` | Verify the version field exists and its key name |
| `sites/landing/public/install.sh` lines 696-783 | main() structure - find where to append hint block |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Add star hint system end-to-end | 1, 2, 3, 4 | default, default, fast, fast | none |

---

## Phase 1: Hint module

### Agent Tier
default

### Goal
Create `apps/node/src/cli/starHint.ts` with the `maybeShowStarHint` function, state
I/O, TTY check, suppression logic, and unit tests.

### Files or Surfaces To Change

- `apps/node/src/cli/starHint.ts` (new)
- `apps/node/src/cli/starHint.test.ts` (new)

### Steps

1. Read `apps/node/src/adapters/logger.ts` to find `expandHomePath()` or the homedir
   import pattern. Use `homedir()` from `node:os` (same as the existing code) to
   construct the state file path: `join(homedir(), '.clawperator', 'star-hint-state.json')`.

2. Read `apps/node/package.json` to confirm the `version` field key name.

3. Create `apps/node/src/cli/starHint.ts` with this exact structure:

   a. **Module-level guard:**
      ```typescript
      let shown = false;
      ```

   b. **State type:**
      ```typescript
      interface StarHintState {
        doctorHintShown?: boolean;
        skillHintShown?: boolean;
        lastUpgradeHintVersion?: string;
      }
      ```

   c. **readState(): StarHintState** - reads and parses `~/.clawperator/star-hint-state.json`.
      Returns `{}` if file missing, unreadable, or parse fails. Never throws.

   d. **writeState(state: StarHintState): void** - writes state as JSON. Never throws.
      Do not create the `~/.clawperator/` directory if it does not exist - wrap the write
      in try/catch and swallow any error. (The directory will already exist on any machine
      that has run Clawperator.)

   e. **getCliVersion(): string** - reads version from `../../package.json` using
      `createRequire(import.meta.url)` (same pattern as `cli/index.ts` line 3-4).
      Returns `"0.0.0"` on any error. Never throws.

   f. **isSuppressed(): boolean** - returns true if any of:
      - `process.stderr.isTTY !== true`
      - `process.env.CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` is a non-empty string
      - `process.argv.slice(2).includes('--disable-star-suggestions')`

   g. **HINT_TEXT constant** - exact multi-line string:
      ```typescript
      const HINT_TEXT = `
Clawperator is open source. If it helped, consider starring the repo:
https://github.com/clawpilled/clawperator

GitHub CLI:
gh api -X PUT /user/starred/clawperator/clawperator -H "X-GitHub-Api-Version: 2026-03-10"

Disable this hint with: --disable-star-suggestions
`;
      ```
      (One blank line before the first line of content, one blank line after the last
      line of content - the template literal newline at the start and end provides these.)

   h. **maybeShowStarHint(trigger: 'doctor' | 'skill' | 'upgrade'): Promise\<void\>** -
      exported. Apply the first-match-wins decision table from `plan.md`:

      ```
      if (shown) return
      if (isSuppressed()) return
      const state = readState()
      if (trigger === 'doctor' && state.doctorHintShown) return
      if (trigger === 'skill' && state.skillHintShown) return
      if (trigger === 'upgrade') {
        const version = getCliVersion()
        if (state.lastUpgradeHintVersion === version) return
        process.stderr.write(HINT_TEXT)
        shown = true
        writeState({ ...state, lastUpgradeHintVersion: version })
        return
      }
      process.stderr.write(HINT_TEXT)
      shown = true
      if (trigger === 'doctor') writeState({ ...state, doctorHintShown: true })
      if (trigger === 'skill') writeState({ ...state, skillHintShown: true })
      ```

4. Create `apps/node/src/cli/starHint.test.ts`. Tests must cover:
   - TTY suppression: when `process.stderr.isTTY` is falsy, nothing is written to stderr
   - Env suppression: when `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` is set, nothing written
   - State suppression: when `doctorHintShown` is already true, doctor trigger does not write
   - State suppression: when `skillHintShown` is already true, skill trigger does not write
   - Version suppression: upgrade trigger suppressed when stored version matches current
   - Show path: trigger fires, writes HINT_TEXT to stderr, updates state correctly
   - Module-level shown guard: second call in same process is suppressed
   - Error swallowing: state write failure does not throw

   Use the existing test setup patterns in the repo (look at another `.test.ts` file
   near `apps/node/src/cli/` for the test framework import style).

### Acceptance Criteria

- `apps/node/src/cli/starHint.ts` exists and exports `maybeShowStarHint`
- `apps/node/src/cli/starHint.test.ts` exists with all 8 test cases above
- `npm --prefix apps/node run build` succeeds with no TypeScript errors
- `npm --prefix apps/node run test` passes (all new tests green)
- Grep confirms no `gh` invocations and no `fetch`/`http`/`axios` calls in starHint.ts:
  ```bash
  grep -n "gh\b\|fetch\|https\|http\b\|axios" apps/node/src/cli/starHint.ts
  # expected: zero matches (the hint text string contains the URL but that is static)
  ```
- Grep confirms no stdout writes in starHint.ts:
  ```bash
  grep -n "stdout" apps/node/src/cli/starHint.ts
  # expected: zero matches
  ```

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test -- --testPathPattern starHint
```

### Expected Commit

```text
feat(star-hint): add maybeShowStarHint module with state and suppression logic
```

---

## Phase 2: Wire hook points

### Agent Tier
default

### Goal

Register `--disable-star-suggestions` as a global flag and insert `maybeShowStarHint`
calls at the 5 hook points in `cli/index.ts`, `doctor.ts`, and `skills.ts`.

### Files or Surfaces To Change

- `apps/node/src/cli/index.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/cli/commands/doctor.ts`
- `apps/node/src/cli/commands/skills.ts`

### Steps

1. **`apps/node/src/cli/index.ts` - register the flag:**

   a. In `FLAG_VALUE_ARITY` (lines 44-94), add:
      ```typescript
      ["--disable-star-suggestions", 0],
      ```
      Arity 0 means the flag takes no value argument.

   b. In `getGlobalOpts()` (lines 100-181), add a branch in the argv loop for the
      new flag. Pattern: match `argv[i] === "--disable-star-suggestions"` and consume
      it (no value to increment). The flag value is not needed in the returned object -
      the hint module reads argv directly. This branch just needs to consume the token
      so it does not fall through to `rest`.

      Add before the `else { rest.push(argv[i]) }` at line ~177:
      ```typescript
      } else if (argv[i] === "--disable-star-suggestions") {
        // consumed; hint module reads process.argv directly
      } else {
      ```

   c. In `main()`, find the `globalFlags` array at ~lines 242-246:
      ```typescript
      const globalFlags = [
        "--device", "--device-id", "--operator-package", "--receiver-package",
        "--json", "--output", "--format", "--log-level", "--timeout", "--timeout-ms",
        "--verbose", "--help", "--version"
      ];
      ```
      Add `"--disable-star-suggestions"` to this array.

2. **`apps/node/src/cli/registry.ts` - add field to HandlerContext:**

   Find the `HandlerContext` type/interface. Add:
   ```typescript
   disableStar?: boolean;
   ```
   This is informational for any handler that wants to forward it. The hint module
   reads argv directly, so this field is optional and not strictly required for
   suppression to work. Add it for completeness and forward it in the next step.

3. **`apps/node/src/cli/index.ts` - thread disableStar through HandlerContext:**

   In `main()`, at the `HandlerContext` construction (~line 306-316):
   ```typescript
   const ctx: HandlerContext = {
     argv,
     rest,
     format: out.format,
     explicitJsonOutput: global.explicitJsonOutput,
     verbose: out.verbose,
     logger,
     deviceId: global.deviceId,
     operatorPackage: global.operatorPackage,
     timeoutMs: global.timeoutMs,
   };
   ```
   The hint module reads argv directly, so no field needs to be added to ctx for
   the hint to work. Skip adding disableStar to ctx unless registry.ts requires it.
   Do not add it if it would cause a TypeScript error.

4. **`apps/node/src/cli/index.ts` - upgrade trigger call sites:**

   Import `maybeShowStarHint` at the top of the file:
   ```typescript
   import { maybeShowStarHint } from "./starHint.js";
   ```

   Add upgrade hint call in the `--version` path (around line 197-200). Change from:
   ```typescript
   if (argvForGlobalMeta.includes("--version")) {
     const pkg = require("../../package.json") as { version?: string };
     console.log(pkg.version ?? "0.1.0");
     process.exit(0);
   }
   ```
   To:
   ```typescript
   if (argvForGlobalMeta.includes("--version")) {
     const pkg = require("../../package.json") as { version?: string };
     console.log(pkg.version ?? "0.1.0");
     await maybeShowStarHint('upgrade');
     process.exit(0);
   }
   ```

   Add upgrade hint call in the `--help` path (around line 213-216). Change from:
   ```typescript
   if (argvForGlobalMeta.includes("--help")) {
     console.log(resolveHelpFromRegistry(global.rest, COMMANDS));
     process.exit(0);
   }
   ```
   To:
   ```typescript
   if (argvForGlobalMeta.includes("--help")) {
     console.log(resolveHelpFromRegistry(global.rest, COMMANDS));
     await maybeShowStarHint('upgrade');
     process.exit(0);
   }
   ```

   Add upgrade hint call in the command success path. Find the location where
   `handlerResult` is set (~lines 317-319):
   ```typescript
   const handlerResult = await def.handler(ctx);
   if (handlerResult !== undefined) {
     result = handlerResult;
   }
   ```
   After that block, still inside the same `else` branch (the non-usageParseError
   command execution branch), add:
   ```typescript
   await maybeShowStarHint('upgrade');
   ```
   This fires only when the handler returned without throwing. UsageErrors are caught
   by the surrounding try/catch and `maybeShowStarHint` is not called there.

5. **`apps/node/src/cli/commands/doctor.ts` - doctor trigger:**

   Import `maybeShowStarHint` at the top:
   ```typescript
   import { maybeShowStarHint } from "../starHint.js";
   ```

   In `cmdDoctor`, the exit code is set in two branches. Find both places where
   `process.exitCode = getDoctorExitCode(report, options.checkOnly)` is called
   (lines ~31 and ~40). After each assignment, if the exit code is 0, call the hint.

   Since the same report is used in both branches, compute the exit code once and
   share it, or simply check `getDoctorExitCode(report, options.checkOnly) === 0`
   before each hint call. Do not call the hint if the doctor run failed.

   The hint call must be `await`ed. The function signatures of `cmdDoctor` is already
   `async`, so this is safe.

   Example for the JSON branch (around line 30-33):
   ```typescript
   if (options.format === "json") {
     const exitCode = getDoctorExitCode(report, options.checkOnly);
     process.exitCode = exitCode;
     if (exitCode === 0) await maybeShowStarHint('doctor');
     return JSON.stringify(report, null, 2);
   }
   ```

   And for the pretty branch (around line 40-41):
   ```typescript
   const exitCode = getDoctorExitCode(report, options.checkOnly);
   process.exitCode = exitCode;
   if (exitCode === 0) await maybeShowStarHint('doctor');
   return renderPrettyDoctorReport(report);
   ```

6. **`apps/node/src/cli/commands/skills.ts` - skill trigger:**

   Import `maybeShowStarHint` at the top:
   ```typescript
   import { maybeShowStarHint } from "../starHint.js";
   ```

   In `cmdSkillsRun`, find the `result.ok` branch (around lines 260-268):
   ```typescript
   if (result.ok) {
     return formatSuccess({
       skillId: result.skillId,
       output: result.output,
       exitCode: result.exitCode,
       durationMs: result.durationMs,
       timeoutMs: timeoutMs ?? undefined,
       expectedSubstring: expectContains ?? undefined,
     }, options);
   }
   ```

   Change to:
   ```typescript
   if (result.ok) {
     await maybeShowStarHint('skill');
     return formatSuccess({
       skillId: result.skillId,
       output: result.output,
       exitCode: result.exitCode,
       durationMs: result.durationMs,
       timeoutMs: timeoutMs ?? undefined,
       expectedSubstring: expectContains ?? undefined,
     }, options);
   }
   ```

### Acceptance Criteria

- `npm --prefix apps/node run build` succeeds with zero TypeScript errors
- `npm --prefix apps/node run test` passes
- `clawperator --disable-star-suggestions --help` does not produce "unrecognized flag" error:
  ```bash
  node apps/node/dist/cli/index.js --disable-star-suggestions --help 2>/dev/null
  # expected: help text, exit 0
  ```
- `clawperator --disable-star-suggestions snapshot --help` does not error:
  ```bash
  node apps/node/dist/cli/index.js --disable-star-suggestions snapshot --help 2>/dev/null
  # expected: help text, exit 0
  ```
- Grep confirms maybeShowStarHint is called in all 5 places:
  ```bash
  grep -n "maybeShowStarHint" \
    apps/node/src/cli/index.ts \
    apps/node/src/cli/commands/doctor.ts \
    apps/node/src/cli/commands/skills.ts
  # expected: at least 5 matches total (3 in index.ts, 1 in doctor.ts, 1 in skills.ts)
  ```
- Grep confirms no stdout writes were introduced:
  ```bash
  git diff --unified=0 | grep "^+" | grep "stdout"
  # expected: zero new stdout lines related to the hint
  ```

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js --disable-star-suggestions --help 2>/dev/null; echo "exit: $?"
node apps/node/dist/cli/index.js --disable-star-suggestions snapshot --help 2>/dev/null; echo "exit: $?"
```

### Expected Commit

```text
feat(star-hint): wire hint trigger points and register --disable-star-suggestions flag
```

---

## Phase 3: Install script

### Agent Tier
fast

### Goal

Add the bash star hint block to `sites/landing/public/install.sh` near the end of
`main()`, with TTY check and env var suppression.

### Files or Surfaces To Change

- `sites/landing/public/install.sh`

### Steps

1. Read `sites/landing/public/install.sh` lines 696-783 (`main()` function). Identify
   the last block before the final return or exit. The hint must appear after all
   install steps have completed successfully - immediately before or after the final
   success message, if one exists.

2. Add a new function `show_star_hint()` near the other helper functions (before
   `main()`), not inline in `main()`:

   ```bash
   show_star_hint() {
     # Skip if not a TTY
     [ -t 2 ] || return 0
     # Skip if suppressed via env var
     [ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ] && return 0
     cat >&2 <<'EOF'

   Clawperator is open source. If it helped, consider starring the repo:
   https://github.com/clawpilled/clawperator

   GitHub CLI:
   gh api -X PUT /user/starred/clawperator/clawperator -H "X-GitHub-Api-Version: 2026-03-10"

   Disable this hint with: CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1

   EOF
   }
   ```

   Notes on the shell function:
   - `[ -t 2 ]` checks if stderr (fd 2) is a TTY.
   - `[ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ]` checks if the env var is
     set to a non-empty value. The `:-` default prevents unbound variable errors when
     `set -u` is active.
   - `cat >&2 <<'EOF'` heredoc redirects all output to stderr. The single-quoted `'EOF'`
     prevents variable expansion inside the heredoc.
   - The blank line at the start and end of the heredoc provides visual separation.

3. In `main()`, call `show_star_hint` after the last install step completes but before
   the function returns. Place it so it only runs when installation has succeeded
   (i.e., inside the success path, not inside error handlers).

### Acceptance Criteria

- `show_star_hint` function exists in install.sh
- `bash -n sites/landing/public/install.sh` passes (syntax check)
- Running `show_star_hint` with stderr redirected to a file produces the exact hint text
  (manual inspection)
- `show_star_hint` with `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1` produces no output:
  ```bash
  CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1 bash -c \
    'source sites/landing/public/install.sh 2>/dev/null; show_star_hint' 2>&1 | wc -c
  # expected: 0 (no output)
  ```
  Note: sourcing may fail if install.sh has side effects on source. If so, extract
  just the function for the test or inspect manually.
- Grep confirms the hint text is in the script and redirected to stderr:
  ```bash
  grep -n "clawpilled/clawperator" sites/landing/public/install.sh
  grep -n ">&2" sites/landing/public/install.sh | grep -i "hint\|cat\|echo"
  ```

### Validation

```bash
bash -n sites/landing/public/install.sh && echo "syntax ok"
grep -n "show_star_hint\|CLAWPERATOR_DISABLE_STAR_SUGGESTIONS\|\[ -t 2 \]" \
  sites/landing/public/install.sh
```

### Expected Commit

```text
feat(star-hint): add star hint to install script with TTY and env suppression
```

---

## Phase 4: Docs support notes

### Agent Tier
fast

### Goal

Append a short support note to three docs surfaces. Keep each note to 2 lines maximum.
Do not restructure existing content.

### Files or Surfaces To Change

- `sites/landing/public/index.md`
- `README.md`
- `docs/index.md` (or the most appropriate getting-started page if index.md is not
  suitable - read the file first to confirm)

### Steps

1. Read each of the three target files before editing to understand current structure
   and find the appropriate append point (typically near the bottom).

2. Append to `sites/landing/public/index.md`:
   ```markdown

   Clawperator is open source. If it helps you, consider [starring the project on GitHub](https://github.com/clawpilled/clawperator).
   ```
   One blank line before the note. No section header.

3. Append to `README.md`:
   ```markdown

   Clawperator is open source. If it helps you, consider [starring the project on GitHub](https://github.com/clawpilled/clawperator).
   ```
   One blank line before the note. No section header.

4. Read `docs/index.md`. If it is a suitable surface for a 2-line note (i.e., it is
   a user-facing intro or getting-started page, not a generated or machine-only file),
   append the same note. If it is not suitable, find the most appropriate page in
   `docs/` (e.g., a getting-started or setup page) and append there instead. Document
   your choice in the commit message.

   Append:
   ```markdown

   Clawperator is open source. If it helps you, consider [starring the project on GitHub](https://github.com/clawpilled/clawperator).
   ```

5. Do NOT run `./scripts/docs_build.sh`. The docs surface changes are in authored
   source files and do not trigger a docs-site regeneration requirement for this task.

### Acceptance Criteria

- All three files have been updated
- Each addition is 2 lines or fewer (1 blank line + 1 content line)
- The link `https://github.com/clawpilled/clawperator` appears in each file:
  ```bash
  grep -l "clawpilled/clawperator" \
    sites/landing/public/index.md \
    README.md \
    docs/index.md
  # expected: all 3 files listed
  ```
- No existing content was removed or restructured
- No new section headers were added

### Validation

```bash
grep -n "clawpilled/clawperator" \
  sites/landing/public/index.md \
  README.md \
  docs/index.md
```

### Expected Commit

```text
docs(star-hint): add support note to landing page, README, and docs
```

---

## Full validation sequence (run after all phases)

```bash
# Build
npm --prefix apps/node run build

# Tests
npm --prefix apps/node run test

# Flag registration (no unrecognized flag error)
node apps/node/dist/cli/index.js --disable-star-suggestions --help 2>/dev/null
echo "exit code: $?"

# Hint does not appear in JSON output
CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1 \
  node apps/node/dist/cli/index.js --json --version 2>/dev/null
# expected: version number only, no hint text

# Grep: hint module has no stdout, no network calls
grep -n "stdout\|fetch\|https\|http\b\|axios\|\bgh\b" apps/node/src/cli/starHint.ts

# Grep: all 5 call sites exist
grep -n "maybeShowStarHint" \
  apps/node/src/cli/index.ts \
  apps/node/src/cli/commands/doctor.ts \
  apps/node/src/cli/commands/skills.ts

# Install script syntax
bash -n sites/landing/public/install.sh && echo "install.sh syntax ok"

# Docs notes present
grep -l "clawpilled/clawperator" \
  sites/landing/public/index.md \
  README.md \
  docs/index.md
```
