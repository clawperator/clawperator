# PRD-5.9: Agent-Friendly Command Surface

Workstream: WS-5.9 (CLI ergonomics for agent discoverability)
Priority: 5.9 (after PRD-5.5, before PRD-6 docs)
Proposed PR: PR-5.9
Status: Draft

---

## Problem Statement

Clawperator's CLI command surface is organized around implementation taxonomy
(`observe`, `action`) rather than agent intent. An agent encountering the tool
cold must guess the correct namespace before guessing the correct verb. This
doubles the search space and produces systematic, repeatable failures.

The blog post "[Agent UX matters at least as much as Human UX](https://steveyegge.com/2025/03/17/agent-ux/)"
(Steve Yegge, March 2025) describes exactly this failure mode: agents reach for
familiar verbs, fail, and give up rather than exploring help text. The fix is to
watch what agents try and make those attempts work.

**Current friction pattern:**

| What an agent tries | What actually works |
|---|---|
| `clawperator snapshot` | `clawperator observe snapshot` |
| `clawperator screenshot` | `clawperator observe screenshot` |
| `clawperator click --selector ...` | `clawperator action click --selector ...` |
| `clawperator tap --selector ...` | `clawperator action click --selector ...` |
| `clawperator open com.foo.bar` | `clawperator action open-app --app com.foo.bar` |
| `clawperator type --selector ... --text ...` | `clawperator action type --selector ... --text ...` |
| `clawperator read --selector ...` | `clawperator action read --selector ...` |

Every one of these fails today. The agent must parse a help screen, find the
namespace, and retry. Most agents do not recover gracefully from this - they
either hallucinate flags, switch to raw `adb`, or ask the user for help.

The `inspect ui` -> `observe snapshot` alias already exists and proves the
pattern works. This PRD extends it to the full high-frequency command set.

---

## Evidence

**Existing alias precedent:**
- `inspect ui` delegates to `cmdObserveSnapshot` (see `cli/commands/inspect.ts`)
- `record` works everywhere `recording` works (case fallthrough in `cli/index.ts`)
- `install` is an alias for `setup` (same pattern)
- Action-type aliases in `contracts/aliases.ts` (`tap` -> `click`, `type_text` -> `enter_text`, etc.) prove the team already accepts the principle

**Playwright vocabulary overlap:**
Clawperator is positioned as "Playwright for mobile." Agents trained on Playwright
will try Playwright verbs. We do not need to replicate Playwright's API, but where
the same verb means the same thing, we should accept it:
- `fill` (Playwright) = `type` (clawperator) = enter text in a field
- `screenshot` (Playwright) = `observe screenshot` (clawperator)
- `tap` (Playwright Mobile) = `action click` (clawperator)

**The `--selector` JSON tax:**
Every selector-based command requires `--selector '{"text":"Login"}'`. This is the
highest-friction flag in the CLI. Agents routinely:
- Forget quotes: `--selector {text: Login}`
- Use wrong JSON: `--selector {"text": "Login"}` (unquoted outer braces in shell)
- Try natural alternatives: `--text Login`, `--label Login`

A `--text` shorthand that constructs the selector internally eliminates the most
common failure mode without changing the underlying contract.

---

## Proposed Changes

### 1. Top-level command aliases

Add top-level cases in `cli/index.ts` that delegate to the existing subcommand
implementations. No new domain logic. Each alias is a one-line delegation like
`inspect ui`.

| Top-level alias | Delegates to | Notes |
|---|---|---|
| `snapshot` | `observe snapshot` | Highest-frequency agent command |
| `screenshot` | `observe screenshot` | Second-highest observation |
| `click` | `action click` | Primary interaction verb |
| `tap` | `action click` | Playwright Mobile / natural synonym |
| `open` | `action open-app` | Natural verb for launching apps |
| `open-uri` | `action open-uri` | Matches the action type name |
| `type` | `action type` | Text entry |
| `fill` | `action type` | Playwright vocabulary |
| `read` | `action read` | Text extraction |
| `wait` | `action wait` | Wait-for-element |
| `press-key` | `action press-key` | Key events |
| `back` | `action press-key --key back` | Most common key press by far |

The nested `action <verb>` and `observe <verb>` forms continue to work unchanged.
Help text for the top-level aliases notes the canonical form.

### 2. Selector shorthands

Add `--text` and `--content-desc` as alternatives to `--selector` on all
selector-accepting commands (`click`, `tap`, `read`, `wait`, `type`, `fill`).

```
# These become equivalent:
clawperator click --selector '{"text":"Login"}'
clawperator click --text "Login"

clawperator click --selector '{"contentDescription":"Submit button"}'
clawperator click --content-desc "Submit button"
```

