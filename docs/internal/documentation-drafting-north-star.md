## North Star

Produce documentation that allows an agent to use `clawperator` correctly, deterministically, and without assistance.

The documentation is complete when an agent can:
- discover capabilities
- construct valid commands and payloads
- interpret results correctly
- recover from failures

without external context, guesswork, or human clarification.

---
## Primary Artifact

`llms-full.txt` is the canonical output.

- It is the source agents will consume.
- The docs site is a projection of the same content.
- There is no separate “human version” of the docs.

All decisions must optimize for:
- agent parsing
- retrieval accuracy
- deterministic interpretation

If there is any tradeoff:
- choose what is better for agents
- do not optimize for human readability

---
## Core Requirements

Documentation must be:

### 1. Accurate
- Matches current implementation exactly
- Verified against code, not assumed from existing docs
- No contradictions across pages

### 2. Structured
- Clear schemas, tables, and contracts
- Minimal prose
- No ambiguity or narrative explanations where structure suffices

### 3. Complete
- All commands, flags, actions, selectors, errors, and outputs are covered
- No hidden or implied behavior

### 4. Actionable
- Enables execution directly
- Provides exact inputs and expected outputs
- Includes failure modes and recovery paths

---
## Source of Truth Hierarchy

1. Code (authoritative)
2. Tests and command definitions
3. Existing documentation (advisory only)

Rules:
- If code and docs conflict → code wins
- Existing docs must not be trusted without verification
- Do not preserve wording unless verified

---
## Current State Only

Documentation reflects the current system only.

Do NOT include:
- deprecated behavior
- legacy APIs
- migration guidance
- historical explanations
- “previously vs now” comparisons

If content is not relevant to current behavior:
- remove it

Prefer deletion over preservation.

---
## Zero Duplication

- Each concept is defined exactly once
- Pages must not overlap in responsibility
- No repeated explanations across pages

Cross-reference instead of duplicating.

---
## Deterministic Contracts

Every system surface must be explicitly defined:
- CLI commands
- flags and parameters
- selector behavior
- action inputs and outputs
- result envelope structure
- error codes and recovery

No implicit behavior.

No inferred rules.

---
## Two-Audience Requirement

Every page must serve both audiences simultaneously:

**Agents** need:
- machine-checkable success conditions (exit codes, exact JSON field paths, expected values)
- deterministic linear flow with no branching ambiguity
- exact error codes for programmatic branching
- concrete JSON examples they can pattern-match against

**Humans skimming the docs site** need:
- scannable summary tables (e.g., all doctor check IDs, all action types)
- at least one concrete JSON example per major contract
- enough context to orient without reading the full page

Neither axis alone is sufficient. A page that is a perfect executable spec but has no summary tables or JSON examples fails the human reader. A page that reads well but lacks success conditions and exact field paths fails the agent.

When the two conflict, choose the agent. But most of the time they do not conflict - a concrete JSON example serves both audiences.

---
## Agent-Centric Design

Assume:
- no prior context
- no shared memory
- no human intuition

Documentation must:
- stand alone
- be parseable in isolation
- minimize cross-page dependency where possible

---
## Page Completeness by Type

Different page types have different minimum bars. A page is not done until it meets the bar for its type.

### Setup / how-to pages
- Machine-checkable success condition at every numbered step
- At least one concrete JSON shape for output the reader will see
- Recovery guidance for the top 3 failure modes at that step
- Linear flow - no branching paths in the main sequence

### API reference pages
- Every parameter's valid values documented (not just the parameter name)
- At least one full request/response or command/output example
- All error codes that page's commands can produce, with recovery
- Flag semantics: what it does, what happens when omitted, valid values

### Contract pages (errors, selectors, result envelope)
- Complete enumeration - every item in the code must appear in the doc
- Cross-reference to the authoritative code file
- At least one worked example showing how an agent uses the contract

---
## Known Failure Patterns

These are specific antipatterns observed in prior drafting rounds. Check your work against them.

1. **Thin tables.** A table that lists all 17 action types but doesn't explain parameter semantics (valid values for `direction`, what `maxSwipes` controls, how `validator` and `validatorPattern` interact) looks complete but isn't usable. If an agent can't construct a valid call from the table alone, the table is incomplete.
2. **Phantom error codes.** Documenting an error code that doesn't exist in `apps/node/src/contracts/errors.ts`. If a code appears in prose or a recovery table, grep for it in the source. If it's not in the enum, don't document it as a formal error code.
3. **Correct structure, insufficient depth.** Right section headings, right page scope, right cross-references - but each section has 2-3 sentences where it needs 5-10. This pattern produces pages that look complete in a table of contents but can't answer real questions.
4. **Missing JSON examples for major contracts.** If a page defines an output shape (DoctorReport, result envelope, devices response), include a concrete JSON example. Naming fields in prose is not equivalent to showing the shape.
5. **Success conditions that require inference.** "If this returns a JSON result with `status: success`" is weaker than "Exit code `0`, `envelope.status` is `\"success\"`, `envelope.stepResults[0].success` is `true`." Agents need exact field paths, not descriptions.
6. **Installer/script internals in the main flow.** The setup page should tell agents what to run and how to verify it worked. What the installer does internally is context, not the main flow. Keep it brief or in a sidebar.

---
## Multi-Pass Workflow

Expect multiple drafting passes across branches. This is by design, not a failure.

- **First pass** produces structure, verified facts, and correct code references. It will miss depth in some areas.
- **Second pass** adds parameter semantics, concrete examples, and catches gaps against the completeness checklist above.
- **Consolidation** merges the best of multiple drafts.

A single agent in a single pass will not produce complete docs for complex pages. The workflow accounts for this.

---
## Implementation Discipline

- Work one document at a time
- Verify against code before writing
- Produce final-form content immediately (no placeholders)
- Commit after each document
- Treat the first commit as a draft - reread it, improve it, commit again
- Prefer incremental correctness over batch completion

## How to Verify Against Code

For every claim in the documentation, there must be a code path that confirms it.

- CLI command names and flags: read `apps/node/src/cli/registry.ts`
- Action types and parameters: read `apps/node/src/contracts/execution.ts`
- Selector flags and behavior: read `apps/node/src/cli/selectorFlags.ts` and `apps/node/src/contracts/selectors.ts`
- Error codes and meanings: read `apps/node/src/contracts/errors.ts`
- Result envelope shape: read `apps/node/src/contracts/result.ts`
- Doctor checks: read `apps/node/src/domain/doctor/checks/`
- Serve endpoints: read `apps/node/src/cli/commands/serve.ts`

Do not write documentation from memory or from existing docs alone. Open the code file, read it, and write the docs from what you see. If the code contradicts existing docs, the code is correct.

---
## Success Criteria

The work is complete when:

- `llms-full.txt` provides full coverage of the system
- an agent can execute real workflows end-to-end using only the docs
- no guessing or interpretation is required
- no contradictions or gaps exist in the documented surface

Perfection is not required.

Correct structure, accurate contracts, and full coverage are required.

