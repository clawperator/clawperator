# Writable evidence video state

Make video recording usable with a writable state override while preserving
exclusive ownership of each device across processes and roots. Done means the
configuration and lifecycle checks below pass, restricted-host live evidence is
recorded, docs and task status are updated, and validated changes are committed.
See [work-breakdown.md](work-breakdown.md) for delivery and validation.

Status: [TODO]. Priority P1 in the [v0.10.x plan](../../releases/v0.10.x/plan.md).

## Evidence

In the 0.10.0 usage run, writable
`--output-dir` and `CLAWPERATOR_LOG_DIR` did not prevent EPERM at the default
home evidence directory; recording succeeded once that path was accessible.
This is host integration friction, not a demonstrated Android recording defect.

At `626a169d`, `video.ts` resolves its root from a test dependency or
`~/.clawperator/evidence`; device locks live beneath that root, while session and
heartbeat files live in the output bundle. Merely exposing the dependency as an
environment variable would let different roots bypass the host lock.

## Scope and decisions

Add `CLAWPERATOR_EVIDENCE_DIR` as a documented evidence-root override, retaining
the existing default when omitted. Reject blank values; resolve relative paths
once against the caller's working directory and persist absolute ownership
paths. Align managed still bundles, managed video lookup, detached workers and
CLI/HTTP callers. Explicit output directories remain separate from this setting.
Keep existing manifest-path status/stop usable across process/environment changes.

Before enabling the override, provide atomic per-device ownership across roots
and processes. Implementation must select and document an ownership mechanism
that also works when the default home directory is unwritable; a lock beneath
each selected root alone is unacceptable. Preserve nonce/process identity checks,
conservative stale-owner recovery and refusal to signal unrelated processes.
If that cannot be achieved within this change, report the concrete blocker;
do not ship a root override that weakens exclusion.

Preflight required state/output writes before spawning a recorder; return a
stable structured permission failure with the failing path and recovery action.
Reuse an existing suitable code or add one in the error contract and docs.
No broad host-root migration, automatic permission changes or log relocation.

## Owners and docs

`apps/node/src/domain/evidence/{video,videoWorker,videoSupport,capture}.ts` own
root resolution, worker state and locks. Inspect `cli/commands/evidence.ts`,
`cli/commands/serve.ts`, `contracts/errors.ts` and existing evidence unit tests
for configuration propagation, lifecycle lookup and errors. Paths are relative
to `apps/node/src/` where shortened above.

Update `docs/api/evidence.md`, `docs/api/errors.md` if codes change, and
`docs/internal/design/still-evidence.md` with configuration, ownership and
recovery policy. Doctor changes are optional only if necessary
to explain a prerequisite that video preflight cannot report adequately.

## Acceptance

Start/status/stop and worker completion succeed with inaccessible default home
state and a writable override. Existing default behavior and explicit output
paths work. Blank/unwritable roots fail predictably without a recorder or leaked
lock. Independent processes using the same and different roots cannot record
one device concurrently; different devices may record independently. Test races,
startup failures, worker death, stale ownership, changed environment and managed
HTTP lookup. Preserve previous sessions and partial artifacts during recovery.
