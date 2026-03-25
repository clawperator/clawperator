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