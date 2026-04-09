# Recording Export Agent Context

## Executive Summary

Add a new Node-facing recording export surface that preserves the full recorded
event stream and packages it into an agent-friendly JSON artifact without
performing skill-generation, selector inference, or intent synthesis.

This task ships in 1 PR with 5 phases. Phase 1 defines the export contract and
test matrix. Phase 2 extracts shared recording validation and proves
`parseRecording.ts` remains behaviorally identical. Phase 3 implements the
export builder and CLI surface. Phase 4 adds minimal `skills new` integration
that copies an exported recording context into the newly scaffolded skill folder
without generating logic. Phase 5 proves the workflow on a real recording and
updates authored public docs.

## Status

| Item | Value |
| --- | --- |
| State | not started |
| Total PRs | 1 |
| Total phases | 5 |
| Completed | 0 |
| Remaining | 5 |
| Current / Next | Phase 1 |
| Blockers | none |

## Goal

Create a deterministic bridge from `clawperator recording pull` output to an
agent-authorable skill workspace:

- `clawperator recording export` reads a pulled NDJSON recording and writes a
  richer JSON artifact that preserves all raw event types and factual timing /
  package-transition data.
- `clawperator skills new --recording-context <file>` copies that artifact into
  the new skill folder so an external agent can author the skill using the
  captured evidence.
- Public docs explain this as an agent-authoring workflow, not as automatic
  skill generation inside Clawperator.

## Why Now

The current Android recorder captures rich evidence, but the current Node parser
collapses that evidence into a lossy `open_app` / `click` step log. That is too
narrow for the next product wedge.

The distribution repo already points at a sharp story: record a real app flow,
then turn that evidence into a reusable agent workflow. To support that story
without violating the brain / hand model, Clawperator needs to export better
recording evidence, not make authoring decisions on the user's behalf.

## In Scope

- Add a new `recording export` CLI subcommand in the existing `recording`
  namespace.
- Implement a deterministic export builder that preserves every supported raw
  recording event type:
  - `window_change`
  - `click`
  - `scroll`
  - `press_key`
  - `text_change`
- Preserve raw snapshot XML per event when present.
- Add snapshot export-mode control so the export can stay agent-consumable for
  large recordings:
  - `--snapshots omit` (default)
  - `--snapshots include`
- Add factual derived fields that do not require product judgment:
  - event ordering by `seq`
  - `deltaMsSincePrevious`
  - package transitions
  - event counts by type
  - snapshot-present flags
- Keep existing `recording parse` behavior intact.
- Extend `skills new` with an optional recording-context attachment flag.
- Update authored public docs for recording and skill-authoring workflow.
- Validate with unit tests and one real recording export flow if a device with
  the debug Operator APK is available.

## Out of Scope

- Automatic skill generation
- Selector ranking or "best selector" inference
- Parameter extraction or placeholder inference
- Control-flow generation
- Retry / fallback strategy synthesis
- XML-to-NodeMatcher heuristic conversion
- Android-side recorder changes
- MCP server work
- Changing the current `recording parse` lossy step-log format
- Changes in the sibling `../clawperator-skills` repository

## Existing Artifact Scope

| Artifact | Disposition |
| --- | --- |
| `apps/node/src/domain/recording/parseRecording.ts` | Preserve current parse semantics; do not repurpose it as the richer export path |
| `apps/node/src/cli/commands/record.ts` | Extend with `export`; keep `start`, `stop`, `pull`, and `parse` behavior stable |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | Extend only for deterministic recording-context copy and scaffold wording |
| `docs/api/recording.md` | Update to document the new export command and its output contract |
| `docs/skills/authoring.md` | Update to document recording-context-assisted skill scaffolding |
| `sites/docs/.build/` | Generated only after authored docs are updated; never hand-edit |

## Surfaces and Ownership

| Surface | Owner | Changes |
| --- | --- | --- |
| Node recording domain | `apps/node/src/domain/recording/` | New export builder and export types |
| Node CLI | `apps/node/src/cli/` | New `recording export` command wiring and help text |
| Node skills scaffolding | `apps/node/src/domain/skills/` | Optional recording-context copy during `skills new` |
| Node tests | `apps/node/src/test/` | New export tests and scaffold integration tests |
| Public docs | `docs/` | Recording and skills workflow updates |
| Generated docs outputs | `sites/docs/.build/`, `sites/docs/site/` | Regenerated only after authored docs change |

