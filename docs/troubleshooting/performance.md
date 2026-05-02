# Performance

## Purpose

Use this page to measure and improve Clawperator I/O latency on Android devices.
The current high-impact checks are:

- use a release Operator APK for timing
- prefer an emulator baseline when the target app can run there
- use a persistent API path for repeated calls
- record device, app screen, package, APK, Node version, and code commit with every result

The repeatable timing workflow lives in the repo-local
[`test-io-speeds` skill](https://github.com/clawperator/clawperator/tree/main/.agents/skills/test-io-speeds).

## Fastest Path

The fastest measured path is emulator plus direct daemon. Direct daemon is an
internal measurement path, not the public caller API; use the
[Serve API](../api/serve.md) as the public persistent API for repeated calls.

Direct daemon means the timing harness posts the execution payload directly to
the already-running Clawperator daemon over the daemon's internal Unix socket,
using that internal server's `/execute` route. It is not the public
[Serve API `POST /execute`](../api/serve.md#endpoint-post-execute), and it is
not the same as running `clawperator execute` from a fresh shell. This path
bypasses fresh CLI process startup, CLI argument parsing, stdout formatting, and
other per-command CLI wrapper work. It is a diagnostic measurement path, not
the recommended public API.

These rule-of-thumb values come from the 2026-05-02 skill validation run at
commit `d77c3915`, using release package `com.clawperator.operator`, 10
measured calls per app, and these apps: Android Settings, Google Play Store,
YouTube, and Google Home.

| Path | Mean snapshot latency | Cost versus fastest | What it means |
|------|-----------------------|---------------------|---------------|
| Emulator + direct daemon | about 78 ms | baseline | Fastest measured path |
| Emulator + fresh CLI through daemon | about 220 ms | about +142 ms | Cost of starting/parsing/formatting a fresh CLI process instead of using the daemon directly |
| Physical USB + direct daemon | about 197 ms | about +119 ms | Cost of using the physical USB device instead of the emulator on the direct-daemon path |
| Physical USB + fresh CLI through daemon | about 326 ms | about +248 ms | Both costs together: physical USB transport/device plus fresh CLI overhead |

Average overheads from the same run:

| Question | Observed cost |
|----------|---------------|
| Not using direct daemon, on emulator | about +142 ms |
| Not using direct daemon, on physical USB | about +129 ms |
| Not using emulator, direct daemon path | about +119 ms |
| Not using emulator, fresh CLI path | about +106 ms |

## Current API Paths

| Path | Command surface | Persistence | Best use |
|------|-----------------|-------------|----------|
| Fresh CLI through daemon | `clawperator snapshot` | Starts a new Node process for each call, then proxies through the daemon when available | Human terminal use and compatibility checks |
| [Serve API](../api/serve.md) | `clawperator serve` then HTTP requests, such as [`POST /snapshot`](../api/serve.md#endpoint-post-snapshot) | One long-running Node process | Repeated agent loops and throughput-sensitive callers |
| Direct daemon socket | Internal daemon Unix socket under `~/.clawperator/daemon/`, posted to by the timing harness | One daemon process | Measurement and implementation diagnostics, not public API use |
| Direct execution | `--no-daemon` or `CLAWPERATOR_NO_DAEMON=1` | No daemon proxy | Debugging daemon behavior, not throughput |

Code sources:

- `apps/node/src/cli/registry.ts` defines `snapshot`, `--no-daemon`, `daemon`, and `serve`.
- `apps/node/src/cli/commands/serve.ts` defines `GET /ping`, `GET /version`, `POST /execute`, `POST /snapshot`, and related endpoints.
- `apps/node/src/cli/daemonProxy.ts` proxies daemon-capable CLI calls to `/execute` unless `--no-daemon`, `CLAWPERATOR_NO_DAEMON=1`, Windows, or an unsupported request forces direct execution.
- `apps/node/src/domain/executions/runExecution.ts` performs device resolution, APK/readiness checks, adb broadcast dispatch, logcat result reading, snapshot extraction, and result envelope normalization.

## Fresh CLI Versus Serve

Fresh CLI means each `snapshot` call starts a new `clawperator` process, parses
CLI arguments, resolves configuration, checks or starts the daemon, proxies the
request, parses the result, and formats stdout. The daemon still helps because
the Android execution work is kept behind a warm host process, but the caller
pays per-process overhead.

Serve means the caller starts one HTTP server and sends repeated requests to that
same process. This avoids fresh process startup and CLI formatting on every call.
For repeated agent loops, the [Serve API](../api/serve.md) is the public
persistent API to prefer.

Start serve:

```bash
clawperator serve --host 127.0.0.1 --port 3000 --operator-package com.clawperator.operator
```

Request a snapshot:

```bash
curl -s http://127.0.0.1:3000/snapshot \
  -H 'Content-Type: application/json' \
  -d '{"deviceId":"<device_serial>","operatorPackage":"com.clawperator.operator"}'
```

Success condition:

- HTTP status is `200`
- JSON field `ok` is `true`
- JSON field `envelope.status` is `"success"`
- JSON field `envelope.stepResults[0].data.text` is a non-empty Android UI Automator XML string

## Replace Fresh CLI Loops

Do not write latency-sensitive loops that start a fresh `clawperator` process
for every observation:

```bash
for i in $(seq 1 20); do
  clawperator snapshot > "snapshot-$i.json"
done
```

That pattern pays fresh process startup, CLI parsing, daemon discovery/proxy
work, JSON parsing, stdout formatting, and process exit on every iteration.

Instead, start one Serve API process:

```bash
clawperator serve
```

Then keep the caller process alive and reuse HTTP requests:

```bash
for i in $(seq 1 20); do
  curl -s http://127.0.0.1:3000/snapshot \
    -H 'Content-Type: application/json' \
    -d '{}' \
    > "snapshot-$i.json"
done
```

For multi-action payloads, use the public
[`POST /execute`](../api/serve.md#endpoint-post-execute) endpoint. Do not
interpret the direct-daemon timing path as a recommendation to call the
daemon's internal Unix socket from skills.

## Measurement Workflow

Run measurements from the repository root with branch-local Node artifacts.

```bash
adb devices -l
npm --prefix apps/node run build
./gradlew :app:assembleRelease
adb -s <device_serial> install apps/android/app/build/outputs/apk/release/app-release.apk
./scripts/clawperator_grant_android_permissions.sh --release --serial <device_serial>
adb -s <device_serial> shell setprop log.tag.ClawpSnapshotTiming DEBUG
node .agents/skills/test-io-speeds/scripts/measure-snapshot-latency.mjs \
  --device <device_serial> \
  --operator-package com.clawperator.operator \
  --warmups 3 \
  --measured 10
```

By default, the harness writes local timing artifacts to
`~/.clawperator/timings/YYYY-MM-DD/<device_serial>`. Use `--out-dir <path>`
only when a run needs a different local output directory. When both an emulator
and a physical device are connected, run the harness once per explicit
`--device` value so the two result sets do not overwrite each other.

Use a custom app set with `--apps-file`:

```json
[
  {
    "id": "play-store",
    "name": "Google Play Store",
    "packageName": "com.android.vending"
  }
]
```

The bundled default app set is package-only:

- Android Settings: `com.android.settings`
- YouTube: `com.google.android.youtube`
- Google Play Store: `com.android.vending`

The harness first runs `clawperator close <package>`, then
`clawperator open <package>`, so each measured app starts from its normal
launcher entry point.

```bash
node .agents/skills/test-io-speeds/scripts/measure-snapshot-latency.mjs \
  --device <device_serial> \
  --operator-package com.clawperator.operator \
  --apps-file /path/to/apps.json
```

Do not commit raw timing artifacts. The harness writes per-app JSON summaries
and can keep raw logcat and host logs with `--keep-raw-logs`; those raw files
may contain screen text, package state, local paths, or device identifiers.

## 2026-05-02 Findings

Measurements on 2026-05-02 used branch-local Node build `0.9.6`, command
surface `snapshot`, release package `com.clawperator.operator`, and locally
built release APKs. The emulator baseline was collected at commit
`f3333c5689991889c3f3c4e1640861ba39dc65fd`. The physical companion run was
collected after adding gated Android timing logs in commit `3a7dcf65`.

The gated Android timing log tag is `ClawpSnapshotTiming`. When the tag is not
enabled, the production path pays only the Android `Log.isLoggable` check and
does not emit per-snapshot timing logs. Keep this behavior gated.

### Devices

| Device | Serial in reports | Model | Android | Screen | Notes |
|--------|-------------------|-------|---------|--------|-------|
| Emulator | `emulator-5554` | `sdk_gphone64_arm64` | Android 16, API 36 | 1080x2400, density 420 | Google Play emulator |
| Physical | redacted in committed docs | Samsung `SM-S901E` | Android 16, API 36 | 1080x2340, density 480 | USB transport |

### Timing Summary

All values are milliseconds. Each app used 3 warmup calls and 10 measured calls.
Fresh CLI mean is the normal `snapshot` CLI call through an already-running
daemon. Direct daemon mean posts directly to the daemon `/execute` socket from
the timing harness and removes fresh CLI process overhead. Operator snapshot
mean is Android-side snapshot work reported by `ClawpSnapshotTiming`.

| App and screen | Emulator fresh CLI mean | Physical fresh CLI mean | Emulator direct daemon mean | Physical direct daemon mean | Emulator operator snapshot mean | Physical operator snapshot mean |
|----------------|-------------------------|--------------------------|-----------------------------|------------------------------|---------------------------------|----------------------------------|
| Google Home, stable home screen | 198.5 | 277.2 | 77.7 | 178.2 | 9.89 | 22.68 |
| Google Play Store, stable store screen | 199.7 | 292.5 | 66.9 | 196.6 | 13.82 | 30.65 |
| AirTouch, stable app screen | 187.9 | 327.6 | 75.6 | 173.4 | 5.25 | 24.76 |

### Payload Summary

| App | Emulator payload bytes, mean | Physical payload bytes, mean |
|-----|------------------------------|-------------------------------|
| Google Home | 57,083 | 61,719 |
| Google Play Store | 46,091 | 40,794 |
| AirTouch | 10,828 | 11,325 |

### Interpretation

The emulator was materially faster than the physical USB device for both host
transport and Android-side snapshot work. Direct daemon latency on the emulator
was about 67-78 ms, while the physical device was about 173-197 ms. Fresh CLI
latency added about 96-154 ms over direct daemon on the physical device and
about 122-133 ms over direct daemon on the emulator.

The main bottleneck for repeated calls is not Android UI hierarchy traversal
alone. Android operator snapshot work was 5-14 ms on the emulator and 23-31 ms
on the physical device. The larger costs are host transport, logcat/result
delivery, daemon proxying, fresh CLI startup, result parsing, and formatting.

For throughput-sensitive loops:

1. Prefer an emulator baseline when the target app supports emulator use.
2. Use release APK timing when evaluating product performance.
3. Use `serve` for repeated caller API traffic.
4. Use fresh CLI timing only when measuring terminal command experience.
5. Treat physical-device USB results as device-and-transport-specific.

## Comparison To Earlier Findings

Earlier task notes under `tasks/node/io-optimizations/findings.md` reported
larger values. They are not directly comparable to the 2026-05-02 controlled
release APK benchmark.

| Source | Date found from git/logs | Likely setup | Snapshot timing |
|--------|--------------------------|--------------|-----------------|
| PR #238, `698e7edc` | 2026-04-26 | Physical Samsung over USB, `.dev` debug Operator, pre-final daemon work, branch-local Node `0.7.8` | Warm CLI median about 2219 ms, serve-mode median about 1750 ms |
| PR #242, `7590a2e7` | 2026-04-26 | Physical Samsung over USB, daemon-aware flow, likely fresh CLI over daemon, app context probably Play Store install/search flow | Warm snapshot improved from about 1599 ms no-daemon to about 846 ms warm daemon |
| 2026-05-02 controlled emulator run | 2026-05-02 | Emulator, release Operator, controlled Google Home, Play Store, and AirTouch screens | Fresh CLI mean about 188-200 ms, direct daemon mean about 67-78 ms |
| 2026-05-02 controlled physical run | 2026-05-02 | Physical Samsung over USB, release Operator, same app set | Fresh CLI mean about 277-328 ms, direct daemon mean about 173-197 ms |

Plausible reasons for the older one-second-scale timings:

- debug `.dev` APK was used for at least part of the earlier work
- the earlier baseline used a physical USB device
- app screens were not the same controlled screen set
- part of the earlier work predated the finalized daemon path
- some earlier values measured fresh CLI behavior, not a persistent caller

Do not use those older values as a current release APK latency baseline.

## Failure Modes

| Symptom | Check | Recovery |
|---------|-------|----------|
| Timing uses the debug package | `adb shell pm path com.clawperator.operator.dev` and command flags | Rebuild and install release, then pass `--operator-package com.clawperator.operator` |
| Multiple devices skew results | `adb devices -l` and `clawperator devices` | Pass `--device <device_serial>` on every command |
| Fresh CLI remains slower than expected | Compare fresh CLI mean to direct daemon mean | Use `clawperator serve` for repeated calls |
| Daemon is stale after rebuilding Node | `clawperator daemon status --format json` and `GET /version` | Restart the daemon or let the daemon proxy replace a mismatched daemon |
| Physical device is much slower than emulator | Compare direct daemon and operator snapshot timing on both | Use emulator for the baseline and keep physical numbers as compatibility data |
| Snapshot appears successful but has no XML | Check `envelope.stepResults[0].data.text` | Treat the run as invalid and inspect version compatibility, operator package, and logcat extraction |

## Validation Commands

Build and test the Node package after changing the timing harness or CLI path:

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Build the release APK before performance timing:

```bash
./gradlew :app:assembleRelease
```

Build the public docs after editing this page:

```bash
./scripts/docs_build.sh
```
