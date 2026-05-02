# Snapshot timings on physical Android device - 2026-05-02

## Summary

The physical Android device is slower than the emulator baseline from
`2026-05-02-timings.md`, but the current release/operator daemon path is still
well below the older roughly one-second physical-device number.

| Screen | Physical CLI warm daemon mean | Emulator CLI warm daemon mean | Physical direct daemon mean | Emulator direct daemon mean |
| --- | ---: | ---: | ---: | ---: |
| Google Home | 277.2 ms | 198.5 ms | 178.2 ms | 77.7 ms |
| Google Play Store | 292.5 ms | 199.7 ms | 196.6 ms | 66.9 ms |
| AirTouch | 327.6 ms | 187.9 ms | 173.4 ms | 75.6 ms |

The physical-device penalty shows up in both places:

- Android operator snapshot work is slower on the phone: 22.7 ms to 30.7 ms
  mean on this run, compared with 5.2 ms to 13.8 ms on the emulator baseline.
- The direct daemon path is also much slower over the physical USB/device path:
  173 ms to 197 ms mean on the phone, compared with 67 ms to 78 ms on the
  emulator.
- A fresh CLI invocation still adds about 96 ms to 154 ms on top of the direct
  daemon path, depending on the screen.

This supports the conclusion that the emulator is materially faster for this
workload. It does not support treating USB alone as the whole bottleneck,
because the Android-side snapshot phase also slowed down, especially on
AirTouch.

## Environment and build

| Item | Value |
| --- | --- |
| Timing date | 2026-05-02 |
| Repo branch | `io-timings` |
| Timing doc commit already recorded | `63efdd958483d718c8ae3eaea692e1ae1c7a6c73` |
| Node CLI | branch-local `apps/node/dist/cli/index.js` |
| Node package version | `0.9.6` |
| Operator package | `com.clawperator.operator` |
| APK variant | local release APK |
| APK path | `apps/android/app/build/outputs/apk/release/app-release.apk` |
| APK sha256 | `40d12f8c97b704457004e9de6a671ff817aec864e71cba078abfc1b2381f3936` |
| Timing instrumentation | gated Android log tag `ClawpSnapshotTiming` |

The release operator had to be reinstalled because the already-installed release
package had a different signature. I uninstalled only `com.clawperator.operator`,
installed the local release APK, then granted release operator permissions.

The Android timing hook is gated behind `Log.isLoggable("ClawpSnapshotTiming",
Log.DEBUG)`. With the tag disabled, the expected production overhead is one
loggability check and branch checks per snapshot. With the tag enabled, it logs
operator-side phase timings and hierarchy byte count for measurement.

## Device details

Connected devices were checked before running the physical timing set.

```bash
adb devices -l
node apps/node/dist/cli/index.js devices --format json
```

| Item | Value |
| --- | --- |
| Selected device | `<physical_device_serial>` |
| Connection | USB physical device |
| Manufacturer | Samsung |
| Model | `SM-S901E` |
| Android version | 16 |
| SDK | 36 |
| Screen size | 1080 x 2340 |
| Density | 480 |
| Release operator version | `0.9.6` |

The emulator `emulator-5554` was also connected, but all commands in this file
explicitly targeted `--device <physical_device_serial>`.

## Commands used

Build and install:

```bash
npm --prefix apps/node run build
./gradlew :app:assembleRelease
adb -s <physical_device_serial> uninstall com.clawperator.operator
adb -s <physical_device_serial> install apps/android/app/build/outputs/apk/release/app-release.apk
./scripts/clawperator_grant_android_permissions.sh --release --serial <physical_device_serial>
adb -s <physical_device_serial> shell setprop log.tag.ClawpSnapshotTiming DEBUG
```

Daemon and timing run:

```bash
node apps/node/dist/cli/index.js daemon stop \
  --device <physical_device_serial> \
  --operator-package com.clawperator.operator \
  --format json

node apps/node/dist/cli/index.js daemon start \
  --device <physical_device_serial> \
  --operator-package com.clawperator.operator \
  --format json

CLAWPERATOR_MEASURE_DEVICE=<physical_device_serial> \
CLAWPERATOR_MEASURE_OUT_DIR=tasks/node/io-optimizations/2026-05-02-physical-timing-artifacts \
node tasks/node/io-optimizations/measure-snapshot-latency.mjs
```

The harness launched each app, ran three warmup snapshots, then ran ten measured
CLI `snapshot` calls through the same already-running daemon. It then ran ten
direct daemon `/execute` calls for the same screen to remove fresh CLI process
startup from the path.