## Source Of Truth

| Topic | Verify against |
| --- | --- |
| Recording namespace and help text | `apps/node/src/cli/registry.ts` |
| Recording CLI implementation | `apps/node/src/cli/commands/record.ts` |
| Raw recording event schema | `apps/node/src/domain/recording/recordingEventTypes.ts` |
| Current lossy parse behavior | `apps/node/src/domain/recording/parseRecording.ts` |
| Pull behavior and session resolution | `apps/node/src/domain/recording/pullRecording.ts` |
| Skills scaffold contract | `apps/node/src/domain/skills/scaffoldSkill.ts` |
| Skills CLI surface | `apps/node/src/cli/commands/skills.ts`, `apps/node/src/cli/registry.ts` |
| Existing recording parser tests | `apps/node/src/test/unit/parseRecording.test.ts` |
| Existing skills tests | `apps/node/src/test/unit/skills.test.ts` |
| Public recording docs | `docs/api/recording.md` |
| Public skill-authoring docs | `docs/skills/authoring.md` |
| Public docs workflow | `.agents/skills/docs-author/SKILL.md`, `.agents/skills/docs-build/SKILL.md` |

## Deterministic Versus Judgment

### Deterministic (computed, not re-derived downstream)

- NDJSON header validation
- Raw event validation and event ordering by `seq`
- Exported event shape per raw event type
- `deltaMsSincePrevious` calculation
- package-transition detection based on adjacent events that expose
  `packageName`
- event counts by type
- snapshot presence detection
- default output path for exported JSON
- recording-context copy path inside a newly scaffolded skill folder

### Judgment (requires human or external-agent review)

- How an exported recording should become a reusable skill
- Which recorded literals should become runtime inputs
- Which selectors are stable enough for long-term reuse
- Whether a recorded flow should be split into probe / flow / action skills
- The explanatory wording in authored docs and examples

## Decision Rules

### Recording command behavior

| Situation | Rule |
| --- | --- |
| User wants current step-log behavior | Keep using `recording parse`; do not change its output contract |
| User wants agent-authoring context | Use new `recording export` path |
| Input source for export in v1 | Require `--input <local_ndjson_file>`; do not add direct device/session export in this task |
| Output path omitted | Replace a trailing `.ndjson` suffix with `.export.json`; otherwise append `.export.json` |
| Explicit `--out` parent directories | Create parent directories recursively before writing the export file. If directory creation or file write fails, return `RECORDING_EXPORT_FAILED` |
| Snapshot flag omitted | Default to `--snapshots omit` so the export is usable as agent context without embedding raw XML blobs by default |

### Export-content rules

| Topic | Rule |
| --- | --- |
| Event coverage | Export every validated raw event type; do not drop `scroll`, `text_change`, or `press_key` |
| Ordering | Sort by `seq` before deriving deltas or transitions |
| Snapshot handling | Support `omit` and `include` modes only in this task. `omit` keeps `present: true/false` but writes `xml: null`. `include` preserves raw XML string. Do not parse into heuristically chosen selectors |
| Snapshot presence flag | `snapshot.present` is `true` when the raw event snapshot is a non-empty string. It is `false` when the raw snapshot is `null`, `undefined`, absent, or an empty string |
| Package transitions | Detect transitions by scanning adjacent package-bearing events in seq order. Events without `packageName` (for example `press_key`) are skipped for transition comparison |
| Unsupported / malformed event | Fail with existing recording parse error semantics rather than silently skipping |
| Shared validation | Extract a shared validation helper named for validation / parsing, not export. It must return `{ header, events }`, sort events by `seq`, preserve current line-numbered validation messages, and throw the same plain `{ code, message }` objects that the current parser throws. It must not print to stderr and it must not return parser-only warnings |
| Export versioning | `exportVersion` tracks the Node exporter's output shape. `session.schemaVersion` tracks the Android recorder's input shape. A single export version may support multiple schema versions only when the output shape remains backward-compatible |
| Empty recordings | A header-only NDJSON recording is valid. Export it as `events: []`, `counts.totalEvents: 0`, `counts.byType: {}`, `packageTransitions: []`, and `timeline.firstEventTs`, `timeline.lastEventTs`, `timeline.durationMs` set to `null` |
| Duration semantics | `timeline.durationMs` is `lastEventTs - firstEventTs`. It is the event span, not the session span from `session.startedAt` |
| Transition timestamp and seq | Package-transition records use the `seq` and `ts` of the arriving package-bearing event, not the departing event |
| Timeline field types | `timeline.firstEventTs`, `timeline.lastEventTs`, and `timeline.durationMs` are typed as `number | null`, not optional numbers |
| Count map type | `counts.byType` is typed as `Record<string, number>` so empty recordings can emit `{}` and future event types do not require a closed enum expansion |

