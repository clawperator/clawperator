# API Refactor Plan - Critical Review

Reviewed against the current code in `apps/node/src/cli/`, `apps/node/src/contracts/`, `scripts/`, `docs/design/`, and `tasks/docs/refactor/`.

## 1. Plan-to-Code Accuracy

Most of the plan now matches the current codebase very closely.

- The CLI really is hand-rolled. The plan's references to `getGlobalOpts()`, `getOpt()`, `hasFlag()`, `resolveHelpTopic()`, and the giant `switch` in `apps/node/src/cli/index.ts` are all accurate.
- The selector contract in `apps/node/src/contracts/selectors.ts` really is `resourceId`, `role`, `textEquals`, `textContains`, `contentDescEquals`, and `contentDescContains`.
- The execution alias layer in `apps/node/src/contracts/aliases.ts` is separate from CLI command dispatch, which matches the plan's distinction between payload aliases and command synonyms.
- The HTTP route table in `apps/node/src/cli/commands/serve.ts` really does include `POST /observe/snapshot`, `POST /observe/screenshot`, `POST /execute`, and `GET /devices`, so the plan's route rename table is aligned with the actual Express routes it intends to change.
- The current smoke scripts and CLI help tests still use the old surface in the places the plan says they do.

One substantive mismatch remains:

- The proposed Phase 1 registry contract is too narrow for `serve`. The plan defines `handler: (ctx: HandlerContext) => Promise<string>` in [tasks/api/refactor/plan.md](tasks/api/refactor/plan.md), lines 508-563, but `cmdServe` in [apps/node/src/cli/commands/serve.ts](apps/node/src/cli/commands/serve.ts), lines 27-35 returns `Promise<void>` and intentionally parks the process in a never-resolving promise after starting the server. The current dispatcher in [apps/node/src/cli/index.ts](apps/node/src/cli/index.ts), lines 839-855 special-cases `serve` by returning early instead of going through the normal `console.log(result)` path. A registry that only accepts string-returning handlers will force `serve` into an awkward exception to the design.

## 2. Phase Boundary Evaluation

- Phase 0 -> Phase 1 is a sensible boundary. The plan now correctly says the two phases can collapse if desired.
- Phase 1 is detailed enough for a less-capable agent to execute, but only if the registry contract is widened enough to represent `serve`.
- Phase 2 is now correctly scoped. The missing-selector examples match the actual `NodeMatcher` field names and the `--submit` / `--clear` carry-forward note is accurate.
- Phase 3 is still genuinely independent in code.
- Phase 4 is appropriately late for help/error polish and the HTTP route rename.

The only phase-boundary concern is the same `serve` issue above: if the registry contract cannot model a long-running command, Phase 1 stops being a pure architectural refactor and becomes a special-case rewrite.

## 3. Registry Design Evaluation

The `COMMANDS` registry is a good architectural bet for most of the current surface.

- `operator` fits the pattern because the registry entry can keep its internal `setup` / `install` dispatch.
- `action` fits because it can be wrapped as a thin handler over the existing `action.ts` functions.
- `execute` fits because it can stay a raw `rest` parser with no need for a nested registry.
- `serve` is the outlier. It does not fit cleanly into the proposed `Promise<string>` handler shape and needs either a `void`/`never`-capable handler type or an explicit long-running command escape hatch.

Help generation is workable for namespaced commands, but only if the handlers keep owning their nested help behavior for things like `operator` and `skills`. The plan does say that, which is good. The "did you mean?" derivation from registry keys plus synonyms is also practical and matches the current command inventory.

## 4. Gaps and Risks

- The plan does not explicitly call out the `serve` handler shape mismatch, which is the main implementation risk I found.
- [tasks/docs/refactor/prd-1-entry-points.md](tasks/docs/refactor/prd-1-entry-points.md), lines 319 and 370 still contain stale `clawperator doctor --output json` examples. Those should become `--json` before the docs work starts.
- [tasks/docs/refactor/plan.md](tasks/docs/refactor/plan.md), line 126 still says `scrollUntil` is deferred, but the current API refactor plan now ships `scroll-until` in Phase 5. That downstream note is stale and should be updated.
- The plan correctly calls out `scripts/clawperator_smoke_core.sh` as needing migration, but it does not need to chase `scripts/clawperator_smoke_scroll.sh` because that script still uses `execute` payloads and old alias flags, not the removed nested commands.

## 5. Design Principles Alignment

1. Guessability Over Taxonomy: consistent
2. Flat Commands for Actions, Namespaces Only for Subsystems: consistent
3. Familiar Vocabulary First: consistent
4. One Primary Name, Accept Synonyms: consistent
5. Simple Arguments Over Structured Input: consistent
6. Short, Generic Flag Names: consistent
7. Errors Must Teach: consistent
8. Deterministic Behavior Over Convenience Heuristics: consistent
9. Output Is Also API: consistent
10. Implementation Details Are Not API: consistent

## 6. Docs Refactor Downstream Impact

- The dependency chain is correct: API refactor -> PRD-1 -> PRD-2.
- PRD-1 is mostly aligned with the new surface. Its AGENTS.md template already uses `--device` and the new docs flow, which is good.
- PRD-1 still has stale `doctor --output json` examples in its verification sections, so it is not fully aligned yet.
- PRD-2 is appropriately downstream and does not appear to rely on old CLI examples.
- The docs refactor plan still has a stale `scrollUntil` note, which should be cleaned up before the docs work begins.

## 7. Overall Assessment

Not ready for implementation yet.

Blocking:
- Broaden the registry handler contract so `serve` can remain long-running without violating the `Promise<string>` assumption.

Should-fix:
- Update the stale `doctor --output json` examples in PRD-1.
- Remove or rewrite the stale `scrollUntil` note in the docs refactor plan.

Nice-to-have:
- Spell out in the API refactor plan that `serve` is the one command that may bypass the normal string-returning handler flow.
