# Result transport reliability

## Contract and ownership

The host result reader owns process lifecycle, stream framing and reassembly.
Android owns terminal publication. A transport failure is a structured execution
failure, never a fabricated Android terminal envelope or a reason to replay an
uncertain mutation. Public codes and SSE migration are documented in
[errors](../../api/errors.md#result-transport-failures) and
[Serve](../../api/serve.md#get-events-sse-stream).

The explicit-device reader starts during preflight. Previously, its deferred
broadcast callback could resume after the reader had exited. A controlled
fixture reproduces this race. The dispatch-capture boundary now refuses to
proceed after settlement, before the broadcast call. Process exit, spawn failure,
cancellation, timeout and malformed transport retain correlation and dispatch
uncertainty. Finalization settles once before killing the reader, so process
close cannot overwrite an already observed terminal result or specific failure.
A final unterminated line is drained at process close.

Chunk validation remains strict: ordered indices, consistent identity and size,
canonical base64, exact reconstructed size and SHA-256, and terminal correlation.
Missing chunks remain incomplete; reordered, duplicate or conflicting chunks
remain malformed. Diagnostics expose received/expected counts and bytes without
inventing Android action progress. The existing 100 ms subscription fallback
remains a timing heuristic, not proof of a connected logcat reader. No timeout
inflation, transport replacement or mutation replay was introduced.

## Reproduced publication loss

A fixed debug baseline on 13 September 2026 ran 20 immediate Settings open/query
cycles and 20 full Internet queries. Three Settings queries failed:

- Cycle 5 timed out after receiving indices 0-53 of 69 (55,296 of 69,700 bytes).
- Cycle 11 timed out after receiving indices 0-59 of 69 (61,440 bytes).
- Cycle 14 rejected index 63 after index 57 (expected index 58).

An independent live reader and a subsequent device-buffer dump had the same
missing records for the first failure. This implicates publication or Android
logging before host reassembly, rather than a Node-only stream split. The other
baseline commands, including all 20 Internet queries, remain in the report.

The publisher previously emitted every chunk synchronously in a tight loop.
[AOSP liblog](https://android.googlesource.com/platform/system/logging/+/refs/tags/android-15.0.0_r1/liblog/logd_writer.cpp)
uses nonblocking logging writes that can drop overloaded records. Its
[public write wrapper](https://android.googlesource.com/platform/system/logging/+/refs/tags/android-15.0.0_r1/liblog/logger_write.cpp)
returns success after calling the logger without exposing the underlying write
result. Buffer pressure is the causal explanation supported by that source and
the missing-record evidence; the exact kernel error was not captured.

`publishResultEnvelope` now inserts a 1 ms pause between chunk records. It
preserves order and publishes each record once, without retrying actions or
weakening integrity. Small envelopes incur no pause. Publication is awaited on
`Dispatchers.IO` inside `NonCancellable`, so chunk encoding and inter-record delays leave the Android main thread available while
preserving cancellation-terminal delivery. This is pacing, not a durable
delivery guarantee. A 69-record result adds 68 requested pauses; actual scheduling
can take longer. Unit coverage asserts the inter-record pause and exact output
sequence, including unchanged small-envelope publication, caller-thread
responsiveness, and complete publication before or during cancellation.

## Declared live evidence and limits

The checked-in [manual harness](../../../validation/result-transport-reliability/README.md)
uses the branch-local 0.10.0 CLI, API-35 arm64 Google APIs Android 15 image,
English en-US, and fingerprint
`google/sdk_gphone64_arm64/emu64a:15/AE3A.240806.036/12592187:user/release-keys`.
Only the selected Operator service was enabled. Builds started from `e1aadca2`
plus the R13 implementation committed as `cd3e979`. Private metadata records the exact built JavaScript hashes,
APK hashes, package metadata, command/task IDs, every output size and duration,
and bounded raw logcat evidence. No personal device identifiers are committed.

| Series | Immediate open/query commands | Full Internet queries | Failures retained |
| --- | --- | --- | --- |
| Original publication, debug | 37/40 | 20/20 | Two missing-tail timeouts and one missing-middle malformed result |
| Paced publication, debug | 39/40 | 20/20 | First open returned `DEVICE_ACCESSIBILITY_NOT_RUNNING` immediately after reinstall |
| Paced publication, release | 40/40 | 20/20 | None |

Each row was declared before its run. The repaired debug failure was not erased
by restarting its series. All 40 full queries in each repaired variant succeeded;
Settings responses reached about 70 KB and Internet responses about 32-34 KB,
so both exercised chunking. Repaired debug Settings query durations were
409-580 ms and Internet queries 335-440 ms; release Settings queries were
384-630 ms and Internet queries 334-424 ms. These include host preflight and
process startup, not just publication.

APK SHA-256 values:

- Baseline debug: `fc79049b2c5147f29839cbb9966a2f48d56a905e05d358440646f752e9502482`.
- Paced debug: `59986b267bf1baa4056c47ab9639057403408d3366d002b16d92009faa90f22f`.
- Paced release: `563b16e1f56e310eab742292e5199a4b596347f3ef4d409c60e098d77fbf5085`.

The original audit's logcat exit 255 and timeout with no correlated events were
not reproduced live here. Controlled subprocesses prove their stable codes and
uncertainty semantics, not their original live root causes. Those causal limits,
the debug startup failure and the finite sample prevent claiming a completely
resolved reliability gate or a zero-flake transport.

R11/R12 were not integrated for the original series above. The combined hierarchy
regression and manual CI release gate were outstanding at that point; this focused fixture deliberately
uses the Settings Internet intent and does not waive homepage/scroll assertions.
No runtime skill contract changed, and no sibling skill migration is required.

## Validation

- `npm --prefix apps/node run build` and `npm --prefix apps/node run test` cover
  1,478 passing tests, including the host changes, lifecycle subprocesses, strict chunk reassembly, deferred
  dispatch, SSE outcomes, and CLI/Serve/MCP/daemon error adapters.
- `./gradlew :app:assembleDebug :app:assembleRelease unitTest` passed, including
  447 Android tests with zero failures or skips.
- `./validation/test_all.sh --suite validation` passed, including the new
  offline fixture checks and existing installer/policy regressions.
- `./scripts/docs_build.sh` passed route/link validation with no organization
  warnings. Generated machine-facing documentation retains all new codes.

The scoped consumer tests preserve specific failure codes and non-success
semantics; MCP retains its intentional stderr redaction. This work does not
claim live daemon/MCP parity across both variants or the full hierarchy gate.

### Background publication follow-up

The main-thread publication fix passed the debug APK build, app unit tests and
all-module unit tests (449 tests, zero failures or skips). Regression tests
verify that writes leave the caller thread and that every record is published
when cancellation occurs before publication or between records.

The updated debug APK was installed on an explicit API-35 emulator with only
the debug Operator accessibility service enabled. A branch-local execution
containing 20 full Settings queries returned one successful 641,390-byte CLI
result; every query contained nonempty, untruncated nodes. This checks live
chunk reassembly; caller-thread responsiveness and cancellation are covered by
the controlled unit tests. The release variant was not rerun for this follow-up.

### Integration with main for PR review

Merged `origin/main` at `28b8b1fa` into the branch containing the reviewed
background-publication fix `be5f85ac`. This brings R7, R11 and R12 together.
The integrated code passed 1,496 Node tests, 463 Android unit tests, both APK
builds, repository validation and the docs build.

On the same explicit API-35 emulator, each selected service was launched and
passed doctor before its single combined hierarchy run. Debug passed the full
checked-in regression, including five query comparisons, XML/MCP parity, PNG
decoding and Display & touch. Release stopped at `Missing unique Wi-Fi switch`:
the first captured Internet query returned a successful, correlated 24-node
hierarchy without the switch; the next two captures returned 68 nodes with the
switch. No transport failure occurred in those three captures. The failed run
is retained, without retrying to obtain a passing result or weakening the
fixture. Release readiness remains open for that fixture transition and manual
CI; original historical transport-cause limits also remain.

Integrated APK SHA-256 values:

- Debug: `b1a0f7c831a200ffe40ea1ce109ffb65a3474e0fdb67d2c0526df7f11a1f350d`.
- Release: `dfd1f5f2aaf1b3b356f260d4f252345977a3f985c36c9127f1944a083c6f0699`.


### Completed local R11/R12/R13 integration

The final integrated harness at `306b38d` passed all six debug/release
fresh/subpage/search runs on API 35, including query/MCP/XML parity, PNG and
Display control. The fixed transport series passed 60/60 commands per variant
with full query outputs of 32,345-69,786 bytes. Both APKs contain the runtime code
merged in `0c4ed5ce`; no additional runtime transport change was needed.

Two harness fixes completed this proof: Internet readiness now distinguishes the
outgoing page's Airplane mode switch from the loaded Internet destination, and
Operator variant setup waits for complete service teardown before installation,
then verifies a healthy selected binding and nonempty query. The earlier release
failure after the readiness fix was retained and diagnosed as unusable service
binding state; the interrupted transport series was not presented as a pass.

The [full acceptance record](../../../validation/sensitive-hierarchy-access/README.md#integrated-r11r12r13-acceptance)
preserves all final cases, earlier failures, setup observations, source and APK
hashes. This resolves the local combined-harness gap described above. The manual
supported-image CI release gate and historical causal limits remain explicit;
a finite series does not prove failure-free transport under every condition.

## PR-2 recurring reader exit investigation

The independent audit at `6367227a` retained a debug Internet parity query with
`RESULT_TRANSPORT_EXITED`, exit 255, empty stderr, a sent broadcast and a
correlated Android command-start event, but no received chunks. Its later fixed
series passed 60/60 commands on each variant. Both observations remain valid;
the passing series does not close the causal reliability gate.

PR-2 starts from main at `8d398706`, including PR-1 and the integrated hierarchy
setup repairs. Inspection separates these mechanisms:

- `NodeProcessRunner.spawn` has no generic process timeout. Reader timeout and
  cancellation settle before killing their child, preserving their specific
  code. The result reader does not restart or redispatch an accepted execution.
- Framing uses a UTF-8 decoder and drains a final unterminated line at close.
  Chunk validation still enforces order, identity, size, canonical base64 and
  checksum. Android still publishes once with the existing background pacing.
- The [ADB shell client](https://android.googlesource.com/platform/packages/modules/adb/+/7c2fd99d6ec7e0d2d977ba03cecc82375af1baad/client/commandline.cpp)
  initializes its shell-protocol result to 255 for unexpected disconnection and
  replaces it when a remote exit packet arrives. Thus host exit 255 does not
  establish that Android logcat itself returned 255. Missing shell completion
  is a source-supported hypothesis, not a captured explanation of this audit.
- [Android logcat](https://android.googlesource.com/platform/system/logging/+/refs/heads/android15-s1-release/logcat/logcat.cpp)
  reports read/EOF failures with stderr diagnostics. Empty stderr alone cannot
  distinguish an ADB connection interruption from device-side termination or
  lost diagnostics. There is no evidence here to blame accessibility or change
  publication pacing, buffer sizes, transport integrity or timeouts.

### Repaired exit-to-close dispatch race

[Node process lifecycle](https://nodejs.org/api/child_process.html#event-close)
allows `exit` before output-pipe `close`, including when another process retains
an inherited pipe. A real controlled subprocess exited 255 at about 33 ms and
closed its pipes at about 363 ms. Two deterministic regressions failed against
the original reader: a deferred preflight dispatched in this interval, and the
startup timer could start a new broadcast after exit.

The reader now marks process death on `exit`. Both broadcast startup and the
dispatch boundary refuse new work from that point. It drains pipes until
`close` or the configured wait deadline, so late stderr, a complete already
dispatched terminal result, and specific integrity errors retain their authority.
A rejected deferred callback
does not replace the reader's exit failure with `BROADCAST_FAILED`. Controlled
real-process and event-order tests cover the race; execution/SSE coverage checks
zero dispatch, correlation and no invented terminal envelope.

This is a demonstrated dispatch-safety repair. It does **not** explain the
audit's already observed Android command start or prevent an external reader
connection from exiting. That recurring cause remains unresolved unless a new
failure captures its process/protocol context.

The manual fixed-series harness also stops after any failed `open`, preserving
remaining attempts as unrun. Previously the next cycle could issue the same
mutation despite an uncertain outcome. Read-only query failures remain recorded
and are never replaced with successful retries. Offline tests cover both paths;
`summary.json` records failures, unrun counts and independent-reader exit state.

### PR-2 bounded live results

On 13 September 2026 the baseline debug full hierarchy fixture passed once
before the repair. The repaired source was committed as
`b31f497e57d9e40454fb03d4b53e8128df17d682` before the final live series. It used
the branch-local CLI 0.10.0 and locally built debug 0.10.0-d / release 0.10.0
APKs, with only the selected service active. The explicit test device was an
English API-35 arm64 emulator, build `AE3A.240806.036/12592187`, 1080 by 2400,
density 420. ADB was 37.0.1-15733141. No other device or shared ADB-server state
was changed.

| Repaired variant | Immediate open/query commands | Full Internet queries | Complete hierarchy fixture | Failed / unrun series attempts |
| --- | --- | --- | --- | --- |
| Debug | 40/40 | 20/20 | Pass once, including Home cleanup | 0 / 0 |
| Release | 40/40 | 20/20 | Pass once, including Home cleanup | 0 / 0 |

Each series was declared before running and was run once. All 40 queries per
variant used `--visibility all --limit 1000`. Settings query output was 69,785
bytes; Internet output ranged from 32,347 to 34,360 bytes. Debug Settings/query
durations were 413-560 ms and Internet 335-409 ms; release was 402-601 ms and
328-413 ms respectively. Both complete hierarchy runs passed homepage readiness
in one observation and Internet readiness in three, then verified repeated
queries, raw/MCP/XML parity, PNG decoding and the unchanged Display scroll and
Brightness level postcondition. This is one complete run per repaired variant,
not a new six-starting-state acceptance matrix.

Private evidence retains all command arguments, stdout/stderr, exit status,
command/task correlation, output sizes, elapsed times, source identity, built
JavaScript hashes, APK hashes, setup checks and artifact assertions. Bounded
independent readers retained up to 5,000 stdout lines and 100 stderr lines;
before/after process lists, accessibility state, buffer sizes and a 5,000-record
device-buffer dump were captured separately. Final runs enabled `ADB_TRACE=shell`.
The fixed-series harness also kept its existing per-attempt independent tails.
All independent readers were alive before intentional cleanup. The observed
logd, adbd and selected Operator process identities were unchanged across each
run. No live transport failure or service failure occurred in these declared
PR-2 attempts. Instrumentation may affect timing; these observations do not
prove that an unobserved short interruption is impossible.

Locally built APK SHA-256:

- Debug: `a155fd245ce1dbfa4eae95639f2e4e33a634abb91f19f07a77ed2f8e37ae1b75`.
- Release: `7671fbc6e36a9c23926febe7e712a0d2c6f0f1c2dbfa36132f3a61503952d131`.

Validation passed: Node build and 1,528 tests; both APK builds and 463 Android
unit tests; repository validation including the fixed-series offline checks;
and docs generation with route/link checks and no organization warnings. The
two intentionally failing pre-repair race regressions and real-process timing
trace remain in the private evidence alongside the passing runs. Initial build
invocation/setup failures were retained separately from completed validations.

### Remaining causal blocker

The bounded PR-2 investigation and safety repairs are complete, but the recurring
post-dispatch exit-255 cause remains unresolved. None of the new live attempts
reproduced that failure, so there is no failing shell-protocol trace to compare
with independent device logging and process state. The audit's command-start
observation rules out presenting the pre-dispatch race repair as its root-cause
fix. Publication loss and the historical zero-event timeout remain separate
causal limits; integrity checks and pacing were not weakened or changed.

Further causal closure needs a fresh failing attempt with host shell-protocol
completion/disconnect evidence and simultaneous independent device/process
observations, without redispatching an uncertain mutation. Keep the R13 pack
active and the causal reliability gate open. The manually dispatched supported
CI image remains a separate release prerequisite; these local passes do not
satisfy it. No automatic emulator workflow, R14 implementation or release publication
is added by PR-2. Subsequent user-authorized review and PR preparation are
recorded below.

### Review repair: bounded draining after exit

The delegated code review found a pre-dispatch hang in the initial PR-2 guard:
if another process retained the exited reader's output pipes, dispatch was
blocked but no result timer had started. With a 20 ms configured timeout, a
controlled reader stayed pending beyond 100 ms until a synthetic close arrived.

Exit now starts the configured result-wait budget if dispatch has not started
it already. An existing dispatch deadline is preserved. At that deadline the
reader drains the final buffered line, accepts a complete validated terminal
result or specific malformed framing failure, or returns `RESULT_TRANSPORT_EXITED`
with the observed exit code/signal and `outputDrainIncomplete: true`. Cleanup
closes both host output handles so retained writers cannot keep the CLI alive.
No mutation is dispatched or replayed during this drain.

Regression coverage exercises startup, deferred preflight and post-dispatch
exit without pipe closure, retained stderr/signal, stream cleanup, final buffered
success and malformed framing. This bounds the demonstrated hang without
extending the configured deadline or claiming a cause for the live audit exit.

### Clean review and latest-main integration

The drain repair was committed in `308d42eb`. A fresh independent sub-agent
review of committed `21c58729` against main `0b571d76` found no actionable
issues and passed 25 reader/transport tests plus four harness checks. This
clean review was a required gate before opening the PR. The branch incorporates
the latest upstream Android overlay-permission and video-verification changes;
no new R14 implementation belongs to this branch's diff.

The integrated build passed all 1,565 Node tests and repository validation,
including the full-stream media fixtures from upstream. Matching debug/release
APKs built successfully and all 463 Android tests passed. Android source did
not change between the two upstream merges, so those exact APKs were retained.

Two host-validation setup problems remain in private attempt accounting: a
temporary isolation wrapper initially retained child logcat pipes, and an
explicit package environment override conflicted with an environment-default
test. The interrupted run and the one failed environment assertion were not
reported as passes. The wrapper was corrected to execute ADB directly, its
identified orphan readers on the assigned device were stopped, and the clean
full run used the normal environment. Neither problem required runtime changes.

The final declared live series used runtime source `21c58729`; the private
source-diff record also retains pending documentation-only notes. Each variant
ran once with 20 immediate open/query cycles and 20 full Internet queries.
All 120 commands delivered correlated canonical envelopes, with no reader exit,
malformed transport or timeout. The fixture verdicts were not all successful:

| Variant | Fixture checks passed | Canonical envelopes received | Retained first Internet-query failure | Complete hierarchy fixture |
| --- | --- | --- | --- | --- |
| Debug | 59/60 | 60/60 | Android returned `UI_TREE_UNAVAILABLE`, with service available but no root | Pass, including Home cleanup |
| Release | 59/60 | 60/60 | Successful query captured a 24-node loading screen without the fixture's sensitive root | Pass, including Home cleanup |

Both series completed all declared attempts without replaying a failed mutation.
The failed debug action and failed release fixture assertion remain failures;
neither series was repeated to obtain a green report. The independent reviewer
matched the debug failure's command-start and terminal records against CLI
output and found no new reader-code issue. The release failure also retains a
successful canonical envelope and its actual loading-screen hierarchy. These
observations establish delivery, not a repair or causal explanation of Settings
hierarchy availability. Accepted full-query responses ranged from 32,345 to
69,785 bytes. Independent observers stayed alive through both series.

A debug hierarchy invocation started while the series still owned the device
lock and failed before issuing commands. That host scheduling error is retained
separately; the subsequent serialized invocation completed the entire fixture.
Release completed its single full hierarchy invocation. Both successful runs
include repeated queries, raw/MCP/XML parity, PNG decoding, Display scroll and
Home cleanup. No device or shared ADB-server reset was used.

Final matching APK SHA-256:

- Debug: `d70263154b535d57b08d0c6935f6bfa43dbe539ece863c84011e5e84ebc99415`.
- Release: `e8df33b54cca7fa4b2614f62b15ded395c76f7c08e19673217351d67bd03f515`.

The clean code review supports these bounded lifecycle repairs. The historical
post-dispatch exit cause, these retained fixture failures, and the manual
supported-image CI prerequisite prevent claiming complete reliability or release
acceptance. PR creation is authorized; release publication is not part of this
work.
