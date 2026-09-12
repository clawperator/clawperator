# Capture portable image and video evidence Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Still evidence bundles | 1 | None |
| PR-2 | Managed video lifecycle | 2 | PR-1 merged |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Still evidence bundles [DONE]

Implemented and locally validated in `7c5cb8d`; pending merge. The pack remains
active for PR-2. Do not start managed video until PR-1 has merged.

- Screenshot/XML bundles, exclusive destinations, correlated manifests, device
  metadata, per-component timings, file validation/hashes, and partial failures
  are implemented through the shared Node domain, CLI, and MCP.
- Complete Node suite: 1,498 passed; final focused checks: 151 passed. Debug APK
  and documentation builds passed, as did independent live CLI/MCP artifact
  verification on the dedicated Android 16 / API 36 emulator.
- Public contract: [Still Evidence Bundles](../../../docs/api/evidence.md).
- Durable design, live evidence, and the separate initial app-open timeout:
  [Still evidence capture](../../../docs/internal/design/still-evidence.md).
- Existing raw screenshot/snapshot skill consumers require no migration. No
  managed-video commands or lifecycle state were implemented.

## PR-2: Managed video lifecycle

Ship bounded, owned, verified screen recordings.

### Work

- After PR-1 merges, add the recording lifecycle state machine: starting, recording, finalizing, complete/partial/failed. Preserve session ownership and exclusive per-device recording while allowing the process-coordination design described in the plan. Recover status across separate CLI processes.
- Implement explicit device geometry, bounded duration, tracked remote process ownership, graceful SIGINT, pull, media probing/decoding, and final manifest publication. Keep stderr and partial files on failures.
- Use a fake process adapter and fake clock for startup, stop, time cap, crash, disconnect, and lock cases. Real subprocess tests prove worker survival after start returns and idempotent status/stop.
- Live record at least 10 seconds with visible Settings navigation, then repeat on an idle screen. Test explicit stop and duration cap. Probe both recordings, decode frames, and record host versus media duration independently. Do not call a truncated idle timeline a full-duration proof.
- Update docs with dependencies, limits, ownership, distinct event-recording semantics, and verified playback workflow.

### Affected Sources

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

### Acceptance Evidence

- Start returns without waiting for duration cap, and status/stop work from another CLI process.
- Concurrent session on the same device is rejected; other devices remain independent. Unknown/stale ownership never triggers broad process termination.
- Starting/finalizing/terminal manifests validate against the same schema; all command exit/status combinations match the plan and duplicate stop requests cannot race final manifest writes.
- Explicit stop, time cap, startup codec failure, disconnect, crash, missing ffprobe/ffmpeg, pull failure, corrupt file, and dimension fallback all yield truthful final states.
- Actual dimensions equal requested dimensions for complete video. Valid decodable frames and positive media duration are mandatory; metadata distinguishes requested, host, and media durations.
- Repeated stop returns the existing result without new capture; partial files are retained; event-recording commands are unchanged.
- Live navigation and idle recordings are opened/decoded and findings identify any missing coverage; a file-exists check cannot satisfy acceptance.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
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

## Validation and Completion

Use AGENTS.md for shared validation policy. Build Node before tests that consume dist. Relevant checks for this pack are:

```sh
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
git diff --check
```

Live verification requires a dedicated, explicitly selected device, an unlocked screen, enabled accessibility, and the matching debug Operator. Offline tests prove the stated contracts; device checks prove integration and pixels. Record unavailable live evidence rather than treating it as passed.

Use `.agents/skills/docs-author/SKILL.md` for the named public docs and `.agents/skills/docs-build/SKILL.md` for regeneration. Run checks for each behavior change; repeat successful checks only after new changes or an unresolved integration concern.

Keep concise findings with versions, reproduction inputs, observed results/artifact paths, decisions, and remaining limitations. Preserve private captures outside tracked files. Update progress and commit validated logical units. Completion includes correcting in-scope failures, not merely producing a first implementation.
