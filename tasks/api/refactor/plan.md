# API Refactor Plan

## Contents

- [Before and After](#before-and-after)
- [Design Decisions](#design-decisions)
- [Implementation Context](#implementation-context)
- [Implementation Discipline](#implementation-discipline)
- [Phase 0: Infrastructure and Compatibility](#phase-0-infrastructure-and-compatibility)
- [Phase 1: CLI Architecture (COMMANDS Registry)](#phase-1-cli-architecture-commands-registry)
- [Phase 2: Command Surface Refactor](#phase-2-command-surface-refactor)
- [Phase 3: Selector Flags (done)](#phase-3-selector-flags)
- [Phase 4: Help, Errors, and Polish](#phase-4-help-errors-and-polish)
- [Phase 5: Extended Commands](#phase-5-extended-commands)
- [Skills Migration Strategy](#skills-migration-strategy)
- [Sequencing](#sequencing)
- [What Success Looks Like](#what-success-looks-like)
- [Detailed Design Specs](#detailed-design-specs)
- [Items Rejected](#items-rejected)
- [Branch progress and deviations (additive)](#branch-progress-and-deviations-additive)

---

Origin: Agent UX review session (2026-03-23). An independent agent was given the
current API docs cold and asked to propose the ideal command surface. The feedback
confirmed that the `action`/`observe` namespace nesting, JSON-only selectors, and
verbose flag names are systematic first-contact failures. This plan implements the
fixes across six phases.

Reviewed 2026-03-23 by a second independent agent. Required changes incorporated.
Reviewed 2026-03-23 by a third independent agent against actual source code.
Reviewed 2026-03-23 (review 5, review 6). logs --follow scope contradiction resolved.
Required changes incorporated.

Primary inputs:
- External agent UX review (full transcript in session context)
- Original PRD-5.9 flatten proposal (superseded by this plan; deleted with
  `tasks/node/agent-usage/`)
- `docs/node-api-for-agents.md` (current API contract)
- `apps/node/src/cli/` (current CLI dispatch)

Predecessor work (all merged):
- PRD-1 through PRD-5.5 in `tasks/node/agent-usage/` (readiness gate, error
  context, dry-run validation, progress visibility, persistent logging, skill
  progress convention). These are complete and carry forward.

Related work (deferred until API stabilizes):
- PRD-6 and PRD-7 from `tasks/node/agent-usage/` are moved to
  `tasks/docs/refactor/`. Docs will be written against the new API surface, not
  the old one.

---

## Before and After

### Commands

```
BEFORE (current)                                       AFTER (target)
---------------------------------------------          -----------------------------------
clawperator observe snapshot                           clawperator snapshot
clawperator observe screenshot                         clawperator screenshot
clawperator action click --selector '{"textEquals":"X"}'     clawperator click --text "X"
clawperator action open-app --app com.foo.bar                clawperator open com.foo.bar
clawperator action open-uri --uri https://example.com        clawperator open https://example.com
clawperator action type --selector '{"textEquals":"X"}'      clawperator type "hello" --text "X"
  --text "hello"
clawperator action read --selector '{"textEquals":"X"}'      clawperator read --text "X"
clawperator action wait --selector '{"textEquals":"X"}'      clawperator wait --text "X"
clawperator action press-key --key back                clawperator press back
(no CLI command)                                       clawperator scroll down
(no CLI command)                                       clawperator back
clawperator inspect ui                                 (removed, use snapshot)

Phase 5 (extended commands):
clawperator execute --execution '{"actions":          clawperator scroll-until --text "X"
  [{"type":"scroll_until","params":                   clawperator scroll-until --text "X" --click
  {"matcher":{"textEquals":"X"}}}]}'
(no CLI flag)                                         clawperator click --text "X" --long
(no CLI flag)                                         clawperator click --text "X" --focus
(fixed 30s timeout)                                   clawperator wait --text "X" --timeout 5000
(no CLI command)                                      clawperator close com.android.settings
clawperator execute --execution <json>                clawperator exec <json-or-file>
clawperator read --selector '{"textEquals":"X"}'      clawperator read --text "X" --all --json
(no CLI command)                                      clawperator sleep 2000
(no CLI command)                                      clawperator wait-for-nav --app com.foo --timeout 5000
(no CLI command)                                      clawperator read-value --label "Battery" --json
```

### Flags

```
BEFORE (current)              AFTER (canonical)         AFTER (still accepted)
----------------------------  ------------------------  ----------------------
--device-id <id>              --device <id>             --device-id
--output json                 --json                    --output json
--timeout-ms <ms>             --timeout <ms>            --timeout-ms
--operator-package <pkg>      --operator-package <pkg>  --operator-package
--selector '{"textEquals":"X"}'          --text "X"             --selector (advanced)
--selector '{"resourceId":              --id "com.foo:id/bar"  --selector (advanced)
  "com.foo:id/bar"}'
--selector '{"contentDescEquals":       --desc "Submit"        --selector (advanced)
  "Submit"}'
```

### Synonyms (accepted but not documented)

```
PRIMARY (in docs/help)   SYNONYM (accepted silently)
-----------------------  --------------------------
click                    tap
type                     fill
press                    press-key
open                     open-uri, open-url
wait-for-nav             wait-for-navigation
read-value               read-kv
```

### HTTP API Routes

```
BEFORE                       AFTER
---------------------------  ---------------------------
POST /observe/snapshot       POST /snapshot
POST /observe/screenshot     POST /screenshot
POST /execute                POST /execute  (unchanged)
GET  /devices                GET  /devices  (unchanged)
```

---

## Design Decisions

These are settled. Implementing agents should not re-litigate them.

### Flat commands are canonical, not aliases

`snapshot`, `click`, `open`, `type`, `read`, `wait`, `press`, `screenshot`,
`scroll` are the primary command names. There is no `action` or `observe` parent
command. The old nested forms produce a "did you mean?" error pointing to the
flat form.

### Namespace rule

Flat commands are canonical for device interaction verbs. Namespaces are only
allowed for subsystems with shared lifecycle or state: `skills`, `emulator`,
`recording`. Do not introduce `ui`, `app`, or `device` namespaces. The external
review proposed these; we reject them because they reintroduce the same
discoverability tax that `action` created.

### Primary names vs synonyms

Every command has one primary name used in docs, help text, and examples.
Synonyms are accepted by the parser but are not featured in documentation.

| Primary (documented) | Synonym (accepted) |
|---|---|
| `click` | `tap` |
| `type` | `fill` |
| `press` | `press-key` |
| `open` | `open-uri`, `open-url` |
| `close` | `close-app` |
| `exec` | `execute` |
| `recording` | `record` |

Implementation: both names call the same handler. Help text shows only the
primary name. `--help` on the synonym shows the same output as the primary.

**Behavioral alias (not a pure synonym):** `scroll-and-click` is an accepted
command alias for `scroll-until --click`. Unlike the synonyms above, it
implies behavior (`--click` is set automatically). It is documented only in
the `scroll-until` detailed spec, not in help text or the synonym table.

### Flag shorthands use short, familiar names

`--device` not `--device-id`. `--json` not `--output json`. `--timeout` not
`--timeout-ms`. Old flag names continue to work (parsed silently) but are not
shown in help text.

**`--operator-package` replaces `--operator-package`.** "Receiver" is an Android
implementation detail (BroadcastReceiver) that means nothing to agents. "Operator"
is Clawperator's own term - it is what `operator setup` installs, what docs
reference, what agents will encounter. `--operator-package` is unambiguous and
self-documenting. `--operator-package` is accepted as a silent alias.
`--package` was considered but dropped: it is too generic and risks colliding
with future flags or confusing agents who assume it means something else.
This flag is rarely needed (only for dev/release variant switching).

**Scope of the rename:** The CLI/API surface changes to `--operator-package`.
Internally, existing TypeScript field names (`operatorPackage` in `GlobalOpts`,
command handlers, `serve.ts` request bodies) may remain `operatorPackage`
temporarily to minimize churn. The internal rename is optional and should only be
done if it does not expand scope.

### `--selector` JSON becomes the escape hatch, not the default

Simple selector flags (`--text`, `--id`, `--desc`, `--role`) are first-class.
`--selector '<json>'` remains for complex matchers. This is the single
highest-value ergonomic change.

### Unified `open` command

`open` is a single command that interprets its target:
- `http://` or `https://` -> open as URL
- Any other `*://` scheme -> open as URI
- Otherwise -> open as Android package name

No separate `open-uri` or `open-url` commands are documented. They may exist as
internal synonyms but are not in help text or docs.

### Selector resolution rules

These are deterministic and non-negotiable:
1. Multiple simple flags (`--text`, `--id`, `--role`, etc.) combine with AND
2. `--selector` is mutually exclusive with simple flags (error if combined)
3. Container flags (`--container-*`) scope element search independently
4. If multiple elements match, the first in accessibility traversal order is
   selected
5. Missing all selectors on a command that requires one: error with flag list
   and example
6. Empty string values: rejected at validation boundary

### `read` output contract

- Default: returns the text content of the first matching node
- `--json` mode: returns structured result with the text value
- `--all` flag returns all matches as a JSON array (Phase 5, requires `--json`)

---

## Implementation Context

The CLI uses **hand-rolled argument parsing** - there is no external CLI
framework (no Yargs, Commander, or similar). All infrastructure described below
must be built from scratch in `apps/node/src/cli/index.ts`.

Key functions the implementing agent must understand before starting (line
numbers are approximate - search by function name, not line number, as other
merges may shift offsets):

- `getGlobalOpts(argv)`: manually iterates argv, extracts `--device-id`,
  `--operator-package` (renamed to `--operator-package`),
  `--output`/`--format`, `--timeout-ms`, `--log-level`, `--verbose`.
  Everything else goes into `rest[]`.
- `getOpt(rest, flag)`: simple `rest.indexOf(flag)` lookup.
- `hasFlag(rest, flag)`: boolean `rest.includes(flag)`.
- `resolveHelpTopic(rest)`: maps command paths like `["observe", "snapshot"]`
  to `HELP_TOPICS` keys. Must be updated when commands are renamed or promoted.
- `HELP` constant: hardcoded template literal near top of file.
- `HELP_TOPICS` record: hardcoded per-command help strings, follows `HELP`.
- Command dispatch: giant `switch (cmd)` in `main()`.
- Exit code logic: at the end of `main()`, parses JSON result to determine
  exit code. Currently, USAGE errors from switch cases produce exit code 0
  in most paths.
- **Early intercepts in `main()`**: before global opts parsing and the switch,
  `main()` handles three special cases: empty argv (prints HELP, exits 0),
  `argv[0] === "help"` (prints HELP, exits 0), and `--version` (prints
  version, exits 0). These are not part of the switch and should remain as
  early intercepts in Phase 1 - do not move them into the registry. They
  execute before `getGlobalOpts()` runs and are intentionally outside the
  normal dispatch path.

Consequences for this refactor:

- **Flag aliases** require modifying `getGlobalOpts` to check both old and new
  names (e.g. `argv[i] === "--device-id" || argv[i] === "--device"`). There is
  no alias table mechanism - each alias is a manual `||` check.
- **`--json` as a global flag** requires a new branch in `getGlobalOpts` that
  sets `output = "json"` when `--json` is encountered, alongside the existing
  `--output`/`--format` parsing.
- **Positional arguments** require manual extraction from the `rest[]` array.
  The pattern is: check if `rest[0]` exists and does not start with `--`, then
  treat it as the positional value. This must be written for each command that
  accepts positional args.
- **"Did you mean?" errors** go in the `default:` case of the switch statement
  (currently index.ts:887) and in specific removed-command cases (e.g. a new
  `case "action":` that produces the redirect error). Fuzzy matching must be
  implemented manually or via a small utility (e.g. Levenshtein distance).
- **Help text** is static strings, not generated. Every promoted command needs
  a new `HELP_TOPICS` entry, and `resolveHelpTopic` must map its name to that
  entry.
- **Exit codes** for new error types ("did you mean?", missing selector, etc.)
  must produce exit code 1. The current `default:` path exits 0 for unknown
  commands. The implementing agent should ensure all error JSON includes a
  `code` field so the exit-code logic at index.ts:903-908 catches it.

### CLI command synonyms vs execution action type aliases

`contracts/aliases.ts` defines action type aliases for the **execution payload**
(e.g., `tap` -> `click`, `press` -> `click` at the payload level). These are
payload normalization used by `normalizeActionType()` and `validateExecution()`.

CLI command synonyms (e.g., the `tap` command routing to the `click` handler)
are **dispatch-level routing** in index.ts. These are different layers.

Do not modify `contracts/aliases.ts` as part of this refactor. CLI synonyms are
implemented by adding additional `case` branches in the switch statement (e.g.
`case "tap": case "click": { ... }`). The execution payload alias table is
unchanged.

### Commands unchanged by this refactor

The following commands' behavior is unchanged by this refactor:

- `devices`, `doctor`, `version`, `packages list`
- `grant-device-permissions` (behavior unchanged; may appear in updated help
  text grouping in Phase 4, but its command contract is not being refactored)
- `operator setup` / `operator install`
- `skills *`, `emulator *`, `provision` (top-level alias for
  `emulator provision`), `recording` / `record`
- `serve` remains the same CLI entrypoint. Only the HTTP route paths exposed
  by `serve.ts` change (in Phase 4)
- `execute` behavior is unchanged through Phases 0-4. In Phase 5, the
  command is renamed to `exec` with `execute` retained as a synonym.
  `--execution` is renamed to `--payload` with `--execution` as a silent
  alias. Phase 4 help text intentionally still shows `execute`.

---

## Implementation Discipline

These rules apply to every phase. They are not optional.

### Commit early, commit often

Create a commit at every natural breakpoint - one coherent sub-task, one
verified behavior change, one passing test suite. Do not batch an entire phase
into a single commit. Use conventional commit format (`feat:`, `fix:`,
`refactor:`, `chore:`). Prefer incremental commits over amending.

A natural breakpoint is: "the flag aliases work and tests pass" or "the `click`
command is promoted and smoke test passes" or "the selector shorthands are
wired and unit tests are green." Each of these is a commit.

### Build before test, always

The CLI tests spawn `dist/cli/index.js` as a subprocess. If you run `npm run
test` without `npm run build` first, the tests exercise stale compiled output.
The loop is:

```
npm --prefix apps/node run build && npm --prefix apps/node run test
```

Do this every time. Do not skip the build step.

### Phase 1 starter checklist

If you are beginning implementation from scratch, follow this order:

1. Read the current `index.ts` dispatcher and identify the special cases that
   do not behave like normal stdout-returning commands.
2. Implement the registry as `Promise<string | void>`, not `Promise<string>`,
   so `serve` can remain a long-running command without a fake wrapper.
3. Keep the early intercepts (`help`, empty argv, `--version`) outside the
   registry. They are not ordinary commands.
4. Run `npm --prefix apps/node run build && npm --prefix apps/node run test`
   after each meaningful registry chunk.
5. Run `./scripts/clawperator_smoke_core.sh` after the promoted command set
   changes, and verify on a connected device or emulator with `clawperator
   devices` plus a small manual command sequence.
6. Use the branch-local CLI build (`node apps/node/dist/cli/index.js ...`).
   Do not use the global `clawperator` binary.
7. If you touch docs later in the refactor, run the docs build and validation
   steps only when the docs phase begins. Do not force docs validation into
   Phase 1 unless the docs files changed.

### Test on a real device or emulator after every phase

Unit tests prove the CLI parses arguments correctly. They do not prove the
command works on an Android device. After completing each phase:

1. Connect to a device or start an emulator: `clawperator devices`
2. Run the promoted commands against the device:
   ```
   clawperator snapshot --json --device <id>
   clawperator open com.android.settings --device <id>
   clawperator click --text "Wi-Fi" --device <id>
   clawperator press back --device <id>
   ```
3. Run the core smoke script: `./scripts/clawperator_smoke_core.sh`

If a command works in unit tests but fails on a device, the command is broken.
Fix it before moving on.

Prefer the debug Operator APK (`--operator-package com.clawperator.operator.dev`) for
local testing. See CLAUDE.md "Device Selection" for full guidance.

### Verify skills continuously, not at the end

Three skills must remain working throughout the refactor:
- `com.android.settings.capture-overview`
- `com.google.android.apps.chromecast.app.set-climate`
- `com.solaxcloud.starter.get-battery`

After each phase, run at least the Android Settings skill on a connected device:

```
clawperator skills run com.android.settings.capture-overview --device <id> --json
```

If the skill breaks because it uses old command forms internally, update the
skill immediately - do not defer it. A broken skill is a signal that the
refactor missed something or that the migration path has a gap.

The skills live in the sibling repo `../clawperator-skills`. Changes there
should be committed and tested alongside the CLI changes. Do not leave skill
fixes for "later."

### Use the branch-local build, not the global install

When testing CLI changes, always use the branch-local build:

```
node apps/node/dist/cli/index.js <command>
```

Or link it locally. Do not use the globally installed `clawperator` binary,
which may lag behind the branch and silently hide new or renamed commands.

### All CLI error paths must return structured JSON

Every error the CLI produces must be a JSON object with a `code` field, output
via `console.log()`. No raw `console.error()` + `process.exit(1)` paths are
allowed for agent-facing commands.

The exit code logic (index.ts:903-908) parses the JSON output to determine the
exit code. If an error bypasses the JSON envelope, the exit code contract
breaks and agent loops that depend on structured output will fail silently.

The codebase already has mixed patterns (e.g. `serve.ts:33-34` does raw
`console.error` + `process.exit(1)`). New error paths added by this refactor
(missing selector, missing argument, "did you mean?", unknown flag) must all
produce structured JSON:

```json
{"code": "MISSING_SELECTOR", "message": "click requires a selector.", ...}
{"code": "UNKNOWN_COMMAND", "message": "Unknown command \"action\".", ...}
```

This is enforcement of the existing contract, not a design change.

---

## Phase 0: Infrastructure and Compatibility [DONE]

Landed in PR `api-refactor/phase-0-1` (2026-03-23). Collapsed into Phase 1 per scope note.

Establish the foundation that makes Phases 1-4 safe.

### Deliverables

1. **"Did you mean?" error system**
   - When an unknown command is entered, suggest the closest known command
   - Fuzzy matching (Levenshtein) runs against all primary names and synonyms
     in the COMMANDS registry. Tie-breaking: closest distance first, then
     primary name over synonym, then alphabetical.
   - Specific redirect hints for removed nested forms (`action click` -> `click`,
     `observe snapshot` -> `snapshot`, etc.) and typos (`screensht` ->
     `screenshot`) become accurate only after Phase 2 adds the flat commands
     to the registry. In Phase 0/1 those flat names do not exist yet, so fuzzy
     match cannot suggest them.

2. **Flag alias infrastructure**
   - Parser accepts both old and new flag names
   - Old flags are not in help text but still work
   - Mapping table:
     - `--device-id` -> `--device`
     - `--output json` -> `--json`
     - `--format json` -> `--json` (existing alias in `getGlobalOpts`, tested
       in `cliHelp.test.ts` - must be preserved)
     - `--timeout-ms` -> `--timeout`
     - `--operator-package` -> `--operator-package` (rename)
     - `--package` -> not aliased (too generic; dropped after review)
   - Centralized in `getGlobalOpts()` so all commands automatically inherit
     the renamed global flags

3. **Regression test coverage in the existing test suite**
   - Extend the existing subprocess-based tests in `apps/node/src/test/unit/`
   - Add explicit coverage for removed commands (verify "did you mean?" errors),
     renamed flags (verify old names still parse), and any flat commands
     introduced in the same PR
   - Do not introduce a separate parallel test harness - the existing tests are
     the harness

### Risk

Low. Infrastructure only. No behavior changes visible to current callers.

### Scope note

Phase 0 is deliberately thin. Its purpose is to make Phase 1 safe, not to be a
standalone deliverable. If the implementing agent finds Phase 0 and Phase 1
naturally collapse into one PR, that is acceptable - and likely preferable.
**If Phase 0 and Phase 1 land together, do not implement a temporary hardcoded
command suggestion map first. Build "did you mean?" directly against the
Phase 1 registry.** Building the hardcoded version in Phase 0 only to replace
it in Phase 1 is wasted work if both land together. The separation exists for
planning clarity, not as a hard PR boundary. The flag alias infrastructure
from Phase 0 survives into Phase 1 unchanged.

---

## Phase 1: CLI Architecture (COMMANDS Registry) [DONE]

Landed in PR `api-refactor/phase-0-1` (2026-03-23). Collapsed with Phase 0 per scope note.
- `apps/node/src/cli/registry.ts` created (1108 lines): `CommandDef`, `HandlerContext`, `COMMANDS` (17 entries), `didYouMean`, `generateTopLevelHelp`, `resolveHelpFromRegistry`, all CLI utilities.
- `apps/node/src/cli/index.ts` reduced from ~915 to ~130 lines.
- `apps/node/src/test/unit/cliRegistry.test.ts` added: registry consistency + flag alias tests.
- 442 tests pass.
- **Intentional behavior change:** unknown commands now return `code: "UNKNOWN_COMMAND"` and exit 1. The old switch `default:` returned `code: "USAGE"` and exited 0. The new behavior is correct and desirable (unknown command is a caller error), and is covered by the `cliRegistry.test.ts` UNKNOWN_COMMAND assertions.

Replace the hand-rolled dispatch sprawl in `index.ts` with a typed command
registry that serves as the single source of truth for command metadata. This
is code health investment that pays off immediately: every subsequent phase
adds commands by adding registry entries, not by touching 3-4 unrelated
locations.

### Why this phase exists

Today, `index.ts` has three surfaces that must stay in sync manually:

1. **The switch statement** (index.ts:481-888, ~400 lines): dispatches commands
   to handlers. Synonyms are duplicated `case` branches.
2. **HELP / HELP_TOPICS** (index.ts:9-330): static strings that must match the
   dispatch surface exactly. Adding a command means editing both.
3. **"Did you mean?" / resolveHelpTopic**: hardcoded mappings that must know
   every command name and synonym.

After Phase 0 adds flag aliases and "did you mean?" infrastructure, and before
Phase 2 adds ~10 new commands, this phase consolidates all three surfaces into
a single registry. Without this, the implementing agent will expand the switch
statement to ~500+ lines, expand HELP_TOPICS proportionally, and create a
larger version of the same maintenance trap.

This is the "40% on code health" investment described in the Yegge blog post.
The alternative - adding commands to the existing sprawl - technically works
but leaves the codebase harder to maintain after the refactor than before it.

### Deliverables

1. **Define a `CommandDef` type and `COMMANDS` registry**

   ```typescript
   interface CommandDef {
     /** Primary name (used in docs, help, dispatch). */
     name: string;
     /** Synonyms accepted silently (not in help text). */
     synonyms?: string[];
     /** One-line description for top-level --help listing. */
     summary: string;
     /** Full help text shown by `<command> --help`. */
     help: string;
     /** Positional argument spec, if any. */
     positional?: { name: string; required: boolean; description: string };
     /** Metadata for error/help generation only; does not parse or validate selectors. */
     requiresSelector?: boolean;
     /** Help group for --help display (e.g. "Device Interaction", "Device Management"). */
     group: string;
     /** The handler function. See HandlerContext below. */
     handler: (ctx: HandlerContext) => Promise<string | void>;
   }

   const COMMANDS: Record<string, CommandDef> = { ... };
   ```

   `serve` is the only current command that may return `void`. It is a
   long-running command that starts the HTTP server and then keeps the process
   alive. Every other registry handler should return a string result that the
   dispatcher prints to stdout.

   The registry is the canonical source for:
   - Dispatch: loop over COMMANDS keys + synonyms instead of a switch
   - Help generation: `--help` output is built from registry entries, not
     a static string
   - Synonym resolution: derived from `synonyms` fields
   - "Did you mean?": fuzzy match against all registry keys + synonyms
   - Missing selector errors: derived from `requiresSelector` flag

   The exact interface shape is a suggestion. The implementing agent may
   adjust field names or add fields as needed. The constraint is: **one
   definition per command, everything else derived.**

   **Handler signature:** The current switch cases close over `rest` (the
   remaining argv after global opts), `outWithLogger` (format + logger),
   and `global` (parsed global flags including `deviceId`,
   `operatorPackage`). The handler signature must thread these through.
   The simplest correct approach:

   ```typescript
   type HandlerContext = {
     rest: string[];           // remaining argv after command name
     format: "json" | "pretty";
     verbose: boolean;
     logger: Logger;
     deviceId?: string;
     operatorPackage?: string;
     timeoutMs?: number;       // global --timeout value; used by execute,
                               // snapshot, screenshot, skills run
   };

   handler: (ctx: HandlerContext) => Promise<string | void>;
   ```

   `rest` stays as the raw string array. Each handler extracts what it
   needs via `getOpt(rest, ...)` and `hasFlag(rest, ...)`, exactly as
   today. Do not invent a parsed-args abstraction in this phase - that
   adds scope without reducing risk. Phase 2 can refine the handler
   contract when adding positional arg parsing.

   **Long-running command escape hatch:** The return type is
   `Promise<string | void>`. Most handlers return a string that the
   dispatcher prints to stdout. `serve` is the exception: `cmdServe`
   returns `Promise<void>` (parks the process via a never-resolving
   promise after starting the HTTP server). The dispatcher must check
   the return value - if `void`, skip the `console.log(result)` path.
   This matches the current special-case in `index.ts` where the
   `serve` branch returns early.

2. **Migrate existing commands onto the registry**

   Every command that currently lives in the switch statement gets a registry
   entry. This is a mechanical refactor - no behavior changes. The handlers
   are the same functions, just referenced from registry entries instead of
   case branches.

   Commands to migrate:
   - `operator` (with subcommand dispatch for `setup`/`install`)
   - `setup`, `install` (guidance redirects)
   - `devices`, `doctor`, `version`, `packages`
   - `emulator` (with subcommand dispatch)
   - `skills` (with subcommand dispatch)
   - `execute`
   - `recording` / `record`
   - `serve`
   - `observe` (existing, pre-promotion)
   - `action` (existing, pre-promotion)
   - `inspect` (existing, pre-promotion)
   - `grant-device-permissions`

   Namespaced commands (`operator`, `emulator`, `skills`) keep their
   subcommand dispatch internally. The registry routes to the top-level
   handler; subcommand routing stays inside the handler.

   For namespaced commands (`skills`, `emulator`, `operator`, `recording`),
   the registry entry owns only top-level command metadata. Subcommand
   dispatch and subcommand-specific help remain internal to the existing
   handler modules in this phase. Do not generalize the registry to a
   nested subcommand registry - that is unnecessary complexity for
   commands that already have working internal dispatch.

   **Concrete example - migrating `devices`:**

   Before (switch case in index.ts:521-523):
   ```typescript
   case "devices":
     result = await (await import("./commands/devices.js")).cmdDevices(outWithLogger);
     break;
   ```

   After (registry entry):
   ```typescript
   devices: {
     name: "devices",
     summary: "List connected devices",
     help: "List all connected Android devices.\n\nUsage:\n  clawperator devices [--json]",
     group: "Device Management",
     handler: async (ctx) => {
       return (await import("./commands/devices.js")).cmdDevices({
         format: ctx.format,
         verbose: ctx.verbose,
         logger: ctx.logger,
       });
     },
   },
   ```

   The handler is a thin wrapper that maps `HandlerContext` to the
   existing command function's expected arguments. No logic changes.

3. **Replace the switch statement with registry-driven dispatch**

   The ~400-line switch becomes approximately:

   ```typescript
   const def = COMMANDS[cmd] ??
     Object.values(COMMANDS).find(c => c.synonyms?.includes(cmd));

   if (def) {
     result = await def.handler(ctx);
   } else {
     result = didYouMean(cmd, COMMANDS);
   }
   ```

   This is the core structural win. Adding a command post-refactor means
   adding a registry entry and a handler function. No switch branch, no
   HELP_TOPICS entry, no resolveHelpTopic mapping.

   **`--help` routing:** Currently, `--help` is intercepted at
   index.ts:464-468 before the switch, using `resolveHelpTopic()` to map
   command paths to HELP_TOPICS keys. With the registry, this becomes:

   ```typescript
   if (argv.includes("--help")) {
     const def = COMMANDS[cmd] ??
       Object.values(COMMANDS).find(c => c.synonyms?.includes(cmd));
     console.log(def ? def.help : generateTopLevelHelp(COMMANDS));
     process.exit(0);
   }
   ```

   For namespaced commands (`operator setup --help`, `skills list --help`),
   the handler itself checks for `--help` in `rest` and returns its
   subcommand help text. The registry's `help` field covers the top-level
   help (e.g., `clawperator operator --help` lists subcommands), not
   individual subcommand help. This matches the current behavior where
   `resolveHelpTopic` maps `["operator", "setup"]` to a specific topic.

   **Exit code contract:** The `usageParseError` flag and the exit code
   logic at index.ts:899-908 live outside the switch and are unchanged by
   this refactor. The try/catch around dispatch catches `UsageError`, sets
   `usageParseError = true`, and produces JSON. The post-dispatch exit
   code logic parses the JSON result to set `process.exitCode`. Both of
   these wrap the registry dispatch the same way they wrapped the switch.
   Do not refactor the exit code logic in this phase.

4. **Replace static HELP/HELP_TOPICS with generated help text**

   Top-level `--help` is generated from registry entries grouped by the
   `group` field. Per-command `--help` uses the `help` field directly.
   `resolveHelpTopic()` is deleted - the registry replaces it.

   In Phase 1, generated help output must preserve the existing wording
   and test-visible structure closely enough that current help assertions
   pass unchanged. Help content redesign is deferred to Phase 4.

   The generated top-level help output should roughly match the target
   structure from Phase 4 (see Phase 4, deliverable 1 for the format).
   But the content at this point still reflects the pre-promotion command
   surface (old command names). Phase 2 will add the promoted commands to
   the registry.

5. **Derive "did you mean?" from the registry**

   Phase 0's "did you mean?" infrastructure should be updated to use the
   registry's command names and synonyms as its known-commands list, rather
   than a separate hardcoded list. The fuzzy matching logic itself (e.g.
   Levenshtein distance) stays the same.

6. **Tests: verify behavioral equivalence**

   Every existing CLI test must pass with zero changes to its assertions.
   This phase changes architecture, not behavior. If a test fails, the
   migration has a bug.

   Add a focused test that verifies `COMMANDS` entries are consistent:
   - Every synonym is unique across all commands
   - No primary command name appears as another command's synonym
   - No synonym collides with a primary command name or namespace name
   - Every command has a non-empty `summary` and `help`
   - Every command has a `group`
   - `handler` is a function

### File organization

The registry and types should live in a new file (e.g.
`apps/node/src/cli/commands.ts` or `apps/node/src/cli/registry.ts`).
Individual command handlers that are currently inline in the switch statement
should be extracted to `apps/node/src/cli/commands/` if they are not already
there. Keep `index.ts` as the entry point that wires the registry to argv
parsing and dispatch.

Do not over-engineer the file split. If a handler is 5 lines, it can stay
inline in the registry definition. Extract only when the handler is complex
enough to warrant its own file (most already have one in `commands/`).

### Behavioral preservation rule

Phase 1 is an architectural refactor only. For commands that exist before
Phase 1, stdout/stderr shape, JSON envelope shape, and exit-code behavior
must remain unchanged unless a failing test proves the old behavior was
already inconsistent. Do not "clean up" help wording, error messages, or
output formatting opportunistically. Those changes belong in Phase 4.

### Risk

Low. Pure refactor with no behavior changes. All existing tests serve as
regression coverage. The risk is scope creep - resist the urge to also
promote commands or add features in this phase. If a command works today,
it should work identically after this phase.

### Scope boundaries

In scope:
- COMMANDS registry type and data
- Switch statement replacement
- Help text generation from registry
- "Did you mean?" derivation from registry
- Extracting inline handlers to command files where they are complex

Out of scope:
- Promoting commands (Phase 2)
- Adding new commands like `scroll`, `back` (Phase 2)
- Selector flag parsing (Phase 3)
- Help text content rewrite to match the target format (Phase 4)
- HTTP API route changes (Phase 4)

---

## Phase 2: Command Surface Refactor [DONE]

Fix the top-level CLI shape so agents can guess commands correctly on first
attempt. With the COMMANDS registry from Phase 1 in place, this phase adds
new commands as registry entries with handler functions - no switch branches,
no manual HELP_TOPICS entries, no hardcoded synonym mappings.

Phase 2 has two logical layers. They can land in one PR but must be mentally
separable for review:

- **Layer A (command promotion):** promote flat commands, remove `action`/`observe`
  from registry, add promoted commands as new registry entries
- **Layer B (argument ergonomics):** positional arguments, flag normalization

### Deliverables

1. **Promote all `action` and `observe` subcommands to top level**

   | Old (removed) | New (primary) | Synonym (accepted) |
   |---|---|---|
   | `observe snapshot` | `snapshot` | - |
   | `observe screenshot` | `screenshot` | - |
   | `action click` | `click` | `tap` |
   | `action open-app` + `action open-uri` | `open` | `open-uri`, `open-url` |
   | `action type` | `type` | `fill` |
   | `action read` | `read` | - |
   | `action wait` | `wait` | - |
   | `action press-key` | `press` | `press-key` |
   | `inspect ui` | (removed, use `snapshot`) | - |

2. **Add convenience commands**
   - `back` is its own registry entry whose handler delegates to the same
     underlying key-press execution path as `press back`. It is a real
     command, not a parser special case.
   - `scroll <direction>` = top-level scroll command, also a registry entry.

   `scroll` spec (not deferred - this is a core primitive):
   ```
   clawperator scroll <down|up|left|right> [--device <id>] [--json]
   ```
   Phase 2 delivers direction-only scroll. Container-scoped scrolling
   (`--container-text`, `--container-id`, etc.) is deferred to Phase 3
   alongside the other selector flag work, since container flags use the same
   parsing infrastructure.

   If no CLI command currently wraps the scroll action, one must be added in
   this phase. The scroll action exists in the execution payload; the CLI
   wrapper translates positional direction into the correct payload.

3. **Unified `open` with smart target detection**
   ```
   clawperator open com.android.settings       # package
   clawperator open https://example.com         # URL
   clawperator open myapp://deep/link           # URI
   ```
   Detection: `https?://` -> URL, any `*://` -> URI, else package name.
   `--app` flag still works as explicit override for ambiguous cases.

   Implementation note: the unified `open` must route to two different existing
   builders: `buildOpenAppExecution()` (domain/actions/openApp.ts) for package
   names, and `buildOpenUriExecution()` (domain/actions/openUri.ts) for URLs and
   URIs. These produce different execution action types (`open_app` vs
   `open_uri`). The detection is unambiguous: package names never contain `://`.

   The existing `cmdActionOpenApp` and `cmdActionOpenUri` handlers in action.ts
   can be reused or inlined - they are thin wrappers around their builders.

   `open-uri` and `open-url` are accepted as top-level command spellings via
   the `synonyms` field on the `open` registry entry (same mechanism as
   `tap`/`click`). They are not shown in help text.

4. **Positional arguments where obvious**
   - `clawperator open com.android.settings` (positional target)
   - `clawperator press back` (positional key name)
   - `clawperator type "hello"` (positional text, selector via flags)
   - `clawperator scroll down` (positional direction)
   - Named flags (`--app`, `--key`, `--text`, `--direction`) still work
   - Positional and named flag for the same value: error with clear message
   - When promoting `type`, carry forward the existing `--submit` and `--clear`
     flags (currently on `action type`). Do not defer these to Phase 3.

5. **Normalize global flags**
   - `--device` (canonical), `--device-id` (accepted silently)
   - `--json` (canonical), `--output json` (accepted silently)
   - `--timeout` (canonical), `--timeout-ms` (accepted silently)
   - `--operator-package` (canonical), `--receiver-package` (accepted silently as legacy alias).
     `--package` was considered and deliberately dropped - see Design Decisions.

6. **Remove `action` and `observe` parent commands**
   - Removed from dispatch, removed from help text
   - Phase 0's "did you mean?" catches agents/scripts still using the old forms

### Failure-mode requirements (acceptance criteria)

These are not nice-to-haves. Each must be tested.

**Missing selector:**

In Phase 2, selector-required errors mention the currently supported input
(`--selector`). In Phase 3, the error expands to include the full selector
flag list (`--text`, `--id`, `--desc`, `--role`).

Phase 2 version:
```
$ clawperator click
Error: click requires a selector.

Usage:
  clawperator click --selector '{"textEquals":"Login"}'

See: clawperator click --help
```

Phase 3 version (after selector flags land):
```
$ clawperator click
Error: click requires a selector.

Use one of:
  --text <text>           Exact visible text
  --id <resource-id>      Android resource ID
  --desc <text>           Content description
  --role <role>           Element role

Example:
  clawperator click --text "Wi-Fi"
```

**Missing argument:**
```
$ clawperator open
Error: open requires a target.

Usage:
  clawperator open <package-id>       Open an Android app
  clawperator open <url>              Open a URL in browser
  clawperator open <uri>              Open a deep link

Examples:
  clawperator open com.android.settings
  clawperator open https://example.com
```

**Missing key:**
```
$ clawperator press
Error: press requires a key name.

Valid keys: back, home, recents

Example:
  clawperator press back
```

**Removed command:**
```
$ clawperator action click --text "Wi-Fi"
Error: Unknown command "action".

Did you mean:
  clawperator click --text "Wi-Fi"
```

7. **Update smoke scripts to use new command surface**
   - `clawperator_smoke_core.sh` uses old command forms (`action open-app`,
     `observe snapshot`, `--output json`, etc.). These will break when
     `action`/`observe` are removed. Update the script as part of this phase,
     not Phase 4.
   - `clawperator_smoke_skills.sh` - check and update if it uses old forms.
   - `clawperator_integration_canonical.sh` - check and update if applicable.
   - All scripts must pass after the update.

8. **Update existing tests to use new command surface**
   - Tests in `apps/node/src/test/unit/cliHelp.test.ts` match on old command
     strings (e.g. `assert.match(stdout, /clawperator observe snapshot/)`).
     Update all string matches to use new flat command names.
   - Do not build a separate regression harness - the existing tests ARE the
     harness. Update them.
   - Tests spawn `dist/cli/index.js` as a subprocess, so `npm run build` must
     run before `npm run test`.

### Carried-forward debt from Phase 0/1

These items were deferred during Phase 0/1 and must be addressed in Phase 2.
Search for `TODO(Phase 2)` in `apps/node/src/` to locate them in code.

1. **Dead-code `?? getOpt(rest, ...)` fallbacks in registry.ts** - Every handler
   passes `deviceId: deviceId ?? getOpt(rest, "--device-id")` as a safety net.
   Because `getGlobalOpts` scans all of argv linearly (including post-command
   tokens), the `getOpt` branch is unreachable under normal invocation. Once the
   Phase 2 argv handling audit confirms no bypass paths exist, remove the
   fallbacks. If a bypass path is found, document it instead.

2. **`getCommandArgs` redundancy in `skills run`** - The handler calls
   `getCommandArgs(argv, ["skills", "run"])` to get the raw pre-`--` segment.
   With the registry, `ctx.rest` is already post-`"skills run"`, making the
   full-argv traversal redundant. Simplify to derive `rawOptSegment` from
   `ctx.rest` directly once the argv audit confirms correctness.

3. **Exit-code heuristic in `index.ts`** - The
   `startsWith("{") && includes('"code"') && !includes('"envelope"')` check for
   setting exit code 1 is brittle. It holds today because all error payloads are
   bare `{ code, message }` and all success payloads carry `"envelope"`. If any
   new Phase 2 command returns a success shape without `"envelope"`, this will
   incorrectly set exit code 1. Audit all new handler return shapes against this
   heuristic before landing Phase 2.

### Risk

Low-medium. Breaking change to CLI surface, but zero external users and only
self-authored skills to migrate. Domain layer and execution payload schema are
unchanged. Phase 0 infrastructure catches regressions.

### Testing

- Every promoted command produces identical output to the old nested form
- Every removed command (`action ...`, `observe ...`, `inspect ui`) produces a
  "did you mean?" error naming the correct flat command
- Global flag aliases work on all commands
- Positional arguments work and are mutually exclusive with their named flag
- `open` correctly detects package vs URL vs URI targets
- All failure-mode requirements above produce the specified output
- All smoke scripts pass with new command forms
- All existing unit tests pass with updated command name assertions

---

## Phase 3: Selector Flags

**[DONE]** Shipped on branch `api-refactor/phase-3`. The working checklist
`tasks/api/refactor/phase-3-impl-plan.md` was removed when the phase closed for PR.

Replace JSON-heavy element targeting with simple, guessable flags.

### Deliverables

1. **Simple selector flags on all element-targeting commands**
   - Commands: `click`/`tap`, `type`/`fill`, `read`, `wait`
   - Flags:
     - `--text <exact>` - exact visible text match
     - `--text-contains <substring>` - partial text match
     - `--id <resource-id>` - Android resource ID
     - `--desc <exact>` - exact content description
     - `--desc-contains <substring>` - partial content description
     - `--role <role>` - element role (button, textfield, text, switch, checkbox,
       image, listitem, toolbar, tab)
     - `--selector <json>` - raw NodeMatcher JSON (advanced fallback)

2. **Container selector flags**
   - Same set with `--container-` prefix for scroll-within:
     - `--container-text`, `--container-text-contains`, `--container-id`,
       `--container-desc`, `--container-desc-contains`, `--container-role`,
       `--container-selector`
   - `scroll` only: `UiAction.Scroll` already accepts `container: NodeMatcher?`
     in the Android runtime.
   - "read-within" (container-scoped `read`) is NOT in Phase 3. `UiAction.ReadText`
     has no `container` field in the Android runtime. That requires an APK change
     and is scheduled as Phase 5C.

3. **Update Phase 2's "missing selector" error to show the full flag list**
   - Phase 2 introduced a missing-selector error that references `--selector`
     only. Now that `--text`, `--id`, `--desc`, `--role` exist, update the
     error text to show the full flag list (see Phase 2 failure-mode
     requirements, "Phase 3 version").

4. **Selector resolution (deterministic, tested)**
   - Multiple simple flags combine with AND semantics:
     `--text "Login" --role button` matches elements with both properties
   - `--selector` is mutually exclusive with simple flags: error if combined
   - Container flags resolve independently from element flags
   - First match in accessibility traversal order is selected
   - Missing all selectors: clear error listing available flags with examples
     (including `--text-contains`, `--desc-contains`, and `--selector` where applicable)
   - Empty string values: rejected at validation boundary
   - The same value flag token must not appear twice (for example two `--text`);
     rejected with `EXECUTION_VALIDATION_FAILED`

5. **Verify existing type flags survived Phase 2 promotion**
   - `--submit` and `--clear` already exist on `action type` (index.ts:667-668,
     action.ts:151-153). These should have been carried forward when `type` was
     promoted in Phase 2. Verify they work on the promoted command and that the
     help text documents them, including the `--clear` limitation note. If Phase
     2 missed them, add them now.

### Risk

Low. CLI-layer parsing only. The domain layer receives a `NodeMatcher` object
regardless of whether it was constructed from `--text`, `--selector`, or a
positional flag. No changes to the Android receiver or execution payload schema.

### NodeMatcher field mapping

CLI selector flags map to `NodeMatcher` fields (contracts/selectors.ts:4-11).
The field names do NOT match the flag names. Implementing agents must use this
mapping:

| CLI flag | NodeMatcher field |
|---|---|
| `--text <value>` | `textEquals` |
| `--text-contains <value>` | `textContains` |
| `--id <value>` | `resourceId` |
| `--desc <value>` | `contentDescEquals` |
| `--desc-contains <value>` | `contentDescContains` |
| `--role <value>` | `role` |

The same mapping applies to container flags with the `--container-` prefix,
populating a separate `NodeMatcher` object for the `container` param.

### Testing

- `--text "Login"` produces `{"textEquals":"Login"}` matcher
- `--id "com.foo:id/bar"` produces `{"resourceId":"com.foo:id/bar"}` matcher
- `--desc "Submit"` produces `{"contentDescEquals":"Submit"}` matcher
- `--text-contains "Log"` produces `{"textContains":"Log"}` matcher
- `--role button` produces `{"role":"button"}` matcher
- `--text "Login" --role button` combines to `{"textEquals":"Login","role":"button"}`
- `--text "Login" --selector '{...}'` errors clearly
- All missing: error with example showing `--text` usage
- `--text ""` errors (blank string rejected)
- Container flags resolve independently and populate a separate matcher object

---

## Phase 4: Help, Errors, and Polish

Finalize the developer and agent experience.

### Deliverables

1. **Rewrite help text**
   - Help generation is already registry-driven after Phase 1. This
     deliverable is about updating `summary` and `help` fields in registry
     entries and refining the `generateTopLevelHelp` grouping/formatting -
     not rebuilding help infrastructure.
   - **Global options flag order:** The Phase 0/1 global options block lists
     both old and new flag names (e.g. `--device-id <id>, --device <id>`).
     Phase 4 should flip this so the canonical new name leads and the legacy
     name appears in a parenthetical or is dropped from the banner entirely.
     This is a cosmetic change deferred here because it requires touching the
     same text as the broader help rewrite.
   - Top-level `--help` shows flat commands grouped by function
   - Target structure:
     ```
     Device Interaction:
       snapshot              Get the current UI tree
       screenshot            Capture the screen
       click                 Click/tap an element
       type                  Enter text into an element
       read                  Read text from an element
       wait                  Wait for an element to appear
       scroll                Scroll the current view
       open                  Open an app, URL, or deep link
       press                 Press a device key (back, home, recents)
       back                  Press the back key

     Device Management:
       devices               List connected devices
       doctor                Check system readiness
       emulator              Emulator lifecycle
       packages              List installed packages

     Execution:
       execute               Run a full execution payload
       skills                Skill operations
       serve                 Start HTTP API server

     Recording:
       recording, record     Session recording

     Setup:
       operator setup        Install Operator APK
       grant-device-permissions  Grant required permissions
       version               Show version info

     Global Options:
       --device <id>         Target device serial
       --operator-package <pkg>  Operator APK package
       --json                Machine-readable JSON output
       --timeout <ms>        Override command timeout

     Examples:
       clawperator snapshot --json
       clawperator open com.android.settings
       clawperator click --text "Wi-Fi"
       clawperator type "hello" --role textfield
       clawperator press back
       clawperator scroll down
     ```
   - Per-command `--help` shows selector flags, examples, and accepted synonyms
   - Examples in help text use the simplest form, not the JSON form
   - Synonyms noted at bottom of per-command help: "Also accepted as: tap"

2. **Error message improvements**
   - Wrong flag: suggest closest match (`--body` -> `--text`)
   - Missing selector: show full flag list with example (the Phase 3 version
     of the error from Phase 2's failure-mode requirements)
   - Missing device in multi-device setup: list connected devices with retry
     command showing `--device` flag
   - Validation error: include task-oriented hint, not just schema path
   - **Pretty vs JSON errors:** Several handlers return a pre-stringified JSON
     object on stdout (for example `makeMissingSelectorError` for
     `MISSING_SELECTOR`, and inline `JSON.stringify` for `MISSING_ARGUMENT` and
     similar). That output is logged as-is and does not go through
     `format` / `formatError`, so users in default (non-`--json`) / pretty mode
     still see a JSON line for those failures. Phase 4 error polish may unify
     this so structured errors respect output format the same way validation and
     execution errors already do, if desired.

3. **Update HTTP API routes (`serve`)**

   The HTTP API (serve.ts) must be updated to match the new CLI surface. The
   HTTP API is alpha/unstable with zero external consumers - there is no
   backward compatibility concern. An agent that learns `snapshot` from the CLI
   will try `POST /snapshot`, not `POST /observe/snapshot`. Consistency between
   CLI and HTTP surfaces prevents confusion.

   Route changes:
   - `POST /observe/snapshot` -> `POST /snapshot`
   - `POST /observe/screenshot` -> `POST /screenshot`

   Request and response body field names are unchanged in this refactor. Route
   paths change; body schemas do not. Specifically, HTTP request bodies that
   accept `operatorPackage` keep that field name even though the CLI flag is
   renamed to `--operator-package`. Body field renames are a separate concern
   that should not be bundled here.

   `POST /execute`, `GET /devices`, skill routes, and emulator routes are
   unchanged.

   Note: smoke scripts and integration tests were already updated in Phase 2
   (deliverable 7). Phase 4 should verify they still pass after help/error
   changes but the migration work is done.

### Risk

Low. UX polish with no behavioral changes. HTTP route renames are safe given
the alpha/unstable status and zero external consumers.

### Testing

- `clawperator --help` output matches target structure
- `clawperator click --help` shows selector flags and examples
- Wrong flag produces suggestion
- Missing selector produces example
- Multi-device without `--device` lists devices
- `POST /snapshot` and `POST /screenshot` work on the HTTP API
- All smoke scripts still pass

---

## Phase 5: Extended Commands

Implement the extended CLI surfaces that depend on Phase 3 selector
infrastructure and the Phase 1 registry. With the registry in place,
each of these is a registry entry + handler + tests.

Phase 5 is split into two sub-phases. **Phase 5A is required** - these
are core agent-facing commands that complete the CLI surface. **Phase 5B
is required but higher-risk** - these introduce new typed actions or
rename an existing command, so they need more careful validation.
Implement all of 5A before starting 5B.

### Phase 5A: Core extended commands

These are low-risk additions: new CLI wrappers around existing action
types, or single-flag additions to existing handlers. Each can land as
a separate commit.

1. **`scroll-until` command**

   ```
   clawperator scroll-until [<direction>] --text <text> [--click] [--json]
   ```

   - Positional: direction (default: `down`)
   - Selector flags: `--text`/`--id`/`--desc`/`--role` (from Phase 3)
   - Container flags: `--container-text`/`--container-id`/etc. (from Phase 3)
   - `--click`: click target after scrolling to it (action type becomes
     `scroll_and_click`, maps to `clickAfter: true`)
   - Without `--click`: action type is `scroll_until`
   - Tuning params (`maxScrolls`, `maxDurationMs`, `distanceRatio`, etc.)
     are NOT CLI flags - use `exec` for those
   - Synonym: `scroll-and-click` (accepted, implies `--click`)
   - See Detailed Design Specs section for full spec and error examples

2. **`close` command**

   ```
   clawperator close <package> [--json]
   ```

   - Positional: package name (required)
   - `--app` flag: alternative to positional
   - Synonym: `close-app`
   - Implementation: builds execution with `close_app` action type,
     uses existing `adb force-stop` pre-flight path in `runExecution.ts`
   - Runtime status (verified): `close_app` is already a first-class
     execution action. It is in `validateExecution.ts` supportedTypes,
     has applicationId validation, has pre-flight execution via
     `runCloseAppPreflight()`, and has result normalization via
     `finalizeSuccessfulCloseAppSteps()`. Phase 5 only needs the CLI
     wrapper and execution builder.

3. **`--long` and `--focus` flags on `click`**

   ```
   clawperator click --text "Settings" --long
   clawperator click --text "Search" --focus
   ```

   - `--long` maps to `clickType: "long_click"`
   - `--focus` maps to `clickType: "focus"`
   - Mutually exclusive (error if both)
   - **buildClickExecution signature change:** `buildClickExecution()` in
     `domain/actions/click.ts` currently takes only a `NodeMatcher`
     parameter. This deliverable requires adding an optional `clickType`
     parameter to this builder.

4. **`wait --timeout` semantic**

   ```
   clawperator wait --text "Loading" --timeout 5000
   ```

   - For `wait`, `--timeout` sets wait duration (not execution timeout)
   - Execution timeout set to `max(waitTimeout + 5000, globalTimeout)`
   - Default without `--timeout`: current 30s behavior
   - **Android implementation required:** Add `timeoutMs: Long?` to `UiAction.WaitForNode`,
     update parser and engine to respect action-level timeout

5. **`read --all` flag**

   ```
   clawperator read --text "Price" --all --json
   ```

   - `--all` returns all matches as JSON array of strings (text content
     of each matching node), e.g. `["$4.99", "$7.99"]`. Structured
     match objects with node metadata are not in scope - agents that
     need that should use `snapshot --json` and filter.
   - `--all` requires `--json` (error without it)
   - Without `--all`: unchanged single-match behavior
   - **Android implementation required:** Add `all: Boolean` to `UiAction.ReadText`,
     update parser, engine, and TaskUiScope to query and return all matching nodes

6. **`sleep` command**

   ```
   clawperator sleep <ms> [--json]
   ```

   - Positional: duration in milliseconds (required)
   - Validation: `durationMs >= 0`, capped at `MAX_EXECUTION_TIMEOUT_MS`
   - No selector flags - this is a raw timer
   - Builds execution with single `sleep` action, `params.durationMs` set
   - See Detailed Design Specs section for full spec

### Phase 5B: Higher-risk extended commands

These are higher-risk because they either rename an existing command
(`exec`) or introduce new typed actions that require contract changes
(`wait-for-nav`, `read-value`). Implement these only after all Phase 5A
deliverables have landed and tests pass.

**Precondition: typed contract alignment.** Before implementing
`wait-for-nav` and `read-value`, update `contracts/execution.ts` so
`ActionParams` includes all fields already accepted by the runtime
validation schema: `expectedPackage`, `expectedNode`, `timeoutMs`
(action-level), and `labelMatcher`. Do not cast around the type system.
This is a prerequisite, not optional cleanup.

7. **`exec` rename**

   ```
   clawperator exec <json-or-file> [--validate-only] [--dry-run] [--json]
   ```

   - `exec` becomes primary, `execute` becomes synonym
   - `--payload` becomes primary flag, `--execution` becomes alias
   - Positional: execution payload (JSON string or file path)
   - Parsing rule: trim leading whitespace, then if the value starts
     with `{` or `[`, parse as inline JSON. Otherwise treat as a file
     path and load the file contents. Error precedence: unreadable
     file path -> invalid JSON content -> missing payload.
   - `exec best-effort` subcommand unchanged
   - Behavior identical to current `execute`

8. **`wait-for-nav` command**

   ```
   clawperator wait-for-nav --app <package> --timeout <ms> [--json]
   clawperator wait-for-nav --text <text> --timeout <ms> [--json]
   ```

   - `--app`: maps to `expectedPackage` (wait until app is in foreground)
   - Selector flags: maps to `expectedNode` (wait until element appears
     after navigation)
   - `--timeout`: required, maps to action-level `timeoutMs` (max 30000ms).
     Same wait-duration semantic as `wait --timeout`
   - At least one of `--app` or a selector flag required
   - Synonym: `wait-for-navigation`
   - See Detailed Design Specs section for full spec

9. **`read-value` command**

   ```
   clawperator read-value --label <text> [--json]
   ```

   - `--label`: maps to `labelMatcher.textEquals` (required)
   - `--label-id`, `--label-desc`: for other labelMatcher fields
   - `--all` + `--json`: returns all matches as array (same as `read --all`)
   - Synonym: `read-kv`
   - See Detailed Design Specs section for full spec

### Phase 5C: Read-within (APK + CLI)

Container-scoped `read`: find and return text from a node matching
`matcher` that exists within the subtree of a node matching `container`.

**Prerequisite:** `UiAction.ReadText` in the Android runtime does not
have a `container` field today. Phase 5C requires an APK change before
the CLI layer can expose it. Do not implement the CLI side without first
shipping and installing the APK change, or the container field will be
silently ignored by the device and the command will appear to work while
producing wrong results.

**APK change (Kotlin):**

- Add `container: NodeMatcher? = null` to `UiAction.ReadText` in
  `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- Update `UiActionEngine` to scope the node search within the container
  subtree when `container` is non-null. The same container-scoping logic
  used by `UiAction.Scroll` is a reference implementation.
- Build and install: `./gradlew :app:assembleDebug :app:installDebug`
- Add Kotlin unit tests in `NodeMatcherTest.kt` or a new
  `UiActionReadTextContainerTest.kt` covering the scoped-search path.

**Node/CLI change:**

- Add `--container-*` flags to the `read` command handler in `registry.ts`,
  reusing `resolveContainerMatcherFromCli` from `selectorFlags.ts` (already
  exists from Phase 3).
- Update `buildReadExecution` in `domain/actions/read.ts` to accept an
  optional `container: NodeMatcher` and include it in `ActionParams`.
  `ActionParams.container` is already typed in `contracts/execution.ts`.
- Update `cmdActionRead` in `commands/action.ts` to accept and forward
  the container.
- Update `HELP_READ` in `registry.ts` and `docs/node-api-for-agents.md`
  to document the new flags.

**CLI surface:**

```
clawperator read --id <resource-id> --container-id <container-id>
clawperator read --text <text> --container-role list
clawperator read --id <resource-id> --container-selector '<json>'
```

**Testing:**

- `read --id X --container-id Y` sends `{ matcher: {resourceId:X}, container: {resourceId:Y} }` in the execution payload
- `read --id X --container-selector '{...}'` works; mutual exclusion with `--container-*` simple flags enforced
- `read --container-id X` without an element selector returns `MISSING_SELECTOR`
- On device: verify that a `read` with a container scopes the search to the container subtree and does not match a node with the same resource ID outside that container
- All existing `read` tests still pass (container is optional)

**Risk:** Medium. APK change required - needs Gradle build, device
install, and on-device verification before the CLI change is useful.
The Node-side is low-risk (reuses existing infrastructure).

**Sequencing:** Implement APK change first (separate commit), validate
on device, then land the Node/CLI change. Do not merge the CLI change
until the APK change is shipped to the device being tested against.

---

### Risk

Low-medium. Phase 5A deliverables are low-risk: CLI wrappers around
existing action types or single-flag additions. Phase 5B deliverables
are medium-risk: `exec` rename touches an existing command surface,
`wait-for-nav` and `read-value` require the ActionParams contract
change and new typed builders. Phase 5C is medium-risk: requires an
APK change before the CLI change is meaningful.

### Implementation notes for Phase 5 agents

- **`logs` command does not exist yet:** The deferred `logs --follow`
  design requires building an entirely new `logs` command, not just
  adding a flag to an existing one. It is not part of Phase 5.
- **Phase 5C APK-first rule:** Do not land the `read --container-*` CLI
  change without the APK change installed on the target device. A CLI
  that sends `container` to an APK that ignores it passes all unit tests
  and silently produces wrong behavior on device.

### Testing

- `scroll-until --text "About phone"` scrolls until element is visible
- `scroll-until --text "X" --click` scrolls and clicks
- `scroll-until` without selector: error with example
- `close com.android.settings` force-stops the app
- `exec <file>` works as `execute --execution <file>` does today
- `execute` still works as synonym for `exec`
- `--execution` still works as alias for `--payload`
- `click --text "X" --long` produces long press
- `click --text "X" --long --focus` errors
- `wait --text "X" --timeout 5000` waits up to 5 seconds
- `read --text "X" --all --json` returns array of matches
- `read --text "X" --all` without `--json` errors
- `sleep 2000` pauses for 2 seconds
- `sleep` without duration: error with usage example
- `sleep -1` or `sleep 999999999`: validation error
- `wait-for-nav --app com.foo --timeout 5000` waits for app transition
- `wait-for-nav --text "Settings" --timeout 5000` waits for element after nav
- `wait-for-nav` without `--app` or selector: error
- `wait-for-nav --app com.foo` without `--timeout`: error
- `wait-for-nav --timeout 50000`: error (max 30000ms)
- `wait-for-navigation` works as synonym
- `read-value --label "Battery" --json` reads associated value
- `read-value` without `--label`: error with usage example
- `read-kv` works as synonym
- All smoke scripts and core skills still pass

---

## Skills Migration Strategy

Skills are the primary integration test for this refactor. If skills break, the
refactor has failed regardless of whether unit tests pass. Treat skill breakage
as a blocking bug, not a follow-up task.

**Three core skills must work at all times:**
- `com.android.settings.capture-overview`
- `com.google.android.apps.chromecast.app.set-climate`
- `com.solaxcloud.starter.get-battery`

These skills live in the sibling repo `../clawperator-skills`. If a CLI change
breaks them, update the skill immediately in the same work session. Commit the
skill fix alongside (or immediately after) the CLI change that caused it.

**Per-phase expectations:**

- **Phase 1:** Pure refactor - no behavior changes, no skill impact expected.
  Run the three core skills as a smoke test to confirm the registry migration
  did not break dispatch.

- **Phase 2:** After promoting commands and removing `action`/`observe`, check
  whether any of the three skills invoke CLI commands directly (vs. using
  `execute` payloads). If they use old command forms like `clawperator action
  open-app` or `clawperator observe snapshot`, update them. Run each skill on a
  connected device to confirm it still works end-to-end.

- **Phase 3:** After adding selector flags, check whether any skill would
  benefit from `--text` or `--id` instead of `--selector` JSON. Update if so.
  Most skills use `execute` payloads rather than CLI selectors, so this may be
  minimal. Run skills to confirm no regressions.

- **Phase 4:** Bulk migration of any remaining skills. Verify with
  `skills validate --dry-run` and `clawperator_smoke_skills.sh`. This is
  cleanup, not first discovery - by this point, the three core skills should
  already be working.

- **Phase 5:** The `exec` rename means skills using `clawperator execute`
  will still work (synonym). Skills using `scroll_and_click` in execution
  payloads are unaffected (payload action types are unchanged). Skills
  that would benefit from `scroll-until` CLI wrapper or `close` command
  can be updated to use them. The climate skill already uses `close_app`
  and `scroll_and_click` in its recipe JSON - it can optionally be
  rewritten to use CLI commands instead.

---

## Sequencing

```
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 5A -> Phase 4 -> Phase 5B -> Phase 5C (APK-gated)
```

Phase 0 and Phase 1 can collapse into a single PR if the implementing agent
finds the boundary artificial. The key constraint is: Phase 0's "did you mean?"
infrastructure and Phase 1's registry must exist before Phase 2 adds new
commands. Phase 2 adds commands as registry entries, not switch branches.

Phase 1 is the structural investment. It changes architecture, not behavior.
All existing tests must pass unchanged. If Phase 1 is done well, Phase 2
becomes mechanical: add registry entries, write handlers, update tests.

Phase 3 is independent of Phase 2 in code (different files, different parsing
paths) but should land after Phase 2 so the commands that accept selectors
already exist in their flat form.

The revised sequencing is:

  Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 -> Phase 5A -> Phase 4 -> Phase 5B -> Phase 5C (APK-gated)

Phase 5A should land before Phase 4. The help-text rewrite in Phase 4 is
most efficient when written over the final command surface. Landing 5A
first (close, scroll-until, sleep, --long/--focus, wait --timeout,
read --all) means Phase 4 only needs to be done once over the complete
surface, rather than extended again after 5A adds new commands.

Phase 4 (structured help, --json everywhere, --device global) is then a
stable documentation and polish pass that lands on the full 5A surface
before Phase 5B introduces higher-risk changes.

Phase 5B (`exec` rename, `wait-for-nav`, `read-value`) lands after
Phase 4. These are higher-risk contract changes and benefit from a clean,
tested baseline established by Phase 4.

Phase 5 depends on Phase 3 (selector flags) and Phase 1 (registry).
Within Phase 5, complete all 5A deliverables before starting 5B. 5A
deliverables are independent of each other and can land as separate PRs.
`scroll-until` is the largest; `close`, `--long`/`--focus`,
`wait --timeout`, `read --all`, and `sleep` are each small enough for a
single commit. 5B deliverables (`exec` rename, `wait-for-nav`,
`read-value`) are also independent but require the ActionParams contract
change as a precondition for the latter two.

Phase 5C (`read --container-*`) is independent of 5A and 5B in terms of
code but requires an APK change as a hard prerequisite. It can be worked
in parallel with any phase as long as the APK change lands before the CLI
change is considered done. Do not merge the Node side of 5C without the
APK side.

Docs work (`tasks/docs/refactor/`) begins only after Phase 5 is complete.

`docs/design/node-api-design.md` contains a "Shipped Commands" section
and an "Agent-Friendly Command Surface" section that describe the current
CLI surface. These must be updated to reflect the new command surface once
the API refactor phases have landed. This is part of the docs refactor
work, not a task for the API refactor implementing agents.

---

## What Success Looks Like

An agent encountering clawperator for the first time tries:

```
clawperator snapshot --json
clawperator open com.android.settings --json
clawperator click --text "Wi-Fi" --json
clawperator type "password123" --role textfield --json
clawperator press back --json
clawperator scroll down --json
clawperator scroll-until --text "About phone" --click --json
clawperator close com.android.settings --json
clawperator screenshot --json
```

Every one of these works. No namespace to discover. No JSON to construct.
No flag name to look up. The help text confirms what the agent already guessed.

---

## Detailed Design Specs

The CLI shapes below are settled decisions, not proposals. This section
contains the full design rationale and detailed specs that Phase 5's
deliverable list references.

All items here are implemented in Phase 5 except `--follow` on logs, which
is design-only. `logs --follow` requires streaming infrastructure beyond
the scope of this refactor and is not scheduled in any phase. The design is
recorded here so the surface is settled when that infrastructure is built.

### `scroll-until` (includes `scroll-and-click`)

`scroll_until` and `scroll_and_click` are canonical execution action types
that currently require `execute --execution <json>`. The CLI wrapper unifies
both under one command with `--click` as the differentiator.

**Designed surface:**

```
clawperator scroll-until [<direction>] --text <text> [--click] [--json]
clawperator scroll-until [<direction>] --id <id> [--click] [--json]
clawperator scroll-until [<direction>] --desc <text> [--click] [--json]
```

- Positional: direction (`down`, `up`, `left`, `right`). Default: `down`.
- Selector flags: same `--text`/`--id`/`--desc`/`--role` from Phase 3.
  These populate the `matcher` field in `ActionParams`.
- Container flags: same `--container-text`/`--container-id`/etc. from Phase 3.
  These populate the `container` field in `ActionParams`.
- `--click`: click the target after scrolling to it. When present, action
  type is `scroll_and_click` (maps to `clickAfter: true`). When absent,
  action type is `scroll_until`.

**Tuning parameters are NOT exposed as CLI flags.** `maxScrolls`,
`maxDurationMs`, `distanceRatio`, `noPositionChangeThreshold`,
`settleDelayMs`, `findFirstScrollableChild` are tuning knobs that 99% of
agents never touch. Agents needing these use `execute --execution <json>`.
This is the `--selector` escape hatch principle applied to scroll params.

**Examples:**

```bash
# Scroll down until "About phone" is visible
clawperator scroll-until --text "About phone"

# Scroll down until "Living room" is visible, then click it
clawperator scroll-until --text "Living room" --click

# Scroll up in a specific container
clawperator scroll-until up --text "Settings" --container-id "com.foo:id/list"
```

**Accepted command alias:** `scroll-and-click` is an accepted command
alias for `scroll-until --click` (same handler, `--click` implied). This
matches the pattern agents trained on the execution payload would guess.

**Error when no selector provided:**
```
$ clawperator scroll-until
Error: scroll-until requires a target selector.

Usage:
  clawperator scroll-until --text <text> [--click]

Example:
  clawperator scroll-until --text "About phone" --click
```

**Registry entry:** `scroll-until` gets its own registry entry with
`requiresSelector: true`. `scroll-and-click` is an accepted command alias.

### `--long` and `--focus` click type flags

```bash
clawperator click --text "Settings" --long
clawperator click --text "Search field" --focus
```

- `--long` maps to `clickType: "long_click"` in ActionParams
- `--focus` maps to `clickType: "focus"` in ActionParams
- Mutually exclusive: error if both are present
- Default (neither flag): `clickType: "default"` (omitted from payload)
- These flags apply to all selector forms (`--text`, `--id`, `--desc`,
  `--role`, `--selector`)

**Error when both present:**
```
$ clawperator click --text "X" --long --focus
Error: --long and --focus are mutually exclusive.

Use --long for a long press, or --focus to set input focus.
```

### `wait --timeout` semantic

```bash
clawperator wait --text "Loading complete" --timeout 5000
```

For `wait` specifically, `--timeout` sets the **wait duration** (how long
to wait for the element to appear), not the execution envelope timeout.
This is the one command where `--timeout` has command-specific meaning,
because no agent using `wait --timeout 5000` means "set the execution
envelope to 5 seconds but wait for the element for 30 seconds."

**Node Implementation:** the builder sets the execution `timeoutMs` to
`max(waitTimeout + 5000, globalTimeout)` to ensure the execution envelope
does not kill the wait prematurely. The 5-second buffer accounts for
command overhead. Also sets `params.timeoutMs` on the action.

**Android Implementation:** Add `timeoutMs: Long? = null` to `UiAction.WaitForNode`
data class. Update `AgentCommandParser` to parse `timeoutMs` from params.
Update `TaskUiScope.waitForNode()` to accept optional timeout and wrap
the wait operation with `kotlinx.coroutines.withTimeout(timeoutMs)` (not
`withTimeoutOrNull`). Update `UiActionEngine` to pass the timeout through.

**Default:** when `--timeout` is not provided, `wait` uses the current
fixed 30s behavior (execution timeout = 30000ms).

---

### `close` (app termination)

`close_app` is already a canonical action type. The Node layer already
implements it via `adb shell am force-stop` as a pre-flight (see
`runExecution.ts:180-237`). It is used in skills, doctor checks, and
scaffold templates. The only thing missing is a CLI wrapper.

**Designed surface:**

```bash
clawperator close com.android.settings
clawperator close com.google.home --json
```

- Positional: package name (required)
- `--app` flag: alternative to positional (same pattern as `open`)
- No selector flags - `close` targets a package, not a UI element

**Synonym:** `close-app` is accepted (matches execution payload naming).

**Registry entry:** `close` gets its own entry with
`positional: { name: "package", required: true }`.

**Implementation:** builds an execution with a single `close_app` action,
same pattern as `buildOpenAppExecution()` but with `close_app` type and
`applicationId` param.

### `exec` (replaces `execute`)

`exec` is the canonical short form in CLI tools (docker exec, kubectl exec,
npm exec). An agent guessing the command name will try `exec` before
`execute`. With zero current users, the migration cost is zero.

**Designed surface:**

```bash
clawperator exec <json-or-file> [--validate-only] [--dry-run] [--json]
clawperator exec --payload <json-or-file> [--validate-only] [--dry-run] [--json]
```

- Primary name: `exec`. Synonym: `execute` (accepted silently).
- Positional: the execution payload (JSON string or file path), replacing
  the redundant `--execution` flag name. Parsing rule: trim leading
  whitespace, then if the value starts with `{` or `[`, parse as inline
  JSON; otherwise treat as a file path and load the file contents. Error
  precedence: unreadable file path -> invalid JSON content -> missing
  payload.
- `--payload` flag: alternative to positional (for when the JSON is complex
  or the agent prefers named args).
- `--execution` is accepted as a silent alias for `--payload` to preserve
  backward compatibility with existing skill scripts.
- `--validate-only` and `--dry-run` are unchanged.

**Note:** `exec best-effort` subcommand retains its current form.

### `read --all`

```bash
clawperator read --text "Price" --all --json
```

- `--all` returns all matching elements as a JSON array of strings (text
  content of each matching node), e.g. `["$4.99", "$7.99"]`. No node
  metadata - agents needing that should use `snapshot --json` and filter.
- Without `--all`, behavior is unchanged (first match, single value)
- `--all` requires `--json` (error if used without it, since pretty output
  for a list is ambiguous)

**Android Implementation:** Add `all: Boolean = false` to `UiAction.ReadText`
data class. Update `AgentCommandParser` to parse `all` from params.
Update `TaskUiScope` to add `getAllText(matcher, retry): List<String>`
method that queries all matching nodes (not just first). Update
`TaskUiScopeDefault` to implement multi-match text extraction using
existing UI tree query. Update `UiActionEngine.executeReadText()` to:
- Call `getAllText()` when `all=true`, return `text` as JSON array string
- Call `getText()` when `all=false`, return single `text` value (unchanged)

### `sleep` (execution pause)

`sleep` is a canonical action type used in skill scaffolds and multi-action
executions. Currently only available via `execute --execution <json>`. The
CLI wrapper is trivial.

**Designed surface:**

```bash
clawperator sleep 2000
clawperator sleep 500 --json
```

- Positional: duration in milliseconds (required)
- Validation: `durationMs >= 0`, capped at `MAX_EXECUTION_TIMEOUT_MS`
- No selector flags, no `--timeout` override - `sleep` is a raw timer
- Execution timeout set to `max(durationMs + 5000, globalTimeout)` to
  ensure the envelope does not kill the sleep prematurely

**Error when no duration provided:**
```
$ clawperator sleep
Error: sleep requires a duration in milliseconds.

Usage:
  clawperator sleep <ms>

Example:
  clawperator sleep 2000
```

**Registry entry:** `sleep` gets its own entry with
`positional: { name: "ms", required: true }`.

**Implementation:** builds an execution with a single `sleep` action,
`params.durationMs` set from the positional argument.

### `wait-for-nav` (app/screen transition wait)

`wait_for_navigation` is a canonical action type that waits for an app or
screen transition. It is functionally distinct from `wait` (`wait_for_node`):
`wait` looks for a specific UI element to appear, `wait-for-nav` waits for
an app/screen transition to complete.

**Designed surface:**

```bash
# Wait until a specific app is in the foreground
clawperator wait-for-nav --app com.foo.bar --timeout 5000

# Wait until a specific element appears after navigation
clawperator wait-for-nav --text "Settings" --timeout 5000

# Both: wait for app AND element
clawperator wait-for-nav --app com.foo.bar --text "Home" --timeout 5000
```

- `--app <package>`: maps to `expectedPackage` in ActionParams
- Selector flags (`--text`/`--id`/`--desc`/`--role` from Phase 3): maps to
  `expectedNode` in ActionParams
- `--timeout <ms>`: required, maps to action-level `timeoutMs` (max 30000ms).
  Same wait-duration semantic as `wait --timeout` - this is how long to wait
  for the transition, not the execution envelope timeout.
- At least one of `--app` or a selector flag is required
- Execution timeout set to `max(navTimeout + 5000, globalTimeout)`

**Synonym:** `wait-for-navigation` (matches the canonical action type name).

**Error when missing required args:**
```
$ clawperator wait-for-nav
Error: wait-for-nav requires --app or a selector, and --timeout.

Usage:
  clawperator wait-for-nav --app <package> --timeout <ms>
  clawperator wait-for-nav --text <text> --timeout <ms>

Example:
  clawperator wait-for-nav --app com.google.home --timeout 5000
```

**Registry entry:** `wait-for-nav` gets its own entry. No `requiresSelector`
metadata since `--app` alone is sufficient (selectors are optional when
`--app` is provided).

### `read-value` (label-associated value read)

`read_key_value_pair` is a canonical action type that reads the value
associated with a labeled UI element (e.g., reading "85%" next to the
"Battery" label). Currently only available via `execute --execution <json>`.

**Designed surface:**

```bash
clawperator read-value --label "Battery" --json
clawperator read-value --label-id "com.foo:id/battery_label" --json
clawperator read-value --label "Wi-Fi" --all --json
```

- `--label <text>`: maps to `labelMatcher.textEquals` (required unless
  another label flag is used)
- `--label-id <id>`: maps to `labelMatcher.resourceId`
- `--label-desc <text>`: maps to `labelMatcher.contentDescEquals`
- At least one label flag is required
- `--all` + `--json`: returns all matches as array (same semantics as
  `read --all`)

**Synonym:** `read-kv` (matches the `read_key_value_pair` shorthand).

**Error when no label provided:**
```
$ clawperator read-value
Error: read-value requires a label selector.

Usage:
  clawperator read-value --label <text> --json

Example:
  clawperator read-value --label "Battery" --json
```

**Registry entry:** `read-value` gets its own entry. The `--label*` flags
are specific to this command (not shared with the Phase 3 `--text`/`--id`
selector flags, since they populate `labelMatcher` not `matcher`).

### `logs` command (design only - not scheduled)

There is no `logs` command today. The unified logging problem definition
(`tasks/log/unified/problem-definition.md`) describes the prerequisite
infrastructure: a unified logger that routes lifecycle events, skill
progress, and terminal output through a single NDJSON log surface. Until
that infrastructure exists, there is nothing meaningful for a `logs`
command to stream or query.

The CLI surface is designed here so it is settled when the unified
logger ships.

```bash
# Stream log output (like tail -f)
clawperator logs --follow
clawperator logs -f

# Query recent logs (future - not designed yet)
clawperator logs
```

- `-f` is the universal short form (tail -f, docker logs -f, kubectl logs -f)
- `--follow` streams NDJSON log output until interrupted (Ctrl+C)
- **Not implemented in any phase of this refactor.** Depends on the
  unified logging infrastructure described in the problem definition.
- Future subcommands or query flags (time range, event type filtering,
  skill ID filtering) are not designed here - they depend on the unified
  logger's event schema being settled first.

---

## Items Rejected

These were raised in the external review and rejected. The decisions are
final.

- **`device` namespace grouping `devices`/`doctor`/`version`**: Adds a
  namespace to three commands that work fine as flat top-level names.
  Contradicts the namespace rule.
- **Selector string DSL** (e.g. `text=Login`): `--text` flag covers 80%+
  of cases. A parser adds complexity for marginal gain.

---

## Branch progress and deviations (additive)

This section was added for the **`api-refactor/phase-2`** branch. It does not
edit or replace the plan above, which stays the original design record.

### Phase status (high level)

| Phase | Status (as of this branch) | Notes |
| :--- | :--- | :--- |
| Phase 0 | Done | Infrastructure and compatibility work merged per plan |
| Phase 1 | Done | `COMMANDS` registry and registry-driven dispatch in `apps/node/src/cli/` |
| Phase 2 | Done | Flat verbs, global flags, `action` / `observe` removed from registry with did-you-mean, docs and smoke updates |
| Phase 3 | Done | Selector shorthand flags on click/type/read/wait; `--container-*` (incl. `-contains` variants) on scroll; MISSING_SELECTOR lists full flag surface incl. `--desc-contains`; duplicate value flags rejected; docs updated |
| Phase 4 | Partial | Exit-code and help polish in flight; full deliverable set not complete |
| Phase 5A | Not done | Extended commands: scroll-until, close, --long/--focus on click, wait --timeout, read --all, sleep |
| Phase 5B | Not done | Higher-risk: exec rename, wait-for-nav, read-value; requires ActionParams contract alignment first |
| Phase 5C | Not done | read-within: container-scoped read; requires APK change to UiAction.ReadText before CLI change |

### Deviations from the written plan (intentional or scheduling)

1. **HTTP route flattening (`serve.ts`)**  
   The plan text in Phase 1 (out of scope), Phase 4 (deliverable 3), and
   **Commands unchanged** for `serve` describe changing HTTP paths in **Phase 4**.
   **As implemented:** `POST /snapshot` and `POST /screenshot` shipped with **Phase 2**
   so HTTP matches the flat CLI. Request/response body shapes were unchanged; only
   paths moved off the removed `/observe/...` URLs.

2. **Implementation Context (earlier in this doc)**  
   That section describes a **pre-registry** layout (`HELP_TOPICS`, `switch` in
   `main()`). **As-built:** command definitions and help live in
   `apps/node/src/cli/registry.ts` (`COMMANDS`, optional `synonyms`, `didYouMean`);
   `apps/node/src/cli/index.ts` dispatches via the registry. Keep the Implementation
   Context as the historical starting picture; use the repo for the current shape.

3. **CLI synonyms**  
   The plan text in places refers to extra `switch` `case` branches for synonyms.
   **As-built:** synonyms are `synonyms` arrays on `CommandDef` entries in the
   registry.

4. **Phase 3 closure**
   Phase 3 is complete and the temporary `phase-3-impl-plan.md` checklist is removed.
   `clawperator click --help` shows the full selector flag list. Missing-selector
   guidance lists the full flag surface (including `--desc-contains` on click/read/wait
   and on `type` where `--text` is reserved for typed content). Duplicate selector
   container/value flags are rejected.

5. **`execute` vs `exec`**  
   The plan schedules renaming `execute` to `exec` in Phase 5. **As implemented
   early:** `exec` is canonical with `execute` as a supported synonym; help and
   compatibility text document both. Phase 5 may still align other naming (`--payload`
   vs `--execution`) per the plan.

### Small follow-ups (non-deviation)

- Top-level `clawperator --help` lists **`--json`** as a global JSON output shorthand
  alongside `--output` / `--format` (matches `getGlobalOpts` behavior).

