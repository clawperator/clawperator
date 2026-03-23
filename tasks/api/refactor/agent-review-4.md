# API Refactor Plan Review

Reviewed against:
- [tasks/api/refactor/plan.md](~/src/clawperator/tasks/api/refactor/plan.md)
- [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts)
- [apps/node/src/cli/commands/action.ts](~/src/clawperator/apps/node/src/cli/commands/action.ts)
- [apps/node/src/contracts/selectors.ts](~/src/clawperator/apps/node/src/contracts/selectors.ts)
- [apps/node/src/contracts/aliases.ts](~/src/clawperator/apps/node/src/contracts/aliases.ts)
- [apps/node/src/contracts/execution.ts](~/src/clawperator/apps/node/src/contracts/execution.ts)
- [apps/node/src/cli/commands/serve.ts](~/src/clawperator/apps/node/src/cli/commands/serve.ts)
- [apps/node/src/test/unit/cliHelp.test.ts](~/src/clawperator/apps/node/src/test/unit/cliHelp.test.ts)
- [scripts/clawperator_smoke_core.sh](~/src/clawperator/scripts/clawperator_smoke_core.sh)
- [scripts/clawperator_smoke_skills.sh](~/src/clawperator/scripts/clawperator_smoke_skills.sh)
- [scripts/clawperator_integration_canonical.sh](~/src/clawperator/scripts/clawperator_integration_canonical.sh)
- [docs/design/node-api-design-guiding-principles.md](~/src/clawperator/docs/design/node-api-design-guiding-principles.md)
- [tasks/docs/refactor/plan.md](~/src/clawperator/tasks/docs/refactor/plan.md)
- [tasks/docs/refactor/prd-1-entry-points.md](~/src/clawperator/tasks/docs/refactor/prd-1-entry-points.md)
- [tasks/docs/refactor/prd-2-structure.md](~/src/clawperator/tasks/docs/refactor/prd-2-structure.md)

## 1. Plan-to-Code Accuracy

Most of the plan is now aligned with the current code. The key architecture claims are accurate:
- The CLI is hand-rolled, with `getGlobalOpts()`, `getOpt()`, `hasFlag()`, `resolveHelpTopic()`, and the giant `switch` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L335).
- The selector contract really is `resourceId`, `role`, `textEquals`, `textContains`, `contentDescEquals`, `contentDescContains` in [apps/node/src/contracts/selectors.ts](~/src/clawperator/apps/node/src/contracts/selectors.ts#L4).
- `action type` already carries `--submit` and `--clear` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L659) and [apps/node/src/cli/commands/action.ts](~/src/clawperator/apps/node/src/cli/commands/action.ts#L147).

There are two concrete mismatches / omissions that matter for implementation:

### [Blocking] `HandlerContext` is missing `timeoutMs`

The proposed `HandlerContext` in Phase 1 only threads `rest`, `format`, `verbose`, `logger`, `deviceId`, and `receiverPackage` ([tasks/api/refactor/plan.md](~/src/clawperator/tasks/api/refactor/plan.md#L490)). That is not enough to preserve current behavior:
- `execute` uses `global.timeoutMs` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L589)
- `observe snapshot` and `observe screenshot` use `global.timeoutMs` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L603)
- `skills run` uses `global.timeoutMs` as the wrapper timeout in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L753)

Without `timeoutMs` in the handler context, those commands either lose behavior or have to re-parse values they no longer have access to.

### [Blocking] The plan omits the live `--format` alias

