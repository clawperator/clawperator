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
| 1 - Android Controller and Mechanism Proof | passed | `fdb2b12` |
| 2 - Raw Execution Contract and Public Documentation | passed | `3efc652` |

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
| `npm --prefix apps/node run build` | 0 | The branch-local Node package compiles with the two raw actions and strict validator. | npm output |
| `npm --prefix apps/node run test` | 0 | All 272 Node tests passed, including raw validation, Serve, MCP, strict canonical action handling, and failed-envelope coverage. | npm output |
| `./gradlew app:assembleDebug app:testDebugUnitTest app:installDebug` | 0 | The debug app rebuilt, app unit tests passed, and the debug APK installed on the available emulator targets. | Gradle output |
| `./gradlew shared:data:operator:testDebugUnitTest shared:test:testDebugUnitTest` | 0 | Android parser, action-engine result mapping, controller, and window-metadata suites remain green. | Gradle output |
| `bash validation/on-screen-logs/test_phase2_contract.sh` | 0 | Both generic raw fixtures validate through the branch-local CLI and normalize colors; the generic `value` alias is rejected. | validation script output |
| `./scripts/docs_build.sh` | 0 | Authored API pages, navigation, generated docs, and machine-facing documentation build successfully. | docs build output |
| `node apps/node/dist/cli/index.js doctor --device <device_serial> --operator-package com.clawperator.operator.dev --output json` | 0 | The selected debug Operator was compatible, accessible, interactive, and ready for raw execution. | terminal observation |
| `node apps/node/dist/cli/index.js exec <raw-set-screenshot-clear.json> --device <device_serial> --operator-package com.clawperator.operator.dev --no-daemon --output json` | 0 | The default raw set, screenshot, and clear actions returned their exact normal result shapes. | ignored local Phase 2 screenshots and terminal output |
| Separate raw set, screenshot, replacement, screenshot, clear, and expiry executions with explicit `<device_serial>` | 0 except expected hidden-label lookup | Visible capture, replacement, raw snapshot metadata, clear, expiry, and selector isolation were observed on the debug Operator. | ignored local Phase 2 screenshots and terminal output |
| `./gradlew shared:data:operator:testDebugUnitTest` | 0 | The review regression tests cover a configuration change while a replacement draw is pending and legacy left-navigation/cutout bounds. | Gradle output |
| `./gradlew app:assembleDebug app:testDebugUnitTest shared:test:testDebugUnitTest` | 0 | The review-fixed debug app and shared Android suites build and pass. | Gradle output |
| `./scripts/docs_build.sh` | 0 | The updated cutout behavior and regenerated machine-facing documentation build successfully. | docs build output |
| `./gradlew app:installDebug` followed by `node apps/node/dist/cli/index.js doctor --device <device_serial> --operator-package com.clawperator.operator.dev --output json` | 0 | The review-fixed debug APK installed and the selected API 35 target remained compatible, accessible, and interactive. | terminal observation |
| `./gradlew shared:data:operator:testDebugUnitTest` | 0 | The second review regression covers both the replacement and deferred configuration-reflow draw acknowledgements. | Gradle output |
| `npm --prefix apps/node run build && npm --prefix apps/node run test` | 0 | All 272 Node tests passed, including the Node-side Unicode whitespace regression. | npm output |
| `./gradlew app:assembleDebug app:testDebugUnitTest shared:test:testDebugUnitTest` | 0 | The full debug app builds and the app plus shared Android suites pass with the second review fix. | Gradle output |
| `bash validation/on-screen-logs/test_phase2_contract.sh` | 0 | The generic raw fixtures retain their strict validation and color-normalization contract. | validation script output |
| `./scripts/docs_build.sh` | 0 | The authored and generated documentation site remains buildable after the review fix. | docs build output |
| `./gradlew app:installDebug` followed by branch-local `doctor` on `<device_serial>` with `com.clawperator.operator.dev` | 0 | The latest debug APK installed, and the selected API 35 emulator remained compatible, accessible, and interactive. | terminal observation |
| `npm --prefix apps/node run build && npm --prefix apps/node run test` | 0 | All 273 Node tests passed, including the MCP regression for null, array, and scalar raw action params. | npm output |
| `./gradlew shared:data:operator:testDebugUnitTest app:assembleDebug app:testDebugUnitTest shared:test:testDebugUnitTest` | 0 | The final review batch leaves the full debug app and relevant Android controller suites green. | Gradle output |
| `bash validation/on-screen-logs/test_phase2_contract.sh` | 0 | The generic raw fixtures still validate through the branch-local CLI after the final transport-boundary fix. | validation script output |
| `./scripts/docs_build.sh` | 0 | The final authored and generated documentation site builds and validates successfully. | docs build output |

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
- Phase 2 raw set with only `text` returned the required defaults and acknowledgement: `visible=true`, `rendered=true`, `truncated=false`, left/left alignment, `8` dp offsets, `280` dp width, `12` sp text, normalized defaults, `300000` ms TTL, and observed bounds `[21,157][756,236]` on the selected API 35 target.
- A raw snapshot while the baseline panel was visible returned `operator_overlay_visible=true` while preserving the raw metadata values `has_overlay=false` and `window_count=2`. A normal raw `read_text` lookup for the displayed label returned no UI node, so the panel text did not enter the app hierarchy.
- The raw custom replacement returned normalized colors `#FFA1B2C3` and `#7F0A0B0C`, right/right alignment, and bounds `[198,199][1038,290]`. The separate full-display screenshot visibly contained only the replacement label on the physical right, with its custom text and background colors.
- A raw clear returned exactly `visible=false` without `rendered`. A separate raw panel with `ttlMs=1000` returned rendered successfully; after two seconds, a raw snapshot reported `operator_overlay_visible=false`, proving local generation-scoped expiry without host-driven updates.
- The required single raw payload ordering set -> screenshot -> clear returned a successful screenshot path but its resulting image had no panel. Source inspection and this live result agree: the existing Node screenshot capture finalizes after the Android action list returns, so clear has already run. Separate raw executions set -> screenshot -> clear captured both the baseline and replacement labels correctly. This timing limitation is documented rather than hidden.

