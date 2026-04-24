# Agent UX Review Frame

Use this as the working context for Clawperator API design and review. It is
self-contained so API reviewers and review-swarm agents can apply the agent UX
principles without chasing another file first.

## Core Principle

Clawperator is an actuator. Its value is mediated through the CLI and Node API
that agents call. The Android operator app, accessibility service, and execution
engine exist to serve that API. If the API is hard for agents to use, the
underlying capability does not matter.

The primary consumer is often not a human developer reading docs. It is an LLM
agent that may have never seen Clawperator before, is operating under token
pressure, and is deciding what command to try based on learned patterns from
other tools. Design every public command, flag, selector, output shape, and
error message for that consumer.

The API should meet agents where their training and tool memory already point
them.

## Why Agent UX Requires Deliberate Design

Agents tend to reach for familiar tools and familiar argument shapes. A model
that has learned GitHub CLI, Playwright, adb, or common Unix-style CLIs will
often transfer those expectations into Clawperator. It may try `--body` because
another issue tool uses that name, `fill` because Playwright uses that verb, or
`--json` because GitHub CLI makes that the obvious machine-readable output flag.
That transfer is not a mistake to scold with documentation. It is a design
signal.

The operational point is: when agents keep trying a familiar shape from another
tool and Clawperator rejects it, consider changing Clawperator's API. Better
docs are not enough if the first intuitive command fails.

The lesson is not "add every alias." The lesson is: the command an agent tries
first, based on intuition from other tools, should work when it maps cleanly to
Clawperator's deterministic contract. When it does not, the preferred fix is to
change the API boundary, not merely to write better docs for the existing API.

## What Agents Tend To Try

Agents commonly transfer expectations from:

- Playwright: `click`, `fill`, `screenshot`, `tap`
- adb: `devices`, `install`, `shell`
- GitHub CLI: `--json`, `list`, `run`, `status`
- General CLI habits: positional primary targets, short flags, `--help`

Use these expectations as input when naming commands, flags, selectors, and
output modes. Do not copy another tool blindly. Choose the primary form that a
Clawperator agent would likely try first, then accept other reasonable guesses as
synonyms when doing so does not weaken the contract.

## Design Principles To Apply

### Guessability Over Taxonomy

If an agent must read help text to find the right command, the API has already
failed once. The command surface should be guessable from general CLI habits,
mobile automation vocabulary, and common English verbs.

Use a simple test: imagine an agent that has only read "CLI tool for automating
Android devices." What would it try? Those commands should work when they are
reasonable.

### Flat Commands For Actions

Make single device interaction verbs top-level commands. Reserve namespaces for
subsystems with shared lifecycle or state, such as `skills`, `emulator`, or
`recording`.

Do not add organizational namespaces that expose implementation taxonomy. They
double the search space for agents.

### Familiar Vocabulary First

Use familiar verbs when the same verb means the same thing. When two communities
use different verbs for the same action, choose the one an agent is most likely
to try first as primary and accept the other as a synonym when appropriate.

Examples:

- Document `click`, accept `tap` where appropriate.
- Document `type`, accept `fill` where appropriate.
- Document `press`, accept `press-key` where appropriate.
- Document `--device`, accept `--device-id` where appropriate.
- Document `--json`, accept `--output json` where appropriate.

### Simple Arguments Over Structured Input

The common path should require no JSON, no complex quoting, and no internal
schema knowledge.

Prefer:

```bash
clawperator click --text "Login"
clawperator type "hello" --desc "Search"
```

Reserve `--selector <json>` for multi-field selectors that cannot be expressed
with simple flags.

### Short Generic Flags

Agents guess short, generic flags first. Prefer the shortest unambiguous flag:

- `--device` over `--device-id`
- `--json` over `--output json`
- `--text` over `--text-equals`
- `--desc` over `--content-description`

Accept older or verbose forms as silent aliases when they already exist, but do
not promote them in docs or help text.

### Errors Must Teach

An agent that gets an error should be able to fix its next attempt without
reading docs. Error messages should include:

- what went wrong
- valid options
- a runnable example

Wrong command names, removed commands, and likely flag typos should get
"did you mean" guidance whenever possible.

### Deterministic Behavior Over Convenience Heuristics

Clawperator is an actuator, not an assistant. Do not add smart behavior that
changes based on hidden context. If multiple elements match, use deterministic
selection. If input is ambiguous, error rather than guess.

### Output Is API

Agents consume output as an API surface. `--json` must be raw parseable JSON
with a stable schema. Error output in JSON mode must also be valid JSON with a
consistent error shape.

### Implementation Details Are Not API

External command names, flag names, and output fields should express what an
agent wants to do, not how Clawperator does it internally. Rename concepts at
the API boundary when an agent who has never read the source would not
understand them.

## Review Heuristics

Use these heuristics during API reviews:

- Prefer flat action commands over organizational namespaces.
- Prefer one primary documented name plus parser-level synonyms.
- Prefer simple positional arguments and selector flags over required JSON.
- Prefer short, generic flags when they are unambiguous.
- Require errors to teach the next valid attempt.
- Preserve raw parseable JSON for `--json` output, including error paths.
- Keep implementation terminology out of public command, flag, and schema names.
- Reject ambiguous inputs rather than guessing at runtime.

## Findings Worth Reporting

Report an issue when the API would likely make an agent:

- choose a familiar command or flag that fails without a helpful recovery path
- need JSON for a common single-action workflow
- parse pretty output because `--json` is unavailable, unstable, or noisy
- confuse implementation details for user intent
- receive an error that lacks valid options or a runnable example
- miss a needed synonym or command placement because tests only cover the happy
  path

Do not report a preference if the existing shape is already guessable,
deterministic, documented, and tested.
