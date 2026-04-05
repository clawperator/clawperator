# Star Hint Work Breakdown

Parent plan: `tasks/star-hint/plan.md`

## Executive Summary

1 PR, 4 phases, all in one branch. No merge gates. Phase 1 creates the hint module
and tests it. Phase 2 wires it into `cli/index.ts` only (flag registration + hint
dispatch in main()). Phase 3 adds the bash hint to the install script. Phase 4
appends support notes to 3 docs surfaces.

`doctor.ts`, `skills.ts`, and `registry.ts` are not modified. All hint calls live
in `main()` and fire after `console.log(result)`.

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

- Do NOT invoke any subprocess, shell-out, library call, or HTTP request whose purpose
  is to inspect GitHub state or interact with GitHub on the user's behalf. This includes
  `gh`, `gh --version`, `curl`/`fetch` to any GitHub endpoint, and any library that
  wraps GitHub APIs. The only GitHub-related content permitted is the static string in
  `HINT_TEXT`.
- All hint output must go to `process.stderr` in Node code and `>&2` in shell code.
  Never write hint text to stdout.
- Never show the hint when `process.stderr.isTTY !== true`. The check must happen
  inside `maybeShowStarHint` itself.
- Never show the hint in the JSON output path, HTTP API responses, or SSE streams.
- All state I/O in `starHint.ts` must be wrapped in try/catch. Errors are silently
  swallowed. The hint module must never throw.
- In the command execution path, all hint calls must come AFTER `console.log(result)`
  in main(). Never call `maybeShowStarHint` from inside a command handler function.
  The hint must appear after the primary command output, not before.
- In the `--version` early-exit path, call the hint after version output and before
  `process.exit(0)`. This path does not go through `console.log(result)`; the rule
  above applies only to the command execution path.
- Do NOT add a hint call in the `--help` path. That path is excluded from the upgrade
  trigger.
- `await maybeShowStarHint(...)` must be used before `process.exit(0)` in the
  `--version` path. A `.then()` or unawaited call will be cut off by exit.
- `--disable-star-suggestions` must be added to `FLAG_VALUE_ARITY` in `cli/index.ts`
  (arity 0) and to the `globalFlags` list in main(), or it will cause "unrecognized
  flag" errors for callers who pass it.
- Do NOT modify `apps/node/src/cli/commands/doctor.ts`,
  `apps/node/src/cli/commands/skills.ts`, or `apps/node/src/cli/registry.ts`.
  No `disableStar` field in `HandlerContext`. All hint logic stays in `main()`.
- `writeState` must call `mkdirSync(dir, { recursive: true })` before writing. Do not
  assume `~/.clawperator/` pre-exists. Swallow any error from both mkdir and write.
