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
