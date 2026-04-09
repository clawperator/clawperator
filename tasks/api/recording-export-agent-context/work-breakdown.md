# Recording Export Agent Context Work Breakdown

Parent plan: `tasks/api/recording-export-agent-context/plan.md`

## Executive Summary

1 PR, 4 phases. Phase 1 locks the export contract and test cases. Phase 2 adds
the richer recording export builder plus CLI wiring. Phase 3 extends `skills
new` with deterministic recording-context attachment only. Phase 4 validates the
workflow on a real recording and updates public docs using the repo docs skills.

| PR | Phases | Agent tier | Purpose |
| --- | --- | --- | --- |
| PR-1 | 1, 2, 3, 4 | thinking, default, default, default | Export contract, implementation, scaffold integration, docs and proof |

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 4 |
| Completed | 0 |
| Remaining | 4 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

1. Keep Clawperator as the hand. Do not add intent inference, selector ranking,
   parameter extraction, or automatic skill generation.
2. Do not change `recording parse` output semantics in this task. The richer
   export path is additive.
3. Use `--snapshots omit` as the default export mode. Snapshot XML is opt-in
   via `--snapshots include`.
4. Build before test. Run `npm --prefix apps/node run build` before every
   `npm --prefix apps/node run test` invocation. Never run them in parallel.
5. Add tests in the same phase that introduces behavior. Do not defer tests to a
   later cleanup phase.
6. Preserve every supported raw event type in the export path. Do not silently
   drop `scroll`, `text_change`, or `press_key`.
7. Do not edit `sites/docs/.build/` or `sites/docs/site/` directly. Author docs
   in `docs/`, then regenerate.
8. Use the branch-local build from `apps/node/` for all validation, not the
   globally installed `clawperator` binary.
9. Keep the recording-context copy verbatim. Do not rewrite, normalize, or
   summarize the exported JSON during scaffold copy.
10. Leave `skill.json.artifacts` unchanged for this task. The recording context
   is a reference file, not a recipe artifact.
11. If a phase uncovers a plan deviation, update `plan.md` first, then continue.
    Do not silently drift.
12. One commit per phase. Do not batch unrelated changes.
13. Never shorten `Clawperator` to `Claw` in code, docs, comments, or commit
    messages.
14. For the live validation phase, prefer the debug Operator APK and pass
    `--operator-package com.clawperator.operator.dev`.
15. Create `tasks/api/recording-export-agent-context/findings.md` at the start
    of Phase 4 using the structure below. Do not invent the format during
    execution.
16. Add `--recording-context` to the `skills new` supported-flags surface in
    `apps/node/src/cli/registry.ts`. Do not rely on ad hoc parsing alone.
17. Add `--snapshots` to the `recording export` supported-flags surface in
    `apps/node/src/cli/registry.ts`. Do not rely on ad hoc parsing alone.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| Order | File | Why it matters |
| --- | --- | --- |
| 1 | `tasks/api/recording-export-agent-context/plan.md` | Stable contract, export boundary, output shape |
| 2 | `apps/node/src/domain/recording/recordingEventTypes.ts` | Authoritative raw event schema |
| 3 | `apps/node/src/domain/recording/parseRecording.ts` | Current lossy parser behavior that must stay intact |
| 4 | `apps/node/src/cli/commands/record.ts` | Existing recording CLI implementation |
| 5 | `apps/node/src/cli/registry.ts` | Recording help text and command-surface source of truth |
| 6 | `apps/node/src/domain/skills/scaffoldSkill.ts` | Current `skills new` scaffold behavior |
| 7 | `apps/node/src/cli/commands/skills.ts` | Skills CLI wiring and argument handling |
| 8 | `apps/node/src/test/unit/parseRecording.test.ts` | Existing parser test style and fixture patterns |
| 9 | `apps/node/src/test/unit/skills.test.ts` | Existing scaffold / skills CLI coverage patterns |
| 10 | `.agents/skills/docs-author/SKILL.md` | Required workflow for authored public docs changes |
| 11 | `.agents/skills/docs-build/SKILL.md` | Required workflow for docs regeneration / validation |
| 12 | `CLAUDE.md` | Repo validation rules, commit conventions, surface boundaries |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Full recording-export workflow | 1, 2, 3, 4 | thinking, default, default, default | `npm --prefix apps/node run build && npm --prefix apps/node run test` passes; docs build passes; live export workflow validated if debug Operator device is available |

