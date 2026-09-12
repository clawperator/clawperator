# Action result diagnostics

The public contract is [action receipts and failure evidence](../../api/actions.md#action-receipts-and-failure-evidence).
R6 builds on merged selector inspection and strict selection, while preserving
per-node sensitivity metadata from hierarchy access.

## Ownership and invariants

- `UiActionEngineDefault` accumulates steps and stops on thrown action exceptions.
  Typed failures keep their code; unclassified exceptions use `ACTION_FAILED`
  and retain the original message. Returned failed steps still allow subsequent
  actions. Node reconciles those failures without replacing an authoritative
  typed runtime failure, including cancellation between steps.
- `ActionExecutionJournal` belongs to one command and survives cancellation of
  the child execution. The engine records an interrupted step and rethrows
  coroutine cancellation. `AgentCommandExecutorDefault` owns terminal
  publication and guards against duplicate publication. Queue timeout may have
  no steps; timeout between steps may contain only completed steps.
- Both task-runner layers retain the caller's job when selecting their main
  dispatcher. Replacing it with the long-lived application job would allow
  actions to outlive the command timeout and discard their collected evidence.
- `ActionReceipt` and `UiDispatchObservation` carry evidence in the execution's
  coroutine context. The UI manager records the actual Android dispatch node
  and mechanism. Receipts reuse `NodeResolver`'s NodeSummary serialization,
  including sensitivity metadata. They do not recapture or replay a mutation.
  An ancestor absent from the captured tree is not mislabeled as the matched
  node; only the available matched summary is retained in that case.
- Gesture acceptance is sampled from `dispatchGesture`, before the completion
  callback. A later cancelled gesture can therefore have accepted dispatch and
  a failed gesture outcome. Accessibility text-input APIs are recorded as
  `accessibility_action`; this field does not claim which application state
  ultimately persisted.
- Text-entry focus preparation and rejected `ACTION_SET_TEXT` calls preserve
  readiness retries so an asynchronous editor session can become available.
  Accepted text replacement, partial input-connection mutation, and uncertain
  dispatch failures block outer retries. Receipt fields still report dispatch
  evidence independently of this retry decision.
- Scroll comparison requires re-resolution of the same scoped container.
  Platform node identity is preferred. Without it, comparison requires a
  unique resource/class match and unchanged bounds, path, and ancestor context.
  Paths alone are never handles or proof of identity. Ambiguity is `unknown`;
  disappearance is `container_lost`. No current path emits `edge_reached`.
- Progress hashes use bounded leading-child observations and their immediate
  descendants. They indicate change in the measured evidence, not exhaustive
  visual equivalence. No raw text is included in the serialized signatures.
- Bounded searches preserve the initial container identity and count unknown or
  unchanged progress toward their existing no-position-change threshold.
  `maxDurationMs` is checked before each attempt; settling and bounded target
  observation may finish after that threshold. The command timeout remains
  cancellable. Scroll-and-click uses the same comparison implementation.

## Validation and compatibility

Validated locally for v0.10 on Android 15 / API 35 with the debug Operator
`0.10.0-d` and branch-local Node CLI `0.10.0`:

- `./gradlew :app:assembleDebug` and `./gradlew testDebugUnitTest`: 443 tests,
  zero failures, errors, or skips across the Android modules.
- `npm --prefix apps/node run build` and `npm --prefix apps/node run test`:
  1,461 tests, zero failures or skips, using the consolidated test discovery.
- `./scripts/docs_build.sh`: public docs, generated contracts and both tracked
  `llms-full.txt` files; route/link validation passed without organization warnings.
- Real emulator click selected a text label but dispatched `ACTION_CLICK` on
  its clickable parent. `target` and `matched_target` identified those distinct
  nodes. A wait for a destination-only label confirmed navigation separately.
- A single scroll produced `moved`, two different hashed signatures, and changed
  row positions/visible items in before/after queries. A separate unchanged
  scroll produced `no_movement`, comparable equal signatures, and accepted
  coordinate dispatch. A raw coordinate click used JSON coordinates and omitted
  selector target/count fields.
- Live wait expiry retained the preceding sleep and failed wait with
  `WAIT_TIMEOUT`; command expiry retained a preceding sleep and interrupted
  sleep with `COMMAND_TIMEOUT`. Both exited nonzero and omitted the unexecuted
  final step. Correlation IDs were preserved.

Regression fixtures cover accepted clicks without asserted effects, actual
ancestor and coordinate fallback dispatch, missing roots and nullable metadata,
changed/unchanged/missing signatures, ambiguous and disappearing containers,
strict zero-dispatch failures, bounded loops, no mutation replay after an
accepted attempt, and cancellation through the real task-runner layers with
exactly one terminal envelope. Existing overlay tests preserve root independence
and `ON_SCREEN_LOG_*` behavior. Node tests cover parsing, CLI JSON/exit behavior,
and preservation of typed failures through post-processing.

Device evidence was kept outside version control. No physical-device or
cross-OEM validation is claimed. Missing-root and disappearing-container races
are covered by deterministic fixtures rather than induced on a live device.
R10's manually dispatched CI hierarchy regression remains a separate release
gate; this work does not satisfy or waive it.

Sibling runtime skills were audited for scroll enums, terminal/step codes, and
text receipt consumers. No current skill branches on the changed scroll enums
or coordinate display string; no sibling migration/version change was needed.
New consumers must accept the additive outcomes, prefer `data.errorCode` over
message matching, and parse receipt JSON fields explicitly. The legacy
snapshot-specific `SNAPSHOT_HIERARCHY_UNAVAILABLE` code is preserved.
