# Enter Text Clear Contract Bug

## Executive Summary

This pack addresses the dedicated `clear` contract bug separately from the
broader `enter_text` runtime upgrade. Today the Node contract and CLI expose
`clear`, but Android ignores it. The goal here is not API redesign. It is to
make the existing public `clear` behavior truthful end to end. This is a small
but real cross-surface fix: 1 PR, 2 phases. Phase 1 lands the runtime contract
propagation and tests. Phase 2 updates docs and completes validation.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | 1, 2 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

After this pack ships, `clear=true` on `enter_text` must either perform a real
clear-before-type flow on Android or fail explicitly. It must no longer be
silently ignored, and it must stay truthful if the broader `enter_text`
strategy seam lands before this bug fix does.

## Why Now

The public contract already promises `clear`, so this is a correctness bug, not
an enhancement. Leaving it in place makes the API dishonest and undermines the
broader text-entry work.

## In Scope

- Propagate `clear` through the Android parser and task/runtime layers
- Implement a real Android clear-before-type behavior for supported text-entry
  routes
- Preserve current replace-style text-entry behavior when `clear=false`
- Add regression coverage in the same phase that introduces the behavior
- Update public and internal docs that describe `clear`

## Out of Scope

- The broader `enter_text` runtime upgrade tracked in `tasks/api/enter-text/`
- New public text-entry parameters
- App-specific clear hacks
- Reworking submit semantics beyond what is required to keep existing behavior
  stable during the bug fix

## Existing Artifact Scope

- `apps/node/src/contracts/execution.ts`, `apps/node/src/domain/actions/typeText.ts`,
  and `apps/node/src/cli/registry.ts`: preserve the existing public `clear`
  shape and semantics
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`:
  fully in scope for parsing `clear`
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`,
  `TaskUiScope.kt`, `TaskUiScopeDefault.kt`, and
  `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt`:
  fully in scope for end-to-end Android clear behavior
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`:
  in scope if a shared text-entry request or result seam is needed to keep the
  fix aligned with broader `enter_text` work
- `docs/api/actions.md`, `docs/api/mcp.md`, and
  `docs/internal/design/operator-llm-playbook.md`: in scope for correcting the
  public and internal contract description

## Surfaces and Ownership

| Surface | What changes | Owner |
| --- | --- | --- |
| `apps/node/src/contracts/execution.ts` | Preserve the existing public `clear` contract and verify it remains aligned | Phase 1 |
| `apps/node/src/domain/actions/typeText.ts` | Preserve request construction for `clear` | Phase 1 |
| `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` | Parse `clear` into Android action state | Phase 1 |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt` | Carry `clear` through the Android task layer | Phase 1 |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskUiScope.kt`, `TaskUiScopeDefault.kt` | Execute clear-before-type semantics | Phase 1 |
| `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManager.kt`, `UiTreeManagerAndroid.kt` | Implement real clear behavior for supported paths and align with any text-entry seam already on the branch | Phase 1 |
| Android and Node tests | Regression coverage for `clear` | Phase 1 |
| `docs/api/actions.md`, `docs/api/mcp.md`, `docs/internal/design/operator-llm-playbook.md` | Correct docs about `clear` behavior | Phase 2 |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Current bug framing | This `plan.md` |
| Current public contract | `apps/node/src/contracts/execution.ts`, `apps/node/src/cli/registry.ts` |
| Request construction | `apps/node/src/domain/actions/typeText.ts`, `apps/node/src/cli/commands/action.ts` |
| Android parser and task flow | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`, `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`, `TaskUiScopeDefault.kt` |
| Android text-entry implementation | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeManagerAndroid.kt` |
| Existing docs | `docs/api/actions.md`, `docs/api/mcp.md`, `docs/internal/design/operator-llm-playbook.md` |

## Deterministic Versus Judgment

**Deterministic - do not re-derive:**

- Keep the existing public `clear` boolean. Do not replace it with a new public
  API shape in this bug-fix pack.
- `clear=true` must no longer be silently ignored.
- For `ACTION_SET_TEXT`-capable targets, implement clear using the documented
  Android clear path of setting empty text before writing the final value.
- If `clear=true` is requested and the runtime cannot perform the requested
  clear behavior on the chosen route, fail explicitly rather than silently
  behaving like `clear=false`.
- If the broader `enter_text` seam has already landed when this pack is
  implemented, fix `clear` through that seam instead of reintroducing a
  one-off path that will diverge immediately.
- Tests that prove the new behavior must ship in the same phase as the code
  change.

**Judgment required:**

- Whether the Android runtime should surface additive step-data details about
  the clear method used
- Whether docs need one or multiple callouts to explain explicit failure on
  unsupported clear paths

## Decision Rules

| Question | Rule |
| --- | --- |
| Should `clear` remain public? | Yes. The contract already exists; this pack makes it truthful. |
| How should clear work on `ACTION_SET_TEXT`-capable targets? | Use the documented Android clear path of setting empty text before writing the requested text, even if the caller-visible final text matches the replace-style `clear=false` route. |
| What happens if `clear=true` is requested but the route cannot clear? | Fail explicitly. Do not silently degrade to `clear=false`. |
| What if the broader `enter_text` pack lands first? | Rebase onto the current seam and implement `clear` through it. Do not restore a second text-entry path just for this bug fix. |
| What if a newer route such as API 33 input connection exists by implementation time? | Either support `clear=true` on that route in the same change or fail explicitly on that route. Do not leave one strategy silently ignoring `clear`. |
| Can tests be deferred to the docs phase? | No. Phase 1 introduces the behavior and must include the proving tests. |
| Should this pack redesign `enter_text` strategy selection? | No. That belongs to `tasks/api/enter-text/`. |

## Failure Modes To Prevent

- `clear=true` is still accepted but ignored
- Clear works in one code path but the Android parser still drops the flag
- `clear=true` works only on the legacy route and is silently ignored again if a
  newer strategy is present on the branch
- `clear=false` stops preserving current replace-style behavior
- Tests cover only CLI help text and not real end-to-end runtime behavior
- Docs keep claiming `clear` works differently from shipped behavior
- The fix is folded into the broader enter-text upgrade and loses review focus

## Output Contract

After this pack ships:

- The public `clear` boolean remains unchanged.
- Android parses and executes `clear` end to end.
- Supported routes perform a real clear-before-type flow.
- Unsupported clear attempts fail explicitly rather than silently.
- Public and internal docs describe the shipped behavior accurately.

## Idempotency

- Re-running the same clear-enabled text-entry action on the same supported
  surface should preserve the same final text and same clear semantics.
- Re-running docs generation after the final authored-doc updates should not
  introduce additional unrelated diffs.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Public `clear` behavior | `docs/api/actions.md`, `docs/api/mcp.md` |
| Android clear implementation | Android task/runtime code and code-adjacent comments where justified |
| Internal note that the contract bug is closed | `docs/internal/design/operator-llm-playbook.md` if it currently calls out the limitation |