- Only add the trigger points specified in the plan. Do not add any additional calls.
- One logical commit per phase. Do not batch all phases into one commit.
- Do not edit generated docs (`sites/docs/.build/`, `sites/docs/site/`).
- Do not run `./scripts/docs_build.sh` for this task.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/star-hint/plan.md` | Stable contract, exact hint text, decision tables - do not re-derive |
| `apps/node/src/cli/index.ts` lines 44-340 | FLAG_VALUE_ARITY, getGlobalOpts, main() flow, --version path, console.log(result) location, HandlerContext construction |
| `apps/node/src/cli/commands/doctor.ts` | Read-only: understand that cmdDoctor sets `process.exitCode` before returning - used in success detection in main() |
| `apps/node/src/cli/commands/skills.ts` lines 260-290 | Read-only: understand the success result shape (skillId, output, exitCode, durationMs - no `code` field) vs error shape (code, message) |
| `apps/node/src/adapters/logger.ts` | homedir() and path join patterns for state file path |
| `apps/node/package.json` | Verify the version field key name |
| `sites/landing/public/install.sh` lines 696-783 | main() structure - find where to append hint call |

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

1. Read `apps/node/src/adapters/logger.ts` to find the `homedir()` import pattern.
   Use `homedir()` from `node:os` to construct the state file path:
   `join(homedir(), '.clawperator', 'star-hint-state.json')`.

2. Read `apps/node/package.json` to confirm the `version` field key name.

3. Look at one existing `.test.ts` file near `apps/node/src/cli/` to confirm the test
   framework import style before writing the test file.

4. Create `apps/node/src/cli/starHint.ts` with this exact structure:

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

   c. **`stateFilePath(): string`** - returns
      `join(homedir(), '.clawperator', 'star-hint-state.json')`. No I/O.

   d. **`readState(): StarHintState`** - reads and JSON-parses the state file.
      Returns `{}` if file missing, unreadable, or parse fails. Never throws.

   e. **`writeState(state: StarHintState): void`** - writes state as JSON. Before
      writing, call `mkdirSync(dirname(stateFilePath()), { recursive: true })` to
      ensure the directory exists. Wrap both the mkdir and the write in a single
      try/catch and swallow any error. Never throws.

   f. **`getCliVersion(): string`** - reads version from `../../package.json` using
      `createRequire(import.meta.url)` (same pattern as `cli/index.ts` lines 3-4).
      Returns `"0.0.0"` on any error. Never throws.

   g. **`isSuppressed(): boolean`** - returns `true` if any of:
      - `process.stderr.isTTY !== true`
      - `process.env.CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` is a non-empty string
      - `process.argv.slice(2).includes('--disable-star-suggestions')`

   h. **`HINT_TEXT` constant** - exact multi-line string (copy verbatim from plan.md):
      ```typescript
      const HINT_TEXT = `
Clawperator is open source. If it helped, consider starring the repo:
https://github.com/clawpilled/clawperator

GitHub CLI:
gh api -X PUT /user/starred/clawperator/clawperator -H "X-GitHub-Api-Version: 2026-03-10"

Disable this hint with: --disable-star-suggestions
`;
      ```
      The template literal starts and ends with a newline, providing blank-line
      separation before and after the hint text.

   i. **`maybeShowStarHint(trigger: 'doctor' | 'skill' | 'upgrade'): Promise<void>`** -
      exported. Apply the first-match-wins decision table from plan.md exactly:

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

5. Create `apps/node/src/cli/starHint.test.ts`. Tests must cover all 8 cases:
   - TTY suppression: `process.stderr.isTTY` falsy - nothing written to stderr
   - Env suppression: `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` set - nothing written
   - State suppression (doctor): `doctorHintShown: true` in state - doctor trigger
     does not write
   - State suppression (skill): `skillHintShown: true` in state - skill trigger does
     not write
   - Version suppression: upgrade trigger suppressed when stored version matches the
     version already recorded in state (i.e. `lastUpgradeHintVersion === currentVersion`)
   - Show path: trigger fires, writes `HINT_TEXT` to stderr, updates state field
     correctly for each trigger type
   - Module-level `shown` guard: second call in same module instance is suppressed
   - Error swallowing: state write failure (e.g. mkdir throws) does not throw

   Tests must never touch the real `~/.clawperator/` directory. Mock or stub the
   state file path (e.g. redirect `homedir()` or inject the path via a test seam)
   so tests are isolated and non-invasive. A test that writes to the real home
   directory is not acceptable.

### Acceptance Criteria

- `apps/node/src/cli/starHint.ts` exists and exports `maybeShowStarHint`
- `apps/node/src/cli/starHint.test.ts` exists with all 8 test cases
- `npm --prefix apps/node run build` succeeds with no TypeScript errors
- `npm --prefix apps/node run test` passes with all new tests green
- Grep confirms no runtime network or subprocess APIs in starHint.ts:
  ```bash
  grep -n "\bfetch\b\|axios\|http\.request\|https\.request\|\bspawn\b\|\bexec\b\|child_process" \
    apps/node/src/cli/starHint.ts
  # expected: zero matches
  # (HINT_TEXT contains a static GitHub URL as a string literal - that is fine;
  #  this grep targets runtime/network/subprocess API usage, not raw URL text)
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
calls in `main()` only - after `--version` output and after `console.log(result)` in
the command path. Do not modify doctor.ts, skills.ts, or registry.ts.

