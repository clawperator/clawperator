# Capture portable image and video evidence Work Breakdown

Parent plan: `tasks/node/evidence-capture/plan.md`

## Executive Summary

2 PR(s), 2 phase(s); phase N ships in PR-N. Implementation has not started. Each phase includes its own tests and docs. Do not start PR-2 until PR-1 is merged.

## Status

| Item | Value |
| --- | --- |
| State | Not started |
| Total PRs | 2 |
| Total phases | 2 |
| Completed | None |
| Remaining | 1-2 |
| Current / Next | Phase 1 |
| Blockers | None |

## Hard Rules

- Follow the parent contract; do not invent alternative default behavior.
- Use branch-local Node output and the matching debug Operator for implementation validation. Never repair or uninstall packages on a device used by another task.
- Commit one logical phase with its tests and authored docs. Do not defer tests to another phase.
- Use the docs-author and docs-build skills for public changes. Do not hand-edit generated pages.
- When affected skill consumers require migration, coordinate changes and version bumps in the sibling skills repository with its active owner, and run its smoke checks per AGENTS.md. Do not silently expand this checkout into unrelated skill edits.
- Keep fixtures generic, using `com.example.fixture`, neutral labels, and caller-provided device IDs. Never copy application-specific research assets into this repository.
- Preserve commandId/taskId and explicit device/operator selection through every path. Do not add autonomous recovery or app-specific policy.
- Record plan deviations before committing. Stop for material contract changes; continue for equivalent internal implementation choices.
- Inspect existing tests listed below before editing. Where the affected path lacks coverage, add the specified regression cases in the same phase.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Topic | Authority |
| --- | --- |
| Governing repository rules | `AGENTS.md` |
| Stable task contract | `tasks/node/evidence-capture/plan.md` |
| Screenshot primitive | `apps/node/src/domain/observe/screenshot.ts` |
| Host screenshot handling | `apps/node/src/domain/executions/runExecution.ts` |
| Snapshot primitive | `apps/node/src/domain/observe/snapshot.ts` |
| Process adapter | `apps/node/src/adapters/android-bridge/processRunner.ts` |
| CLI registration | `apps/node/src/cli/registry.ts` |
| MCP entry points | `apps/node/src/mcp/tools/index.ts` |
| Existing event recording | `apps/node/src/cli/commands/record.ts` |
| Observe tests | `apps/node/src/test/unit/observe.test.ts` |
| Public docs authoring workflow | `.agents/skills/docs-author/SKILL.md` |
| Existing public contract exemplar (match its examples and caveats) | `docs/api/navigation.md` |
| Generated docs workflow | `.agents/skills/docs-build/SKILL.md` |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Still evidence bundles | 1 | default | None |
| PR-2 | Managed video lifecycle | 2 | thinking | PR-1 merged |

## Phase 1: Still evidence bundles

### Agent Tier

default

### Goal

Ship screenshot/XML bundles and the shared manifest.

### Files or Surfaces To Change

- `apps/node/src/contracts/evidence.ts`
- `apps/node/src/domain/evidence/`
- `apps/node/src/cli/commands/evidence.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/mcp/tools/evidence.ts`
- `apps/node/src/mcp/tools/index.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/test/unit/evidenceCapture.test.ts`
- `apps/node/src/test/integration/mcp.test.ts`
- `docs/api/evidence.md`
- `docs/api/snapshot.md`
- `docs/api/mcp.md`
- `sites/docs/source-map.yaml`
- `sites/docs/mkdocs.yml`

### Steps

1. Trace existing screenshot and snapshot primitives and preserve their canonical envelopes. Add an injected capture/metadata/file seam for deterministic tests, with one shared manifest writer.
2. Implement exclusive destination creation, sequential independent captures, metadata collection, and atomic manifest persistence. Preserve all component errors.
3. Wire Node domain, CLI and MCP through the same implementation. Use docs-author to register the authored evidence page through the source manifest; regenerate rather than hand-editing staging.
4. Add temporary-directory tests using valid tiny PNG fixtures and malformed/empty variants. Live-capture an unlocked Settings screen, open the PNG, parse hierarchy XML, and verify correlation/timestamps against captures.json.

### Acceptance Criteria

- Successful screenshot and XML produce complete manifest with valid relative paths, sizes, hashes, and independent timestamps.
- Snapshot failure with valid image produces partial bundle and nonzero exit; image failure with XML succeeds only for that component.
- Both captures failing still produces failed manifest when destination is writable; metadata errors remain explicit.
- Existing directory, blank path, invalid/oversized context, disk-write error, malformed PNG, and multiple unspecified devices fail deterministically.
- CLI/MCP output and errors agree; original caller failure remains intact; no HTML report or automatic recovery is introduced.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Unit/subprocess tests are the primary reproducible gate. Live checks prove device integration only and require a dedicated target with the matching debug Operator, enabled accessibility, and an unlocked screen. A skipped live check is not a pass; record its unmet prerequisite.