### Exported event-shape rules

| Event type | Exported fields |
| --- | --- |
| `window_change` | `seq`, `ts`, `deltaMsSincePrevious`, `type`, `packageName`, `className`, `title`, `snapshot` |
| `click` | `seq`, `ts`, `deltaMsSincePrevious`, `type`, `packageName`, `resourceId`, `text`, `contentDesc`, `bounds`, `snapshot` |
| `scroll` | `seq`, `ts`, `deltaMsSincePrevious`, `type`, `packageName`, `resourceId`, `scrollX`, `scrollY`, `maxScrollX`, `maxScrollY`, `snapshot` |
| `press_key` | `seq`, `ts`, `deltaMsSincePrevious`, `type`, `key`, `snapshot` |
| `text_change` | `seq`, `ts`, `deltaMsSincePrevious`, `type`, `packageName`, `resourceId`, `text`, `snapshot` |

Rule:
- Exported events preserve the raw event fields for their type, except raw
  `snapshot?: string | null` is replaced by `snapshot: { present, xml }`.
- No event type gets selector inference, normalization into steps, or
  additional meaning beyond the deterministic derived fields above.

### Skill scaffold integration rules

| Situation | Rule |
| --- | --- |
| `skills new` without `--recording-context` | Keep existing scaffold behavior |
| `skills new` with `--recording-context <file>` | Copy the file verbatim into the scaffolded skill folder |
| Missing recording-context source file | Fail with `SKILLS_SCAFFOLD_FAILED` and a message that names the missing source path |
| Blank recording-context source path | Fail with `SKILLS_SCAFFOLD_FAILED`; blank strings are invalid input, not omitted input |
| Recording-context destination | `skills/<skill_id>/recording-context.json` |
| `skill.json.artifacts` field | Leave unchanged; recording context is a reference file, not a compiled runtime artifact |
| Scaffolded `run.js` | Do not derive flow logic from the recording context |
| `skills validate` coverage | Do not extend `skills validate` in this task to inspect `recording-context.json`. Validation continues to cover registry-linked skill files only |

## Failure Modes To Prevent

1. **Brain leakage.** The exporter must not infer intent, choose "best"
   selectors, or auto-generate skill steps.
2. **Silent data loss.** The richer export path must not quietly drop supported
   raw event types.
3. **Contract confusion.** `recording parse` and `recording export` must remain
   distinct; do not mutate `parse` into the new format.
4. **Artifact misuse.** The copied recording context must not be treated as a
   runtime recipe artifact.
5. **JSON contract drift.** CLI output and file-output shapes must be pinned by
   tests for valid, invalid, and missing-input cases.
6. **Docs overclaim.** Public docs must describe the export as evidence for an
   external agent, not as automatic skill authoring inside Clawperator.
7. **Build / test staleness.** Node tests run compiled `dist/` output; build
   before test every time.
8. **Agent-context overload.** The default export must not embed megabytes of
   snapshot XML into the file when the user only needs a timeline and event
   metadata view.

## Output Contract

### CLI surface

```text
clawperator recording export --input <file> [--out <file>] [--snapshots <omit|include>] [--output <json|pretty>]
clawperator record export --input <file> [--out <file>] [--snapshots <omit|include>] [--output <json|pretty>]
```

Success wrapper:

```json
{
  "ok": true,
  "outputFile": "./recordings/demo-session.export.json",
  "sessionId": "demo-session",
  "eventCount": 5,
  "packageTransitionCount": 1,
  "byType": {
    "window_change": 1,
    "click": 1,
    "scroll": 1,
    "press_key": 1,
    "text_change": 1
  }
}
```

### Exported file shape

