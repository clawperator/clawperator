# Writable evidence video state

Status: implementation and independent validation [DONE] locally. Integrated
complete-bundle acceptance remains open before publication. No merge or release
is asserted. Priority P1, item 2 in the [v0.10.x plan](../../releases/v0.10.x/plan.md).

Delivered `CLAWPERATOR_EVIDENCE_DIR`, absolute managed state/worker paths, fixed
per-user host ownership across roots, structured storage preflight failures,
CLI/MCP lifecycle propagation, deterministic process races and canonical docs.
The existing HTTP server has no evidence endpoints; managed lookup was validated
through fresh MCP stdio processes instead.

Durable behavior, ownership/upgrade limits and sanitized physical-device evidence
live in [the design record](../../../docs/internal/design/still-evidence.md#writable-evidence-roots-and-video-ownership).
The [public storage contract](../../../docs/api/evidence.md#evidence-storage-configuration)
owns configuration and recovery details. See [work-breakdown.md](work-breakdown.md)
for the one remaining integration check.

Node build/full suite (1,597 passing tests), extended focused tests (32 passing),
matching development APK build/install, explicit restricted-host physical CLI/MCP
lifecycle, cross-root rejection, full video decoding and artifact hashes passed.
Docs build passed with no organization warnings. Physical bundles retained only
the known device-classification metadata error; they were not called complete.