## Phase 1: Lock the export contract and test matrix

### Agent Tier

thinking

### Goal

Define the new export types, CLI shape, default path rules, and required tests
before implementation so downstream phases do not re-derive the format.

### Files or Surfaces To Change

- `tasks/api/recording-export-agent-context/plan.md` (only if contract needs correction before code)
- `apps/node/src/domain/recording/recordingEventTypes.ts`
- `apps/node/src/test/unit/parseRecording.test.ts` (only if new shared fixtures or types belong there)
- `apps/node/src/test/unit/recordingExport.test.ts` (new)

### Steps

1. Re-read the required reading files in order.
2. Extend `recordingEventTypes.ts` with explicit export types for:
   - export root object
   - per-event export object
   - package transition object
   - counts object
3. Keep the types factual. Do not add fields that imply selector choice,
   parameterization, or intent.
4. Create a new shared-validation plan in code comments or docstrings for a
   `recordingValidation.ts` helper that returns `{ header, events }`.
5. Do not add test imports that require a non-existent `exportRecording.ts`
   module in this phase. The test file lands in Phase 2 with the implementation.
6. Required cases to implement in Phase 2:
   - valid mixed-event recording exports all supported event types
   - events are sorted by `seq` before delta / transition calculation
   - `deltaMsSincePrevious` is `null` for the first event and numeric thereafter
   - package transitions are emitted only when adjacent package-bearing events
     change package
   - `--snapshots omit` writes `present: true/false` and `xml: null`
   - `--snapshots include` preserves raw XML
   - written export file can be read back and matches the contract
   - malformed header fails
   - malformed event fails
   - unsupported schema version fails
   - export-stage output write failure emits `RECORDING_EXPORT_FAILED`
7. If contract changes are needed, update `plan.md` before proceeding.

### Acceptance Criteria

- Export types exist in `recordingEventTypes.ts`
- Shared-validation extraction approach is explicit and pinned to a dedicated
  helper module
- No export type field implies automatic skill generation or selector inference
- Any contract change is reflected in `plan.md` before later phases begin

### Validation

```bash
npm --prefix apps/node run build
```

### Expected Commit

```text
feat(node): define recording export types
```

## Phase 2: Implement `recording export`

### Agent Tier

default

### Goal

Add the export builder and new `recording export` CLI command that emits the
agent-context JSON artifact from a local NDJSON recording file.

### Files or Surfaces To Change

- `apps/node/src/domain/recording/exportRecording.ts` (new)
- `apps/node/src/domain/recording/recordingValidation.ts` (new)
- `apps/node/src/domain/recording/recordingEventTypes.ts`
- `apps/node/src/cli/commands/record.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/contracts/errors.ts`
- `apps/node/src/test/unit/recordingExport.test.ts`
- `apps/node/src/test/unit/cliRegistry.test.ts`
- `apps/node/src/test/unit/cliHelp.test.ts`

### Steps

1. Extract shared NDJSON validation into
   `apps/node/src/domain/recording/recordingValidation.ts` with a helper that
   returns `{ header, events }`.
2. Update `parseRecording.ts` to consume that helper without changing its
   current output semantics.
3. Implement `exportRecordingFile(inputFile, outputFile?, snapshotMode?)` and
   any pure helper functions in a new `exportRecording.ts`.
4. Add `RECORDING_EXPORT_FAILED` to `apps/node/src/contracts/errors.ts` for
   export-stage output failures.
