# Runtime reliability investigation - 2026-09-20

## Disposition

The incomplete snapshot acceptance defect is reproduced and corrected in Node.
Readiness failures now retain separate probe and requested-command evidence.
The cause of the historical Samsung readiness timeouts remains unresolved.
There is no evidence supporting a timeout increase, disabled readiness check,
or longer cache lifetime. Those settings are unchanged.

## Environment and experiment

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
