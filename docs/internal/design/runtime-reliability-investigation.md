# Runtime reliability investigation - 2026-09-20

## Disposition

The incomplete snapshot acceptance defect is reproduced and corrected in Node.
Readiness failures now retain separate probe and requested-command evidence.
The cause of the historical Samsung readiness timeouts remains unresolved.
There is no evidence supporting a timeout increase, disabled readiness check,
or longer cache lifetime. Those settings are unchanged.

## Earlier R1/R2 environment and experiment

The following physical-device work predates this R3 investigation. It is retained
as earlier evidence; R3 itself used only the authorized emulator, as recorded below.

- Physical Samsung SM-S901E, explicitly selected for every command.
- Branch-local CLI 0.12.0 and debug Operator 0.12.0-d, verified with
  `version --check-compat` after building and installing the matching APK.
- The initial device APK was 0.9.5-d and was not used for the matrix.
- Device remained awake and unlocked on its launcher. No skill mutation workload
  ran concurrently. These results do not represent scrolling or app switching.
- Direct CLI: three serialized snapshots at each of 0, 1, and 9 seconds between
  commands, including compact output on the second capture in each group.
- Daemon: the same three intervals and three captures per interval, submitted
  to `/execute` on an isolated Unix socket using the normal `cmdDaemonRun`
  implementation. One daemon host process was verified from reader timelines.

| Mode | Captures | Successful | Readiness probes | Observation |
| --- | --- | --- | --- | --- |
| Direct CLI | 9 | 9 | 9 | Each new process starts with a cold module cache |
| Isolated daemon | 9 | 9 | 4 | First capture and each 9-second interval probe; five warm captures reuse readiness |

Direct captures took approximately 0.60-0.66 seconds. Daemon warm captures took
0.27-0.29 seconds; cold captures took 0.61-0.67 seconds. This supports the stated
cache behavior, not a causal explanation for the historical missing responses.

An earlier nine-command attempt labelled daemon actually fell back to direct
execution. It is excluded from the daemon results. Managed daemon processes
exited before ownership checks in this host environment; an isolated daemon
was used to avoid claiming that fallback exercised persistent readiness state.
The isolated run exercised the daemon HTTP execution path, not CLI proxy selection.

## Reproduction and retained evidence

Build Node and the debug APK, select one device, install with `operator setup`,
and verify matching versions. Use `CLAWPERATOR_LOG_LEVEL=debug` and a writable
`CLAWPERATOR_LOG_DIR`. For direct captures:

```bash
node apps/node/dist/cli/index.js snapshot --no-daemon \
  --device <device_serial> --operator-package com.clawperator.operator.dev
```

Run three times per interval, serially. For persistent-cache comparison, start
`cmdDaemonRun` with an isolated `baseDir`, explicit device and package, and a
logger. Verify `/ping`, then submit the same snapshot executions to `/execute`
with the explicit `deviceId`. Use distinct command/task IDs and stop the owned
daemon afterward. Capture Android logcat locally before it rotates.

Local investigation artifacts were retained under `/tmp/reliability-live/`
(direct outputs and host logs) and `/tmp/reliability-isolated-daemon/` (matrix,
raw envelopes, host timelines, and Android logcat). These may contain UI text
and device identifiers and are deliberately not committed.

Host timelines retain reader creation, broadcast callback entry, dispatch
capture, first output, deadline, and settlement timestamps. Probe creation is
identified by the generated `doctor-handshake-*` correlation. Android command
receipt and completion can be correlated where retained logcat contains them.
For the first cold daemon probe, the host reader started at
`00:16:21.636Z`: process creation was +2.316 ms, dispatch capture +104.373 ms,
first stdout +358.297 ms, and terminal settlement +359.211 ms. Correlated Android
logcat records execution start at `10:16:21.765`, success at `10:16:21.778`, and
publication completion at `10:16:21.781` (device local clock). Host and device
clocks are separate; these are correlated stages, not a clock-synchronized
latency decomposition.

The experiment does not measure when the Android logcat subscription becomes
ready independently of process creation and first output. Missing receipt logs
must not be interpreted as proof that Android did not receive a command.

## Historical failure interpretation

The retained `jev-r&d/transport-failures.json` audit records `samsung-a2`
read-value and screenshot failures around 7.27 seconds. Its reader failures
first identify `doctor-handshake-*` commands and then the requested operation.
The seven-second wait is the probe budget, not the requested action budget.
That classifies these as readiness failures; it does not establish whether
listener lifecycle, cadence, interactivity, or Android execution lost evidence.

