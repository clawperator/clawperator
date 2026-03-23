# API Refactor Review

Verdict: **FAIL**

The plan is much closer than it was before, and most of the command-surface
work now lines up with the current codebase. The remaining blocker is a scope
contradiction around `logs --follow`, which the plan treats both as out of
scope and as a fully designed surface. That has to be resolved before this can
be signed off.

## 1. Plan-to-code Accuracy

Most of the current plan now matches the code:

- The registry migration list covers every existing top-level switch case in
  `apps/node/src/cli/index.ts`, including `operator`, `setup`, `install`,
  `devices`, `emulator`, `provision`, `packages`, `execute`, `observe`,
  `inspect`, `action`, `skills`, `recording`, `record`, `serve`, `doctor`,
  `grant-device-permissions`, and `version`.
- The proposed `HandlerContext` includes the closure state the current switch
  cases actually use, including `rest`, `format`, `verbose`, `logger`,
  `deviceId`, `receiverPackage`, and `timeoutMs`.
- The selector mapping in Phase 3 matches `apps/node/src/contracts/selectors.ts`
  exactly: `resourceId`, `role`, `textEquals`, `textContains`,
  `contentDescEquals`, and `contentDescContains`.
- The canonical action list in `apps/node/src/contracts/aliases.ts` is fully
  covered by the plan, including the later Phase 5 additions:
  `scroll_until`, `scroll_and_click`, `close_app`, `wait_for_navigation`, and
  `read_key_value_pair`.

The one accuracy problem is internal to the plan itself:

- `tasks/api/refactor/plan.md:1420` says `logs --follow` "is the exception" and
  "is not scheduled in any phase".
- `tasks/api/refactor/plan.md:1716` immediately follows with a full designed
  surface for `clawperator logs --follow` and `clawperator logs -f`.

Those two statements cannot both be true. Given the user context for this
revision, `logs --follow` should either be clearly promoted into Phase 5 or
cleanly removed from the plan, but not left in both states at once.

## 2. Phase Boundary Evaluation

The phase ordering itself is sound:

- Phase 0 -> Phase 1 makes sense as the registry foundation.
- Phase 1 has enough detail for a lower-capability agent to execute the
  migration mechanically.
- Phase 2 and Phase 3 are still separated cleanly.
- Phase 4 before Phase 5 is a reasonable dependency order.

The problem is not sequencing, it is completeness. The plan says it has done a
systematic audit to avoid deferring anything that belongs in the refactor, but
`logs --follow` is still treated as deferred in prose while also being designed.
That is exactly the kind of scope ambiguity this refactor is supposed to remove.

## 3. Registry Design Evaluation

The `COMMANDS` registry approach looks viable.

- `operator` fits the proposed model because its top-level registry entry can
  hand off internal `setup` / `install` subcommand dispatch exactly the way the
  current switch does.
- `action` fits because the registry entry can still delegate to the existing
  subcommand handler pattern while preserving the `--submit` / `--clear`
  behavior currently in `cmdActionType`.
- `execute` fits because it is a thin wrapper around execution payload parsing
  and can be renamed to `exec` without losing behavior.

`HandlerContext` is also sufficient for the current switch cases. Nothing in the
existing command set requires a wider ambient closure than the plan already
threads through.

The help-generation and "did you mean?" strategy is practical. A flat registry
is the right source of truth for both command discovery and synonym handling,
and the plan correctly avoids building a nested subcommand registry too early.

## 4. Gaps and Risks

The remaining risks are mostly about consistency rather than missing mechanics:

- `logs --follow` is still contradictory, as noted above.
- The downstream docs refactor still contains stale command examples that use
  the pre-refactor surface. For example, `tasks/docs/refactor/prd-1-entry-points.md:319`
  and `tasks/docs/refactor/prd-1-entry-points.md:370` still mention
  `clawperator doctor --output json`.
- `tasks/docs/refactor/plan.md:126` still says `scrollUntil` is currently in
  the API refactor's deferred items list, which is now stale relative to the
  current Phase 5 design.

Those docs issues are downstream of the API refactor, so they are not blockers
for this plan by themselves, but they should be corrected when the docs work
starts so the follow-on PRDs do not reintroduce old-surface examples.

## 5. Design Principles Alignment

The plan is consistent with the guiding principles doc overall:

1. Guessability over taxonomy: **consistent**
2. Flat commands for actions, namespaces only for subsystems: **consistent**
3. Familiar vocabulary first: **consistent**
4. One primary name, accept synonyms: **consistent**
5. Simple arguments over structured input: **consistent**
6. Short, generic flag names: **consistent**
7. Errors must teach: **consistent**
8. Deterministic behavior over convenience heuristics: **consistent**
9. Output is also API: **consistent**
10. Implementation details are not API: **consistent**

The plan does a good job of applying the document's intent rather than merely
parroting it.

## 6. Docs Refactor Downstream Impact

The downstream docs plans correctly depend on the API refactor:

- `tasks/docs/refactor/plan.md` blocks on `tasks/api/refactor/` being complete.
- `tasks/docs/refactor/prd-1-entry-points.md` and
  `tasks/docs/refactor/prd-2-structure.md` both explicitly say the API refactor
  must land first.

The examples are mixed:

- `tasks/docs/refactor/prd-1-entry-points.md` does use the new surface in some
  places, such as `snapshot`, `click --text`, and `--device`.
- The same file still has stale `--output json` examples.
- `tasks/docs/refactor/prd-2-structure.md` mostly speaks in terms of the new
  API surface and is correctly framed as downstream.

There are no obvious stale phase-number references in the docs refactor files,
but there are still stale command examples that will need cleanup when those
PRDs are implemented.

## 7. Overall Assessment

This plan is **not quite ready for implementation** because it still contains a
scope contradiction around `logs --follow`.

### Required Changes

1. Make `logs --follow` consistent everywhere in the plan.
2. If it belongs in Phase 5, add it to the Phase 5 deliverables and remove the
   "not scheduled in any phase" language.
3. If it does not belong, remove the designed surface block so the plan does not
   promise an out-of-scope API.

### Severity

- **Blocking:** `logs --follow` is simultaneously excluded and designed.
- **Should-fix:** downstream docs PRDs still contain stale old-surface examples.
- **Nice-to-have:** tighten the docs-refactor examples so they all consistently
  use the new command surface once the API refactor lands.