### Files or Surfaces To Change

- `apps/node/src/cli/index.ts` (only)

### Steps

1. **Register the flag in `FLAG_VALUE_ARITY` (lines 44-94):**

   Add:
   ```typescript
   ["--disable-star-suggestions", 0],
   ```
   Arity 0 means the flag takes no value argument.

2. **Parse the flag in `getGlobalOpts()` (lines 100-181):**

   Add a branch in the argv loop. The flag needs to be consumed so it does not fall
   through to `rest`. The hint module reads `process.argv` directly so no return value
   is needed. Add before the final `else { rest.push(argv[i]) }`:
   ```typescript
   } else if (argv[i] === "--disable-star-suggestions") {
     // consumed; hint module reads process.argv directly
   } else {
   ```

3. **Add to the `globalFlags` list in `main()` (~lines 242-246):**

   Find:
   ```typescript
   const globalFlags = [
     "--device", "--device-id", "--operator-package", "--receiver-package",
     "--json", "--output", "--format", "--log-level", "--timeout", "--timeout-ms",
     "--verbose", "--help", "--version"
   ];
   ```
   Add `"--disable-star-suggestions"` to this array.

4. **Import `maybeShowStarHint` at the top of the file:**
   ```typescript
   import { maybeShowStarHint } from "./starHint.js";
   ```

5. **Upgrade trigger in the `--version` path (~lines 197-200):**

   The hint must fire AFTER the version is printed, BEFORE `process.exit(0)`.
   Change:
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
   The `main` function is already async so `await` is valid here.

6. **Doctor, skill, and upgrade triggers in the command path:**

   Locate the block that prints the result and sets the exit code (~lines 335-339):
   ```typescript
   if (result !== undefined) {
     console.log(result);
   }
   if (typeof result === "string" && shouldCliStdoutForceExitCode1(result, usageParseError)) {
     process.exitCode = 1;
   }
   ```

   Insert hint calls AFTER `console.log(result)` and BEFORE
   `shouldCliStdoutForceExitCode1`. The block should become:
   ```typescript
   if (result !== undefined) {
     console.log(result);
   }
   if (!usageParseError) {
     // Doctor trigger: fires after first successful clawperator doctor
     if (cmd === 'doctor' && (process.exitCode ?? 0) === 0) {
       await maybeShowStarHint('doctor');
     }
     // Skill trigger: fires after first successful skills run.
     // Success is detected by a heuristic: success envelopes lack a top-level `code`
     // field while error envelopes have one. This is a deliberate temporary heuristic,
     // not a contract. Wrap in a named helper to isolate the assumption:
     //   function isSuccessfulSkillsRunResult(r: string | undefined): boolean {
     //     try { return !((JSON.parse(r ?? '{}') as { code?: string }).code); }
     //     catch { return false; }
     //   }
     if (cmd === 'skills' && rest[0] === 'run' && isSuccessfulSkillsRunResult(result)) {
       await maybeShowStarHint('skill');
     }
     // Upgrade trigger: fires once per version after any successful command or --version
     await maybeShowStarHint('upgrade');
   }
   if (typeof result === "string" && shouldCliStdoutForceExitCode1(result, usageParseError)) {
     process.exitCode = 1;
   }
   ```

   Implementation notes:
   - `cmd` is defined at ~line 217 as `const [cmd, ...rest] = global.rest;` and is
     in scope at this point.
   - `process.exitCode` for doctor: `cmdDoctor` sets it before returning, so by the
     time `console.log(result)` runs it already reflects the doctor outcome. This
     relies on an observed contract of `cmdDoctor` - not a generic Node.js convention.
     If `cmdDoctor` is ever refactored to defer exit code setting, this trigger will
     silently stop firing on success. Flag this in code review if doctor.ts changes.
   - `isSuccessfulSkillsRunResult`: define this as a small local helper function in
     `index.ts` near the hint dispatch block. Its body is the JSON parse heuristic
     described in the comment above. Isolating it in a named function makes the
     heuristic visible and easy to replace later if the contract hardens.
   - Call doctor first, then skill, then upgrade. The module-level `shown` guard
     ensures only one hint fires per invocation; feature-specific triggers get
     priority over the generic upgrade trigger.
   - The outer `!usageParseError` guard ensures the hints do not fire on flag errors.
     Handler throws (UsageError) are caught earlier and set `usageParseError = true`,
     so that guard also covers thrown errors.