```sh
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
: "${DEVICE_ID:?Select a test device}"
CAPTURE_ROOT="$(mktemp -d)"
node apps/node/dist/cli/index.js evidence capture --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --output-dir "$CAPTURE_ROOT/still" --label "Settings observation"

```

### Expected Commit

```text
feat(evidence): capture correlated screenshot and hierarchy bundles
```

## Phase 2: Managed video lifecycle

### Agent Tier

thinking

### Goal

Ship bounded, owned, verified screen recordings.

### Files or Surfaces To Change

- `apps/node/src/domain/evidence/`
- `apps/node/src/contracts/evidence.ts`
- `apps/node/src/cli/commands/evidence.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/mcp/tools/evidence.ts`
- `apps/node/src/test/unit/evidenceVideo.test.ts`
- `apps/node/src/test/unit/evidenceWorker.test.ts`
- `docs/api/evidence.md`
- `docs/api/recording.md`
- `docs/api/mcp.md`

### Steps

1. After PR-1 merges, add the worker state machine: starting, recording, finalizing, complete/partial/failed. Use session-owned files, exclusive per-device lock, and stop requests. Recover status across separate CLI processes.
2. Implement explicit device geometry, bounded duration, tracked remote process ownership, graceful SIGINT, pull, media probing/decoding, and final manifest publication. Keep stderr and partial files on failures.
3. Use a fake process adapter and fake clock for startup, stop, time cap, crash, disconnect, and lock cases. Real subprocess tests prove worker survival after start returns and idempotent status/stop.
4. Live record at least 10 seconds with visible Settings navigation, then repeat on an idle screen. Test explicit stop and duration cap. Probe both recordings, decode frames, and record host versus media duration independently. Do not call a truncated idle timeline a full-duration proof.
5. Update docs with dependencies, limits, ownership, distinct event-recording semantics, and verified playback workflow.

### Acceptance Criteria

- Start returns without waiting for duration cap, and status/stop work from another CLI process.
- Concurrent session on the same device is rejected; other devices remain independent. Unknown/stale ownership never triggers broad process termination.
- Explicit stop, time cap, startup codec failure, disconnect, crash, missing ffprobe/ffmpeg, pull failure, corrupt file, and dimension fallback all yield truthful final states.
- Actual dimensions equal requested dimensions for complete video. Valid decodable frames and positive media duration are mandatory; metadata distinguishes requested, host, and media durations.
- Repeated stop returns the existing result without new capture; partial files are retained; event-recording commands are unchanged.
- Live navigation and idle recordings are opened/decoded and findings identify any missing coverage; a file-exists check cannot satisfy acceptance.
- Human review: output accuracy matches observed evidence; scope covers the named surfaces only; important claims trace to tests or findings; schema, section order, and public help match the contract.

### Validation

Run from repository root, in order. Unit/subprocess tests are the primary reproducible gate. Live checks prove device integration only and require a dedicated target with the matching debug Operator, enabled accessibility, and an unlocked screen. A skipped live check is not a pass; record its unmet prerequisite.

```sh
npm --prefix apps/node ci
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
ffprobe -version
ffmpeg -version
: "${DEVICE_ID:?Select a test device}"
VIDEO_ROOT="$(mktemp -d)"
node apps/node/dist/cli/index.js evidence video start --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --output-dir "$VIDEO_ROOT/session" --duration-seconds 15
node apps/node/dist/cli/index.js evidence video status --session "$VIDEO_ROOT/session/manifest.json"
# Perform visible navigation for the live case before stopping; repeat separately while idle.
node apps/node/dist/cli/index.js evidence video stop --session "$VIDEO_ROOT/session/manifest.json"
ffprobe -v error -show_streams "$VIDEO_ROOT/session/video.mp4"
ffmpeg -v error -i "$VIDEO_ROOT/session/video.mp4" -frames:v 1 "$VIDEO_ROOT/frame.png"
```

### Expected Commit

```text
feat(evidence): manage bounded verified video capture
```

## Execution Findings

Create `findings.md` at the start of the first phase, before source edits. Use these sections in order: Environment and Versions; Reproduction Inputs; Observed Results (command, exit code, JSON fields, artifact paths); Source Mapping; Decisions and Deviations; Validation (case, expected, actual, pass/fail/blocked); Remaining Work. Append phase-specific results before its commit. Do not paste sensitive or application-specific captures. Keep raw local evidence outside tracked files and use generic reproduction fixtures in tests.
