# On-Screen Logs Findings

## Environment

- Source revision at Phase 1 start: `5d23af58e6b383e9ed56e65e757db61bffb386e0` on branch `on-screen-prompt`.
- Node validation will use the branch-local build under `apps/node/`; no global CLI is used.
- Debug Operator: `com.clawperator.operator.dev`, rebuilt from this branch and installed for the proof.
- Selected target: disposable Android emulator, API 35, 1080x2400 px, 420 dpi, initial font scale `1.0`.
- Capture methods: `adb exec-out screencap -p` and finalized `adb shell screenrecord`, both with an explicit `<device_serial>`. The retained artifacts are ignored local validation output.

## Phase Status

| Phase | Status | Commit |
| --- | --- | --- |
| 1 - Android Controller and Mechanism Proof | passed | recorded by the pending Phase 1 commit |
| 2 - Raw Execution Contract and Public Documentation | pending | - |

## Validation

| Command | Exit status | What it proves | Evidence path |
| --- | --- | --- | --- |
| `./gradlew app:assembleDebug app:testDebugUnitTest` | 0 | The complete debug app builds and its app unit tests pass. | Gradle output |
| `./gradlew shared:data:operator:testDebugUnitTest shared:test:testDebugUnitTest` | 0 | Controller, lifecycle, panel-view, geometry, and raw-window-metadata tests pass with the surrounding Android suites. | Gradle output |
| `./validation/on-screen-logs/test_phase1_proof.sh` | 0 | The opt-in proof harness parses and contains no raw-action ingress. | validation script output |
| `./scripts/clawperator_grant_android_permissions.sh --debug --serial <device_serial>` | 0 | The selected debug Operator accessibility service was enabled. | terminal observation |
| `./gradlew :app:processReleaseMainManifest` followed by a release-manifest search | 0 | The debug-only proof Activity is absent from the release manifest. | Gradle output |
| `./validation/on-screen-logs/run_phase1_proof.sh --device <device_serial> --output-dir <absolute_output_dir>` | 0 | Reproducible screenshot, active-window, accessibility-state, and screen-recording proof completed and cleared the panel. | ignored local Phase 1 output |
| `ffprobe -v error -show_entries format=duration,size .../on-screen-log-phase1.mp4` | 0 | The pulled recording finalized and was playable: 4.952756 seconds, 1,641,686 bytes. Extracted frames were visually inspected. | ignored local Phase 1 output |
| `node apps/node/dist/cli/index.js snapshot --device <device_serial> --operator-package com.clawperator.operator.dev --output json` | 0 | The branch-local snapshot retained the foreground app hierarchy while the panel was shown. | ignored local interaction output |
| `node apps/node/dist/cli/index.js exec <read-hidden-label.json> --device <device_serial> --operator-package com.clawperator.operator.dev --output json` | 1, expected | A normal `read_text` action could not match the panel-only label. | terminal envelope: `No UI node found matching criteria` |

## Live Observations

- The post-install baseline showed the Settings app at its normal full 1080x2400 bounds. With the panel visible, the Settings window remained full-display and foreground selection remained the Settings package.
- Portrait geometry was physical and inset once: left scenario bounds were `[32,199][767,278]`; right scenario bounds were `[313,199][1048,278]`. The observed 32 px edge inset is the requested 12 dp at 420 dpi, and the 199 px top is the system-bar-inset usable top plus the requested 24 dp offset.
- Window state identified the panel as `TYPE_ACCESSIBILITY_OVERLAY`, `TRANSLUCENT`, `NOT_FOCUSABLE`, and `NOT_TOUCHABLE`. The panel entry had no `FLAG_SECURE` flag. It was one window with a generated controller-unique `clawperator.on_screen_log...` title.
- The playable recording visibly contains the left dark panel, a real Settings scroll, and the replacement right panel with its distinct pale background and dark text. The final harness clears the panel and confirms no crashed accessibility service before or after.
- A fixed debug scenario placed the panel over the Settings search control. A physical tap at `[450,615]`, inside the panel bounds, opened Settings search and focused the real editable field. The subsequent screenshot showed the keyboard while the panel remained at the same top coordinate. A normal `read_text` request for `PHASE-1 INPUT: Touch passes through` failed, confirming the custom-drawn label was absent from application text matching.
- With the panel still shown, navigation to Network & internet and a real scroll both succeeded. Screenshots show the panel unchanged while Settings content moved.
- At font scale `1.3` in landscape, the panel remained physical-right at `(1633,137)` with size `735x90` on the `2400x1080` logical display. Returning to portrait re-evaluated the same logical right panel at `(313,199)` with size `735x90` and a new generation title. The emulator was restored to font scale `1.0`, portrait rotation, and its initial rotation-policy setting after the proof.
- The draw acknowledgement was sufficient to order the immediate observed screenshots on this API 35 target. This is evidence for the tested sequence only. It remains a draw callback, not a compositor or capture-frame guarantee.
- Android's standalone `uiautomator dump` temporarily replaced the active accessibility-service environment and destroyed the debug service during exploratory testing. The repeatable harness deliberately uses the branch-local `snapshot` path, `dumpsys`, screenshots, and screen recording instead. No claim depends on that disruptive tool.
- When only the panel was visible, this target's service window list omitted the panel and preserved raw snapshot metadata as `has_overlay=false`, `window_count=2`. When the keyboard was present, it correctly reported the unrelated input-method overlay. This is why Phase 2 must add a separately identified controller-owned visibility field without changing existing raw metadata semantics.

## Decisions and Deviations

- The concrete controller and custom view are in `apps/android/shared/data/operator/`, which owns the accessibility-service window. The logical configuration, geometry, and controller seam are in `apps/android/shared/data/task/`; exact owned-window identity is in `apps/android/shared/data/uitree/`; bindings are in `apps/android/shared/app/di/`; the raw-window unit test is in `apps/android/shared/test/`. These are the exact additional PR-1 paths required by the existing dependency direction.
- The proof access is a debug-source-set Activity at `apps/android/shared/data/operator/src/debug/`. It accepts only four fixed scenario names and fixed panel content, is absent from release builds, and does not expose a receiver, a raw action, a hidden release command, or a caller-controlled production ingress.
- The implementation uses `TYPE_ACCESSIBILITY_OVERLAY`, a custom non-accessible View, `FLAG_NOT_TOUCHABLE`, `FLAG_NOT_FOCUSABLE`, and no `FLAG_SECURE`. It has no ticking timer, host-driven elapsed update, application-overlay fallback, or persistent state.
- API 21 fails closed with `ON_SCREEN_LOG_RENDER_FAILED` before attempting to attach. `TYPE_ACCESSIBILITY_OVERLAY` is introduced on API 22, so raising the project minimum SDK or using a different overlay mechanism would not meet the specified contract.
- Phase 1 deliberately does not publish `operator_overlay_visible` in snapshot data. It wires exact identity without altering raw metadata. The string-valued public output belongs to Phase 2 with the normal raw execution contract.

## Remaining Limitations

- Live interaction and capture proof ran only on the selected API 35 emulator. API 21 has a unit-tested fail-closed path; API 22 through API 34 were not live-tested.
- The API 21-22 view path uses an invisible left-to-right mark per paragraph to preserve physical alignment. The API 22 behavior is covered by a Robolectric test but not a device capture.
- The mechanism is proven for the tested screenshot and recording sequence, not as a general compositor-synchronization guarantee.
- Phase 2 will add raw actions, Android action dispatch, public result data, transport tests, and documentation. It must preserve this Phase 1 behavior and must not add the PR-2 CLI convenience command.