## Screens tested

| App | Package | Activity or focused screen |
| --- | --- | --- |
| Google Home | `com.google.android.apps.chromecast.app` | `com.google.android.apps.chromecast.app/com.google.android.apps.chromecast.app.main.MainActivity` |
| Google Play Store | `com.android.vending` | `com.android.vending/com.android.vending.AssetBrowserActivity` |
| AirTouch | `au.com.polyaire.airtouch5` | `au.com.polyaire.airtouch5/au.com.polyaire.airtouch5.MainActivity` |

## Per-app timing tables

### Google Home

| # | commandId | CLI wall ms | payload bytes | nodes | Android cmd ms | operator snapshot ms | hierarchy build ms | direct daemon ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `snapshot-1777707719789-ult6khj` | 302.3 | 61719 | 135 | 24 | 21.63 | 5.08 | 176.0 |
| 2 | `snapshot-1777707720049-cm9wljd` | 277.6 | 61719 | 135 | 31 | 29.38 | 3.89 | 177.5 |
| 3 | `snapshot-1777707720327-4w3ra1j` | 283.2 | 61719 | 135 | 26 | 23.91 | 5.72 | 195.8 |
| 4 | `snapshot-1777707720612-pxzji4r` | 268.5 | 61719 | 135 | 24 | 21.96 | 5.59 | 153.1 |
| 5 | `snapshot-1777707720884-p5yjv37` | 274.1 | 61719 | 135 | 22 | 20.11 | 5.27 | 145.6 |
| 6 | `snapshot-1777707721159-mnzlw1b` | 261.3 | 61719 | 135 | 24 | 21.80 | 4.57 | 186.2 |
| 7 | `snapshot-1777707721416-shim3sy` | 284.3 | 61719 | 135 | 20 | 18.05 | 3.84 | 202.0 |
| 8 | `snapshot-1777707721704-oa05uqn` | 281.3 | 61719 | 135 | 32 | 29.43 | 6.09 | 196.3 |
| 9 | `snapshot-1777707721992-izd41l8` | 267.7 | 61719 | 135 | 21 | 19.30 | 3.77 | 182.9 |
| 10 | `snapshot-1777707722250-193wbnb` | 271.8 | 61719 | 135 | 23 | 21.20 | 5.10 | 166.6 |

| Metric | CLI wall | Direct daemon | Operator snapshot | Hierarchy build |
| --- | ---: | ---: | ---: | ---: |
| Mean | 277.2 ms | 178.2 ms | 22.68 ms | 4.89 ms |
| Median | 275.8 ms | 180.2 ms | 21.72 ms | 5.09 ms |
| Min | 261.3 ms | 145.6 ms | 18.05 ms | 3.77 ms |
| Max | 302.3 ms | 202.0 ms | 29.43 ms | 6.09 ms |
| p95 | 302.3 ms | 202.0 ms | 29.43 ms | 6.09 ms |

### Google Play Store

| # | commandId | CLI wall ms | payload bytes | nodes | Android cmd ms | operator snapshot ms | hierarchy build ms | direct daemon ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `snapshot-1777707732333-hbrgvzs` | 337.7 | 40794 | 108 | 45 | 43.34 | 7.79 | 181.1 |
| 2 | `snapshot-1777707732660-r2ydc5x` | 296.1 | 40794 | 108 | 37 | 33.47 | 8.77 | 227.7 |
| 3 | `snapshot-1777707732944-cqnt136` | 265.6 | 40794 | 108 | 29 | 27.52 | 4.66 | 194.7 |
| 4 | `snapshot-1777707733212-lybmmf9` | 305.6 | 40794 | 108 | 22 | 19.92 | 3.49 | 183.7 |
| 5 | `snapshot-1777707733512-r4dlsk7` | 288.4 | 40794 | 108 | 30 | 28.36 | 4.33 | 178.4 |
| 6 | `snapshot-1777707733801-7sqge0f` | 282.4 | 40794 | 108 | 30 | 27.87 | 3.59 | 163.9 |
| 7 | `snapshot-1777707734094-g2rrl0g` | 296.3 | 40794 | 108 | 33 | 31.24 | 4.21 | 242.5 |
| 8 | `snapshot-1777707734393-x1ifblv` | 309.2 | 40794 | 108 | 35 | 31.91 | 4.24 | 211.2 |
| 9 | `snapshot-1777707734692-yj7i2j9` | 254.6 | 40794 | 108 | 27 | 26.12 | 3.91 | 176.4 |
| 10 | `snapshot-1777707734948-8gl47av` | 289.5 | 40794 | 108 | 39 | 36.77 | 4.60 | 206.3 |

