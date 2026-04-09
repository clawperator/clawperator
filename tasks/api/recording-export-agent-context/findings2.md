# Recording Export Findings 2

## Environment

- Repo: `<repo_root>`
- Branch: `codex/recording-export-agent-context-impl`
- Connected devices:
  - `<device_serial>` (physical)
  - `emulator-5554` (emulator)
- Live validation target: `emulator-5554`
- Operator package: `com.clawperator.operator.dev`
- CLI path used for all runtime checks: `node apps/node/dist/cli/index.js`

## Commands Run

- `clawperator devices`
- `adb devices`
- `node apps/node/dist/cli/index.js doctor --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording start --session-id export-demo-live-20260409 --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js open com.android.settings --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js back --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording stop --session-id export-demo-live-20260409 --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `mkdir -p /tmp/clawperator-recording-live-findings2`
- `node apps/node/dist/cli/index.js recording pull --session-id export-demo-live-20260409 --out /tmp/clawperator-recording-live-findings2 --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording export --input /tmp/clawperator-recording-live-findings2 --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording parse --input /tmp/clawperator-recording-live-findings2/export-demo-live-20260409.ndjson --json`
- `node apps/node/dist/cli/index.js recording export --input /tmp/clawperator-recording-live-findings2/export-demo-live-20260409.ndjson --out /tmp/clawperator-recording-live-findings2/export-demo-live-20260409.include.export.json --snapshots include --json`
- `node apps/node/dist/cli/index.js recording start --session-id export-demo-stale-seq-a --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording start --session-id export-demo-stale-seq-b --device emulator-5554 --operator-package com.clawperator.operator.dev --json`
- `node apps/node/dist/cli/index.js recording stop --session-id export-demo-stale-seq-a --device emulator-5554 --operator-package com.clawperator.operator.dev --json`

## Live Results

- `doctor` passed end to end on `emulator-5554`.
- `recording start` succeeded and returned the exact on-device NDJSON path.
- The live interaction was intentionally small:
  - open Settings
  - wait briefly
  - press Back
- `recording stop` succeeded and reported `eventCount: "4"`.
- `recording pull` returned the exact host path in `localPath`:
  - `/tmp/clawperator-recording-live-findings2/export-demo-live-20260409.ndjson`
- `recording export --input /tmp/clawperator-recording-live-findings2 --json` succeeded with no `--out` and wrote:
  - `<tmp_export_dir>/export-demo-live-20260409.export.json`
- This confirms the fixed behavior:
  - directory input now derives the default output path from the resolved newest NDJSON file
  - the export lands inside the pulled directory, not beside it
- `recording parse` still produced a valid steps file for the same NDJSON.

## Output Summary

- Raw NDJSON size:
  - `163773` bytes
- Export with default `--snapshots omit`:
  - `1999` bytes
- Parse output (`.steps.json`):
  - `59068` bytes
- Export with `--snapshots include`:
  - `164889` bytes

The size difference is substantial. For this live sample, `omit` reduced the exported artifact from roughly raw-recording size to about 2 KB while still preserving event structure, counts, transitions, and snapshot presence booleans.

## Recorded Event Summary

- Raw event types observed:
  - `window_change`
  - `scroll`
  - `window_change`
  - `window_change`
- Export summary:
  - `eventCount: 4`
  - `byType: {"window_change": 3, "scroll": 1}`
  - `packageTransitionCount: 1`
- Exported package transition:
  - `com.android.settings` -> `com.android.vending`
- Timeline:
  - `durationMs: 8935`

## Important Runtime Observations

### 1. The directory export flow now works as intended

This was the main behavior under review, and the live emulator run confirmed it:

- `recording pull` wrote `export-demo-live-20260409.ndjson` into the target host directory
- `recording export --input <that directory>` selected the NDJSON file inside it
- the default export path was derived from the resolved NDJSON file name
- the written file path matched the command result payload

### 2. Sequential stale-session recovery works well

The stale-session path behaved correctly when exercised sequentially:

- first `recording start` succeeded for `export-demo-stale-seq-a`
- second `recording start` failed with `RECORDING_ALREADY_IN_PROGRESS`
- the failure payload included:
  - `sessionId`
  - `filePath`
  - a concrete `hint`
- the hint was actionable and copy-paste friendly:
  - `recording stop --session-id export-demo-stale-seq-a --device emulator-5554 --operator-package com.clawperator.operator.dev --json`

This part feels ready and materially better than before.

### 3. Pressing Back did not yield a `press_key` raw recording event

Even though the flow included a real `back` CLI action, the pulled NDJSON contained:

- `window_change`
- `scroll`
- `window_change`
- `window_change`

There was no `press_key` recording event in this emulator run. The export builder supports `press_key`, but that event type did not appear here. This is important because the docs and contract examples can make `press_key` look more routinely observable than it may be in practice.

### 4. The parse and export views are intentionally very different

For the same recording:

- `parse` produced one `open_app` step plus a warning that the scroll event was dropped
- `export` preserved all four raw events

That difference is useful and expected, but it is large enough that docs should keep emphasizing:

- `parse` is a lossy normalization pipeline for v1 step extraction
- `export` is the evidence-preserving artifact for downstream authoring agents

## API Gaps And Improvement Ideas

### 1. A `recording status` command would still be valuable

The new stale-session hint is good, but discovery is still reactive. If a user or agent wants to ask "what recording is currently open on this device?" there is still no direct status command.

Suggested improvement:

- add `recording status --device <id> --operator-package <pkg>`
- return:
  - active session id
  - on-device file path
  - whether the operator considers the session open
  - maybe the current event count so far

This would make recovery deterministic before issuing another `start`.

### 2. Export could surface the resolved input file explicitly

When `--input` is a directory, the command returns the final `outputFile`, but not the NDJSON file it selected.

Suggested improvement:

- add a top-level `resolvedInputFile` field to successful export responses

That would help with:

- debugging directory autodiscovery
- provenance tracking in higher-level automation
- reducing the need to inspect the directory after the fact

### 3. The snapshot-size tradeoff should be easier to reason about from the CLI

The size delta between `omit` and `include` is dramatic in real usage. The current API works, but the user has to know that from docs or experimentation.

Suggested improvement:

- mention snapshot-size implications directly in `recording export --help`
- optionally return a small summary such as `snapshotXmlIncluded: false` and `snapshotCount`

That would help agents choose between:

- lightweight context for planning or authoring
- full-fidelity evidence for auditing or replay analysis

### 4. Concurrency semantics for recording commands are unclear

I intentionally probed a same-device concurrency edge by firing two `recording start` commands in parallel and later two `recording stop` commands in parallel. In that stress case, both shell calls surfaced the same envelope payload, including the same `commandId` and session details.

I do not want to overstate this as a confirmed product bug yet, because this probe used parallel local shell execution rather than a documented supported workflow. Still, it suggests the contract around concurrent same-device recording commands is under-specified.

Suggested improvement:

- document whether concurrent `recording start/stop` calls against the same device are unsupported
- if unsupported, fail explicitly with a local single-flight or conflict error
- add a test that pins the intended behavior rather than leaving it undefined

## Documentation Gaps

### 1. Recording docs should call out that `press_key` may not appear in every real flow

The live emulator run used `back`, but the recording only captured scroll and window-change events. That means users should not assume one raw event per CLI action.

Docs should say more explicitly:

- recording captures what the runtime actually observes
- some command types may only be indirectly reflected through downstream accessibility or window events

### 2. Recording docs should emphasize the size profile of `omit` vs `include`

The docs already explain the modes, but the live numbers show the practical tradeoff much more clearly:

- omit export: ~2 KB
- include export: ~165 KB

That kind of example would help external authoring agents and humans choose the right mode without trial and error.

### 3. The parse/export contrast deserves a concrete side-by-side example

The same recording produced:

- one normalized `open_app` step in parse output
- four preserved raw events in export output

That contrast is core to the feature and should be very prominent in the docs.

## Testing Gaps

### 1. There should be a higher-level CLI regression that covers the full pull-directory-export flow

Current tests cover directory export behavior, and the live run confirmed it works. Still, the most user-realistic path is:

1. `recording stop`
2. `recording pull --out <dir>`
3. `recording export --input <same dir>`

A test that models that exact path with CLI-shaped artifacts would guard the most important authoring workflow.

### 2. Same-device concurrent recording commands need a documented test stance

Right now the sequential stale-session path is covered and behaves well. The concurrent path is not clearly covered. The project should choose one of these and test it explicitly:

- unsupported: reject concurrent starts and stops with a clear local error
- supported: guarantee per-command correlation and distinct envelopes under concurrency

### 3. Live-device coverage for event-type realism is still useful

Unit tests prove the exporter handles `press_key` when present, but the emulator run showed that real recordings can omit that event even when a `back` action happened. A lightweight live smoke note or emulator-based integration check could help keep docs and expectations aligned with observed runtime behavior.

## Bottom Line

- The fixed directory-input export behavior worked correctly on a real emulator run.
- The improved stale-session recovery hint also worked correctly in a real sequential retry.
- The biggest remaining opportunities are around:
  - recording status discovery
  - clearer directory export provenance
  - better docs about event realism and snapshot size tradeoffs
  - an explicit stance on same-device command concurrency
