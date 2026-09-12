# Result transport reliability series

This manual harness runs exactly 20 immediate Settings open/query cycles and
20 full Internet queries on one explicit API-35 English device. Install the
matching APK and activate only its accessibility service first. It uses the
branch-local CLI with daemon routing disabled. It never retries an attempt. A failed open stops the series so a later cycle
cannot replay an uncertain mutation; remaining declared attempts are unrun.
Failed read-only queries are retained while the fixed series continues.

```sh
python3 validation/result-transport-reliability/run.py \
  --device <device_serial> --operator-package com.clawperator.operator.dev \
  --apk apps/android/app/build/outputs/apk/debug/app-debug.apk \
  --out /tmp/result-transport-debug
```

Repeat separately for the release package and APK. Each output directory must
be new. The harness takes the shared device lock and verifies API, language and
selected service. The caller must install the supplied APK first; its hash is
recorded alongside installed package metadata, the source commit and built CLI
hashes. Raw command output and a bounded independent logcat tail are private
artifacts. Every attempt records identity, output size, duration and outcome;
failed attempts remain in the report. `summary.json` records completed, failed and
unrun counts and whether the independent reader exited before cleanup. Timeouts
are failures, not retries.

The Internet fixture is prepared using `android.settings.WIFI_SETTINGS`, then
verified through the full query's heading, sensitive root and Wi-Fi switch.
This focused transport check does not replace the hierarchy regression or its
homepage preparation and scrolling assertions. Run the combined hierarchy
harness after R11/R12 integration before declaring release readiness.

Offline tests are included in `validation/test_all.sh --suite
validation`. Live runs are explicit only. See the [causal findings and recorded
limits](../../docs/internal/design/result-transport-reliability.md).
