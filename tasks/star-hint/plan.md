# Star Hint

## Executive Summary

Adds a lightweight, one-time GitHub star suggestion system to the Clawperator CLI
and install script. Single PR, 4 phases in one PR. The Node CLI gets a centralized
hint module, 4 wired trigger points, a new global flag, and state tracking under
`~/.clawperator/star-hint-state.json`. The install script gets a standalone bash
hint at install completion. Three docs surfaces get a short support note.

No GitHub API calls. No stdout pollution. No dynamic behavior.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Show a single, static, stderr-only star suggestion at 4 specific high-value moments.
Never pollute structured output. Never repeat. Never call any GitHub API. Let users
opt out via flag or env var.

## Why Now

Clawperator is open source and growing. A low-friction, trust-respecting nudge at
natural moments adds community signal without degrading the developer experience or
undermining Clawperator's positioning as a deterministic, agent-first runtime.

## In Scope

- New file `apps/node/src/cli/starHint.ts` with `maybeShowStarHint(trigger)` function
- State persistence in `~/.clawperator/star-hint-state.json`
- Global flag `--disable-star-suggestions` (arity 0) registered in `cli/index.ts`
- Env var suppression: `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS`
- Trigger hook in `apps/node/src/cli/commands/doctor.ts` (doctor success)
- Trigger hook in `apps/node/src/cli/commands/skills.ts` (skill run success)
- Trigger hook in `apps/node/src/cli/index.ts` (upgrade detection at startup, --help, --version)
- Bash hint block added to `sites/landing/public/install.sh`
- Short support note in `sites/landing/public/index.md`
- Short support note in `README.md`
- Short support note in `docs/index.md` or an appropriate getting-started page

## Out of Scope

- Any call to `gh`, the GitHub API, or any network request
- Checking whether the repo is already starred
- Personalizing the hint based on user identity or history
- Additional trigger points beyond the 4 specified
- Analytics, telemetry, or call-home behavior
- Showing the hint on command failure or usage errors
- Modifying the HTTP API server, SSE stream, or JSON contract shapes

## Existing Artifact Scope

`apps/node/src/cli/index.ts` - add `--disable-star-suggestions` to FLAG_VALUE_ARITY,
parse in `getGlobalOpts()`, add to `globalFlags` list, insert 3 upgrade trigger call
sites. No other changes to this file.

`apps/node/src/cli/registry.ts` - add `disableStar?: boolean` to `HandlerContext`
type. No other changes.

`apps/node/src/cli/commands/doctor.ts` - insert one hint call after the success
check. No restructuring.

`apps/node/src/cli/commands/skills.ts` - insert one hint call in the `result.ok`
branch of `cmdSkillsRun`. No restructuring.

`sites/landing/public/install.sh` - append hint block near end of `main()`.
No restructuring.

`sites/landing/public/index.md`, `README.md`, `docs/index.md` - append a short
(2-4 line) support note. No restructuring of existing content.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Hint module | `apps/node/src/cli/starHint.ts` | new file |
| CLI global flag parsing | `apps/node/src/cli/index.ts` | add flag + 3 call sites |
| Handler context type | `apps/node/src/cli/registry.ts` | add field to HandlerContext |
| Doctor hook | `apps/node/src/cli/commands/doctor.ts` | add 1 call site |
| Skills hook | `apps/node/src/cli/commands/skills.ts` | add 1 call site |
| Install script | `sites/landing/public/install.sh` | add bash hint block |
| Landing page | `sites/landing/public/index.md` | append support note |
| README | `README.md` | append support note |
| Docs | `docs/index.md` | append support note |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| FLAG_VALUE_ARITY map and getGlobalOpts() | `apps/node/src/cli/index.ts` lines 44-181 |
| HandlerContext type | `apps/node/src/cli/registry.ts` |
| globalFlags list in main() | `apps/node/src/cli/index.ts` lines 242-246 |
| Doctor success path (report.ok, getDoctorExitCode) | `apps/node/src/cli/commands/doctor.ts` |
| Skills run success path (result.ok branch) | `apps/node/src/cli/commands/skills.ts` lines 260-268 |
| State dir convention (~/.clawperator/) | `apps/node/src/adapters/logger.ts` (expandHomePath) |
| Package version source | `apps/node/package.json` (read via require as in cli/index.ts line 198) |
| Install script structure and main() | `sites/landing/public/install.sh` |

## Deterministic Versus Judgment

Everything in this task is deterministic except the 2-4 line docs support note on
three surfaces.

Deterministic rules:

- Hint text is an exact static string (see Decision Rules below). Do not modify it.
- TTY check: `process.stderr.isTTY !== true` suppresses.
- Env suppression: `process.env.CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` is truthy (any
  non-empty value) suppresses.
- Flag suppression: `process.argv.slice(2).includes('--disable-star-suggestions')`
  suppresses. (The hint module checks argv directly so it works in early-exit paths
  before getGlobalOpts has run.)
- State file: `~/.clawperator/star-hint-state.json`
- State shape: `{ doctorHintShown?: boolean, skillHintShown?: boolean, lastUpgradeHintVersion?: string }`
- Version source: `require("../../package.json")` as used in `cli/index.ts` line 198.
- Each trigger fires at most once per state (upgrade: once per version string).
- A module-level `shown` flag prevents more than one hint per process invocation even
  if multiple triggers fire in the same run.
- All errors in the hint module are silently swallowed. Never throw. Never crash the CLI.
- In install.sh: TTY check is `[ -t 2 ]` (stderr). Suppression check is
  `[ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ]`.

Judgment (minimal):

