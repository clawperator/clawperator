# Remaining integration validation

- [DONE] Writable root configuration, fixed per-user host ownership and storage
  preflight, lifecycle/worker compatibility, process-race regressions and docs.
- [DONE] Restricted physical-device CLI start/status/stop, same/different-root
  exclusion, fresh recording after release, duration-cap completion, and managed
  MCP start/status/stop through separate processes. Video decoding and hashes
  passed. CLI/MCP still artifacts were also retained.
- [TODO] After integrating the independent
  [device-classification fix](../evidence-device-classification/plan.md), repeat
  restricted physical still/video capture and cross-root exclusion on the combined
  revision. Require complete manifests, CLI exit 0 and MCP results without
  `isError`; retain source/CLI/APK identity, media verification and artifact hashes.
  Current bundles are metadata-only partial and cannot satisfy this combined gate.

The implementation has no dependency on the first pack's merge. This retained
handoff owns only the combined acceptance check; do not implement classification
or publish a release from this pack. The HTTP `serve` API has no evidence routes;
use CLI and MCP for the existing evidence surfaces.

Once combined validation passes, update the
[permanent evidence record](../../../docs/internal/design/still-evidence.md#writable-state-validation-and-remaining-integration-gate),
update the [release queue](../../releases/v0.10.x/plan.md), and retire this pack
with task-cleanup. Independent transport and publication gates remain applicable.
