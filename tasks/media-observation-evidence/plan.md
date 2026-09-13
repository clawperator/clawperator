# Media observation evidence

Extend existing media status with callback sequence/receipt time, buffered
position and local/remote playback type. Add bounded `media observe` through the
canonical action path so agents can collect evidence while locked without waking
the device. Reports and estimates never establish independent playback proof.

Scope: one implementation branch/PR, with no merge dependency. Add
`observe_media` selected by exactly one applicationId/mediaSessionId and required
integer durationMs (1-30000). Pin the session; collect initial/final snapshots and
callback samples, cap retained callback samples at 64 and expose truncation. Count all
callbacks during observation, including those beyond the retention limit. Keep
existing status decoding compatible with older Operators. No new permissions,
audio capture, browser-specific assertions, push or release. Apply api-agent-ux
to naming, recovery errors, readable samples and the documented agent workflow.

Owners: NotificationMediaService.kt owns callback evidence and observation;
AgentCommandParser.kt and UiAction.kt own Android ingress/readiness;
apps/node/src/contracts/notifications.ts and cli/registry.ts own validated actions
and CLI; domain/notifications/service.ts owns typed decoding. Existing tests in
both runtimes and validation/notifications-media provide regression fixtures.
Public contract belongs in docs/api/media.md; durable rationale belongs in
docs/internal/design/notifications-and-media.md. Use .agents/skills/docs-author
and docs-build for that work. Inspect sibling runtime skills for affected usage.

Done means scoped implementation, regression tests, relevant live evidence,
docs regeneration, task status and validated local commits. Run Node build then
tests; Android assembleDebug/testDebugUnitTest and relevant module tests; docs
build. Live verification needs an explicit connected device, matching debug APK
and the independent media fixture. Offline checks cannot prove locked-device
behavior. Report any unavailable validation with its remaining uncertainty.
