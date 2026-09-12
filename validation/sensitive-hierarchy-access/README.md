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
Use the checked-in setup helper before each variant:

```sh
python3 validation/sensitive-hierarchy-access/prepare_operator.py \
  --device <device_serial> --operator-package com.clawperator.operator.dev \
  --apk apps/android/app/build/outputs/apk/debug/app-debug.apk --out /tmp/hierarchy-debug-setup
```

The helper holds the device lock, disables accessibility, removes the enabled
service list and waits for all bindings to disconnect before stopping the two
Operator packages and installing the selected APK. It launches the selected
Operator, enables only its service, grants notification permissions, waits for
one healthy binding, and requires both doctor and a nonempty query to succeed.
Binding observations are bounded by 15 seconds and 30 attempts per phase; failed
commands are not retried. Each setup uses a new artifact directory and records
commands, outputs, deadlines and the APK hash. CI uses this same helper for both
variants sequentially. This explicitly replaces accessibility-service selection
on the dedicated emulator; it does not clear application data or change network
settings. The capture harness itself does not install APKs or change permissions.

The harness uses branch-local CLI commands and a real stdio MCP session. It
requires successful correlated envelopes, three consecutive Internet queries,
raw/MCP query parity, the sensitive Settings root, Wi-Fi switch state/bounds/XML
parity, a decoded PNG, and the Display & touch control screen. Internet readiness requires the destination's `collapsing_toolbar` labeled
`Internet`, the `Wi-Fi` row, and `switchWidget` together. The outgoing Network &
internet page's Airplane mode switch and the Internet loading page cannot satisfy
readiness. At most 30 successful queries run within 15 seconds, with each process
bounded by the remaining deadline. Query/service/transport failures fail
immediately; no navigation is replayed. Sensitivity, unique switch/state and
parity assertions still apply to the separate captures after readiness.
`internet-preparation.json` retains the readiness verdict and observation count. A missing hierarchy fails immediately; it is never
converted to zero matches or a skip. Connected-row evidence is compared when
present. Each subprocess has a deadline; readiness is bounded. A per-device lock
serializes cooperating harnesses. Do not run other automation on the device.

Preparation supports a fresh Settings process, an ordinary restored subpage, and
a restored `com.google.android.settings.intelligence` search activity. Under the
same device lock, it records the activity stack, force-stops only that search
package and `com.android.settings`, then launches Settings once through the CLI.
It does not clear application data, reset the device, or change network settings.
Launch success is required but does not itself establish readiness.

Within a 60-second preparation deadline, at most five successful queries check
for unique on-screen `settings_homepage_container` and
`main_content_scrollable_container` nodes and the `Network & internet` row.
API 35 also requires the expanded, scrollable outer homepage container. A search
label alone cannot satisfy the check. Only successful queries of an unsettled
screen can be observed again; command, service and transport failures stop the
run immediately, with no replay. Capture assertions cannot run until preparation
passes. The Display scroll scenario remains unchanged.

API 35 remains the default and the manual CI release gate. For an explicit
API 36 comparison, pass `--api 36`. Its Settings homepage has a fixed outer header;
preparation instead also requires the on-screen `search_action_bar` and first
`Google` row. This comparison does not qualify the API 35 image or reproduce its
collapsing-container scroll transition. Other API values are rejected.

Cleanup attempts Home once, including after failure, and records whether it
succeeded. Settings retains its last visited page. Network settings are unchanged. Output contains raw responses, errors, device/package
metadata, XML, and screenshots; keep it outside Git on personal devices.
`preparation.json` records the preparation verdict, selected device/Operator,
expected API, original and launched activity stacks (including foreground package
when available), deadline, observation count and elapsed time. Each numbered
command retains its arguments, stdout/stderr, exit status and stage/timeout
context. Source commit, the repository-wide tracked diff against HEAD (including
staged and unstaged changes and binary patches), a NUL-delimited inventory of
non-ignored untracked files, CLI version and installed-package metadata are also
captured. Untracked file contents and ignored build outputs are not archived;
commit source files before collecting release evidence. `failure.json` distinguishes prerequisites, preparation,
Internet navigation, capture/parity and Display control failures. The original
failure remains in `failure.txt`; `failure-screenshot.json` and `cleanup.json`
record secondary attempts without replacing it. Use a new output directory for
each attempt and retain failed runs alongside later runs. CI uploads evidence from its disposable emulator.

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


## R12 local evidence and remaining gates

The 13 September 2026 R12 checks used the source at `e1aadca2` plus this harness
change, matching debug `0.10.0-d` and release `0.10.0` APKs, and the user-assigned
English API 36 arm64 emulator (`BE2A.250530.026.D1`, build `13818094`). API 36 was
explicitly accepted for this investigation; the API 35 manual release gate was
not changed. Node build, both APK builds, 13 offline assertion/preparation tests,
the complete `validation` suite and shell syntax checks passed.

Debug preparation passed from fresh processes, a verified Settings `SubSettings`
page, and the verified Settings Intelligence `SearchActivity`. All three passed
on the first observation in 1.43, 1.81 and 2.28 seconds respectively. The homepage
container, content container, search bar, Google row and Network & internet row
had identical bounds and state across those runs. All three full harness runs
then failed `Root sensitivity must be true`: this API 36 Internet root reported
false. Later raw/MCP/XML, PNG and Display assertions were therefore not reached;
they were not weakened or skipped to manufacture a pass.

The separately installed release variant passed doctor but returned correlated
`COMMAND_TIMEOUT` failures from Settings `open_app`: once during fresh-state
preparation, then during each of the subpage/search fixture setups. The failure
screenshot showed Settings, but this does not override the failed launch
contract. No release preparation or full-harness pass is claimed. This runtime
launch-wait limitation needs investigation before repeating release proof; it
must not be relabeled as a transport failure without supporting evidence. A
subsequent read-only release query returned `UI_TREE_UNAVAILABLE`, with
`serviceAvailable: true`, `rootAvailable: false`, `windowCount: 0` and no foreground
package. Android listed the selected release service in both bound and crashed
services. The final Home cleanup returned `GLOBAL_ACTION_FAILED`; a successful
Home state is not claimed. These observations do not establish the crash cause.

Private evidence retains all development attempts: the first debug attempt had
an unbound, still-stopped Operator and a result timeout; the next rejected the
API 36 fixed header using the initial API 35 predicate; the next encountered
`RESULT_ENVELOPE_TIMEOUT` on its first preparation query. During the first state
matrix, a concurrent local CLI rebuild invalidated debug subpage/search and
release setup with `MODULE_NOT_FOUND`. Only those host-invalidated cases were
repeated after the build completed, in separate output directories. These failed
attempts remain evidence and do not become passes because later debug runs pass.

Remaining release proof requires the supported API 35 image, both matching
variants, resolution of the recorded runtime failures, and the complete harness
including R11/R13 integration. The API 36 fixed header and visible Display row
do not reproduce the API 35 collapsing-container scenario. Keep the workflow
manual and preserve the sensitive-root assertion.