```json
{
  "exportVersion": 1,
  "session": {
    "sessionId": "demo-session",
    "schemaVersion": 1,
    "operatorPackage": "com.clawperator.operator.dev",
    "startedAt": 1710000000000
  },
  "timeline": {
    "firstEventTs": 1710000000100,
    "lastEventTs": 1710000005200,
    "durationMs": 5100
  },
  "counts": {
    "totalEvents": 5,
    "byType": {
      "window_change": 1,
      "click": 1,
      "scroll": 1,
      "press_key": 1,
      "text_change": 1
    }
  },
  "packageTransitions": [
    {
      "seq": 4,
      "ts": 1710000004200,
      "fromPackageName": "com.example.source",
      "toPackageName": "com.example.search"
    }
  ],
  "events": [
    {
      "seq": 0,
      "ts": 1710000000100,
      "deltaMsSincePrevious": null,
      "type": "window_change",
      "packageName": "com.example.source",
      "className": "com.example.SourceActivity",
      "title": "Source",
      "snapshot": {
        "present": true,
        "xml": null
      }
    },
    {
      "seq": 1,
      "ts": 1710000001900,
      "deltaMsSincePrevious": 1800,
      "type": "click",
      "packageName": "com.example.source",
      "resourceId": "com.example.source:id/refresh",
      "text": "Refresh",
      "contentDesc": null,
      "bounds": {
        "left": 840,
        "top": 220,
        "right": 1020,
        "bottom": 360
      },
      "snapshot": {
        "present": false,
        "xml": null
      }
    },
    {
      "seq": 2,
      "ts": 1710000002600,
      "deltaMsSincePrevious": 700,
      "type": "scroll",
      "packageName": "com.example.source",
      "resourceId": "com.example.source:id/feed",
      "scrollX": 0,
      "scrollY": 640,
      "maxScrollX": 0,
      "maxScrollY": 3200,
      "snapshot": {
        "present": false,
        "xml": null
      }
    },
    {
      "seq": 3,
      "ts": 1710000003200,
      "deltaMsSincePrevious": 600,
      "type": "press_key",
      "key": "back",
      "snapshot": {
        "present": false,
        "xml": null
      }
    },
    {
      "seq": 4,
      "ts": 1710000004200,
      "deltaMsSincePrevious": 1000,
      "type": "text_change",
      "packageName": "com.example.search",
      "resourceId": "com.example.source:id/search",
      "text": "thermostat",
      "snapshot": {
        "present": true,
        "xml": null
      }
    }
  ]
}
```

Empty recording example:

```json
{
  "exportVersion": 1,
  "session": {
    "sessionId": "empty-session",
    "schemaVersion": 1,
    "operatorPackage": "com.clawperator.operator.dev",
    "startedAt": 1710000000000
  },
  "timeline": {
    "firstEventTs": null,
    "lastEventTs": null,
    "durationMs": null
  },
  "counts": {
    "totalEvents": 0,
    "byType": {}
  },
  "packageTransitions": [],
  "events": []
}
```

### Skill scaffold success extension

When `skills new --recording-context <file>` succeeds, the returned success
payload must include the copied file in the `files` array and expose
`recordingContextPath` as an explicit field.

### Export failure codes

- Use existing recording parse failure codes for malformed input:
  - `RECORDING_PARSE_FAILED`
  - `RECORDING_SCHEMA_VERSION_UNSUPPORTED`
- Add `RECORDING_EXPORT_FAILED` for export-stage failures such as unwritable
  output paths or failed file serialization.
- Keep recording-validation throws compatible with current parser behavior:
  plain `{ code, message }` objects, not `Error` instances.

## Known Limitations

- The export path still reads the entire NDJSON file into memory in v1.
- `--snapshots include` can produce very large output files for long recordings.
- Streaming export and snapshot-summary modes are explicitly out of scope for
  this task.

## Idempotency

- Re-running `recording export` for the same NDJSON input yields the same file
  content except for path formatting differences caused by the chosen `--out`
  value.
- Re-running `skills new` with the same `skill_id` still fails with
  `SKILL_ALREADY_EXISTS`; this task does not change that behavior.
- Export output is read-only derived data. No source NDJSON content is modified.

## Durable Follow-Up

| Knowledge | Permanent home |
| --- | --- |
| Recording export types and builder contract | `apps/node/src/domain/recording/` |
| Recording CLI usage and examples | `apps/node/src/cli/registry.ts`, `docs/api/recording.md` |
| Skill scaffold recording-context flag behavior | `apps/node/src/domain/skills/scaffoldSkill.ts`, `docs/skills/authoring.md` |
| Public workflow guidance | `docs/api/recording.md`, `docs/skills/authoring.md` |