5. Preserve all validated raw events in the exported `events` array.
6. Compute only the deterministic derived fields from `plan.md`:
   - sorted event order
   - `deltaMsSincePrevious`
   - counts
   - package transitions
7. Add `--snapshots <omit|include>` handling with `omit` as the default. Parse
   this flag with `getStringOpt`, not `getOpt`, so `--snapshots` with no value
   is a usage error.
8. Add `cmdRecordExport()` to `apps/node/src/cli/commands/record.ts`.
9. Wire `recording export` and `record export` help text and usage into
   `apps/node/src/cli/registry.ts`, including:
   - `supportedFlags` entry for `export` with `--input`, `--out`, and `--snapshots`
   - `topLevelBlock` line for `recording export`
   - bare-command USAGE message updated to `recording start|stop|pull|parse|export ...`
   - help text that explains syntax, output-path rule, and `--snapshots <omit|include>`
10. Keep `recording parse` semantics unchanged.
11. Treat the `parseRecording.ts` refactor as a parser-regression gate. All
    existing `apps/node/src/test/unit/parseRecording.test.ts` cases must pass
    without modification. If any existing parser test needs updating, stop and
    investigate before continuing.
12. Add CLI and unit tests for:
   - valid `recording export --input <file>`
   - explicit `--out`
   - explicit `--snapshots include`
   - omitted snapshots mode defaults to `omit`
   - `--snapshots` present with no value returns USAGE
   - `--snapshots foo` returns USAGE
   - missing `--input`
   - malformed NDJSON
   - unsupported schema version
   - output write failure
   - written export file can be read back and matches the contract
   - both execution paths: `recording export ...` and `record export ...`
   - help text routing for `recording export --help` and `record export --help`
13. Build and run Node tests.

### Acceptance Criteria

- `clawperator recording export --input <file>` writes `<input>.export.json`
  using the path rule from `plan.md`
- Success JSON wrapper matches the `plan.md` contract
- Export file preserves all supported event types
- Default export mode omits XML blobs while preserving snapshot presence facts
- `recording parse` test expectations remain unchanged
- All existing `parseRecording.test.ts` cases pass without modification
- CLI valid / invalid / missing-input cases are covered by tests
- `npm --prefix apps/node run build && npm --prefix apps/node run test`
  succeeds

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): add recording export command
```

## Phase 3: Attach recording context during `skills new`

### Agent Tier

default

### Goal

Extend scaffolded skills with an optional copied `recording-context.json`
reference file, while keeping skill generation decisions outside Clawperator.

### Files or Surfaces To Change

- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/cli/commands/skills.ts`
- `apps/node/src/cli/registry.ts`
- `apps/node/src/test/unit/skills.test.ts`

### Steps

1. Add an optional `recordingContextPath` input to the scaffold path.
2. If provided, copy the referenced export file verbatim into
   `skills/<skill_id>/recording-context.json`.
3. Extend scaffold success output with `recordingContextPath` and include the
   copied file in `files`.
4. Add `--recording-context <file>` to the `skills new` supported-flags list in
   `apps/node/src/cli/registry.ts`.
5. Update scaffolded `SKILL.md` starter text so it explains that the recording
   context is reference evidence for an external agent to use while authoring
   the skill.
6. Use this exact wording in the scaffold guidance section, adjusted only for
   surrounding formatting:
   - `This skill was scaffolded with recording context at \`recording-context.json\`.`
   - `Read that file to inspect the recorded interaction timeline and raw events.`
   - `The recording context is reference evidence, not an executable skill recipe.`
   - `An external agent or human author must write the reusable skill logic.`
7. Do not change the scaffolded `run.js` logic beyond wording that points users
   toward the recording context for manual / agent refinement.
8. Add skills tests for:
   - `skills new` without recording context remains unchanged
   - `skills new --recording-context <file>` copies the file
   - missing recording-context file fails deterministically
   - copied file path appears in success output
   - `skill.json.artifacts` remains unchanged
