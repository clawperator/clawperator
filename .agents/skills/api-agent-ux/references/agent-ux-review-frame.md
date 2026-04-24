# Agent UX Review Frame

Read this after opening `docs/internal/design/node-api-design-guiding-principles.md`.
This file is a compact working lens, not a replacement for the source design
document.

## Core Principle

Clawperator's API is the product because agents experience the runtime entirely
through commands, flags, schemas, and errors. The API should meet agents where
their training and tool memory already point them.

The design note's Agent UX section makes one operational point: when agents keep
trying a familiar shape from another tool and Clawperator rejects it, consider
changing Clawperator's API. Better docs are not enough if the first intuitive
command fails.

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
