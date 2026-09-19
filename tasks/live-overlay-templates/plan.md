# Live overlay templates

## Goal and status

Task 1 is implemented and validated. Task 2 has not started. The overall goal
is to let a Node caller configure an overlay once, with Android resolving device
and foreground-app values and refreshing them locally. No host polling is required.

Split this into two sequential implementation tasks, each suitable for one PR:

| Task | Deliverable | Dependency | Status |
| --- | --- | --- | --- |
| 1 | Reusable Android foreground-application observer | None | [DONE] |
| 2 | Overlay templates, inline icons, and live refresh | Task 1 observer contract and implementation | Not started |

Task 2 may build on Task 1 in a stacked branch; integrate Task 1 first. This pack
does not itself authorize implementation or remote publication. A future agent
assigned one task completes that task through validation, docs, and local
commits without automatically expanding into the other task.

## Current implementation

The accessibility service now feeds a reusable subscription-driven foreground
observer, including window-change ingress for split-screen input focus. It
provides explicit unavailable state, bounded null-root retries, cancellation,
and service-reconnect protection. Public snapshot foreground lookup remains
unchanged. The existing overlay still renders static text and owns its draw
acknowledgement, replacement, and expiry; Task 2 integration is not implemented.

Durable semantics, test coverage, live evidence, and platform limitations are in
[foreground application observation](../../docs/internal/design/foreground-application-observation.md).
Task 1 was live-verified on the requested Pixel 10 Pro Fold AVD with an Android
consumer of production code, independent of recording and Node navigation.

## Task boundaries

Task 1 owns observable current application identity and service lifecycle.
Use existing accessibility ingress, with an initial read and event-triggered
reconciliation. Expose explicit unavailable state and changes to consumers.
Observation should be subscription-driven; stop additional work when no
consumer needs it. It must work independently of recording and Node execution.
Do not introduce a separate Android service, public Node monitoring API,
continuous full hierarchy capture, or unrelated snapshot behavior changes.

Task 2 owns metadata lookup, caching, template validation, inline icon layout,
Node/CLI integration, and renderer refresh. Foreground metadata is resolved in
Android from Task 1 identity. Device-only templates need no app subscription.

## Foreground semantics

Follow the active/focused application window on the overlay's display, excluding
the Operator-owned overlay and input-method windows. In split-screen, follow
the interacted-with/focused application. Home can identify the launcher.
Do not substitute an accessibility event's package directly for verified
application identity. Each observation pairs `foregroundState` with nullable
`foregroundApp`. `app_focused` identifies the focused app; `system_panel`
retains the subscription's last verified app as context while a system panel
owns focus. A subscription starting under a panel has no app context. `locked`
and `unavailable` clear app context. Never select an arbitrary background app
or treat retained panel context as proof of application input focus.

Check these rules against live window evidence, including permission dialogs,
notification shade, recents, and keyboards; record the exact resolution policy
and any platform limits. Reuse existing window inspection where appropriate,
but preserve the current public snapshot foreground semantics. Do not claim
instantaneous updates: measure event-to-observation latency and describe limits.

## Template contract

Extend `set_on_screen_log` with `params.template`; require exactly one of `text`
or `template`. Existing `text` stays literal. CLI adds `on-screen-log set
--template` alongside the existing styling and execution options. Generic
execution transports carry the same action; no new Serve endpoint or MCP tool.

Use the following closed placeholder vocabulary:

| Placeholder | Value |
| --- | --- |
| `{{foreground_app.icon}}` | Declared application icon, not a resource-name lookup for `ic_launcher` |
| `{{foreground_app.package_name}}` | Current installed package name |
| `{{foreground_app.version_code}}` | Full version code rendered as decimal text |
| `{{foreground_app.version_name}}` | Declared human-readable version name |
| `{{device.manufacturer}}` | Android device manufacturer |
| `{{device.model}}` | Android device model |
| `{{system.language_code}}` | Primary system locale's language code, such as `en` |
| `{{system.language_tag}}` | Primary system locale's language tag, such as `en-AU` or `zh-Hant-TW` |
| `{{system.language_name}}` | Language name in its own language, such as `Deutsch` |

