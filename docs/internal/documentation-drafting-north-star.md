# Documentation Drafting North Star

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
- There is no separate "human version" of the docs.

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
- If code and docs conflict - code wins
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
- "previously vs now" comparisons

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
## Exact Values Rule

If a default value, constant, range, or threshold exists as a literal in the code, write that literal in the docs. Do not paraphrase, summarize, or describe it indirectly.

**Wrong:** "The default log directory is a logger-specific default under the user home directory."
**Right:** "The default log directory is `~/.clawperator/logs` (from `logger.ts`)."

**Wrong:** "The default log level is the logger default level."
**Right:** "The default log level is `info` (from `normalizeLogLevel()` in `logger.ts`)."

**Wrong:** "The timeout is clamped to a reasonable range."
**Right:** "The timeout is clamped to `[5000, 300000]` ms (from `limits.ts`)."

This applies to: default values, valid ranges, clamping bounds, enum members, constant names, file paths, package identifiers, port numbers, and any other value that exists as a literal in source code.

When you write a default or range, cite the source file. If you cannot point to a line of code for the value, you are guessing.

---
## Verification Patterns

Every page must include at least one machine-checkable way for an agent to confirm the documented behavior.

A verification pattern is a command an agent can run whose output proves the setting, state, or contract is in effect.

**Examples:**
- Environment variable: run `clawperator doctor --json`, check `report.operatorPackage` matches the env var value
- Device connection: run `clawperator devices --json`, check the array contains the expected serial
- Setup complete: run `clawperator doctor --json`, check `report.ok` is `true`

If a page documents a setting, flag, or state, and there is no way to verify it took effect, that is a gap. Either add a verification command or note that the setting is not externally observable.

---
## Error Cases Per Setting

For every configurable value (environment variable, CLI flag, config field), document what happens when it is set incorrectly.

This means: the specific error code that surfaces, what the error message says, and how to recover.

**Example for `CLAWPERATOR_OPERATOR_PACKAGE`:**
- Set to a package not installed on the device
- Error: `OPERATOR_NOT_INSTALLED`
- Recovery: install the correct APK or fix the variable

If a setting silently falls back to a default when invalid (e.g., `CLAWPERATOR_LOG_LEVEL` falls back to `info` for unrecognized values), document that behavior explicitly. Silent fallbacks are easy to miss and hard to debug.

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
- Every default value is the exact literal from code, with source file cited
- At least one full request/response or command/output example
- All error codes that page's commands can produce, with recovery
- Flag semantics: what it does, what happens when omitted, valid values
- At least one verification pattern showing how to confirm the documented behavior

### Contract pages (errors, selectors, result envelope)
- Complete enumeration - every item in the code must appear in the doc
- Cross-reference to the authoritative code file
- At least one worked example showing how an agent uses the contract

### Environment / configuration pages
- Every variable or setting with: exact default (literal from code), where it is read (specific category or list, not "various"), what error surfaces when wrong
- At least one JSON verification example
- Flag-to-env-var precedence documented

---
## Known Failure Patterns

These are specific antipatterns observed in prior drafting rounds. Check your work against them.

1. **Thin tables.** A table that lists all 17 action types but doesn't explain parameter semantics (valid values for `direction`, what `maxSwipes` controls, how `validator` and `validatorPattern` interact) looks complete but isn't usable. If an agent can't construct a valid call from the table alone, the table is incomplete.

2. **Phantom error codes.** Documenting an error code that doesn't exist in `apps/node/src/contracts/errors.ts`. If a code appears in prose or a recovery table, grep for it in the source. If it's not in the enum, don't document it as a formal error code.

3. **Correct structure, insufficient depth.** Right section headings, right page scope, right cross-references - but each section has 2-3 sentences where it needs 5-10. This pattern produces pages that look complete in a table of contents but can't answer real questions.

4. **Missing JSON examples for major contracts.** If a page defines an output shape (DoctorReport, result envelope, devices response), include a concrete JSON example. Naming fields in prose is not equivalent to showing the shape.

5. **Success conditions that require inference.** "If this returns a JSON result with `status: success`" is weaker than "Exit code `0`, `envelope.status` is `\"success\"`, `envelope.stepResults[0].success` is `true`." Agents need exact field paths, not descriptions.

6. **Installer/script internals in the main flow.** The setup page should tell agents what to run and how to verify it worked. What the installer does internally is context, not the main flow. Keep it brief or in a sidebar.

