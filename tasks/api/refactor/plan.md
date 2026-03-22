# API Refactor Plan

Origin: Agent UX review session (2026-03-23). An independent agent was given the
current API docs cold and asked to propose the ideal command surface. The feedback
confirmed that the `action`/`observe` namespace nesting, JSON-only selectors, and
verbose flag names are systematic first-contact failures. This plan implements the
fixes across four phases.

Reviewed 2026-03-23 by a second independent agent. Required changes incorporated.

Primary inputs:
- External agent UX review (full transcript in session context)
- `tasks/node/agent-usage/prd-5.9.md` (original flatten proposal, now superseded by this plan)
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

Implementation: both names call the same handler. Help text shows only the
primary name. `--help` on the synonym shows the same output as the primary.

### Flag shorthands use short, familiar names

`--device` not `--device-id`. `--json` not `--output json`. `--timeout` not
`--timeout-ms`. Old flag names continue to work (parsed silently) but are not
shown in help text.

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
- Future consideration: `--all` flag to return all matches as a list (not in
  scope for this refactor)

---

## Phase 0: Infrastructure and Compatibility

Establish the foundation that makes Phases 1-2 safe.

### Deliverables

1. **"Did you mean?" error system**
   - When an unknown command is entered, suggest the closest known command
   - Specific mappings for removed commands:
     - `action click` -> `click`
     - `action open-app` -> `open`
     - `action type` -> `type`
     - `observe snapshot` -> `snapshot`
     - `observe screenshot` -> `screenshot`
     - `inspect ui` -> `snapshot`
   - Generic fuzzy matching for typos: `screensht` -> `screenshot`

2. **Flag alias infrastructure**
   - Parser accepts both old and new flag names
   - Old flags are not in help text but still work
   - Mapping table:
     - `--device-id` -> `--device`
     - `--output json` -> `--json`
     - `--timeout-ms` -> `--timeout`
     - `--receiver-package` -> `--package`
   - Centralized so all commands inherit flag aliases automatically

3. **Regression test harness**
   - Test that every old command + flag combination either works (if preserved)
     or produces a clear "did you mean?" error (if removed)
   - This harness runs throughout Phases 1-3 as a safety net

### Risk

Low. Infrastructure only. No behavior changes visible to current callers.

### Scope note

Phase 0 is deliberately thin. Its purpose is to make Phase 1 safe, not to be a
standalone deliverable. If the implementing agent finds Phase 0 and Phase 1
naturally collapse into one PR, that is acceptable. The separation exists for
planning clarity, not as a hard PR boundary.

---

## Phase 1: Command Surface Refactor

Fix the top-level CLI shape so agents can guess commands correctly on first
attempt.

Phase 1 has two logical layers. They can land in one PR but must be mentally
separable for review:

- **Layer A (command promotion):** promote flat commands, remove `action`/`observe`,
  implement "did you mean?" errors
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
   - `back` = `press --key back` (most common key press)
   - `scroll <direction>` = top-level scroll command

   `scroll` spec (not deferred - this is a core primitive):
   ```
   clawperator scroll <down|up|left|right> [--device <id>] [--json]
   clawperator scroll <direction> --container-text "..." [--json]
   ```
   If no CLI command currently wraps the scroll action, one must be added in
   this phase. The scroll action exists in the execution payload; the CLI
   wrapper translates positional direction + optional container flags into the
   correct payload.

3. **Unified `open` with smart target detection**
   ```
   clawperator open com.android.settings       # package
   clawperator open https://example.com         # URL
   clawperator open myapp://deep/link           # URI
   ```
   Detection: `https?://` -> URL, any `*://` -> URI, else package name.
   `--app` flag still works as explicit override for ambiguous cases.

4. **Positional arguments where obvious**
   - `clawperator open com.android.settings` (positional target)
   - `clawperator press back` (positional key name)
   - `clawperator type "hello"` (positional text, selector via flags)
   - `clawperator scroll down` (positional direction)
   - Named flags (`--app`, `--key`, `--text`, `--direction`) still work
   - Positional and named flag for the same value: error with clear message

5. **Normalize global flags**
   - `--device` (canonical), `--device-id` (accepted silently)
   - `--json` (canonical), `--output json` (accepted silently)
   - `--timeout` (canonical), `--timeout-ms` (accepted silently)
   - `--package` (canonical), `--receiver-package` (accepted silently)

6. **Remove `action` and `observe` parent commands**
   - Removed from dispatch, removed from help text
   - Phase 0's "did you mean?" catches agents/scripts still using the old forms

### Failure-mode requirements (acceptance criteria)

These are not nice-to-haves. Each must be tested.

**Missing selector:**
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
- `clawperator_smoke_core.sh` passes (update script if it uses old command forms)

---

## Phase 2: Selector Flags

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
   - Same set with `--container-` prefix for scroll-within and read-within:
     - `--container-text`, `--container-id`, `--container-desc`,
       `--container-role`, `--container-selector`

