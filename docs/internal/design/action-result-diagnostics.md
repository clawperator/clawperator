# Action result diagnostics

The public contract is [action receipts and failure evidence](../../api/actions.md#action-receipts-and-failure-evidence).
Action diagnostics build on selector inspection and strict selection, while preserving
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
Current local verification requirements and device-coverage limits are recorded
in the [release reference](../release-reference.md#v010-acceptance-requirements).

Sibling runtime skills were audited for scroll enums, terminal/step codes, and
text receipt consumers. No current skill branches on the changed scroll enums
or coordinate display string; no sibling migration/version change was needed.
New consumers must accept the additive outcomes, prefer `data.errorCode` over
message matching, and parse receipt JSON fields explicitly. The legacy
snapshot-specific `SNAPSHOT_HIERARCHY_UNAVAILABLE` code is preserved.


### Scroll eligibility transition validation

On 13 September 2026, the baseline at `e1aadca2` reproduced the Android 15 / API 35
Settings failure with both default selection and a strict explicit outer-container
selector. In each case, `Display & touch` was initially off screen; an accepted
scroll revealed it while the outer container remained present but became
non-scrollable. The action incorrectly failed with `CONTAINER_LOST` and
`container_identity_changed`.

The scroll eligibility repair was validated with the matching debug Operator `0.10.0-d`
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
`RESULT_ENVELOPE_MALFORMED`. Those failures remain result-transport evidence; later successful
checks do not erase them. An initial check ran before the reinstalled service was
ready, and a supplemental raw payload was rejected locally for its omitted
`expectedFormat`; both were corrected before their successful checks. No uncertain
mutation was replayed to recover evidence.

This establishes local scroll-transition acceptance. The one clean-start harness
pass does not establish restored-search preparation or repeated transport
reliability. No
release-variant, physical-device, or cross-OEM transition proof is claimed.
Sibling runtime skills use the existing scroll actions and explicit containers;
no new wire values or skill migration/version changes were needed.


After reviewing the node-lifetime fix in `5e73d6c0` and merging upstream through
`460e654c`, validation passed 460 Android tests, 1,479 Node tests, 14 hierarchy
preparation tests, and the docs build. API 31/32 platform-identity regressions
passed independently. The merged API-35 live harness verified Settings
preparation but later stopped at a query with `logcat exited before terminal
envelope (code=255, signal=null)`. That invocation remains a failed transport
observation; the earlier successful harness invocation does not supersede it.


### Combined hierarchy follow-up

With integrated scroll, preparation and transport repairs through `306b38d`, all six API 35
fresh/subpage/search runs across debug and release passed the unchanged Display
scroll and the Brightness level postcondition. Internet query/MCP/XML parity and
PNG checks also passed in each run. See the
[integrated acceptance record](../../../validation/sensitive-hierarchy-access/README.md#integrated-hierarchy-and-transport-acceptance)
for complete attempt accounting and build identity. This completes local
integration proof on the stated local image. The GitHub regression is optional
under the current release requirements.

## Scoped-selection presentation audit and live walkthrough

The [scoped selection walkthrough](../../api/scoped-selection.md) is the canonical
consumer workflow for duplicate labels, overlapping lists, destination assertions,
and evidence status. The September 2026 audit found no dropped selection diagnostic
requiring a runtime change:

- `SelectionWarnings` accumulates the largest duplicate counts per action.
  `UiActionEngineDefault` attaches warnings to returned successes, returned failures,
  and caught exceptions. Strict failures retain candidate count and candidates.
- CLI action commands pass through `formatRunExecutionResultForCli`; JSON and
  pretty formats serialize the envelope without summarizing its step data.
- MCP execution success/failure paths retain the envelope. Transport sanitization
  removes sensitive path/command fields, but does not remove selection warnings,
  counts, or JSON-encoded candidate, target, and progress data. Successful `read`
  intentionally keeps its value first and warning in a second content item.
- `resolved_container` alone cannot distinguish same-ID lists. Decode the selected
  `target` and use its observation-local parent chain from discovery, together with
  the explicit ancestor matcher. Paths are not durable identity or action handles.

Live verification used an Android 15 / API 35 emulator, source baseline `e96e7584`,
branch-local CLI `0.10.1`, and a freshly built/installed development Operator
`0.10.1-d`. A temporary native fixture (`com.example.scopedselection`) placed two
full-size ScrollViews with the same `list` ID under distinct `background_pane` and
`detail_pane` ancestors. The detail pane overlaid the background. Both lists were
reported on screen with identical bounds. Each contained an `Open` button; only
the detail list contained the initially offscreen `Target item`. The fixture and
raw per-attempt output, exits, APKs, query captures, and bundle remain local,
outside version control.

Observed and asserted:

- Full discovery returned 100 nodes without truncation. Duplicate-label and
  shared-list queries each returned two matches; the ancestor-scoped list query
  returned exactly one. Parent chains identified the distinct panes.
- Default CLI read returned `Open` and a warning containing `target: 2` (exit 0).
  Strict read returned `NODE_AMBIGUOUS`, count 2, and candidates (exit 1).
  Ancestor-scoped strict read succeeded (exit 0).
- Strict scrolling with only the shared list ID returned `CONTAINER_AMBIGUOUS`
  before dispatch (exit 1). Strict ancestor-scoped scrolling returned
  `TARGET_FOUND` after one scroll, candidate count 1, the detail list target,
  and comparable changed progress signatures (exit 0).
- A separate scoped click, bounded destination wait, and unique query all passed.
  The screenshot visibly showed `Detail destination ready`; the capture manifest
  was `complete`, with verified PNG/XML and CLI/APK metadata (exit 0).
- On a reset fixture, an absent-label bounded wait retained `container: 2` in its
  warning on failure. Unscoped scrolling tracked the background list and returned
  `NO_POSITION_CHANGE` after three scrolls with the warning preserved (exit 1).
  This demonstrates a scope-selection mistake, not a scoped-scroll defect.
- Live stdio MCP read preserved its scalar value and warning in separate content
  items. Strict MCP read retained `NODE_AMBIGUOUS` in the error envelope; a failed
  read under the duplicate container retained its selection warning.

Attempt accounting: the first doctor check after installation found the service
not running; `doctor --fix` restored readiness and passed. A host log-write warning
was resolved for subsequent runs by selecting a writable log directory. Initial
fixture `Open` buttons overlapped system chrome and were reported off screen, so
an initial read returned `NODE_NOT_FOUND`. Moving those fixture rows below the
chrome produced the duplicate eligible targets used above. These preparation
failures remain in local evidence; they are not runtime regressions or successful
acceptance attempts.

Node and Android runtime sources were unchanged. The branch-local Node build,
matching debug APK build, and complete docs pipeline passed. No new runtime test
suite or sibling skill migration was required. No physical-device, cross-OEM,
release-Operator, induced ANR, or live partial-bundle validation is claimed here;
partial-bundle interpretation follows the existing evidence contract. Publication
and the independent result-transport investigation retain their separate gates.