9. Build and run Node tests.

### Acceptance Criteria

- `skills new` default behavior is preserved when the new flag is omitted
- Recording context is copied verbatim to the exact path from `plan.md`
- No generated skill logic is derived from the recording export
- `skill.json.artifacts` remains unchanged
- Tests cover valid, invalid, and omitted-flag cases
- `npm --prefix apps/node run build && npm --prefix apps/node run test`
  succeeds

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

### Expected Commit

```text
feat(node): attach recording context to new skills
```

## Phase 4: Validate the workflow and update public docs

### Agent Tier

default

### Goal

Prove the export-to-skill-authoring workflow on one real recording when host
state permits, document the exact workflow in authored docs, and capture the
runtime evidence in `findings.md`.

### Files or Surfaces To Change

- `docs/api/recording.md`
- `docs/skills/authoring.md`
- `tasks/api/recording-export-agent-context/findings.md` (new, created in this phase only if runtime validation occurs)
- Generated docs outputs after authored docs updates

### Steps

1. Use `.agents/skills/docs-author/SKILL.md` for the authored-doc updates. Do
   not restate that workflow from scratch.
2. Update `docs/api/recording.md` to cover:
   - `recording export` command syntax
   - default output path rule
   - success wrapper shape
   - exported file contract
   - explicit boundary that export preserves evidence but does not author skills
3. Update `docs/skills/authoring.md` to cover:
   - `skills new --recording-context <file>`
   - copied file path
   - external-agent authoring workflow
   - explicit non-goals: no automatic skill generation inside Clawperator
4. If the docs build requires nav or source-map changes for the updated authored
   pages, update `sites/docs/source-map.yaml` and `sites/docs/mkdocs.yml` in
   this same phase. Do not assume those updates are unnecessary.
5. Create `tasks/api/recording-export-agent-context/findings.md` at the start
   of runtime validation with these sections:
   - `# Recording Export Findings`
   - `## Environment`
   - `## Commands Run`
   - `## Export Output Summary`
   - `## Skill Scaffold Summary`
   - `## Anomalies`
   - `## Open Questions`
6. If a debug Operator device is available:
   - run `recording start`
   - perform a short real interaction
   - run `recording stop`
   - run `recording pull`
   - run `recording export`
   - run `skills new --recording-context <export_file>`
   - capture outputs and any anomalies in `findings.md`
7. If a device is not available, note the host-state limitation in
   `findings.md` and treat the unit test suite as the primary gate. Still create
   the file so the skipped live path is auditable.
8. Use `.agents/skills/docs-build/SKILL.md` or the repo-standard build commands
   to regenerate and validate docs outputs after authored docs are updated.
9. Run the full validation set.

### Acceptance Criteria

- Authored docs describe the new workflow accurately and without overclaiming
- `findings.md` exists with the required sections
- Live validation is captured if host state permits; otherwise the skipped live
  path is documented explicitly
- `./scripts/docs_build.sh` succeeds
- `npm --prefix apps/node run build && npm --prefix apps/node run test`
  succeeds

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

Live validation when device state permits:

```bash
npm --prefix apps/node run build
node apps/node/dist/cli/index.js recording start --session-id export-demo --device <device_serial> --operator-package com.clawperator.operator.dev --json
node apps/node/dist/cli/index.js recording stop --session-id export-demo --device <device_serial> --operator-package com.clawperator.operator.dev --json
node apps/node/dist/cli/index.js recording pull --session-id export-demo --device <device_serial> --operator-package com.clawperator.operator.dev --json
node apps/node/dist/cli/index.js recording export --input ./recordings/export-demo.ndjson --json
node apps/node/dist/cli/index.js skills new com.example.app.from-recording --recording-context ./recordings/export-demo.export.json --json
```

### Expected Commit

```text
docs(recording): document export-to-skill workflow
```
