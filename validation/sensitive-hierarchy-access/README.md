# Sensitive hierarchy access regression

Run from the repository root after building Node and installing the matching APK:

```sh
python3 validation/sensitive-hierarchy-access/run.py --device <device_serial> --operator-package com.clawperator.operator.dev --out /tmp/sensitive-hierarchy-proof
```

Use an unlocked Android 15/API 35 emulator with Google APIs image revision 9,
English (`en-US`), and Settings from that image. The manual CI workflow uses
`system-images;android-35;google_apis;x86_64`, revision 9, Pixel 6 profile.
The image revision is checked and a changed image fails CI until deliberately
requalified. The publisher's revision-9 archive is
`https://dl.google.com/android/repository/sys-img/google_apis/x86_64-35_r09.zip`
(SHA-1 `0103e6dab21290c4b9d16550a3ce99476f884eef`). Local implementation proof
uses the corresponding API 35 arm64 image. No network connection is required.

Only the selected Operator should be active on this dedicated test device.
Install the matching APK, enable its accessibility service and notification
permissions, and allow the service to connect before starting. The harness does
not install APKs or change accessibility or network settings. CI handles setup
outside the harness and tests both variants sequentially.

The harness uses branch-local CLI commands and a real stdio MCP session. It
requires successful correlated envelopes, three consecutive Internet queries,
raw/MCP query parity, the sensitive Settings root, Wi-Fi switch state/bounds/XML
parity, a decoded PNG, and the Display & touch control screen. A loading page
cannot satisfy readiness. A missing hierarchy fails immediately; it is never
converted to zero matches or a skip. Connected-row evidence is compared when
present. Each subprocess has a deadline; readiness is bounded. A per-device lock
serializes cooperating harnesses. Do not run other automation on the device.

The device ends on Home, with Settings retaining its last visited page. Network
settings are unchanged. Output contains raw responses, errors, device/package
metadata, XML, and screenshots; keep it outside Git on personal devices.
The failure output includes the failed command's artifact path and an independent
screenshot attempt. CI uploads evidence from its disposable emulator.

Offline checks:

```sh
python3 -m unittest discover -s validation/sensitive-hierarchy-access -p 'test_*.py'
python3 validation/sensitive-hierarchy-access/check-apk.py --aapt2 <aapt2_path> <debug_apk> <release_apk>
```

The APK check resolves the compiled resource table, including version qualifiers
and release resource path shortening. It must find a true declaration for API 31+.
Offline tests cannot prove Android's filtering behavior. The manual CI workflow actually
runs `ci-device.sh` under the emulator runner; it does not stop at APK installation.

Run the **Sensitive hierarchy access** workflow manually from GitHub Actions when
release validation or an explicit device regression is needed. It has no pull
request or push trigger. Ordinary PR checks do not boot this emulator. The
manual run remains required release evidence before shipping v0.10.