| Metric | CLI wall | Direct daemon | Operator snapshot | Hierarchy build |
| --- | ---: | ---: | ---: | ---: |
| Mean | 292.5 ms | 196.6 ms | 30.65 ms | 4.96 ms |
| Median | 292.8 ms | 189.2 ms | 29.80 ms | 4.29 ms |
| Min | 254.6 ms | 163.9 ms | 19.92 ms | 3.49 ms |
| Max | 337.7 ms | 242.5 ms | 43.34 ms | 8.77 ms |
| p95 | 337.7 ms | 242.5 ms | 43.34 ms | 8.77 ms |

### AirTouch

| # | commandId | CLI wall ms | payload bytes | nodes | Android cmd ms | operator snapshot ms | hierarchy build ms | direct daemon ms |
| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | `snapshot-1777707750305-qth73eb` | 338.8 | 11325 | 31 | 33 | 24.32 | 8.16 | 167.7 |
| 2 | `snapshot-1777707750632-z06cjxl` | 283.0 | 11325 | 31 | 18 | 15.22 | 5.27 | 163.0 |
| 3 | `snapshot-1777707750921-97vmjea` | 306.2 | 11325 | 31 | 24 | 19.79 | 3.73 | 123.3 |
| 4 | `snapshot-1777707751234-h0u67za` | 328.4 | 11325 | 31 | 38 | 27.82 | 9.18 | 150.3 |
| 5 | `snapshot-1777707751549-jxw3p5l` | 358.2 | 11325 | 31 | 36 | 26.63 | 8.88 | 177.8 |
| 6 | `snapshot-1777707751918-idb045n` | 308.9 | 11325 | 31 | 37 | 29.11 | 8.72 | 169.0 |
| 7 | `snapshot-1777707752226-3t4n2eg` | 316.6 | 11325 | 31 | 33 | 22.97 | 5.88 | 185.8 |
| 8 | `snapshot-1777707752537-mft7y0v` | 437.9 | 11325 | 31 | 45 | 38.13 | 10.76 | 206.9 |
| 9 | `snapshot-1777707752991-uosynw0` | 326.2 | 11325 | 31 | 31 | 22.05 | 6.21 | 185.6 |
| 10 | `snapshot-1777707753299-qlwvmcn` | 271.5 | 11325 | 31 | 26 | 21.55 | 5.02 | 204.1 |

| Metric | CLI wall | Direct daemon | Operator snapshot | Hierarchy build |
| --- | ---: | ---: | ---: | ---: |
| Mean | 327.6 ms | 173.4 ms | 24.76 ms | 7.18 ms |
| Median | 321.4 ms | 173.4 ms | 23.65 ms | 7.18 ms |
| Min | 271.5 ms | 123.3 ms | 15.22 ms | 3.73 ms |
| Max | 437.9 ms | 206.9 ms | 38.13 ms | 10.76 ms |
| p95 | 437.9 ms | 206.9 ms | 38.13 ms | 10.76 ms |

## Overall latency breakdown

| Segment | Google Home | Play Store | AirTouch | Notes |
| --- | ---: | ---: | ---: | --- |
| CLI total wall | 277.2 ms | 292.5 ms | 327.6 ms | Fresh `node apps/node/dist/cli/index.js snapshot ...` process per call |
| Direct daemon wall | 178.2 ms | 196.6 ms | 173.4 ms | POST to already-running daemon `/execute`, no fresh CLI process |
| Fresh CLI overhead over direct daemon | 99.0 ms | 95.9 ms | 154.2 ms | Includes process startup, CLI parsing, daemon resolution, output formatting |
| Android command observed by host | 24.7 ms | 32.7 ms | 32.1 ms | Host-side command timing around broadcast/result collection |
| Android operator snapshot work | 22.7 ms | 30.7 ms | 24.8 ms | Operator-side timing hook |
| Hierarchy build | 4.9 ms | 5.0 ms | 7.2 ms | Included in operator snapshot work |
| Payload size | 61.7 KB | 40.8 KB | 11.3 KB | Snapshot text payload |

The largest measured physical-device cost is not accessibility traversal itself.
Even on the physical device, operator snapshot work remains tens of milliseconds.
The larger gap is between operator completion and full daemon response, plus the
additional fresh CLI invocation cost when callers use one process per snapshot.