The current parser still accepts `--format` as an alias for `--output` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L356), and the test suite explicitly checks that alias in [apps/node/src/test/unit/cliHelp.test.ts](~/src/clawperator/apps/node/src/test/unit/cliHelp.test.ts#L196).

Phase 0 and Phase 2 normalize `--json` and `--output json`, but they never mention preserving `--format`. If that alias falls out during the refactor, current tests and current callers will break.

### [Should-fix] Phase 4 help structure omits `grant-device-permissions`

The current top-level help includes `grant-device-permissions` in [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L84), and Phase 1 explicitly says it is unchanged ([tasks/api/refactor/plan.md](~/src/clawperator/tasks/api/refactor/plan.md#L246), [tasks/api/refactor/plan.md](~/src/clawperator/tasks/api/refactor/plan.md#L516)).

But the Phase 4 target help structure in [tasks/api/refactor/plan.md](~/src/clawperator/tasks/api/refactor/plan.md#L991) does not include it at all. That makes the final help surface incomplete unless it is grouped somewhere intentionally.

## 2. Phase Boundary Evaluation

- Phase 0 -> Phase 1 is reasonable. The plan now correctly says the two phases can collapse, and it avoids the wasted hardcoded suggestion-map work if they do.
- Phase 1 is the right place for the registry extraction, but it is only safe if the handler context carries every global value the current switch cases use, especially `timeoutMs`.
- Phase 2 is correctly scoped around command promotion and argument ergonomics. The missing-selector example now matches the current `NodeMatcher` shape, so the earlier mismatch has been fixed.
- Phase 3 really is mostly independent in code, but it still belongs after Phase 2 because it depends on the promoted flat command names existing first.
- Phase 4 is appropriately last for polish, but it should not be the first place the plan notices missing commands in the help surface. `grant-device-permissions` needs a place in the grouped help output before Phase 4 is implemented.

## 3. Registry Design Evaluation

The registry approach is viable for the current command set:
- `devices` is a straightforward thin wrapper
- `execute` can be represented with a registry entry plus raw `rest` parsing
- `operator` can remain a namespaced handler with internal subcommand dispatch

The main design gap is `HandlerContext`. As written, it is not sufficient for the current switch cases because it omits `timeoutMs`.

Help generation can work for flat commands and for namespaced commands only if the handler retains its own subcommand help routing. A single `help` string per command is enough for `devices` or `execute`, but not enough by itself to describe both `operator --help` and `operator setup --help` unless the handler still owns the nested help behavior.

The "did you mean?" idea is practical. The registry can derive the candidate list from primary names plus synonyms. The current code already has a clean separator between CLI synonyms and payload aliases in [apps/node/src/contracts/aliases.ts](~/src/clawperator/apps/node/src/contracts/aliases.ts#L5), so that part of the plan is sound.

## 4. Gaps and Risks

- The plan does not explicitly preserve the pre-dispatch `help` and `--version` behavior from [apps/node/src/cli/index.ts](~/src/clawperator/apps/node/src/cli/index.ts#L442). Those are not normal commands, but they are still user-facing entry points and need to survive the registry migration.
- The plan does not explicitly say what happens to unknown flags for each command. It describes the desired "did you mean?" behavior, but the dispatch layer still needs a command-local flag schema or equivalent so it can tell typos apart from positional values.
- Phase 4 help content currently omits `grant-device-permissions`, which is otherwise called out as unchanged. That is the biggest completeness risk in the final help surface.
- The docs refactor PRD still contains stale output examples that use old flags, so the downstream docs work is not fully aligned yet.
- The smoke and integration scripts still use the old surface in [scripts/clawperator_smoke_core.sh](~/src/clawperator/scripts/clawperator_smoke_core.sh), [scripts/clawperator_smoke_skills.sh](~/src/clawperator/scripts/clawperator_smoke_skills.sh), and [scripts/clawperator_integration_canonical.sh](~/src/clawperator/scripts/clawperator_integration_canonical.sh). The plan correctly mentions them, but Phase 2 needs to treat all three as required migration targets.

## 5. Design Principles Alignment

The plan is consistent with all 10 principles in [docs/design/node-api-design-guiding-principles.md](~/src/clawperator/docs/design/node-api-design-guiding-principles.md):

1. Guessability Over Taxonomy: consistent
2. Flat Commands for Actions, Namespaces Only for Subsystems: consistent
3. Familiar Vocabulary First: consistent
4. One Primary Name, Accept Synonyms: consistent
5. Simple Arguments Over Structured Input: consistent
6. Short, Generic Flag Names: consistent
7. Errors Must Teach: consistent
8. Deterministic Behavior Over Convenience Heuristics: consistent
9. Output Is Also API: consistent, though it is silent on pretty-output details that do not need to change
10. Implementation Details Are Not API: consistent

## 6. Docs Refactor Downstream Impact

The dependency chain is stated correctly in [tasks/docs/refactor/plan.md](~/src/clawperator/tasks/docs/refactor/plan.md#L31): docs refactor waits on the API refactor, and PRD-2 waits on PRD-1.

The downstream docs plans are mostly aligned with the new command surface, but PRD-1 still has stale examples:
- The AGENTS.md template still uses `clawperator operator setup --apk <path> --device <id>` in [tasks/docs/refactor/prd-1-entry-points.md](~/src/clawperator/tasks/docs/refactor/prd-1-entry-points.md#L168)
- The test/acceptance sections still mention `clawperator doctor --output json` in [tasks/docs/refactor/prd-1-entry-points.md](~/src/clawperator/tasks/docs/refactor/prd-1-entry-points.md#L317) and [tasks/docs/refactor/prd-1-entry-points.md](~/src/clawperator/tasks/docs/refactor/prd-1-entry-points.md#L367)

PRD-2 is cleaner. Its structure discussion is dependency-correct and does not appear to rely on old CLI examples.

## 7. Overall Assessment

Not ready for implementation yet.

### Blocking
1. Add `timeoutMs` to the registry handler context, or otherwise preserve the current global timeout behavior.
2. Explicitly preserve `--format` as a live alias, since the current code and tests still depend on it.

### Should-fix
1. Put `grant-device-permissions` into the final grouped help structure.
2. Make the registry migration preserve `help`, empty-argv, and `--version` behavior explicitly.
3. Clean the stale `--output json` examples out of PRD-1 before the docs refactor starts.

### Nice-to-have
1. Spell out the command-local unknown-flag strategy in the registry design so implementers do not have to improvise it.