- Exact wording of the 2-4 line support note on the three docs surfaces. Must be short,
  non-intrusive, and consistent with Clawperator's tone. See Decision Rules for guidance.

## Decision Rules

**Hint display decision - first-match wins:**

| Condition | Result |
| --- | --- |
| `process.stderr.isTTY !== true` | suppress, do not update state |
| `CLAWPERATOR_DISABLE_STAR_SUGGESTIONS` env var is set (non-empty) | suppress, do not update state |
| `--disable-star-suggestions` present in `process.argv` | suppress, do not update state |
| module-level `shown === true` (already fired this invocation) | suppress, do not update state |
| trigger is `doctor` and `state.doctorHintShown === true` | suppress, do not update state |
| trigger is `skill` and `state.skillHintShown === true` | suppress, do not update state |
| trigger is `upgrade` and `state.lastUpgradeHintVersion === currentVersion` | suppress, do not update state |
| otherwise | print hint to stderr, update state, set `shown = true` |

**State update after printing:**

| Trigger | Field to set |
| --- | --- |
| `doctor` | `state.doctorHintShown = true` |
| `skill` | `state.skillHintShown = true` |
| `upgrade` | `state.lastUpgradeHintVersion = currentVersion` |

**Exact hint text for Node CLI (stderr):**

```
Clawperator is open source. If it helped, consider starring the repo:
https://github.com/clawpilled/clawperator

GitHub CLI:
gh api -X PUT /user/starred/clawperator/clawperator -H "X-GitHub-Api-Version: 2026-03-10"

Disable this hint with: --disable-star-suggestions
```

Print a blank line before and after this block to separate it visually from command
output.

**Exact hint text for install.sh (stderr):**

Same text except the last line reads:
```
Disable this hint with: CLAWPERATOR_DISABLE_STAR_SUGGESTIONS=1
```

(The CLI flag is not applicable in an install script context.)

**Trigger hook locations in cli/index.ts:**

| Path | Where to call | Condition |
| --- | --- | --- |
| `--version` path | Before `process.exit(0)` at ~line 200 | Always (version check inside module) |
| `--help` path | Before `process.exit(0)` at ~line 215 | Always (version check inside module) |
| Command success path | After handler returns at ~line 317-319, inside the non-error branch | Only if no usageParseError and handler did not throw |

**Trigger hook locations in command files:**

| File | Call site | Condition |
| --- | --- | --- |
| `doctor.ts` | After `process.exitCode = getDoctorExitCode(...)`, when exit code is 0 | `getDoctorExitCode(report, options.checkOnly) === 0` |
| `skills.ts` | Inside `if (result.ok)` branch of `cmdSkillsRun`, before the return | `result.ok === true` |

**Doctor success definition:** `getDoctorExitCode(report, options.checkOnly) === 0`.
Both the JSON and pretty branches return after setting `process.exitCode`, so call
`await maybeShowStarHint('doctor')` just before the `return` in the success branch
for each format path. Alternatively, compute the exit code once, call the hint if 0,
then use the cached value. Do not call `maybeShowStarHint` if the doctor check failed.

**Note on `--help` and `--version` early-exit paths:**

These paths call `process.exit(0)` before `getGlobalOpts` runs. The hint module must
not depend on parsed opts - it reads `process.argv` and `process.env` directly. The
`--disable-star-suggestions` check inside the module covers suppression here.

Because both are async and the hint write is to stderr, the implementer must `await
maybeShowStarHint(...)` before `process.exit(0)` so the write completes. Do not use
`.then()` chains that might be cut off by exit.

**docs support note tone:**

Keep it to 2 lines maximum per surface. Example:
```
Clawperator is open source. If it helps you, consider
[starring the project on GitHub](https://github.com/clawpilled/clawperator).
```
Do not add a section header. Append near the bottom of each file, not mid-content.

## Failure Modes To Prevent

- Hint text or blank lines appearing in stdout, JSON output, HTTP API responses, or SSE
  streams - use only `process.stderr.write`
- Hint firing on command failure or usage error - only fire on confirmed success
- Hint firing in non-TTY contexts (piped output, CI, agent runner) - always check TTY
- State write error crashing the CLI - wrap all state I/O in try/catch, swallow errors
- Hint firing twice in one invocation - enforce module-level `shown` guard
- Any network call, any call to `gh`, any GitHub API call - forbidden absolutely
- `--disable-star-suggestions` causing "unrecognized flag" error - must be in
  `FLAG_VALUE_ARITY` and the `globalFlags` list in `cli/index.ts`
- Upgrade hint firing on every startup instead of once per version - state guard on
  `lastUpgradeHintVersion`
- `await maybeShowStarHint(...)` missing before `process.exit(0)` in early-exit paths -
  the write is async; fire-and-forget will be cut off

## Output Contract

The hint module exports one function:

```typescript
export async function maybeShowStarHint(
  trigger: 'doctor' | 'skill' | 'upgrade'
): Promise<void>
```

- Writes to `process.stderr` only
- Never throws
- Never returns a value used by callers
- Has no effect on stdout, JSON output, exit code, or any structured output
- Is safe to call from any command handler without wrapping in try/catch

## Idempotency

- Running the same trigger twice in separate invocations: fires only on the first
  (state guard).
- Running `--version` twice after version upgrade: fires only on the first invocation
  (state guard updates `lastUpgradeHintVersion` on first show).
- Running multiple triggers in one invocation: fires at most once (module-level `shown`
  guard).
- State file missing or unreadable: treat as empty state, show hint, attempt write.

## Durable Follow-Up

None. This task is self-contained. The 3 docs additions are the permanent record.
No task folder content needs migration after cleanup.