3. **Selector resolution (deterministic, tested)**
   - Multiple simple flags combine with AND semantics:
     `--text "Login" --role button` matches elements with both properties
   - `--selector` is mutually exclusive with simple flags: error if combined
   - Container flags resolve independently from element flags
   - First match in accessibility traversal order is selected
   - Missing all selectors: clear error listing available flags with examples
   - Empty string values: rejected at validation boundary

4. **Additional type ergonomics**
   - `--submit` flag: press enter/submit after typing
   - `--clear` flag: clear existing text first. If the Android receiver does not
     yet support this, the flag is accepted but the help text documents the
     limitation: "Note: --clear requires receiver support; currently a no-op on
     some devices"

### Risk

Low. CLI-layer parsing only. The domain layer receives a `NodeMatcher` object
regardless of whether it was constructed from `--text`, `--selector`, or a
positional flag. No changes to the Android receiver or execution payload schema.

### Testing

- `--text "Login"` produces `{"text":"Login"}` matcher
- `--id "com.foo:id/bar"` produces `{"resourceId":"com.foo:id/bar"}` matcher
- `--desc "Submit"` produces `{"contentDescription":"Submit"}` matcher
- `--text-contains "Log"` produces the correct partial-match matcher
- `--role button` produces the correct role matcher
- `--text "Login" --role button` combines to AND matcher
- `--text "Login" --selector '{...}'` errors clearly
- All missing: error with example showing `--text` usage
- `--text ""` errors (blank string rejected)
- Container flags resolve independently and populate the correct matcher field

---

## Phase 3: Help, Errors, and Polish

Finalize the developer and agent experience.

### Deliverables

1. **Rewrite help text**
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

     Recording:
       recording, record     Session recording

     Setup:
       operator setup        Install Operator APK
       version               Show version info

     Global Options:
       --device <id>         Target device serial
       --package <pkg>       Operator package
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
   - Missing selector: show flag list with example (see Phase 1 failure-mode
     requirements for exact format)
   - Missing device in multi-device setup: list connected devices with retry
     command showing `--device` flag
   - Validation error: include task-oriented hint, not just schema path

3. **Update smoke scripts and integration tests**
   - `clawperator_smoke_core.sh` uses new command surface
   - `clawperator_smoke_skills.sh` uses new command surface
   - `clawperator_integration_canonical.sh` if applicable
   - All scripts verified passing

### Risk

Low. UX polish with no behavioral changes.

### Testing

- `clawperator --help` output matches target structure
- `clawperator click --help` shows selector flags and examples
- Wrong flag produces suggestion
- Missing selector produces example
- Multi-device without `--device` lists devices
- All smoke scripts pass

---

## Skills Migration Strategy

Skills migration validates the refactor but does not block it. CLI changes land
first; skills are updated to confirm the new surface works end-to-end.

**Phase 1 (validation):** Migrate three active skills that are regularly tested:
- `com.android.settings.capture-overview`
- `com.google.android.apps.chromecast.app.set-climate`
- `com.solaxcloud.starter.get-battery`

These are migrated after Phase 1 CLI changes land. They validate the new command
surface on real devices.

**Phase 2 (optional):** Migrate any skill commands that use `--selector` JSON to
use simple flags where possible. Most skills use `execute` payloads (not CLI
selectors), so this may be minimal.

**Phase 3 (final):** Bulk migration of all remaining skills. Verify with
`skills validate --dry-run` and `clawperator_smoke_skills.sh`.

---

## Sequencing

```
Phase 0 -> Phase 1 -> Phase 2 -> Phase 3
```

Phase 0 and Phase 1 can collapse into a single PR if the implementing agent
finds the boundary artificial. The key constraint is: Phase 0's "did you mean?"
infrastructure must exist before Phase 1 removes the old commands.

Phase 2 is independent of Phase 1 in code (different files, different parsing
paths) but should land after Phase 1 so the commands that accept selectors
already exist in their flat form.

Phase 3 is polish and must land last.

Docs work (`tasks/docs/refactor/`) begins only after Phase 3 is complete.

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
clawperator screenshot --json
```

Every one of these works. No namespace to discover. No JSON to construct.
No flag name to look up. The help text confirms what the agent already guessed.

---

## Items Considered and Deferred

These were raised in the external review and are worth revisiting later, but are
not part of this refactoring:

- **`app close <package>`**: No current `close-app` action exists in the Android
  receiver. Adding it requires receiver changes beyond CLI dispatch. Track as a
  separate feature.
- **`exec run/validate/plan` replacing `execute`**: The current `execute` command
  has a settled contract. Renaming it adds migration cost with minimal
  discoverability gain since agents rarely type `execute` directly. Revisit if
  feedback shows confusion.
- **`device` namespace grouping `devices`/`doctor`/`version`**: Adds a namespace
  to three commands that work fine as flat top-level names. Contradicts the
  namespace rule.
- **Selector string DSL** (e.g. `text=Login`): `--text` flag covers 80%+ of
  cases. A parser adds complexity for marginal gain.
- **`--follow` flag on logs**: Useful but requires streaming infrastructure.
  Separate feature.
- **`read --all`**: Return all matches as a list. Useful but adds output format
  complexity. Track as a follow-up once the single-match contract is established.
