# Agent Review 5: Final Sign-off Review

Date: 2026-03-23
Reviewer: Independent agent (sign-off review)

## Summary

The plan is thorough, well-sequenced, and accurately reflects the current codebase. All 18 canonical action types have CLI coverage (existing or designed in Phase 5), all switch cases are accounted for, and the Phase 5 designs reference correct builder functions and ActionParams fields. There is one internal contradiction in the Design Decisions section and one TypeScript type gap the implementing agent should be aware of, but neither blocks implementation.

## Findings

### Consistency: `read --all` contradicts Design Decisions section

The Design Decisions section at lines 219-220 states:

> Future consideration: `--all` flag to return all matches as a list (not in scope for this refactor)

However, Phase 5 deliverable 6 (lines 1227-1235) explicitly designs and schedules `read --all` as an in-scope deliverable. The Before/After table (line 82) also lists `read --text "X" --all --json` as a target command. The Design Decisions text was not updated when Phase 5 was expanded to include `--all`. The implementing agent should treat Phase 5's spec as authoritative and ignore the stale "not in scope" note.

Lines 219-220 should read something like: "`--all` flag to return all matches as a list (Phase 5 deliverable)" to be consistent with the rest of the plan.

### Implementation note: ActionParams type is missing fields for wait-for-nav and read-value

The plan references `expectedPackage`, `expectedNode`, and `labelMatcher` as fields the `wait-for-nav` and `read-value` handlers will populate in ActionParams. These fields exist in the Zod validation schema (`apps/node/src/domain/executions/validateExecution.ts:56-60`) but are NOT present in the TypeScript `ActionParams` interface (`apps/node/src/contracts/execution.ts:6-36`).

The execution payload passes through as JSON and validation uses the Zod schema, so this works at runtime. However, the implementing agent building typed execution objects for these commands will need to either:
1. Add `expectedPackage`, `expectedNode`, `timeoutMs` (action-level), and `labelMatcher` to the `ActionParams` interface, or
2. Cast/escape the type system when constructing the payload.

Option 1 is the correct approach and should be considered part of Phase 5's implementation scope. The plan does not call this out, but it is a natural consequence of building typed builders for these action types. This is not a plan design issue - it is an implementation detail that the implementing agent will discover immediately.

Similarly, `buildClickExecution()` in `apps/node/src/domain/actions/click.ts:4` currently takes only a `NodeMatcher` parameter with no `clickType` argument. Phase 5 deliverable 4 (--long/--focus) will require either modifying this builder to accept an optional `clickType` parameter or creating a new builder. The plan's implementation guidance for this deliverable (lines 1206-1215) is sufficient - the implementing agent will see the builder signature and know what to do.

### Accuracy: Line number references are correct

All line number references in the Implementation Context section were verified against the actual source:
- `index.ts:481-888` (switch statement): actual range 481-888. Correct.
- `index.ts:9-330` (HELP/HELP_TOPICS): HELP starts at line 9, HELP_TOPICS block ends around line 309. Correct.
- `index.ts:464-468` (--help intercept): exact match.
- `index.ts:887` (default case): actual line 886. Off by one, acceptable.
- `index.ts:903-908` (exit code logic): exact match.
- `index.ts:667-668` (submit/clear flags on action type): exact match.
- `action.ts:151-153` (submit/clear in cmdActionType): exact match.

### Accuracy: All 18 canonical action types have CLI coverage

Verified against `apps/node/src/contracts/aliases.ts:25-44`:

| # | Canonical type | CLI coverage |
|---|---|---|
| 1 | `open_app` | `open` (Phase 2) |
| 2 | `open_uri` | `open` (Phase 2) |
| 3 | `close_app` | `close` (Phase 5) |
| 4 | `start_recording` | `recording start` (unchanged) |
| 5 | `stop_recording` | `recording stop` (unchanged) |
| 6 | `wait_for_node` | `wait` (Phase 2) |
| 7 | `click` | `click` (Phase 2) |
| 8 | `scroll_and_click` | `scroll-until --click` (Phase 5) |
| 9 | `scroll` | `scroll` (Phase 2) |
| 10 | `scroll_until` | `scroll-until` (Phase 5) |
| 11 | `read_text` | `read` (Phase 2) |
| 12 | `enter_text` | `type` (Phase 2) |
| 13 | `snapshot_ui` | `snapshot` (Phase 2) |
| 14 | `take_screenshot` | `screenshot` (Phase 2) |
| 15 | `sleep` | `sleep` (Phase 5) |
| 16 | `press_key` | `press` (Phase 2) |
| 17 | `wait_for_navigation` | `wait-for-nav` (Phase 5) |
| 18 | `read_key_value_pair` | `read-value` (Phase 5) |

All 18 are covered. No gaps.

### Accuracy: All switch cases accounted for

Verified against `apps/node/src/cli/index.ts:481-888`:

