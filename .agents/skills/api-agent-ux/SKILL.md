---
name: api-agent-ux
description: Gather and apply Clawperator's Node API agent-UX design guidance when designing, reviewing, or documenting CLI and Node API changes. Use for API reviews, command or flag naming, selector or output contract work, error message design, docs about API ergonomics, and review-swarm passes focused on whether an API naturally maps to what agents will try first.
---

# API Agent UX

This skill shapes judgment for Clawperator CLI and Node API work. Its purpose is
to make Clawperator APIs meet agents where their training already points them, so
the first command an agent guesses actually works.

**Core anti-pattern this skill guards against:** when an agent repeatedly tries a
familiar command shape and Clawperator rejects it, the response is to fix the
API - not write better documentation for the existing API. Docs cannot fix a
command that does not parse. An alias, a renamed flag, or a teaching error can.

## Workflow

### Step 1: Read the design note

**Read this before doing anything else:**

`docs/internal/design/node-api-design-guiding-principles.md`

This is not optional background. The design note contains the argument for why
agent UX requires deliberate design, the ten principles, and the checklist for
new commands and flags. The checklist at the end is directly actionable. Read it
now if this context is not already fresh.

Sections to read closely:

- `## The API Is the Product`
- `## Why Agent UX Requires Deliberate Design`
- `## Principles`
- `## Checklist for New Commands and Flags`

After reading, continue. Do not substitute `references/agent-ux-review-frame.md`
for the source document - the reference is a compact mid-review lookup, not a
replacement.

### Step 2: Identify the surface

State what is under review:

- CLI command, flag, or alias
- Selector behavior or contract
- Result or error schema
- Node API contract shape
- Docs example or help text
- Runtime error message

If reviewing a diff, name the files and infer the intent before proceeding.

### Step 3: Read the code that owns the surface

Do not judge the API from docs or commit messages alone. Read the code:

- Commands and aliases: `apps/node/src/cli/registry.ts`
- Selector flags: `apps/node/src/cli/selectorFlags.ts`
- Selector contracts: `apps/node/src/contracts/selectors.ts`
- Execution actions: `apps/node/src/contracts/execution.ts`
- Error contracts: `apps/node/src/contracts/errors.ts`
- Result envelope: `apps/node/src/contracts/result.ts`
- Serve API: `apps/node/src/cli/commands/serve.ts`

### Step 4: Apply the agent-UX test

Ask: what would a capable agent type first after reading only "CLI tool for
automating Android devices"?

Compare that against what Clawperator currently accepts. The gap is the finding.
When a gap exists, the fix is an API change - a synonym, a flag alias, a
friendlier error - not a documentation edit that explains why the intuitive form
does not work.

Agents transfer expectations from adjacent tools. The likely guesses are:

| Source | What agents expect |
|--------|-------------------|
| Playwright | `click`, `fill`, `screenshot`, `tap` |
| adb | `devices`, `install`, `shell` |
| GitHub CLI | `--json`, `list`, `run`, `status` |
| General CLI | positional primary targets, short flags, `--help` |

Use this table as the starting hypothesis. Do not copy blindly: choose the primary
form agents would try first, then accept reasonable alternatives as synonyms.

### Step 5: Recommend or implement the minimum fix

Prefer the smallest change that removes friction:

- Add a parser alias that silently accepts the familiar form
- Rename a flag to the shortest unambiguous form
- Add selector flags (`--text`, `--id`, `--desc`, `--role`) where missing
- Strengthen an error message so it teaches the next valid attempt
- Add a "did you mean" redirect for removed or renamed commands

Do not add convenience heuristics that vary behavior based on hidden context.
Clawperator is an actuator: identical inputs must produce identical outputs.
When input is ambiguous, error rather than guess.

### Step 6: Verify

For implementation work: cover valid, invalid, missing-value, canonical, and
synonym forms in tests. CLI option work must cover global vs command-local flag
placement when both forms exist.

For docs work: write only behavior that the code path confirms.

For review work: report concrete friction, compatibility, or coverage risks using
the output shape below.

## Review Checks

For each API surface, apply these questions:

- Is the command or flag guessable without reading help text?
- Does the common path use a positional argument or short flags instead of JSON?
- If the command targets a UI element, does it accept `--text`, `--id`, `--desc`,
  `--role` in addition to `--selector`?
- Does it accept likely synonyms from adjacent tools while keeping exactly one
  primary documented name?
- Does a wrong command or flag produce a teaching error with valid options and a
  runnable example?
- Is `--json` parseable as raw JSON with a stable schema, including error paths?
- Are external names free of Android internals or implementation details an agent
  would not know?
- Is behavior deterministic for identical inputs?
- Do docs, help text, parser aliases, contracts, and tests agree with each other?
- If this command replaces or renames a prior command, does the old name produce
  a "did you mean" redirect rather than a silent failure?

## Review-Swarm Use

When invoked as part of review-swarm, run as a focused API reviewer:

- Stay read-only unless the user explicitly asks for fixes outside the workflow.
- Focus on agent guessability, parser aliases, error recovery, selector ergonomics,
  JSON contracts, and tests for command-line placement and invalid input.
- Treat docs-only fixes as insufficient when the API itself rejects what an agent
  would naturally try first.
- Return only material findings: those that would cause agents to fail, retry
  wastefully, parse output incorrectly, or learn the wrong contract.

## Output Shape For Reviews

For each finding, report:

- File and line or nearest symbol
- Category: agent UX, contract, docs, or coverage
- Why an agent would likely stumble here
- Recommended API, parser, error, docs, or test adjustment
- Confidence
