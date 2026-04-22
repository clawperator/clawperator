# Discovery Immediate Opportunities

## Executive Summary

Follow-up to the verified discovery findings in
`tasks/discovery/findings.md`. This pack turns the four
`Immediate Opportunities` items into one reviewable implementation path:
three authored-doc updates and one paired Node CLI help-text update. The work
ships in 1 PR across 4 phases. Each phase is intentionally narrow so an
implementing agent can finish, validate, and commit without batching.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | none |
| Remaining | 1, 2, 3, 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Improve low-guidance Clawperator discovery for raw-route users by shipping the
four verified immediate-opportunity changes:

- add an explicit "never guess selectors" rule to `docs/quickstart.md`
- add launcher and home-screen navigation guidance to `docs/api/navigation.md`
- add selector stability guidance to `docs/api/selectors.md`
- add raw-route orientation reminders to `clawperator exec --help` and
  `clawperator snapshot --help`

## Why Now

`tasks/discovery/findings.md` already separates short-term improvements from
follow-up product work. The immediate-opportunity bucket is the first pass we
actually want to ship. It is low-risk, grounded in verified repo behavior, and
should improve first-run agent outcomes without changing runtime contracts or
device semantics.

## In Scope

- Targeted edits to these authored public docs only:
  - `docs/quickstart.md`
  - `docs/api/navigation.md`
  - `docs/api/selectors.md`
- Targeted help-text edits for:
  - `clawperator exec --help`
  - `clawperator snapshot --help`
- Regression coverage for the new help text in `apps/node/src/test/unit/cliHelp.test.ts`
- Validation with `./scripts/docs_build.sh` plus Node build or test where the
  CLI help surface changes

## Out of Scope

- `wait_for_navigation` result-shape or diagnostics changes
- `open_app` runtime behavior changes
- a new `clawperator status --json` command or equivalent MCP tool
- broad docs IA or host-agent routing rewrites beyond the targeted additions in
  this pack
- expanding the CLI help reminder beyond `exec` and `snapshot` unless code
  review proves one of those commands cannot carry the intended guidance

## Existing Artifact Scope

- `tasks/discovery/findings.md` is authoritative input for scope and
  prioritization. Preserve its `Immediate Opportunities` and
  `Follow-Up Enhancements` split. If implementation discovers a material
  contradiction, append a dated `## Execution Notes` section at the end instead
  of rewriting the existing findings.
- `docs/quickstart.md`, `docs/api/navigation.md`, and `docs/api/selectors.md`
  are in scope only for the targeted additions named in this plan. Do not turn
  this task into a general rewrite of those pages.