## Comparison to existing findings

`findings.md` reported typical physical-device medians around 846 ms before the
Node I/O optimization work. The emulator baseline in `2026-05-02-timings.md`
was much faster, with CLI medians around 190 ms to 200 ms. This physical-device
rerun lands between those two:

| Screen | Old physical median from `findings.md` | Current physical CLI median | Emulator CLI median |
| --- | ---: | ---: | ---: |
| Google Home | about 846 ms | 275.8 ms | 195.2 ms |
| Google Play Store | about 846 ms | 292.8 ms | 199.7 ms |
| AirTouch | about 846 ms | 321.4 ms | 189.8 ms |

Compared with the emulator baseline, current physical CLI mean is 40 percent
slower for Google Home, 46 percent slower for Play Store, and 74 percent slower
for AirTouch. Current physical direct daemon mean is 129 percent slower for
Google Home, 194 percent slower for Play Store, and 129 percent slower for
AirTouch.

## Interpretation

The next optimization target should still be the host/daemon access pattern, not
Android traversal or payload compaction first.

For repeated calls, the important floor is the direct daemon path. On the
emulator that floor was about 67 ms to 78 ms. On this physical phone it was
about 173 ms to 197 ms. That is much slower, but still fast enough for several
snapshots per second if the caller can reuse a persistent client path and avoid
fresh CLI process startup.

The fresh CLI path is useful for humans and shell scripts, but it is not the
right performance target for agent loops that need frequent snapshots. On this
physical run, fresh CLI startup and formatting added roughly 96 ms to 154 ms per
call on top of direct daemon latency.

Android snapshot traversal and serialization remain second-order for these
screens. They are worth improving, especially for physical devices and complex
apps, but the measured operator-side work is not large enough to explain the
total end-to-end wall time by itself.

## Recommended next experiments

1. Add or expose a supported persistent Node client API for daemon-backed calls.
   - Expected impact: high for repeated snapshots.
   - Risk: moderate, because this needs a stable lifecycle and result contract.
   - Success metric: repeated physical-device snapshots close to the direct
     daemon means in this file rather than the fresh CLI means.

2. Add daemon-side phase timing around command receipt, broadcast send,
   result-read, parse, and response write.
   - Expected impact: high diagnostic value.
   - Risk: low if gated behind an environment variable or debug flag.
   - Purpose: split the remaining direct-daemon cost into Android transport,
     logcat/result capture, daemon parsing, and HTTP/socket write.

3. Prototype a lower-latency result return path than logcat for snapshot-sized
   payloads on physical USB.
   - Expected impact: medium to high on physical devices.
   - Risk: moderate to high depending on the transport.
   - Purpose: test whether the 170 ms to 200 ms physical direct daemon floor is
     dominated by logcat/result transport.

4. Keep the gated Android timing hook available.
   - Expected impact: diagnostic.
   - Risk: low when disabled.
   - Purpose: preserve cheap operator-side visibility for future regressions.

5. Test payload format changes only after daemon/transport timing is clearer.
   - Expected impact: uncertain for these screens.
   - Risk: moderate if it changes contracts or compatibility.
   - Rationale: a 61.7 KB Google Home snapshot was not proportionally slower
     than smaller payloads, so payload size does not appear to be the first
     bottleneck in this sample.

## Caveats and failed runs

- The first physical harness run completed Google Home, then a direct daemon
  request hit `EPIPE`. I added retry handling in the measurement harness and
  reran the full app set. The tables above use the successful rerun.
- Raw logcat, host logs, and per-call JSON artifacts were not committed after
  summary extraction. This avoids keeping app screen text, local device
  identifiers, or screen-specific payload metadata in source history.
- The `.dev` operator service was also enabled on the phone, but all timing
  commands explicitly used `--operator-package com.clawperator.operator`.
- The Android timing hook was enabled with
  `adb shell setprop log.tag.ClawpSnapshotTiming DEBUG` during the run. This
  adds extra logging work only for the measurement run.

## Validation

Validation run for the code used in this measurement:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./gradlew :app:assembleRelease :shared:data:task:testDebugUnitTest
```

Result:

- Node build succeeded.
- Node tests passed: 269 passed, 0 failed.
- Release APK build succeeded.
- `:shared:data:task:testDebugUnitTest` completed as `NO-SOURCE`, because that
  module currently has no debug unit-test sources.