Implementation: in the CLI layer only, before calling the existing `parseSelector`
path. If `--text` is provided, construct `{"text": value}`. If `--content-desc`
is provided, construct `{"contentDescription": value}`. If `--selector` is also
provided, error with a clear message. The domain layer sees a `NodeMatcher` either
way.

`--content-desc` is chosen over `--description` because `contentDescription` is the
Android accessibility attribute name that agents will see in snapshot output.

### 3. Positional app argument for `open`

```
# These become equivalent:
clawperator open com.spotify.music
clawperator open --app com.spotify.music
clawperator action open-app --app com.spotify.music
```

When `open` receives a positional argument, treat it as the application ID.
`--app` still works for explicitness.

---

## What is explicitly NOT in scope

- **Renaming or removing existing commands.** `action click`, `observe snapshot`,
  etc. continue to work identically. This is purely additive.
- **Replicating Playwright's locator/page object model.** Clawperator is
  action-centric, not page-centric. The abstraction models are different.
- **A `goto` alias.** `goto` implies in-browser navigation. `open` is the right
  verb for launching an Android app or URI.
- **Selector string syntax** (e.g. `text=Login`). The `--text` shorthand covers
  80%+ of cases. A full selector DSL adds parser complexity for marginal gain.
- **Changes to the execution payload JSON schema.** Programmatic callers use the
  Node API with docs; the CLI shorthands are for interactive/agent use.
- **Changes to `contracts/aliases.ts`.** The action-type aliases are a separate
  layer used inside execution payloads, not CLI dispatch.

---

## Implementation

### CLI dispatch (cli/index.ts)

Add cases to the existing switch statement. Pattern follows `inspect`:

```typescript
case "snapshot":
  // alias for: observe snapshot
  return cmdObserveSnapshot({ format, deviceId, receiverPackage, timeoutMs, logger });

case "click":
case "tap":
  // alias for: action click
  return cmdActionClick({ format, selector, deviceId, receiverPackage, logger });
```

### Selector shorthand (cli/commands/action.ts or new cli/selectors.ts)

```typescript
function resolveSelector(opts: {
  selector?: string;
  text?: string;
  contentDesc?: string;
}): NodeMatcher {
  const sources = [opts.selector, opts.text, opts.contentDesc].filter(Boolean);
  if (sources.length === 0) throw new Error("One of --selector, --text, or --content-desc is required");
  if (sources.length > 1) throw new Error("Provide only one of --selector, --text, or --content-desc");
  if (opts.text) return { text: opts.text };
  if (opts.contentDesc) return { contentDescription: opts.contentDesc };
  return parseSelector(opts.selector!);
}
```

### Help text

Top-level aliases should appear in `--help` output grouped under a "Quick
Commands" heading, separate from the organized subcommand groups. This makes
discoverability immediate without cluttering the existing structure.

```
Quick Commands:
  snapshot              Get UI tree (alias for: observe snapshot)
  screenshot            Capture screen (alias for: observe screenshot)
  click, tap            Click/tap element (alias for: action click)
  open                  Open app (alias for: action open-app)
  fill, type            Enter text (alias for: action type)
  read                  Read element text (alias for: action read)
  wait                  Wait for element (alias for: action wait)
  press-key             Press device key (alias for: action press-key)
  back                  Press back key

Commands:
  observe               Observation commands (snapshot, screenshot)
  action                Device actions (click, type, read, ...)
  ...
```

---

## Testing

For each top-level alias:
- Verify it produces identical output to the canonical form
- Verify `--help` on the alias shows correct flags
- Verify unknown flags produce the same error as the canonical form

For selector shorthands:
- `--text "Login"` produces `{"text":"Login"}` selector
- `--content-desc "Submit"` produces `{"contentDescription":"Submit"}` selector
- `--text` and `--selector` together errors clearly
- `--text` and `--content-desc` together errors clearly
- Missing all three errors clearly
- Empty string `--text ""` errors (not a valid selector value)

For positional `open`:
- `clawperator open com.foo.bar` works
- `clawperator open --app com.foo.bar` works
- Both provided: positional takes precedence (or errors - TBD)

---

## Sequencing

This PRD should land **before PRD-6** (docs entry points) so that:
1. The flat command surface exists when docs are written
2. `AGENTS.md` and `llms.txt` can reference the flat verbs as canonical
3. Docs are not regenerated twice

It has no dependencies on PRDs 1-5.5 (purely additive CLI layer).

---

## What Success Looks Like

An agent encountering clawperator for the first time tries `clawperator snapshot`
and it works. It tries `clawperator click --text "Login"` and it works. It never
needs to discover the `observe` or `action` namespaces to be productive. The
namespaces remain for organization and for agents that have read the docs, but
they are no longer a gate.
