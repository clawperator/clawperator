# Daemon Latency Findings

Date: 2026-04-26
Device: SM-S901E, Android 16 (API 36), serial `<device_serial>`
Baseline commit: faa94df5d75eaaeaaa2aff251c495eaeb13775a6
Test commit: bb33c714504ab3f6a124e8dfc61d04b12cf865ec

## Phase 4 Cache

Phase 4 readiness cache merged: yes.

## Raw Measurements

| Measurement | Mode | Command count | Real time | Average per call | Notes |
| --- | --- | ---: | ---: | ---: | --- |
| Measurement A | direct snapshot | 5 | 5.78s | 1.156s | `CLAWPERATOR_NO_DAEMON=1`; physical device; debug operator package |
| Measurement B | daemon + cache snapshot, cold auto-start first call | 1 | 1.37s | 1.370s | daemon stopped before call; first call includes auto-start and socket readiness polling |
| Measurement B | daemon + cache snapshot, cold auto-start remaining calls | 4 | 2.56s | 0.640s | same cold-start sequence after daemon was online |
| Measurement C | daemon + cache snapshot, warm | 5 | 3.71s | 0.742s | daemon already running before the sequence |
| Measurement D | direct exec close_app | 3 | 0.65s | 0.217s | fixed `close_app` payload; `CLAWPERATOR_NO_DAEMON=1` |
| Measurement D | daemon + cache exec close_app | 3 | 0.62s | 0.207s | fixed `close_app` payload through daemon |

## Averages

- Direct snapshot average: 1.156s per call.
- Warm daemon snapshot average: 0.742s per call.
- Direct exec average: 0.217s per call.
- Warm daemon exec average: 0.207s per call.

## Auto-Start Overhead

The first daemon snapshot call after `daemon stop` took 1.370s. Compared with the
warm daemon snapshot average of 0.742s, auto-start added about 0.628s to the first
call. Compared with the direct snapshot average of 1.156s, the cold daemon first call
was about 0.214s slower, but the five-call cold-start sequence still finished in
3.93s total, 1.85s faster than the 5.78s direct sequence.

## Breakdown

- Snapshot direct to warm daemon improved from 1.156s to 0.742s per call, a 0.414s
  reduction per call.
- That 0.414s reduction lines up with the expected readiness-cache win. Phase 4 was
  active for these measurements, so the warm daemon path should be avoiding repeated
  `doctor_ping` readiness handshakes inside the long-lived daemon process.
- The `close_app` exec payload improved only from 0.217s to 0.207s per call. This is
  expected to be small because `close_app` bypasses interactive readiness and is
  already a short host-side operation.
- These measurements still include startup of the branch-local CLI process for each
  user-facing command. The daemon removes repeated runtime work inside the background
  process, but it does not remove the cost of launching `node apps/node/dist/cli/index.js`
  for each separate shell command.

## Assessment

The daemon approach is confirmed for snapshot-style sequential calls. Warm daemon +
cache saved about 36% per snapshot call in this run, and even the cold auto-start
five-call sequence was about 32% faster overall than direct mode.

The result is not a universal speedup for every command. The simple `close_app` exec
payload was only about 5% faster through the daemon, which is within a narrow margin
and should not be presented as a major latency win. The practical benefit is strongest
for repeated observation or action loops that would otherwise pay readiness and
runtime setup costs on every call.

## Anomalies

- Measurement C was slightly slower than the post-auto-start calls in Measurement B
  (0.742s versus 0.640s per call). The difference is small enough to treat as run-to-run
  device variance rather than a separate behavior.
- Daemon stdout/stderr logs did not provide useful per-request proof for these timing
  runs because normal HTTP route handling is not emitted there by default.
- The direct and daemon `close_app` timings are close enough that more samples would be
  needed before making fine-grained claims about that command.
