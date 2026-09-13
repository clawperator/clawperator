# Scoped selection diagnostics and deterministic assertions

Enable consumers to resolve ambiguous targets and overlapping scroll containers
using observable scope and strict selectors. Done means the walkthrough is live
verified, any demonstrated presentation gaps are fixed and tested, docs and task
status are updated, and validated changes are committed. See
[work-breakdown.md](work-breakdown.md) for delivery and validation.

Status: [TODO]. Priority P2 in the [v0.10.x plan](../../releases/v0.10.x/plan.md).

## Evidence

The 0.10.0 usage run correctly rejected duplicate labels with `NODE_AMBIGUOUS`.
Two same-ID, same-bounds lists
also caused an unscoped scroll to track the wrong container and report
`NO_POSITION_CHANGE`; strict ancestor-scoped scrolling subsequently returned
`TARGET_FOUND` after four scrolls and the corrected domain assertions passed.
This establishes a documentation/diagnostic opportunity, not a scoped-scroll bug.

## Scope

Audit CLI and MCP agent-facing summaries for preservation and visibility of
`selection_warning`, candidate counts and available scope/progress details.
Repair demonstrated dropped or obscured diagnostics without changing the
canonical envelope, first-match defaults, strict errors or scroll algorithms.
If the diagnostics are already sufficiently exposed, retain them and deliver
only the verified examples; do not invent a runtime defect to justify changes.

Publish one coherent generic discovery/testing walkthrough: inspect candidates
and ancestor paths, choose a unique strict selector, select a scroll container
by ancestor, establish destination readiness, assert app state, then capture
evidence. Explain that onScreen/visible bounds do not establish visual occlusion
or the topmost pane, and dispatch success does not prove the postcondition.
Use generic app identifiers and exact supported flags. Cover why an empty input
may lack a clear button and why bookmark-folder context matters as examples of
state assumptions, without embedding app-specific strategy into the runtime.

Clarify doctor readiness versus target-app responsiveness and bounded ANR
classification in the same walkthrough. Do not add automatic ANR dismissal,
system-dialog APIs, guessed `--max-scrolls`, coordinate fallbacks or sleep loops.
A new system-dialog diagnostic API is deferred until concrete requirements exist.

## Owners and documentation

- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/SelectionWarnings.kt`,
  `TaskUiScopeDefault.kt` and `UiActionEngine.kt`: emitted selection/progress evidence.
- `apps/node/src/cli/commands/action.ts`, `apps/node/src/mcp/results.ts` and
  `apps/node/src/domain/actions/scrollUntil.ts`: consumer presentation and results.
- `apps/node/src/cli/selectorFlags.ts`, `contracts/selectors.ts` and
  `cli/registry.ts`: actual supported scope and flags (last two under apps/node/src).
- Extend `docs/api/selectors.md`, `docs/api/actions.md` and `docs/api/doctor.md`
  by linking to the canonical walkthrough rather than copying it among pages.
  Durable diagnostic rationale belongs in `docs/internal/design/action-result-diagnostics.md`.

## Acceptance

A reader can move from duplicate candidates to an observed unique selector and
strictly scroll the intended same-bounds detail pane. Warnings remain available
on failed as well as successful steps. Non-strict and strict behavior is unchanged.
The example distinguishes dispatch, readiness, assertion, media validity and
bundle completeness, including a partial manifest with usable artifacts.
