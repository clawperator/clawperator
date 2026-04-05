# Star Hint

## Executive Summary

Adds a lightweight, one-time GitHub star suggestion system to the Clawperator CLI
and install script. Single PR, 4 phases in one PR. The Node CLI gets a centralized
hint module, hint calls consolidated in `main()`, a new global flag, and state
tracking under `~/.clawperator/star-hint-state.json`. The install script gets a
standalone bash hint at install completion. Three docs surfaces get a short support
note.

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

Show a single, static, stderr-only star suggestion at 3 specific high-value moments
in the CLI (plus install script). Never pollute structured output. Never repeat.
Never call any GitHub API or interact with GitHub on the user's behalf. Let users
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
- All hint calls consolidated in `main()` in `apps/node/src/cli/index.ts`:
  - upgrade trigger after `--version` output
  - upgrade + doctor + skill triggers after `console.log(result)` in the command path
- Bash hint block added to `sites/landing/public/install.sh`
- Short support note in `sites/landing/public/index.md`
- Short support note in `README.md`
- Short support note in `docs/index.md` or an appropriate getting-started page

## Out of Scope

- Any subprocess invocation, shell-out, library call, or HTTP request whose purpose
  is to inspect GitHub state or interact with GitHub on the user's behalf
- Checking whether the repo is already starred
- Showing the hint on `--help` invocations
- Personalizing the hint based on user identity or history
- Additional trigger points beyond the 3 CLI triggers and the install script trigger
- Analytics, telemetry, or call-home behavior
- Showing the hint on command failure or usage errors
- Modifying the HTTP API server, SSE stream, or JSON contract shapes
- Modifying `apps/node/src/cli/commands/doctor.ts` or `apps/node/src/cli/commands/skills.ts`
- Modifying `apps/node/src/cli/registry.ts` or adding fields to `HandlerContext`
- Release notes beyond the 3 authored doc surfaces - deferred, not part of this PR

## Existing Artifact Scope

`apps/node/src/cli/index.ts` - add `--disable-star-suggestions` to `FLAG_VALUE_ARITY`,
parse in `getGlobalOpts()`, add to `globalFlags` list, insert hint calls after
`--version` output and after `console.log(result)` in the command path. No other
changes to this file.

`sites/landing/public/install.sh` - add `show_star_hint()` helper function and one
call site in `main()`. No restructuring.

`sites/landing/public/index.md`, `README.md`, `docs/index.md` - append a short
(1-2 line) surface-appropriate support note. No restructuring of existing content.

## Surfaces and Ownership

| Surface | Path | Change type |
| --- | --- | --- |
| Hint module | `apps/node/src/cli/starHint.ts` | new file |
| CLI global flag + hint dispatch | `apps/node/src/cli/index.ts` | add flag, add hint calls in main() |
| Install script | `sites/landing/public/install.sh` | add bash hint block |
| Landing page | `sites/landing/public/index.md` | append support note |
| README | `README.md` | append support note |
| Docs | `docs/index.md` | append support note |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| FLAG_VALUE_ARITY map and getGlobalOpts() | `apps/node/src/cli/index.ts` lines 44-181 |
| globalFlags list in main() | `apps/node/src/cli/index.ts` lines 242-246 |
| main() flow and result printing | `apps/node/src/cli/index.ts` lines 190-340 |
| Doctor process.exitCode behavior | `apps/node/src/cli/commands/doctor.ts` (read-only - not modified) |
| Skills result.ok / result.code shape | `apps/node/src/cli/commands/skills.ts` lines 260-290 (read-only - not modified) |
| State dir convention (~/.clawperator/) | `apps/node/src/adapters/logger.ts` (homedir() usage pattern) |
| Package version source | `apps/node/package.json` (read via require as in cli/index.ts line 198) |
| Install script structure and main() | `sites/landing/public/install.sh` |

## Deterministic Versus Judgment

Everything in this task is deterministic except the 1-2 line docs support note on
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
  if multiple triggers would otherwise qualify.
- All errors in the hint module are silently swallowed. Never throw. Never crash the CLI.
- State dir `~/.clawperator/` is created with `mkdirSync(..., { recursive: true })` if
  missing, with errors swallowed. Do not assume the directory pre-exists.
- Hint is always printed after the primary command result has been written to stdout.
  All hint calls in main() must come after `console.log(result)`.
- In install.sh: TTY check is `[ -t 2 ]` (stderr). Suppression check is
  `[ -n "${CLAWPERATOR_DISABLE_STAR_SUGGESTIONS:-}" ]`.

Judgment (minimal):

- Exact wording of the 1-2 line support note, adapted per surface. See Decision Rules.

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

