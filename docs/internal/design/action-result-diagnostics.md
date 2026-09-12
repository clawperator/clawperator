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
  Hierarchy capture transfers retained Android node handles to the tree without
  recycling them. On API 32 and earlier, recycling clears their identity fields
  and allows pool reuse, making unrelated nodes compare equal. Retained handles
  are garbage collected with the tree; temporary traversal handles are still
  recycled after use.
  Re-observation searches all visible nodes for the original identity, independently
  of their current scrollable flag. It never substitutes an eligible descendant.
- A `TaskScrollScope` retains the initial tree and node only within the operation;
  it is not serialized as a reusable handle. The loop passes it through final
  target confirmation and click. An observed target remains valid within this
  scope after eligibility loss. Absent targets end with `CONTAINER_NOT_SCROLLABLE`
  after bounded observation; true disappearance, replacement, or unresolved
  identity ends the search with `CONTAINER_LOST` (strict ambiguity keeps
  `CONTAINER_AMBIGUOUS`). Standalone scrolls retain
  measured progress even when the identifiable container stops being scrollable.
  Strict target ambiguity still fails before any click. Legacy global target
  matching remains available before scope selection, but cannot override a
  completed scoped search. A gesture that reveals the target counts toward
  `scrolls_executed` even when no further capture or gesture is needed.
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


### Scroll eligibility transition validation (R11)

On 13 September 2026, the baseline at `e1aadca2` reproduced the Android 15 / API 35
Settings failure with both default selection and a strict explicit outer-container
selector. In each case, `Display & touch` was initially off screen; an accepted
scroll revealed it while the outer container remained present but became
non-scrollable. The action incorrectly failed with `CONTAINER_LOST` and
`container_identity_changed`.

The R11 implementation was validated with the matching debug Operator `0.10.0-d`
and branch-local Node CLI `0.10.0` on a dedicated English API-35 emulator:

- `./gradlew :app:assembleDebug unitTest`: 454 tests, no failures, errors, or skips.
- Node build followed by `npm --prefix apps/node run test`: 1,461 tests, no
  failures or skips. An earlier run was interrupted by another local CLI rebuild;
  the final suite ran without concurrent rebuilds.
- `./scripts/docs_build.sh`: routes, links, generated contracts, and organization
  checks passed.
- Default and strict explicit outer-container `scroll-until down --text
  'Display & touch' --click` both passed from a verified homepage top with the
  target initially off screen. A separate `Brightness level` wait and query
  verified the destination. These checks passed again with the final APK.
- Raw `scroll_until` found the target with `scrolls_executed: "1"`; raw
  `scroll_until` with strict outer selection and `clickAfter: true` also reached
  the verified destination. Captures and receipts remained correlated.
- A standalone scroll reported `moved` with comparable signatures while the
  original outer container became non-scrollable. A raw search for an absent
  target returned `CONTAINER_NOT_SCROLLABLE` after exactly one accepted gesture;
  its after-query showed the original outer scope still present and non-scrollable.
- One unchanged `validation/sensitive-hierarchy-access/run.py` invocation passed
  from a freshly closed Settings app. It retained all Internet query, raw/MCP/XML
  parity, PNG, and Display control assertions. No inner-container workaround or
  harness preparation change was used.

Deterministic fixtures additionally cover present-but-nonscrollable scopes,
missing targets, targets outside the original scope, delayed target appearance,
platform replacement despite identical resource IDs/bounds/paths, strict target
and container ambiguity, cancellation, and no extra gesture or click after scope
loss. Exhausted raw searches cannot use a later global wait to override their
scoped result. Existing moved/no-movement, unavailable hierarchy, and receipt
regressions remain enabled.

Device attempts and captures are retained outside version control. The baseline
follow-up query timed out. Two broad pre-scenario queries on the final build also
timed out, and one on-screen pre-scenario query returned
`RESULT_ENVELOPE_MALFORMED`. Those failures remain R13 evidence; later successful
checks do not erase them. An initial check ran before the reinstalled service was
ready, and a supplemental raw payload was rejected locally for its omitted
`expectedFormat`; both were corrected before their successful checks. No uncertain
mutation was replayed to recover evidence.

This is local R11 acceptance, not release readiness. The one clean-start harness
pass does not establish R12's restored-search preparation contract or R13's
repeated reliability contract, and does not replace R10's manual CI gate. No
release-variant, physical-device, or cross-OEM transition proof is claimed.
Sibling runtime skills use the existing scroll actions and explicit containers;
no new wire values or skill migration/version changes were needed.


After reviewing the node-lifetime fix in `5e73d6c0` and merging upstream through
`460e654c`, validation passed 460 Android tests, 1,479 Node tests, 14 hierarchy
preparation tests, and the docs build. API 31/32 platform-identity regressions
passed independently. The merged API-35 live harness verified Settings
preparation but later stopped at a query with `logcat exited before terminal
envelope (code=255, signal=null)`. That invocation remains a failed R13 transport
observation; the earlier successful harness invocation does not supersede it.