With the new contract an equivalent error identifies `phase: "readiness"`,
requested `dispatchState: "not_dispatched"`, distinct `probeCommandId`, and the
probe's own dispatch state and bounded transport diagnostics. An agent can
inspect `earlierEffects` and `wakeAttempts` before deciding to retry. A requested
mutation with `dispatchState: "unknown"` instead requires observation before
repetition. Historical records lack some of these fields and cannot be
retroactively treated as complete traces. Injected regression failures prove
propagation, not repair of the physical transport cause.

The sanitized `apps/node/src/test/fixtures/readiness-timeout.json` excerpt keeps
one `samsung-a4` screenshot timeout and the paired probe/request reader-failure
timestamps. Its command IDs are replaced. The audit did not retain a broadcast
acknowledgement; the regression test injects one explicitly to exercise propagation
and does not infer it from the historical log. R2 coverage also exercises loss of
successful probe correlation during a later requested-command failure, preflight
exceptions after a force-stop, host post-processing, and public serialization.

## Snapshot transport boundary

`TaskScopeDefault.logUiTree` emits a command-tagged hierarchy through `Log.d`,
which delegates to Timber. Node collects the live result reader's tagged lines
and previously accepted any nonempty fragment, including one ending at stream
termination. The saved two-line partial fixture reproduced that acceptance
before the fix. The corrected extractor retains an invalid occurrence with
`validationError: "malformed_xml"` and no observation text; execution then
fails the matching step for both raw and compact consumers.

The old reproducer's `acceptedIncomplete` boolean only tests for a missing
closing tag, so it also labels the new empty invalid-record placeholder true.
Regression checks additionally assert `validationError`, absence of valid text,
step association, failed envelope, and CLI exit 1. The source defect is corrected
without changing presentation format or assuming where the original bytes were
lost. No Android framing change is justified by this experiment.

## R3 readiness-probe disposition (20 September 2026)

Disposition: **historical Samsung cause unresolved; no runtime fix justified by
this investigation**. R1/R2 retain their diagnostic and evidence improvements.
This disposition does not assert that Samsung transport reliability is repaired.
The next causal experiment requires explicit Samsung access and a naturally
failing attempt with independent observations. Do not replace diagnosis with
larger timeouts, skipped readiness, extended caching, or blind mutation retries.

### Verified baseline and scope

The investigation used a dedicated worktree at source revision
`aab6ac67533f1543e0d847c424057855c2419313`, which includes R1 `2a50b4f2` and landed
R2. Node CLI `0.12.0` and development Operator `0.12.0-d` were built from this
worktree. The target was the explicitly authorized API-35 Android 15 arm64
emulator. Samsung permission was requested but not received; no Samsung command,
installation, or setting change was performed.

`runDoctorPingCommand` still uses a 5000-ms Android command timeout and 7000-ms
host envelope wait. The readiness map is process-local, keyed by device/package,
and expires 8000 ms after the pre-check timestamp stored on success. Fresh CLI
processes cannot share that map. An isolated daemon can reuse it. Existing cache
invalidation and the R2 failure contract were preserved.

The retained Samsung benchmark used global CLI `0.11.3`, release Operator
`0.11.3`, Android 16, and direct transport. Its final audit identifies 31 probe
timeouts separately from repaired skill framing and failure-reporting defects.
The copied host log has no independent Android receipt/completion capture for
those failures. All 31 failure timelines show first stdout after dispatch:
398.459-600.746 ms after reader creation. Cleanup follows the deadline, so these
records do not show an early reader exit. Zero received chunks is not proof of
missing Android execution: a small canonical probe result uses no chunks.

The currently installed global `0.11.3` reader and freshly compiled `0.12.0`
reader are byte-identical (SHA-256
`5d020c8cfd733f66c64ff9883f553968a2b47df25d4fef6acd7af01d5513dc33`). This compares
the installed files at investigation time, not a separately preserved historical
binary. The old benchmark remains a separate baseline, not a current-code test.

### Bounded live comparison