| Switch case | Plan treatment |
|---|---|
| `operator` | Migrated to registry (Phase 1) |
| `setup` | Migrated to registry (guidance redirect) |
| `install` | Migrated to registry (guidance redirect) |
| `devices` | Migrated to registry (unchanged) |
| `emulator` | Migrated to registry (unchanged) |
| `provision` | Migrated to registry (unchanged) |
| `packages` | Migrated to registry (unchanged) |
| `execute` | Migrated to registry, renamed to `exec` (Phase 5) |
| `observe` | Removed, "did you mean?" (Phase 2) |
| `inspect` | Removed, "did you mean?" (Phase 2) |
| `action` | Removed, "did you mean?" (Phase 2) |
| `skills` | Migrated to registry (unchanged) |
| `recording`/`record` | Migrated to registry (unchanged) |
| `serve` | Migrated to registry (unchanged) |
| `doctor` | Migrated to registry (unchanged) |
| `grant-device-permissions` | Migrated to registry (unchanged) |
| `version` | Migrated to registry (unchanged) |
| `default` | Replaced by registry-driven "did you mean?" |

All cases accounted for. No gaps.

### Accuracy: NodeMatcher field mapping is correct

Phase 3's mapping table (lines 1017-1024) was verified against the actual `NodeMatcher` interface in `apps/node/src/contracts/selectors.ts:4-11`. All six fields are covered:

- `--text` -> `textEquals` (line 7)
- `--text-contains` -> `textContains` (line 8)
- `--id` -> `resourceId` (line 5)
- `--desc` -> `contentDescEquals` (line 9)
- `--desc-contains` -> `contentDescContains` (line 10)
- `--role` -> `role` (line 6)

Correct and complete.

### Accuracy: HTTP API routes match current code

The Before/After table for HTTP routes (lines 119-126) was verified against `apps/node/src/cli/commands/serve.ts`:

- `POST /observe/snapshot` (serve.ts:141) -> `POST /snapshot`: correct current route.
- `POST /observe/screenshot` (serve.ts:186) -> `POST /screenshot`: correct current route.
- `POST /execute` (serve.ts:100): correct, unchanged.
- `GET /devices` (serve.ts:51): correct, unchanged.

The plan does not mention skill, emulator, or SSE routes (`/skills`, `/android/emulators/*`, `/events`) but these are explicitly listed as unchanged (line 1133-1134) and not part of the refactor. No gap.

### Phase 5 review: Agent ergonomics assessment

**scroll-until**: Natural. The `--click` flag to differentiate scroll-until from scroll-and-click is elegant and avoids having two separate commands. The synonym `scroll-and-click` provides a safety net for agents that know the execution type name. Direction defaulting to `down` is correct - the vast majority of scroll-until operations are downward. No issues.

**close**: Natural. Mirrors `open` pattern. Positional package name is what agents expect. No issues.

**exec**: Natural. Positional payload is a significant improvement over `--execution`. The `execute` synonym preserves backward compatibility for scripts. No issues.

**--long/--focus on click**: Natural. Flag names are concise and unambiguous. Mutual exclusivity is correctly specified. Error message is clear. No issues.

**wait --timeout**: The semantic override (wait duration vs execution timeout) is well-justified in the rationale (lines 1512-1516). The 5-second buffer implementation is practical. No issues.

**read --all**: The `--json` requirement is reasonable and well-motivated. No issues.

**sleep**: Natural and trivial. No issues.

**wait-for-nav**: The `--timeout` requirement is correct (agents must be explicit about how long to wait for a transition). The max 30000ms cap matches the existing validation in `validateExecution.ts:294`. Synonym `wait-for-navigation` matches the canonical action type. No issues.

**read-value**: The `--label` flags are distinct from the Phase 3 selector flags, which is correct since they populate a different matcher (`labelMatcher` vs `matcher`). The `--all --json` semantics are consistent with `read --all`. The synonym `read-kv` is concise. No issues.

### Minor: Before/After table omits some Phase 5 commands

The Before/After commands table (lines 56-86) includes `sleep`, `wait-for-nav`, and `read-value` in the "Post-Phase 4" section, but `logs --follow` is not listed there. This is fine since the plan explicitly says `logs --follow` is not scheduled in any phase (line 1420-1421). Just noting for completeness.

### Minor: `logs` command does not currently exist

The Designed but Deferred section (lines 1716-1727) designs `logs --follow` and `logs -f`. There is no existing `logs` command in the current CLI. This means `logs --follow` would require both a new `logs` command and the streaming infrastructure. The plan correctly identifies this as out of scope, but the implementing agent should be aware that this is not just adding `--follow` to an existing command - it is an entirely new command.

## Verdict

PASS WITH NOTES

The plan is accurate and well-designed. No blocking issues were found.

Required action (minor, does not block implementation):
- Lines 219-220 in Design Decisions should be updated to reflect that `read --all` is now in scope (Phase 5), not "Future consideration" / "not in scope." This is a documentation consistency fix within the plan itself. The Phase 5 spec is authoritative.

Advisory notes for implementing agents (no plan changes needed):
- `ActionParams` in `apps/node/src/contracts/execution.ts` needs `expectedPackage`, `expectedNode`, `timeoutMs` (action-level), and `labelMatcher` fields added as part of Phase 5 implementation for `wait-for-nav` and `read-value` builders.
- `buildClickExecution()` in `apps/node/src/domain/actions/click.ts` needs a `clickType` parameter added for Phase 5 deliverable 4 (--long/--focus).