### Acceptance Criteria

- `npm --prefix apps/node run build` succeeds with zero TypeScript errors
- `npm --prefix apps/node run test` passes
- `--disable-star-suggestions` does not cause "unrecognized flag" when combined with
  any command:
  ```bash
  node apps/node/dist/cli/index.js --disable-star-suggestions snapshot --help 2>/dev/null
  echo "exit: $?"
  # expected: help text, exit 0
  ```
- `--disable-star-suggestions` passed before `doctor` command does not error:
  ```bash
  node apps/node/dist/cli/index.js --disable-star-suggestions doctor --help 2>/dev/null
  echo "exit: $?"
  # expected: exit 0
  ```
- Grep confirms all hint call sites are in index.ts only:
  ```bash
  grep -rn "maybeShowStarHint" apps/node/src/
  # expected: matches only in starHint.ts (definition) and index.ts (call sites)
  # no matches in doctor.ts, skills.ts, or registry.ts
  ```
- Grep confirms hint calls come after console.log in the diff:
  ```bash
  git diff apps/node/src/cli/index.ts | grep -n "maybeShowStarHint\|console\.log(result"
  # verify visually that console.log(result) appears before maybeShowStarHint lines
  ```
- Grep confirms no stdout writes were introduced:
  ```bash
  git diff --unified=0 apps/node/src/cli/index.ts | grep "^+" | grep "stdout"
  # expected: zero new stdout lines related to hint
  ```

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
node apps/node/dist/cli/index.js --disable-star-suggestions snapshot --help 2>/dev/null
echo "exit: $?"
node apps/node/dist/cli/index.js --disable-star-suggestions doctor --help 2>/dev/null
echo "exit: $?"
grep -rn "maybeShowStarHint" apps/node/src/
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
   install steps have completed successfully.

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

   Notes:
   - `[ -t 2 ]` checks if stderr (fd 2) is a TTY.
   - `[ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ]` checks for non-empty env var.
     The `:-` default prevents unbound variable errors under `set -u`.
   - `cat >&2 <<'EOF'` redirects output to stderr. Single-quoted `'EOF'` prevents
     variable expansion inside the heredoc.
   - The blank line at start and end of the heredoc provides visual separation.
   - The last line uses `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1` (not the CLI flag),
     since this is a shell script context.

3. In `main()`, call `show_star_hint` after the last install step completes. Place it
   so it only runs on the success path, not inside error handlers.

### Acceptance Criteria

- `show_star_hint` function exists in install.sh
- `bash -n sites/landing/public/install.sh` passes (syntax check)
- Behavior validation of `show_star_hint` suppression may be manual. Sourcing
  `install.sh` directly is side-effectful and not safe in a test environment.
  Instead, test the function logic in isolation:
  ```bash
  CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1 \
    bash -c 'show_star_hint() {
      [ -t 2 ] || return 0
      [ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ] && return 0
      echo "should not reach here" >&2
    }; show_star_hint' 2>&1 | wc -c
  # expected: 0 (suppressed)
  ```
  Syntax check and grep are the required automated checks; behavior verification
  above is sufficient for the suppression path.
