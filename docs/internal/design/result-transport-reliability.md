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

R11/R12 are not integrated into this worktree. The combined hierarchy regression
and manual CI release gate remain outstanding; this focused fixture deliberately
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
