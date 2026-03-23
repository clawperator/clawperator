# API Refactor Plan - Agent Review 3

**Status:** Ready for implementation
**Date:** March 23, 2026

## 1. Plan-to-code accuracy

The plan's understanding of the codebase's structure and behavior is highly accurate, though its specific line-number references for `apps/node/src/cli/index.ts` have drifted significantly due to other recent merges.

**Accurate Claims:**
- **`apps/node/src/cli/commands/action.ts`**: The plan correctly notes that `--submit` and `--clear` already exist on `action type`. It also correctly states that `cmdActionOpenApp` and `cmdActionOpenUri` are thin wrappers around builders.
- **`apps/node/src/contracts/selectors.ts`**: Phase 3's `NodeMatcher` mapping table perfectly matches lines 4-11 of this file exactly (fields: `resourceId`, `role`, `textEquals`, `textContains`, `contentDescEquals`, `contentDescContains`).
- **`apps/node/src/contracts/aliases.ts`**: The execution payload aliases mentioned (`tap` -> `click`, `press` -> `click`, `scroll_until`, `scroll_and_click`) are present and accurate.
- **`apps/node/src/contracts/execution.ts`**: The deferred item correctly identifies that `clickType` supports `"default" | "long_click" | "focus"`.
- **`apps/node/src/cli/commands/serve.ts`**: The HTTP routes `POST /observe/snapshot` and `POST /observe/screenshot` are exactly as described and take `deviceId` and `receiverPackage` in the JSON body.
- **Test Infrastructure**: `apps/node/src/test/unit/cliHelp.test.ts` uses spawn-based subprocess tests and asserts via `assert.match(stdout, /clawperator observe snapshot/)` exactly as claimed.
- **Smoke Scripts**: `scripts/clawperator_smoke_core.sh` uses old command forms extensively (`observe snapshot`, `action open-app`, `--output json`, `--device-id`).

**Inaccurate/Drifted Claims (Line Numbers only):**
The line numbers cited for `apps/node/src/cli/index.ts` are outdated, though the structure described remains true.
- `getGlobalOpts(argv)`: Plan says 335-380; actual is ~250-281.
- `getOpt`: Plan says 382-385; actual is 283-286.
- `hasFlag`: Plan says 438-440; actual is 327-329.
- `resolveHelpTopic`: Plan says 313-333; actual is 228-248.
- `HELP`: Plan says 9-119; actual is 9-55.
- `HELP_TOPICS`: Plan says 121-330; actual is 57-224.
- `switch` statement: Plan says 481-888; actual is 347-661.
- Exit code logic: Plan says 903-908; actual is 676-681.

*Conclusion:* The drift is purely line numbers. The technical architecture the plan describes is 100% accurate.

## 2. Phase boundary evaluation

The five phases are correctly sequenced, with highly logical boundaries:
- **Phase 0 -> Phase 1**: Setting up the "did you mean" and flag alias fallback mechanisms *before* the structural overhaul makes sense, though the plan's note that they can be combined into one PR is pragmatic.
- **Phase 1 (COMMANDS registry)**: Has excellent detail for execution. The transition from a switch block to a structured loop is well defined.
- **Phase 2 (Command Surface)**: Correctly groups the command promotion (`action click` -> `click`) with flag ergonomics.
- **Phase 3 (Selector Flags)**: Keeping selector parsing (`--text`, `--desc`, etc.) isolated in Phase 3 is a great idea. It prevents Phase 2 from ballooning in scope. Code-wise, `NodeMatcher` JSON construction is fully decoupled from the dispatch loop, so this boundary holds up perfectly.
- **Phase 4 (Help, Errors, Polish)**: Safely deferred to the end.

## 3. Registry design evaluation

The `COMMANDS` registry is a robust structural improvement over the existing switch statement.
- **`CommandDef` Interface**: Adequate for all commands. It supports subcommands by allowing namespaces (`skills`, `emulator`) to handle their internal routing within the handler, rather than forcing the registry to become a complex nested tree.
- **`HandlerContext` Type**: It captures exactly what the current switch statement relies on from the closure scope: `rest`, `format`, `verbose`, `logger`, `deviceId`, and `receiverPackage`.
- **Help Generation**: Replacing `resolveHelpTopic` with a registry-driven lookup that delegates subcommand help to the handlers is sound.
- **"Did you mean?"**: Deriving this from `Object.keys(COMMANDS)` and their `.synonyms` arrays is a clean, dynamic solution.

## 4. Gaps and risks

The plan is extremely comprehensive. There are only two extremely minor gaps:
1. **`serve` in Phase 4 Help Output**: The target help output string detailed in Phase 4's deliverables omits the `serve` command entirely. `serve` should probably be included under an `API:` or `Execution:` group.
2. **`--version` handling**: `index.ts` intercepts `--version` at line ~343, before options parsing or the command switch. The plan does not explicitly state whether `--version` should become a registry command or remain intercepted early. Leaving it as an early intercept is fine, but it might be worth adding a registry entry for help text generation purposes.

*These are trivial and do not block implementation.*

## 5. Design principles alignment

The plan perfectly executes the guidance in `docs/design/node-api-design-guiding-principles.md`:
- **Principle 1 & 2 (Guessability & Flat Commands):** Met by destroying the `action`/`observe` taxonomy and moving verbs to the root.
- **Principle 3 & 4 (Familiar Vocabulary & Synonyms):** Met by using `click`/`type` but silently accepting `tap`/`fill`.
- **Principle 5 (Simple Arguments):** Met by Phase 3's introduction of `--text`, `--id`, etc.
- **Principle 6 & 10 (Short Flags & No Implementation Leaks):** Met by renaming `--receiver-package` to `--operator-package` and `--timeout-ms` to `--timeout`.
- **Principle 7 (Errors Must Teach):** Met by Phase 0 "did you mean" redirects and Phase 2/3's missing-selector examples.

## 6. Docs refactor downstream impact

Reviewed `tasks/docs/refactor/`:
- `plan.md` and `prd-1-entry-points.md` accurately list the API refactor as a hard dependency.
- The command examples in PRD-1 correctly utilize the new syntax (e.g., `clawperator snapshot`, `clawperator click --text "..."`, `--device`).
- No stale references to old phase numbers were found.

## 7. Overall assessment

**This plan is ready for implementation.** 

The technical approach is sound, the phase boundaries are pragmatic, and the alignment with the design principles is exact.

**Actionable tweaks during implementation (Severity: Nice-to-have):**
1. Add the `serve` command to the target help text layout in Phase 4.
2. Ensure the pre-switch early returns for empty `argv`, `help`, and `--version` are gracefully handled or mapped to the registry during Phase 1.