## Decisions and Deviations

- The concrete controller and custom view are in `apps/android/shared/data/operator/`, which owns the accessibility-service window. The logical configuration, geometry, and controller seam are in `apps/android/shared/data/task/`; exact owned-window identity is in `apps/android/shared/data/uitree/`; bindings are in `apps/android/shared/app/di/`; the raw-window unit test is in `apps/android/shared/test/`. These are the exact additional PR-1 paths required by the existing dependency direction.
- The proof access is a debug-source-set Activity at `apps/android/shared/data/operator/src/debug/`. It accepts only four fixed scenario names and fixed panel content, is absent from release builds, and does not expose a receiver, a raw action, a hidden release command, or a caller-controlled production ingress.
- The implementation uses `TYPE_ACCESSIBILITY_OVERLAY`, a custom non-accessible View, `FLAG_NOT_TOUCHABLE`, `FLAG_NOT_FOCUSABLE`, and no `FLAG_SECURE`. It has no ticking timer, host-driven elapsed update, application-overlay fallback, or persistent state.
- API 21 fails closed with `ON_SCREEN_LOG_RENDER_FAILED` before attempting to attach. `TYPE_ACCESSIBILITY_OVERLAY` is introduced on API 22, so raising the project minimum SDK or using a different overlay mechanism would not meet the specified contract.
- Phase 1 deliberately does not publish `operator_overlay_visible` in snapshot data. It wires exact identity without altering raw metadata. The string-valued public output belongs to Phase 2 with the normal raw execution contract.
- Phase 2 adds strict canonical-only action handling in `apps/node/src/contracts/aliases.ts` and `apps/node/src/contracts/inputAliases.ts`, strict Node validation and structured error promotion in `apps/node/src/domain/executions/validateExecution.ts` and `apps/node/src/domain/executions/runExecution.ts`, plus Android parser/action-engine integration. These exact additional PR-1 paths are included in the review scope because they preserve the same contract across raw CLI, Serve, and MCP transport.
- PR-1 review added `apps/node/src/mcp/tools/core.ts` to the raw-transport scope. MCP now preserves raw action-type text until the canonical validator runs, so whitespace around either on-screen-log action is rejected instead of normalized. The review fix also preserves pre-existing unrelated envelope error codes.
- Configuration changes now defer while a replacement generation waits for its draw acknowledgement, then recompute the acknowledged replacement rather than reapplying stale state. Legacy API 29 bounds combine public `Display.getCutout()` safe insets with system bars and account for reverse-landscape left navigation. API 28 with a declared built-in cutout fails closed because a service has no public pre-attachment safe-inset query.
- The second PR-1 review requires every configuration reflow deferred by a pending `set_on_screen_log` to receive its own draw acknowledgement within the original request deadline. The returned rendered bounds therefore always belong to an acknowledged generation. Node and Android now also use the same explicit whitespace set for required text, including U+FEFF.
- Numeric on-screen-log fields use JSON numeric semantics on both sides of the Android boundary: finite values with no fractional component are accepted, including JSON forms such as `1.0` and `1e3`; numeric strings, nulls, and fractional values are rejected. The public documentation also states that API 21 fails closed before a window is attached, while API 22 or later is required for placement.
- The generic MCP `execute` schema preserves raw action parameters through transport. Nulls, arrays, and scalars now reach the canonical execution validator and return `EXECUTION_VALIDATION_FAILED`, rather than becoming transport-specific `InvalidParams` errors. The caller-controlled screenshot-path safeguard remains record-gated.
- The existing screenshot execution pipeline was not redesigned. Its same-payload ordering limitation is a documented follow-up boundary, not a reason to add a parallel transport, host-owned renderer, or temporary ingress in PR-1.

## Remaining Limitations

- Live interaction and capture proof ran only on the selected API 35 emulator. API 21 has a unit-tested fail-closed path; API 22 through API 34 were not live-tested.
- The API 21-22 view path uses an invisible left-to-right mark per paragraph to preserve physical alignment. The API 22 behavior is covered by a Robolectric test but not a device capture.
- Android 9 (API 28) devices that declare a built-in display cutout reject panel placement with `ON_SCREEN_LOG_LAYOUT_INVALID` rather than place a panel using unverified safe-area geometry. API 29 compatibility behavior has unit coverage but no live device proof.
- The mechanism is proven for the tested screenshot and recording sequence, not as a general compositor-synchronization guarantee.
- The Phase 2 live proof used the branch-local raw CLI and one API 35 emulator. Serve and MCP transport coverage uses local test doubles through the same Node executor, not a real remote client/device run.
- A single raw execution that orders `set_on_screen_log`, `take_screenshot`, and `clear_on_screen_log` cannot currently guarantee that the output file contains the label because host screenshot capture finalizes after Android completes the list. PR-1 documents and proves the separate-execution workaround. Any interleaved capture redesign requires a separate design decision and is out of scope for PR-1.
- PR-2 remains blocked until PR-1 merges and the user explicitly requests continuation. No CLI convenience command was started.
