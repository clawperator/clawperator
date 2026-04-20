# Enter Text Clear Contract Bug Work Breakdown

Parent plan: `tasks/api/clear/plan.md`

## Executive Summary

1 PR, 2 phases. Phase 1 makes `clear` truthful end to end across the Android
parser, task layer, runtime implementation, and tests. Phase 2 updates docs and
completes final validation. This is a dedicated bug-fix pack, not a redesign of
`enter_text`.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Keep the public `clear` boolean stable. Do not redesign the public API in
  this pack.
- Do not silently ignore `clear=true` anymore.
- If a requested clear cannot be performed on the chosen runtime route, fail
  explicitly instead of degrading to `clear=false`.
- Preserve current replace-style behavior when `clear=false`.
- The phase that introduces runtime behavior must include the tests that prove
  it.
- Do not fold the broader enter-text runtime upgrade into this bug pack.
- If the broader `enter_text` seam already exists on the branch, implement this
  fix through that seam instead of recreating a one-off direct path.
- Use `.agents/skills/docs-author/SKILL.md` for the docs phase.
- Do not edit generated docs directly. Update authored docs and then run
  `./scripts/docs_build.sh`.
- Keep commits narrow and reviewable: code plus tests first, docs second.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/api/clear/plan.md` | Stable contract and scope boundaries |
| `apps/node/src/contracts/execution.ts` | Existing public `clear` contract |
| `apps/node/src/domain/actions/typeText.ts` | Request construction that already forwards `clear` |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Current point where Android drops `clear` |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` | Android action state that must carry `clear` |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt` | Android task execution path |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` | Current text-entry implementation to fix |
| `tasks/api/enter-text/plan.md` | Cross-pack constraint if the broader text-entry seam lands first |
| `docs/api/actions.md` | Public action docs to correct in Phase 2 |
| `docs/api/mcp.md` | MCP-facing docs to correct in Phase 2 |
| `.agents/skills/docs-author/SKILL.md` | Required docs workflow for Phase 2 |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Make `clear` truthful end to end and update docs | 1, 2 | thinking, default | none |

## Phase 1: Runtime Fix And Regression Coverage

### Agent Tier

thinking

### Goal

Propagate `clear` through Android and implement real clear-before-type behavior
with regression coverage in the same phase.

### Files or Surfaces To Change

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScopeDefault.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`
- Android and Node tests that prove end-to-end `clear` behavior

### Steps

1. Parse `clear` in the Android agent command parser and carry it through the
   Android action/task/runtime layers.
2. If the branch already contains the broader `enter_text` seam, thread `clear`
   through that seam instead of bypassing it.
3. Implement clear-before-type behavior for supported text-entry routes.
4. For `ACTION_SET_TEXT`-capable targets, clear first with empty text and then
   write the final text.
5. Decide whether additive runtime step data should report the clear method
   used. Keep any addition small and truthful.
6. Add focused regressions for at minimum:
   - Node-side request construction still forwards `clear`
   - Android parser preserves `clear=true`
   - supported route no longer drops `clear=true` and honors it truthfully,
     even when the caller-visible final text matches the replace-style
     `clear=false` route
   - `clear=false` preserves current replace-style behavior
   - unsupported clear attempt fails explicitly
   - if multiple internal strategies exist on the branch, none of them silently
     ignore `clear=true`
7. Keep docs out of this phase. Code plus tests only.

### Acceptance Criteria

- Android no longer drops `clear`.
- Supported routes honor `clear=true` truthfully instead of silently treating it
  as `clear=false`.
- Unsupported clear attempts fail explicitly.
- `clear=false` still behaves like the pre-fix replace-style route.
- Tests cover request construction, Android parsing, supported behavior, and
  explicit failure.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
git diff --check
```

Plus:
- the phase is not complete until the runtime proof in the phase steps is
  recorded, either as a live validation result on a suitable target or as an
  explicit blocked reason naming the missing precondition

### Expected Commit

```text
fix(android): implement enter_text clear behavior
```

## Phase 2: Docs And Final Validation

### Agent Tier

default

### Goal

Correct the public and internal docs so they match the shipped `clear`
behavior, then run final validation.

### Files or Surfaces To Change

- `docs/api/actions.md`
- `docs/api/mcp.md`
- `docs/internal/design/operator-llm-playbook.md`

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the authored-doc updates.
2. Update public docs so `clear` is described accurately, including explicit
   failure when the selected runtime route cannot clear truthfully.
3. Update internal docs that currently describe `clear` as accepted but ignored.
4. Run `./scripts/docs_build.sh`.
5. Re-run the Phase 1 validation commands after the docs updates.
6. Launch the debug operator and run a live validation pass on a field with
   pre-existing text when a suitable target is available.
7. Record the target device or emulator serial, operator package, and blocked
   reason if live validation is not possible.

### Acceptance Criteria

- Public docs describe the shipped `clear` behavior accurately.
- Internal docs no longer call `clear` ignored if the bug is fixed.
- `./scripts/docs_build.sh` passes.
- Final validation proves the behavior on code paths that callers can actually
  hit, not only parser or help text coverage.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew app:assembleDebug app:testDebugUnitTest
./gradlew app:installDebug
./scripts/docs_build.sh
git diff --check
```

### Expected Commit

```text
docs(api): document enter_text clear behavior
```
