---
name: api-agent-ux
description: Gather and apply Clawperator's Node API agent-UX design guidance when designing, reviewing, or documenting CLI and Node API changes. Use for API reviews, command or flag naming, selector or output contract work, error message design, docs about API ergonomics, and review-swarm passes focused on whether an API naturally maps to what agents will try first.
---

# API Agent UX

## Overview

Use this skill to keep Clawperator API work centered on agent usability. The
goal is to make the first command an agent guesses from prior CLI, Playwright,
adb, and GitHub CLI experience actually work, while preserving deterministic
runtime contracts.

## Required Context

Before making or reviewing API-facing changes, read:

`references/agent-ux-review-frame.md`

That reference carries the working guidance from:

- `## The API Is the Product`
- `## Why Agent UX Requires Deliberate Design`
- `## Principles`
- `## Checklist for New Commands and Flags`

For substantial API redesign, updates to this skill, or disputes about the
guidance, also read the canonical source:

`docs/internal/design/node-api-design-guiding-principles.md`

## Workflow

1. Identify the API surface under review.
   - CLI command, flag, alias, selector, result schema, error message, Node API
     contract, docs example, or runtime behavior.
   - If reviewing a diff, infer intent from the changed files and commit or PR
     context, then state the inference if it matters.
2. Read the code that owns the surface before judging it.
   - CLI commands and aliases: `apps/node/src/cli/registry.ts`
   - Selector flags: `apps/node/src/cli/selectorFlags.ts`
   - Selector contracts: `apps/node/src/contracts/selectors.ts`
   - Execution actions: `apps/node/src/contracts/execution.ts`
   - Error contracts: `apps/node/src/contracts/errors.ts`
   - Result envelope: `apps/node/src/contracts/result.ts`
   - Serve API: `apps/node/src/cli/commands/serve.ts`
3. Apply the agent-UX test.
   - Ask what a capable agent would type first after reading only "CLI tool for
     automating Android devices."
   - Compare the current API against names and shapes agents already know from
     Playwright, adb, GitHub CLI, and general CLI conventions.
   - Treat repeated agent mistakes as API design evidence, not as a docs
     problem.
4. Recommend or implement the smallest API adjustment that reduces friction.
   - Prefer one canonical name in docs and help text.
   - Accept reasonable synonyms silently in parsing when they preserve a stable
     contract.
   - Keep deterministic behavior and validation boundaries strict.
5. Verify the contract.
   - For implementation work, cover valid, invalid, missing-value, canonical,
     and synonym forms where relevant.
   - For docs work, write only behavior that the code path actually supports.
   - For review work, report concrete friction, compatibility, or coverage risks.

## Agent-UX Review Checks

Use these questions for API design and review:

- Would the command or flag be guessable without help text?
- Does the common path use a positional argument or short simple flags instead
  of JSON?
- If the command targets UI, does it support simple selector flags such as
  `--text`, `--id`, `--desc`, and `--role` where applicable?
- Does it accept likely synonyms from adjacent tools while keeping one primary
  documented form?
- Does a wrong command or flag produce a teaching error with valid options and a
  runnable example?
- Is `--json` parseable as raw JSON with a stable schema, including failures?
- Are external names free of Android or implementation details that an agent
  would not know?
- Is behavior deterministic for identical inputs?
- Do docs, examples, help text, parser aliases, contracts, and tests agree?

## API Suggestions Agents Expect

When proposing an API shape, start from familiar forms:

- Device discovery and selection: `devices`, `--device`
- Open targets: `open <package-or-url>`
- Observation: `snapshot --json`, `screenshot`
- UI actions: `click --text "..."`, `tap --text "..."`, `type "..."`,
  `fill "..."`, `press <key>`, `scroll <direction>`
- Programmatic output: `--json`
- Subsystems with shared lifecycle: `skills list`, `skills run`,
  `emulator start`, `recording start`

Use this as a starting hypothesis, then verify against current code and project
contracts.

## Review-Swarm Use

When this skill is used with `review-swarm`, run it as a focused API reviewer:

- Stay read-only unless the user explicitly asks for fixes outside the
  review-swarm workflow.
- Focus on API guessability, parser aliases, error recovery, selector ergonomics,
  JSON contracts, and tests for command-line placement and invalid input.
- Treat documentation-only fixes as insufficient when the API itself rejects the
  command an agent would naturally try.
- Return only material findings that would cause agents to fail, retry
  wastefully, parse output incorrectly, or learn the wrong contract.

## Output Shape For Reviews

For each finding, report:

- File and line or nearest symbol
- Category: agent UX, contract, docs, or coverage
- Why an agent would likely stumble
- Recommended API, parser, error, docs, or test adjustment
- Confidence