7. **Vague defaults.** Writing "logger-specific default" instead of `~/.clawperator/logs`. Writing "a reasonable timeout" instead of `30000` ms. If the value is a literal in code, write the literal.

8. **Vague "where it is read" descriptions.** "Many command modules" and "used in various places" are not documentation. Either name the category precisely ("every device-targeting CLI command") or list the specific files.

9. **Missing error cases.** Documenting what a setting does when correct but not what happens when it is wrong. Every configurable value should have its failure mode documented with the exact error code.

10. **Missing verification patterns.** A page that documents behavior but provides no way for an agent to confirm that behavior is in effect. If there is a command that proves it, show it.

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

---
## How to Verify Against Code

For every claim in the documentation, there must be a code path that confirms it.

| Topic | Verify against |
|-------|---------------|
| CLI commands, flags, aliases | `apps/node/src/cli/registry.ts` |
| Action types and parameters | `apps/node/src/contracts/execution.ts` |
| Selector flags and behavior | `apps/node/src/cli/selectorFlags.ts`, `apps/node/src/contracts/selectors.ts` |
| Error codes and meanings | `apps/node/src/contracts/errors.ts` |
| Result envelope shape | `apps/node/src/contracts/result.ts` |
| Execution limits and timeouts | `apps/node/src/contracts/limits.ts` |
| Execution validation | `apps/node/src/domain/executions/validateExecution.ts` |
| Execution runtime | `apps/node/src/domain/executions/runExecution.ts` |
| Snapshot extraction | `apps/node/src/domain/executions/snapshotHelper.ts` |
| Environment variables | Grep `process.env.CLAWPERATOR` across `apps/node/src/` |
| Runtime config | `apps/node/src/adapters/android-bridge/runtimeConfig.ts` |
| Navigation builders | `apps/node/src/domain/actions/waitForNav.ts`, `openApp.ts`, `openUri.ts` |
| Recording format | `apps/node/src/domain/recording/recordingEventTypes.ts` |
| Recording parsing | `apps/node/src/domain/recording/parseRecording.ts` |
| Recording CLI | `apps/node/src/cli/commands/record.ts` |
| Skills registry | `apps/node/src/contracts/skills.ts`, `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` |
| Skills runtime | `apps/node/src/domain/skills/runSkill.ts`, `apps/node/src/domain/skills/skillsConfig.ts` |
| Skills CLI | `apps/node/src/cli/commands/skills.ts` |
| Skill validation | `apps/node/src/domain/skills/validateSkill.ts` |
| Skill compilation | `apps/node/src/domain/skills/compileArtifact.ts` |
| Operator setup | `apps/node/src/cli/commands/operatorSetup.ts`, `apps/node/src/domain/device/setupOperator.ts` |
| Permissions | `apps/node/src/domain/device/grantPermissions.ts` |
| Version compatibility | `apps/node/src/domain/version/compatibility.ts` |
| Doctor checks | `apps/node/src/domain/doctor/checks/` |
| Serve endpoints | `apps/node/src/cli/commands/serve.ts` |
| Install script | `sites/landing/public/install.sh` |

Do not write documentation from memory or from existing docs alone. Open the code file, read it, and write the docs from what you see. If the code contradicts existing docs, the code is correct.

---
## Terminology Rules

These are enforced across all authored documentation:

- "operator" not "receiver"
- "action" not "command" when referring to execution payload actions
- "selector" not "matcher" (except when referencing the `NodeMatcher` type specifically)
- Primary flag name `--device` (not `--device-id`)
- Primary flag name `--timeout` (not `--timeout-ms`)
- Flat CLI surface: `snapshot` not `observe snapshot`, `click --text` not `action click --selector`
- Never shorten "Clawperator" to "Claw"
- Use regular dashes/hyphens, never em dashes

---
## Exemplar Pages

These pages represent the target quality bar. Study them before writing or revising any page:

- `docs/setup.md` - setup/how-to quality bar
- `docs/api/actions.md` - API reference quality bar
- `docs/api/environment.md` - configuration/environment quality bar

---
## Success Criteria

The work is complete when:

- `llms-full.txt` provides full coverage of the system
- an agent can execute real workflows end-to-end using only the docs
- no guessing or interpretation is required
- no contradictions or gaps exist in the documented surface

Perfection is not required.

Correct structure, accurate contracts, and full coverage are required.
