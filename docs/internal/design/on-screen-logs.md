# On-screen log implementation and verification

The public contract is [On-screen logs](../../api/on-screen-logs.md).
The panel is static caller-supplied text; labels do not verify device metadata.
Timers, streaming, inferred metadata, and capture interleaving are outside the
implemented contract.

## Ownership and invariants

- `OnScreenLogPanelController` in the Android operator module owns the window,
  generation, draw acknowledgement, and expiry on the main thread. Invalid
  replacement preserves existing state. A configuration change deferred during
  a set must draw within the original deadline; reflow preserves absolute expiry.
  Controller comments and tests own these invariants.
- The custom-drawn view has no accessible text descendants. Exact controller
  identity distinguishes this panel from unrelated overlays. App selectors and
  foreground selection must not fall back to the panel.
- The Node CLI builds canonical actions and uses `runActionExecution`; the
  canonical validator owns limits and normalization. Mutation proxy tests cover
  safe pre-dispatch fallback and no replay after uncertain dispatch.
- The fixed-scenario proof Activity is debug-only and absent from release
  builds. It is not production ingress or proof of CLI behavior.

## Repeatable proof

Build the branch-local Node CLI and matching debug APK before running proof.
Do not rebuild or run the docs pipeline concurrently with live CLI proof:
`docs_build.sh` runs `npm ci` and replaces dependencies and compiled output.
Use an explicitly selected dedicated debug device.

```bash
bash validation/on-screen-logs/test_overlay_mechanism_proof.sh
bash validation/on-screen-logs/test_raw_execution_contract.sh
bash validation/on-screen-logs/test_cli_contract_proof.sh
bash validation/on-screen-logs/run_cli_contract_proof.sh --device <device_serial> --output-dir <absolute_output_dir>
```

The CLI harness records each command, result, status, expected image label,
and saved/restored device settings. Offline tests cover failures with settings
already changed, service deletion, interruption, and service restoration before
cleanup clear. Empty accessibility-service lists require deleting the setting;
adb can drop an empty value passed to `settings put`.

Review every capture independently and supplement the harness with playable
replacement/clear video, app bounds/foreground comparisons, read/wait/click
exclusion for panel-only labels, touch-through interaction, and another real
overlay. A successful draw or screenshot command does not prove capture pixels.
Use separate awaited set, screenshot, replacement, screenshot, and clear calls.
MCP must omit screenshot paths and use its returned runtime-managed path.

Use branch-local snapshots for app inspection. Standalone `uiautomator dump`
was observed to disrupt the active accessibility-service environment during
proof. For app navigation, await the expected foreground before comparing
bounds; an immediate post-back snapshot can still describe the outgoing app.

## Coverage and follow-up

The implementation proof at `33d69ed` passed the Node package selection (280
tests), focused public-interface selection (210 tests), relevant Android build
and unit suites, harness tests, and docs build. API 35 emulator proof inspected
30 full-display PNGs, including all 20 images from ten capture cycles without
missing/stale labels, and a playable H.264 replacement/clear video. Settings
were restored and the final panel was hidden. Original local evidence remains
ignored under `validation/on-screen-logs/artifacts/pr2/`; it is not a required
build input or a publicly hosted artifact.

API 35 is the only live-tested platform in that evidence. API 21 fails closed;
API 22+ supports placement except API 28 devices declaring a built-in cutout.
Older compatibility paths retain unit coverage. Before expanding live support
claims, run the public CLI proof on the additional OS/device, inspect all
captures, and record its result and limitations here. Physical-device and
secure-window capture remain unverified. Serve/MCP transport proof uses local
executor tests, not a live remote client.

The host screenshot pipeline captures pixels after the Android action list
returns. If atomic action/capture interleaving is later required, design it
separately against `apps/node/src/domain/executions/runExecution.ts` and add
cross-transport capture tests before changing the documented guarantee. The
separate-execution sequence is the supported workflow today; this is not an
unfinished requirement of the static panel feature.