- Grep confirms hint content and stderr redirect exist:
  ```bash
  grep -n "clawpilled/clawperator" sites/landing/public/install.sh
  grep -n "show_star_hint" sites/landing/public/install.sh
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

Append a short support note to three docs surfaces. Each note is 1-2 lines, adapted
for the surface. Do not restructure existing content.

### Files or Surfaces To Change

- `sites/landing/public/index.md`
- `README.md`
- `docs/index.md` (confirm this is a suitable user-facing page before editing; if not,
  use the most appropriate getting-started page in `docs/`)

### Steps

1. Read all three target files before editing to understand structure and find the
   appropriate append point (near the bottom of each file).

2. Append to `sites/landing/public/index.md` (community-facing; softer, welcoming
   tone):
   ```markdown

   Clawperator is open source and community-supported. If it's useful to you, [star it on GitHub](https://github.com/clawpilled/clawperator) - it helps others discover it.
   ```

3. Append to `README.md` (developer/contributor entry point; direct "support the
   project" framing):
   ```markdown

   If Clawperator is useful to your project, consider [starring the repo on GitHub](https://github.com/clawpilled/clawperator).
   ```

4. Append to `docs/index.md` (technical navigation; understated but purposeful):
   ```markdown

   Clawperator is open source. If these docs help, see the [project on GitHub](https://github.com/clawpilled/clawperator).
   ```
   If `docs/index.md` is not a user-facing intro or overview page, find the most
   appropriate getting-started or overview page in `docs/` and append there instead.
   Note the chosen file in the commit message.

5. Do NOT run `./scripts/docs_build.sh`. These are authored source files and do not
   require docs-site regeneration.

### Acceptance Criteria

- All three files have been updated
- Each addition is 2 lines or fewer (1 blank line + 1 content line)
- The link `https://github.com/clawpilled/clawperator` appears in all three files:
  ```bash
  grep -l "clawpilled/clawperator" \
    sites/landing/public/index.md \
    README.md \
    docs/index.md
  # expected: all 3 files listed (adjust docs path if a different page was used)
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
# Build and test
npm --prefix apps/node run build
npm --prefix apps/node run test

# Flag registration (no unrecognized flag error)
node apps/node/dist/cli/index.js --disable-star-suggestions --help 2>/dev/null
echo "exit: $?"

# Hint is suppressed by env var (suppression works)
CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1 \
  node apps/node/dist/cli/index.js --version 2>&1
# expected: version number only, no hint text on either stream

# Hint goes to stderr only, not stdout (deterministic: use isolated HOME with no prior state)
ISOLATED_HOME=$(mktemp -d)
HOME="$ISOLATED_HOME" node apps/node/dist/cli/index.js --version \
  1>/tmp/clawperator-hint-stdout.txt \
  2>/tmp/clawperator-hint-stderr.txt
cat /tmp/clawperator-hint-stdout.txt
# expected: version number only - no hint text on stdout
cat /tmp/clawperator-hint-stderr.txt
# expected: hint text (version not yet in state for this isolated HOME)
rm -rf "$ISOLATED_HOME"

# Hint module has no runtime network or subprocess API usage
grep -n "\bfetch\b\|axios\|http\.request\|https\.request\|\bspawn\b\|\bexec\b\|child_process" \
  apps/node/src/cli/starHint.ts
# expected: zero matches (static URL in HINT_TEXT string is not a runtime call)

# All hint calls are in index.ts only - not in doctor.ts, skills.ts, registry.ts
grep -rn "maybeShowStarHint" apps/node/src/
# expected: definition in starHint.ts, call sites only in index.ts

# Hint calls appear after console.log(result) in index.ts
grep -n "console\.log(result\|maybeShowStarHint" apps/node/src/cli/index.ts
# verify visually: console.log(result) line number < maybeShowStarHint line numbers

# Install script syntax
bash -n sites/landing/public/install.sh && echo "syntax ok"

# Docs notes present
grep -l "clawpilled/clawperator" \
  sites/landing/public/index.md \
  README.md \
  docs/index.md
```
