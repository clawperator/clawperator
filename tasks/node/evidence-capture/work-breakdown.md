# Capture portable image and video evidence Implementation

Contract: [plan.md](plan.md). Dependencies and release coordination: [v0.10 plan](../../releases/v0.10/plan.md).

## PR Scope

| PR | Purpose | Phase | Merge gate |
| --- | --- | --- | --- |
| PR-1 | Still evidence bundles | 1 | None |
| PR-2 | Managed video lifecycle | 2 | PR-1 merged |

Implement the requested PR through its acceptance criteria, relevant checks, in-scope repairs, docs, and local commits. A dependency becoming available does not authorize the next PR. Routine implementation choices are yours; raise only decisions that change the contract or scope.

## PR-1: Still evidence bundles

Ship screenshot/XML bundles and the shared manifest.

### Work

- Trace existing screenshot and snapshot primitives and preserve their canonical envelopes. Add an injected capture/metadata/file seam for deterministic tests, with one shared manifest writer.
- Implement exclusive destination creation, sequential independent captures, metadata collection, and atomic manifest persistence. Preserve all component errors.
- Wire Node domain, CLI and MCP through the same implementation. Use docs-author to register the authored evidence page through the source manifest; regenerate rather than hand-editing staging.
- Add temporary-directory tests using valid tiny PNG fixtures and malformed/empty variants. Live-capture an unlocked Settings screen, open the PNG, parse hierarchy XML, and verify correlation/timestamps against captures.json.

### Affected Sources

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

### Acceptance Evidence

- Successful screenshot and XML produce complete manifest with valid relative paths, sizes, hashes, and independent timestamps.
- MCP refuses caller output paths, allocates a managed bundle, and uses opaque video session IDs rather than arbitrary manifest paths. CLI and MCP share schema/behavior without identical path inputs.
- With root unavailable, actual screenshot capture is attempted through the shared helper and yields partial image evidence; budget exhaustion records each unattempted component explicitly.
- Snapshot failure with valid image produces partial bundle and nonzero exit; image failure with XML succeeds only for that component.
- Both captures failing still produces failed manifest when destination is writable; metadata errors remain explicit.
- Existing directory, blank path, invalid/oversized context, disk-write error, malformed PNG, and multiple unspecified devices fail deterministically.
- CLI/MCP output and errors agree; original caller failure remains intact; no HTML report or automatic recovery is introduced.

### Live Entry Points

Use these for the device proof described above, after building the matching tools. They do not replace the acceptance assertions.

```sh
: "${DEVICE_ID:?Select a test device}"
CAPTURE_ROOT="$(mktemp -d)"
node apps/node/dist/cli/index.js evidence capture --device "$DEVICE_ID" --operator-package com.clawperator.operator.dev --output-dir "$CAPTURE_ROOT/still" --label "Settings observation"
```

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