**Trigger hook locations - all in `apps/node/src/cli/index.ts`:**

| Location | Triggers to call | Condition |
| --- | --- | --- |
| After `console.log(pkg.version)` in `--version` path, before `process.exit(0)` | `upgrade` | always (version state checked inside module) |
| After `console.log(result)` in command success path | `doctor`, `skill`, `upgrade` | see per-trigger conditions below; only if no usageParseError and handler did not throw |

Do NOT add a hint call in the `--help` path. Help output is exploratory and not a
value moment.

**Per-trigger condition in the command path (after `console.log(result)`):**

Doctor trigger fires when:
- `cmd === 'doctor'`
- `(process.exitCode ?? 0) === 0`
  (cmdDoctor sets `process.exitCode` before returning; 0 means success)

Skill trigger fires when:
- `cmd === 'skills'` and `rest[0] === 'run'`
- the result JSON does not contain a top-level `code` field
  (success envelopes have `skillId`, `output`, `exitCode`, `durationMs`;
  error envelopes have `code`, `message`)
- detect this with: `try { const p = JSON.parse(result ?? '{}'); if (!p.code) ... } catch { }`

Upgrade trigger fires when:
- no usageParseError, handler did not throw
- version state checked inside the module

**Ordering within the command path block:**

Call doctor trigger first, then skill trigger, then upgrade trigger. The module-level
`shown` guard ensures only one fires per invocation. Calling doctor/skill before
upgrade gives feature-specific triggers priority over the generic upgrade trigger on
the first invocation.

**Note on `--version` early-exit path:**

The `--version` path calls `process.exit(0)` before `getGlobalOpts` finishes. The
hint module must not depend on parsed opts - it reads `process.argv` and `process.env`
directly. The `--disable-star-suggestions` check inside the module covers suppression.

Because `maybeShowStarHint` is async, the implementer must `await` it before
`process.exit(0)` so the write completes. A `.then()` or unawaited call will be cut
off by the exit.

**Surface-appropriate docs wording:**

Do not use identical wording on all three surfaces. Adapt per context:

- `sites/landing/public/index.md` (community-facing landing): softer, welcoming tone.
  Example: "Clawperator is open source and community-supported. If it's useful to you,
  [star it on GitHub](https://github.com/clawpilled/clawperator) - it helps others
  discover it."

- `README.md` (developer/contributor entry point): direct "support the project" framing.
  Example: "If Clawperator is useful to your project, consider
  [starring the repo on GitHub](https://github.com/clawpilled/clawperator)."

- `docs/index.md` (technical navigation page): minimal - one line, no emphasis.
  Example: "Clawperator is [open source](https://github.com/clawpilled/clawperator)."
  or simply append the repo link with a brief label.

Keep each note to 1-2 lines. No section headers. Append near the bottom of each file.

## Failure Modes To Prevent

- Hint text appearing before primary command output on stdout - all hint calls in main()
  must come after `console.log(result)`, never inside command handler functions
- Hint text appearing in stdout, JSON output, HTTP API responses, or SSE streams -
  use only `process.stderr.write`
- Hint firing on command failure or usage error - check per-trigger conditions strictly
- Hint firing in non-TTY contexts (piped output, CI, agent runner) - always check TTY
- State write error crashing the CLI - wrap all state I/O in try/catch, swallow errors
- Hint firing twice in one invocation - enforce module-level `shown` guard
- Any subprocess, shell-out, library call, or HTTP request targeting GitHub - forbidden
  absolutely; the only GitHub-related content is the static string in HINT_TEXT
- `--disable-star-suggestions` causing "unrecognized flag" error - must be in
  `FLAG_VALUE_ARITY` and the `globalFlags` list in `cli/index.ts`
- Upgrade hint firing on every startup instead of once per version - state guard on
  `lastUpgradeHintVersion`
- `await maybeShowStarHint(...)` missing before `process.exit(0)` in the `--version`
  path - the write is async; fire-and-forget will be cut off
- State write failing silently on fresh installs because `~/.clawperator/` does not
  yet exist - use `mkdirSync(..., { recursive: true })` before writing

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
- Is safe to call from `main()` without wrapping in try/catch

## Idempotency

- Running the same trigger twice in separate invocations: fires only on the first
  (state guard).
- Running `--version` twice after version upgrade: fires only on the first invocation
  (state guard updates `lastUpgradeHintVersion` on first show).
- Running multiple triggers in one invocation: fires at most once (module-level `shown`
  guard).
- State file missing or unreadable: treat as empty state, show hint, attempt write.
- State dir missing: create it silently, then write.

## Durable Follow-Up

None. This task is self-contained. The 3 docs additions are the permanent record.
No task folder content needs migration after cleanup.
