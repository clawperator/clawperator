# On-Screen Logs

## Executive Summary

Add an optional, noninteractive diagnostic panel to the Android Operator, controlled through the existing execution API. Callers supply static text, placement, and colors. This is a generic Clawperator feature owned by Action Launcher.

Two PRs, four sequential phases. PR-1 proves and ships the Android renderer plus raw execution actions; PR-2 adds CLI convenience and completes validation/documentation. PR-1 merged in `120c1eb782bbed67e1cb1fbe7c2080fdb302ff5d` (PR #266). PR-2 is explicitly requested and ready to start; no PR-2 implementation has begun. The renderer and raw API below are shipped source contracts; the CLI convenience surface remains proposed PR-2 work.

## Status

| Item | Value |
| --- | --- |
| State | PR-1 merged; PR-2 ready |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | Phases 1-2 |
| Remaining | 3-4 |
| Current / Next | Phase 3: CLI convenience |
| Blockers | None; prerequisite merge and continuation are satisfied |

## Goal

Allow an agent or script to display a workflow label and context on the device so a person watching the run, a screenshot, and a full-display video have the same useful context. The panel must not consume touches, change app layout, steal focus, or satisfy application selectors with its own text.

## Why Now

Device automation produces useful visual evidence, but images and recordings lack context unless the caller prepares it separately. A small Operator-owned panel makes that context visible while the automation runs. Command latency makes host-driven ticking clocks inappropriate for this first version.

## In Scope

- One panel per Operator service instance on the default display.
- Static multiline caller-supplied text; complete replacement on every set.
- Physical left/right horizontal anchoring, top offset, edge offset, width, independent text alignment, font size, text color, background scrim color.
- Accessibility-service overlay, lifecycle cleanup, bounded expiry, and render acknowledgement.
- Raw execution actions, existing serve/MCP execute routes, and a CLI convenience command.
- Correct treatment of the Operator's own panel in window metadata and app inspection.
- Unit tests, live screenshot/video proof, and public documentation in the same PR as each exposed capability.

## Out of Scope

- Live clock, elapsed timer, countdown, timing measurements, host clock synchronization, or periodic host updates.
- Automatic metadata collection, emulator detection, or app-specific fields. Callers may include a date, OS/API version, device description, workflow ID, and behavior label in plain text. These remain caller labels, not Operator-verified facts.
- Log streaming, append/history buffers, multiple panels, dragging, buttons, rich text, images, font families, automatic repositioning, or bottom/center anchors.
- A new video-capture API, evidence report generator, FFmpeg integration, or changes to application behavior.
- Automatic SYSTEM_ALERT_WINDOW grants or a silent switch to application overlays.
- General fixes to selector ambiguity, system-dialog accessibility, or other unrelated work.

## Existing Artifact Scope

PR-1 already added the renderer, raw actions, aliases, snapshot visibility field, docs page, and proof fixtures. PR-2 extends that implementation with CLI convenience and final proof. Preserve existing command names, host `logs` behavior, screenshot contracts, and raw window metadata meaning. Modify only the integration seams required for the panel; do not refactor unrelated action infrastructure.

## Surfaces and Ownership

| Surface | Responsibility |
| --- | --- |
| Android Operator/service | Own the window, state, expiry, UI-thread updates, render acknowledgement, and cleanup |
| Android action parser/engine | Parse validated actions and return normal step results |
| Node contracts/validator | Define and reject invalid action input before dispatch |
| Node CLI | Map convenience flags into those actions; no independent renderer or state |
| Existing serve/MCP execute | Carry the same action contract; no new dedicated endpoints/tools |
| Public docs | Explain fields, units, limits, result semantics, and capture limitations |
| Caller | Supply labels, choose placement, update/clear at workflow boundaries |

## Source Of Truth

Paths are relative to the repository root. Verify current source before editing.

| Topic | Authority |
| --- | --- |
| Execution fields and validation | `apps/node/src/contracts/execution.ts`, `apps/node/src/domain/executions/validateExecution.ts`, `apps/node/src/contracts/aliases.ts` |
| Error/result shape | `apps/node/src/contracts/errors.ts`, `apps/node/src/contracts/result.ts` |
| Landed renderer | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/onscreenlog/OnScreenLogPanelController.kt`, `OnScreenLogPanelView.kt` in the same directory |
| Shared panel contract | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/OnScreenLog.kt` |
| Exact owned-window identity | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/OperatorOverlayIdentity.kt` |
| Node alias normalization | `apps/node/src/contracts/inputAliases.ts` |
| CLI and daemon | `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/action.ts`, `apps/node/src/cli/daemonProxy.ts` |
| Capture and dispatch | `apps/node/src/domain/executions/runExecution.ts` |
| Existing transport routes | `apps/node/src/cli/commands/serve.ts`, `apps/node/src/mcp/tools/core.ts` |
| Android parser | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt` |
| Android actions | `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiAction.kt`, `UiActionEngine.kt` in the same directory |
| Service lifecycle | `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt` |
| Window inspection | `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt` |
| Dependency injection | `apps/android/shared/app/di/src/main/kotlin/clawperator/di/module/AppModule.kt` |
| Docs ownership | `.agents/skills/docs-author/SKILL.md`, `.agents/skills/docs-build/SKILL.md`, `sites/docs/source-map.yaml`, `sites/docs/mkdocs.yml` |

Relevant existing tests include `apps/node/src/test/unit/validateExecution.test.ts`, `cliRegistry.test.ts`, `cliHelp.test.ts`, `cliExitCode.test.ts`, `daemon/actionProxy.test.ts`; Android `OperatorAccessibilityServiceTest.kt`, `UiActionEngineDefaultTest.kt`, and `UiTreeInspectorAndroidTest.kt`. Locate them before edits. Add tests for all new controller/geometry logic in the same phase as that logic.

Platform references: [overlay type](https://developer.android.com/reference/android/view/WindowManager.LayoutParams#TYPE_ACCESSIBILITY_OVERLAY), [touch-through rules](https://developer.android.com/about/versions/12/behavior-changes-all#untrusted-touch-events), [accessibility service](https://developer.android.com/reference/android/accessibilityservice/AccessibilityService). PR-1 proved the mechanism on one API 35 emulator. Older versions and other devices are not covered by that live proof; PR-2 must record its own matrix without implying broader coverage.

## Deterministic Versus Judgment

Apply the field defaults, validation rules, state table, and PR boundaries below verbatim. Do not design an elapsed clock or infer metadata from text. Implementation choices about Kotlin class placement and test doubles are allowed within existing module dependencies. If live proof contradicts the overlay mechanism or prevents isolation from app selectors, record the evidence and stop before broadening the design.

## Decision Rules

### Renderer

Use `TYPE_ACCESSIBILITY_OVERLAY` from the connected service with `FLAG_NOT_TOUCHABLE` and `FLAG_NOT_FOCUSABLE`. Use one small custom-drawn View with no accessible text descendants, marked not important for accessibility. Draw plain text yourself so application matchers cannot find the panel's labels. Do not create a production Activity or request SYSTEM_ALERT_WINDOW. PR-1 includes a debug-only fixed-scenario proof Activity in `apps/android/shared/data/operator/src/debug/`; it is absent from release builds and must not become production ingress. Do not set FLAG_SECURE on the panel.

All window mutations occur on the Android main thread. Keep state in the service lifetime, not a command object. Service disconnection/destruction removes the window and cancels pending callbacks. Process restart starts hidden; do not persist panel state.

### Raw API

The merged canonical actions are `set_on_screen_log` and `clear_on_screen_log`. These use the normal execution envelope, action IDs, and explicit target selection. At the Node input boundary, accept the exact lower-case aliases `on_screen_log_set` and `on_screen_log_clear`, then normalize them to their canonical types before validation and dispatch. Reject case and whitespace variants. `clear_on_screen_log` accepts omitted params or `{}` only. `set_on_screen_log` accepts only these fields:

| Field | Type / accepted range | Default / meaning |
| --- | --- | --- |
| `text` | string; 1-2048 UTF-16 code units; at least one non-whitespace character | required; preserve whitespace/newlines; reject control characters except LF and TAB |
| `anchor` | `left` or `right` | `left`; physical edge, independent of locale |
| `textAlign` | `left` or `right` | `left`; alignment inside panel |
| `topOffsetDp` | integer 0-1000 | 8; from usable top edge |
| `edgeOffsetDp` | integer 0-1000 | 8; inward from selected usable horizontal edge |
| `widthDp` | integer 80-600 | 280; complete panel width, including padding |
| `fontSizeSp` | integer 8-24 | 12; follows system font scale |
| `textColor` | exactly `#RRGGBB` or `#AARRGGBB` | `#FFFFFFFF`; alpha first in 8-digit form |
| `backgroundColor` | same color grammar | `#B3000000`; background scrim |
| `ttlMs` | integer 1000-3600000 | 300000; local stale-label expiry, not a visible timer |

Normalize 6-digit colors to opaque 8-digit uppercase form. Numeric fields use JSON numeric semantics: accept finite numbers with no fractional component, including `1.0` and `1e3` when within the field range. Reject fractional numbers, numeric strings, null, unknown keys, NaN/infinity, and named colors. Validate on Node and Android; malformed direct ingress must not mutate current state. Do not loosen other action schemas when adding these fields. Text is plain text, never markup or interpolation.

### Placement and overflow

The usable rectangle is the current default-display window bounds inset by system bars and display cutouts, ignoring temporary bar visibility. Keep the coordinate basis unchanged when the keyboard appears; the panel may overlap the keyboard area and does not move automatically. Use the supported compatibility path for the existing minimum Android version; do not increase minSdk. The shipped controller fails closed on API 21 with `ON_SCREEN_LOG_RENDER_FAILED`; accessibility-overlay placement requires API 22+. On API 28 with a declared built-in display cutout, fail with `ON_SCREEN_LOG_LAYOUT_INVALID` because pre-attachment safe insets are unavailable. API 29 uses public display cutout safe insets. Preserve these tested compatibility paths in PR-2.

Convert dp/sp only on Android. Panel x is usable-left + edge offset for left anchor, or usable-right - edge offset - width for right anchor. Panel y is usable-top + top offset. Insets must be applied exactly once; prove this live. Fixed internal padding: 8dp on each edge. Soft-wrap text within the padded width. Height is content height, limited to remaining usable height.

Reject geometry that leaves less than one complete text line plus padding or places the requested width beyond the usable horizontal bounds, with `ON_SCREEN_LOG_LAYOUT_INVALID`. Do not silently reposition or scale text. When text exceeds available height, ellipsize the final visible line and return `truncated=true`; do not imply all supplied text is visible.

On rotation/display-configuration change, re-evaluate the same logical geometry. If it no longer fits, hide and discard the panel rather than obscure arbitrary content; emit a diagnostic event. The caller must set it again. Do not add a general responsive-layout engine.

### State, timing, and acknowledgement

| Event | Required behavior |
| --- | --- |
| Set while hidden | Validate, attach, draw, acknowledge the new content |
| Set while visible | Atomically replace all text/style with supplied values plus defaults; no patch semantics |
| Invalid set | Leave existing panel and expiry unchanged |
| Successful repeated set | Same content/geometry; renew expiry; no duplicate window |
| Clear while visible | Remove panel, cancel expiry, acknowledge hidden |
| Clear while hidden | Success with hidden; no-op |
| Expiry | Remove only the generation that scheduled it; never clear a newer panel |
| Service loss | Remove/cancel; reconnect starts hidden |
| Failed/aborted render | Remove pending panel and cancel callbacks; no late appearance after reported failure |

Use Android's monotonic clock for expiry, starting at the acknowledged draw of the new generation. No clock updates, timestamp formatting, or elapsed-time UI. This cleanup timer is independent of the execution timeout. Use a generation token so an old expiry/draw callback cannot affect newer content.

Set succeeds only after the requested generation completes a draw callback, bounded by the execution deadline and at most 2000ms after dispatch to the UI thread. This is a draw acknowledgement, not proof that a compositor frame or screenshot contains the content. Return `rendered=true` only under that precise meaning. Do not acknowledge merely because `addView` returned. Do not add host sleeps as a substitute for acknowledgement. PR-1 verified separate-execution captures on API 35. The host captures screenshot pixels after the Android action list returns: never combine set, screenshot, and clear in one payload when visible-label evidence is required. Use separate set -> screenshot -> replace -> screenshot -> clear executions, each awaited. The existing combined fixtures prove schema/ordering limitations, not visible-label capture. MCP must omit screenshot params.path and use the returned runtime-managed path; raw CLI and Serve may choose paths. Screenshot pipeline redesign is outside both PRs.

### Window metadata and inspection

Keep `has_overlay`, `overlay_package`, and `window_count` semantics intact. Add string-valued `operator_overlay_visible` to snapshot step data so callers can distinguish known instrumentation. Do not suppress other windows or treat all Operator windows as harmless. Matchers and active-app selection must not fall back to the panel. Identify the exact owned panel by controller/window identity, not all accessibility overlays. Verify that same-text labels cannot satisfy read/wait/click actions against the app.

## Failure Modes To Prevent

- Treating a successful dispatch as proof of draw or capture.
- Stealing focus, intercepting touches, changing app bounds, or contaminating application selectors.
- Accidentally applying both WindowManager insets and manual insets.
- Stale text/expiry callbacks modifying a newer panel.
- A failed set leaving a late-attached panel after its command has finished.
- Introducing ticking updates to compensate for command latency.
- Treating caller text as verified device metadata.
- Shipping screenshot/video claims backed only by unit tests.
- Updating host `logs`, adding private app integrations, or mixing unrelated fixes into this feature.

## Output Contract

All new keys in `StepResult.data` remain strings, matching the existing contract.

Successful set includes `visible="true"`, `rendered="true"`, `truncated="true"|"false"`, `anchor`, `text_align`, `top_offset_dp`, `edge_offset_dp`, `width_dp`, `font_size_sp`, normalized `text_color`, normalized `background_color`, `ttl_ms`, and physical `bounds="[left,top][right,bottom]"`. Do not echo text into additional result fields. Successful clear includes `visible="false"`. Clear has no rendered flag.

Known failures use structured codes: `ON_SCREEN_LOG_SERVICE_UNAVAILABLE`, `ON_SCREEN_LOG_LAYOUT_INVALID`, `ON_SCREEN_LOG_RENDER_FAILED`, and `ON_SCREEN_LOG_RENDER_TIMEOUT`. Node schema failures retain `EXECUTION_VALIDATION_FAILED`. Preserve existing shared readiness failures when dispatch is blocked before the action. Android failures must reach failed step data/errorCode as supported by the current envelope pipeline; never success with an embedded error string.

Proposed CLI in PR-2:

```sh
clawperator on-screen-log set --text "FLOW-001: Settings persist" --anchor right --text-align left --top-offset-dp 24 --edge-offset-dp 12 --width-dp 280 --font-size-sp 12 --text-color '#FFFFFFFF' --background-color '#B3000000' --ttl-ms 300000 --device <device_serial>
clawperator on-screen-log clear --device <device_serial>
```

Flags map exactly to camelCase raw fields. Require `--text` for set. Clear accepts only common execution/output options, with no panel flags or positional text. Reject repeated panel flags, unknown flags, invalid subcommands, missing values, and extra positional arguments. Convert the entire numeric flag token to a JSON number before shared validation; accept decimal/exponent numeric syntax only when finite and integral, and reject empty, hexadecimal, fractional, and partially parsed tokens such as `12px`. Do not use prefix-only parseInt parsing. Preserve `0` offsets and pass omitted fields through as omitted so the canonical validator/Android defaults remain authoritative. Existing output-format, timeout, device, Operator-package, and no-daemon conventions apply. Default JSON wraps the same execution result. No new named MCP tool or serve endpoint; their execute routes accept the new actions.

Live acceptance must show full-display screenshot and playable video containing updated text, left/right placement and colors, continued app interaction, unchanged app bounds/foreground selection, and cleanup. Record capture limitations honestly; do not change secure-window behavior.

## Idempotency

Set is replacement, not append. Omitted style fields reset to defaults even after a previous customized set. Repeating a successful set renews TTL but does not accumulate views. Clear is idempotent. No background restoration after process/service restart. An uncertain transport result remains uncertain; set/clear use `allowPostDispatchFallback:false` through the common action execution path. A proven pre-dispatch fallback is allowed; a lost acknowledgement after dispatch must not replay set or clear.

## Durable Follow-Up

Extend the PR-1 authored `docs/api/on-screen-logs.md` with CLI usage; preserve its raw API and capture limitations. Update `docs/api/actions.md`, `docs/api/snapshot.md`, `docs/api/errors.md`, and CLI generated-source registrations. Describe transport availability in `docs/api/serve.md` and `docs/api/mcp.md` only as existing execute-route support. Preserve the existing page registration/navigation and regenerate using repository skills; update generated CLI references from their source.

Store lifecycle/clock/geometry invariants in source comments and tests. Keep the multi-PR task pack until both PRs finish; use `.agents/skills/task-cleanup/SKILL.md` before deleting it. Timing widgets and automatic metadata are future ideas, not incomplete requirements of this task.