System language is independent of the Operator's per-app locale. Manufacturer
and model can resolve once; language refreshes on system configuration changes.
Do not add the ambiguous `system.language` token or HTML/angle-bracket aliases.

Example template:

```text
{{device.manufacturer}} {{device.model}}
{{system.language_code}} - {{system.language_name}}
{{foreground_app.icon}} {{foreground_app.package_name}}
{{foreground_app.version_code}}, {{foreground_app.version_name}}
other text
more text
```

Templates support ordinary spaces and newlines, not HTML entities, expressions,
or recursive expansion. Unknown and malformed placeholders fail validation
before changing the current panel, with supported names in the error. Define
and document one literal-delimiter escape, plus consistent input and expanded
content bounds, with matching Node and Android fixtures. These mechanical
details are implementation choices, not a reason to block the task.

Use `Unavailable` for unavailable text metadata and a neutral icon when an icon
cannot be loaded. Preserve a known package when only its metadata lookup fails.
Render all app fields from one identity observation; discard stale asynchronous
lookups. Cache metadata without keeping obsolete package-update results.
Start with an inline icon sized to the text line and handle adaptive icons.

## Lifecycle and evidence contract

Preserve touch-through input, selector isolation, styling, full replacement,
idempotent clear, and existing draw deadlines. Initial success acknowledges the
first rendered template state, including explicit unavailable values when needed.
Result bounds/truncation describe that initial draw, not all future refreshes.
Do not echo resolved text in the execution result or redefine snapshot metadata.

Live refresh does not extend TTL. Replacement, clear, expiry, and service detach
cancel subscriptions and pending work; old work cannot resurrect a panel.
Layout failure on refresh must remove the panel rather than display stale app
details. Existing screenshot timing and capture-inclusion limits remain in force.

## Owning sources

- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/accessibilityservice/OperatorAccessibilityService.kt`: event mask, ingress, service lifecycle.
- `apps/android/shared/data/resources/src/main/res/xml/accessibility_service_config.xml`: declared accessibility capabilities.
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/UiTreeInspectorAndroid.kt`: on-demand foreground lookup and window metadata.
- `apps/android/shared/data/uitree/src/main/kotlin/clawperator/uitree/OperatorOverlayIdentity.kt`: exact overlay exclusion.
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/onscreenlog/`: controller lifecycle and plain-text view layout.
- `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/OnScreenLog.kt`: specs, validation, and layout limits.
- `apps/android/shared/data/operator/src/main/kotlin/clawperator/operator/agent/AgentCommandParser.kt`: Android action validation.
- `apps/android/app/src/main/AndroidManifest.xml`: existing package visibility permission; verify supported metadata access.
- `apps/node/src/contracts/execution.ts`, `apps/node/src/domain/executions/validateExecution.ts`: canonical Node contract.
- `apps/node/src/cli/registry.ts`, `apps/node/src/cli/commands/action.ts`, `apps/node/src/domain/actions/onScreenLog.ts`: CLI parsing and mutation dispatch.
- `docs/api/on-screen-logs.md`, `docs/internal/design/on-screen-logs.md`, `validation/on-screen-logs/`: current guarantees and repeatable proof.

## Documentation and exclusions

Task 1 records durable observer semantics and evidence in
`docs/internal/design/foreground-application-observation.md`. Task 2 updates
the public overlay/action/error and affected transport documentation, plus
`docs/internal/design/on-screen-logs.md`. Use `.agents/skills/docs-author/SKILL.md`
and `.agents/skills/docs-build/SKILL.md` for these changes.

No arbitrary images, HTML rendering, template expressions, elapsed-time tags,
permanent overlays, screenshot pipeline redesign, or release/version work.
Runtime skill edits are needed only if actual consumers are affected; inspect
the sibling skills repo and apply the repository's lockstep rules if so.