- `apps/node/src/cli/registry.ts` and `apps/node/src/test/unit/cliHelp.test.ts`
  are in scope only for the `exec` and `snapshot` raw-route orientation
  reminder and the tests that prove it.

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `tasks/discovery/findings.md` | Scope input only; append `Execution Notes` only if execution finds a real contradiction | All phases |
| `docs/quickstart.md` | Add the explicit "never guess selectors" callout | PR-1 / Phase 1 |
| `docs/api/navigation.md` | Add launcher and home-screen guidance | PR-1 / Phase 2 |
| `docs/api/selectors.md` | Add selector stability guidance | PR-1 / Phase 3 |
| `apps/node/src/cli/registry.ts` | Add orientation reminders to `exec` and `snapshot` help only | PR-1 / Phase 4 |
| `apps/node/src/test/unit/cliHelp.test.ts` | Add regression coverage for the new help text | PR-1 / Phase 4 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Verified discovery scope and non-goals | `tasks/discovery/findings.md` |
| Quickstart behavior and current framing | `docs/quickstart.md` |
| Navigation guidance and current statements about `open_app` | `docs/api/navigation.md` |
| Selector contract and current docs coverage | `docs/api/selectors.md`, `apps/node/src/contracts/selectors.ts`, `apps/node/src/cli/selectorFlags.ts` |
| Raw CLI help text | `apps/node/src/cli/registry.ts` |
| Existing CLI help regression patterns | `apps/node/src/test/unit/cliHelp.test.ts` |
| Public-doc authoring workflow | `.agents/skills/docs-author/SKILL.md`, `docs/internal/documentation-drafting-north-star.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- This pack implements only the four `Immediate Opportunities` from
  `tasks/discovery/findings.md`. Do not pull any item from
  `Follow-Up Enhancements` into this pack.
- The authored-doc targets are fixed:
  - `docs/quickstart.md`
  - `docs/api/navigation.md`
  - `docs/api/selectors.md`
- The CLI help targets are fixed:
  - `clawperator exec --help`
  - `clawperator snapshot --help`
- The Phase 4 code change must include tests in the same phase and commit.
- Public-doc work must use `.agents/skills/docs-author/SKILL.md`. Do not
  invent a parallel docs workflow.
- Do not edit `sites/docs/.build/` or `sites/docs/site/` directly.

**Judgment required:**

- Exact wording and placement of the quickstart callout
- Exact wording and placement of the launcher guidance within
  `docs/api/navigation.md`
- How strongly the selector stability section frames preferences versus hard
  guarantees
- The shortest truthful wording for the `exec` and `snapshot` help reminders

## Decision Rules

| Question | Rule |
| --- | --- |
| Which findings ship in this pack? | Only the four `Immediate Opportunities` in `tasks/discovery/findings.md`. |
| Which docs pages are in scope? | Only `docs/quickstart.md`, `docs/api/navigation.md`, and `docs/api/selectors.md`. |
| Which CLI help entries are in scope? | Only `exec` and `snapshot`. Do not broaden to `click`, top-level help, or other commands in this pack. |
| How should authored docs be updated? | Use `.agents/skills/docs-author/SKILL.md`, verify against code, and validate with `./scripts/docs_build.sh`. |
| What if execution finds a contradiction in the findings file? | Append a dated `## Execution Notes` section to `tasks/discovery/findings.md` before finishing the affected phase. |
| What if a proposed change requires runtime or contract work? | Stop and leave it out of this pack. That belongs to `Follow-Up Enhancements`, not this implementation. |

## Failure Modes To Prevent

- re-opening already-settled findings and expanding scope beyond the four
  immediate-opportunity items
- claiming a docs gap where the current docs already say the right thing
- rewriting public docs from existing prose without verifying against code and
  current help text
- adding raw-route reminders to unrelated commands and turning a focused change
  into a broad CLI sweep
- changing CLI help text without adding tests in the same phase
- editing generated docs instead of authored sources
- batching multiple phases into one commit

## Output Contract

After this task ships:

- `docs/quickstart.md` contains an explicit, prominent rule that raw-route
  users should not guess selectors and should derive them from the current
  snapshot
- `docs/api/navigation.md` contains a launcher and home-screen guidance section
  that explains why direct `open_app` is preferred and why launcher paging does
  not always map to `scroll`
- `docs/api/selectors.md` contains a practical selector stability section that
  orders preferred selector fields without overstating guarantees
- `clawperator exec --help` and `clawperator snapshot --help` both include a
  short orientation reminder that points unfamiliar hosts toward
  `clawperator bundled-skills list` and `clawperator-agent-orientation`
- `apps/node/src/test/unit/cliHelp.test.ts` proves the new help text
- `./scripts/docs_build.sh`, `npm --prefix apps/node run build`, and
  `npm --prefix apps/node run test` pass for the phases that require them

## Idempotency

- Re-running the docs phases should preserve the same targeted sections and not
  create duplicate guidance blocks.
- Re-running the help-text phase should preserve the same `exec` and `snapshot`
  reminders without widening the change to other commands.
- Re-running validation should not require any manual cleanup.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Raw-route "never guess selectors" rule | `docs/quickstart.md` |
| Launcher and overlay navigation guidance | `docs/api/navigation.md` |
| Selector stability guidance | `docs/api/selectors.md` |
| Raw-route orientation cue in CLI help | `apps/node/src/cli/registry.ts` and tests in `apps/node/src/test/unit/cliHelp.test.ts` |