The primary matrix ran two blocks of three snapshots for each transport and
inter-command delay. The isolated daemon was restarted for every block. Delays
were measured after the preceding response; CLI launch and command time are
additional. Transport order was reversed in the second block. Every command
selected the emulator and development package explicitly; actions were serialized.
The daemon used the unchanged branch-local `cmdDaemonRun` and `/execute` handler
with a dedicated socket directory. Its HTTP client bypassed automatic CLI daemon
discovery and fallback, so those client mechanisms are not covered here.

| Transport | Delay (ms) | Valid snapshots | Fresh probes | Median request time (ms) |
| --- | ---: | ---: | ---: | ---: |
| Direct CLI | 0 | 6/6 | 6 | 1330.657 |
| Direct CLI | 1000 | 6/6 | 6 | 750.745 |
| Direct CLI | 9000 | 6/6 | 6 | 787.264 |
| Daemon HTTP | 0 | 6/6 | 2 | 1222.662 |
| Daemon HTTP | 1000 | 6/6 | 2 | 496.959 |
| Daemon HTTP | 9000 | 6/6 | 6 | 672.489 |

All 36 requested results contained valid hierarchy XML. All 28 fresh probes had
independently observed executor start, success, canonical result, and publication
write-completion records. Eight requests used the warm daemon cache. At 9000 ms,
all daemon requests needed fresh probes. Two successful probes had first stdout
after dispatch, demonstrating that this timing signature alone cannot identify
the historical failure cause.

The primary matrix retained the existing configuration with both release and
development accessibility services enabled. A separate control temporarily
selected only the development service: 12/12 snapshots and 10/10 probes passed
across the same transport/delay combinations. The original service setting was
restored and verified. The first request after reconfiguration took 6331.448 ms
but succeeded; its probe settled in 1411.034 ms. These small, ordered samples and
uncontrolled host load do not establish a performance effect or an OEM cause.

Both before/after captures were awake, and all 38 observed probes across the two
complete series reported screen on, device unlocked, and user storage unlocked.
No host wake or force-stop commands appeared in these series. That is specific
to these snapshot payloads and observed state, not a general no-effects claim:
readiness can wake devices and the Android receiver can close the notification
panel. Earlier effects in the original failed attempts remain unknown.

A driver pilot passed three direct snapshots before a Python naming collision
aborted daemon startup. The pilot and traceback were retained separately; none
of its samples replaced a matrix attempt. Total live accounting is 51 requested
snapshots: 3 pilot + 36 matrix + 12 control, all successful. The host driver
failure is not a Clawperator timeout.

### Evidence limits and next discriminating experiment

Existing R2 host logs supplied requested/probe identities, dispatch and settlement
timing. A separate continuous logcat observer supplied Android stages. No runtime
instrumentation was added. First stdout is observable output, not a subscription
acknowledgement. Successful receiver entry itself is not logged; executor start
is the earliest correlated Android execution stage. Publication writes completing
do not acknowledge delivery, but an independently parsed canonical result does
establish observation by that independent reader. Host arrival and Android epoch
times are retained separately and are not treated as synchronized clocks.

An explicitly synthetic, off-device two-case experiment delayed first stdout to
500 ms in both cases. Buffering the synthetic result succeeded; deliberately
discarding it before a simulated subscription timed out at the unchanged
7000-ms wait. This demonstrates an ambiguity in the timing evidence; it does not
reproduce a real device defect or establish the historical cause.

On an authorized Samsung, the next bounded experiment should reproduce the
original release-package/direct cohort separately from matching current builds,
while recording an independent continuous reader and per-command host timelines.
If a probe fails, preserve its exact result, publication markers and command
stages, then take one read-only device-buffer capture before further actions.
A complete result present independently but absent from the request reader
isolates a listener/delivery path. Executor start without completion instead
motivates queue, main-thread and service-lifecycle inspection. No correlated
receipt evidence leaves both ingress and observation loss open. Add targeted
receiver-entry instrumentation only if that missing stage prevents discrimination;
do not infer non-execution from silence or replay an uncertain mutation.

Sanitized report, recipes, per-attempt summaries and the historical ledger live
in the usage-notes repository under `jev-r&d/r3-readiness-probes/`. Raw logs,
private device identifiers, setup captures and independent streams remain in
that directory's ignored `raw/` subtree. Validation at the investigated revision:
Node build and 1723 tests passed; matching debug APK built and passed emulator
compatibility/readiness and the live comparisons. This documentation-only
closeout adds no runtime behavior or new transport guarantee.
