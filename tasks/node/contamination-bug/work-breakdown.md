# Snapshot XML Contamination Fix Work Breakdown

Parent plan: `tasks/node/contamination-bug/plan.md`

## Executive Summary

One PR, three phases. Phase 1 audits the extraction, post-processing, and
logging boundaries and appends any new evidence to `findings.md`. Phase 2
implements the extractor fix with regression tests in the same commit. Phase 3
performs live validation, checks shared API surfaces, updates authored docs if
needed, and records final validation notes.

## Status

| Item | Value |
| --- | --- |
| State | planning |
| Total PRs | 1 |
| Total phases | 3 |
| Completed | none |
| Remaining | 1, 2, 3 |
| Current / Next | Phase 1 |
| Blockers | none |

## Hard Rules

- Read the required files in order before editing code.
- Do not add or change CLI output formats for this task.
- Do not change the `ResultEnvelope` shape or move snapshot XML out of
  `stepResults[].data.text`.
- Do not edit Android hierarchy logging unless Node-only hardening proves
  insufficient and the reason is recorded in `findings.md`.
- Do not change unified logger routing, terminal routing, `clawperator logs`,
  or EventEmitter/SSE behavior.
- Do not write diagnostics to stdout in JSON mode.
- Add the contamination regression tests in the same phase and commit as the
  extractor behavior change. Do not defer tests.
- Build before running Node tests. Do not run build and test in parallel.
- Use the branch-local CLI for live checks:
  `node apps/node/dist/cli/index.js`.
- When multiple devices are connected, pass `--device <device_serial>` and use
  `--operator-package com.clawperator.operator.dev` unless validating release
  behavior explicitly.
- Append live validation notes to `findings.md` before the Phase 3 commit.
- Do not edit `sites/docs/.build/` or `sites/docs/site/` directly. If docs
  change, edit authored docs and run `./scripts/docs_build.sh`.
- If implementation deviates from `plan.md`, update `plan.md` first and explain
  the deviation in `findings.md`.

## Required Reading

Read these files IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `tasks/node/contamination-bug/plan.md` | Stable contract, scope boundaries, and decision rules |
| `tasks/node/contamination-bug/findings.md` | Live reproduction evidence and current hypothesis |
| `docs/internal/design/unified-logging.md` | Logging architecture boundaries that must not regress |
| `apps/node/src/domain/executions/snapshotHelper.ts` | Primary behavior to fix |
| `apps/node/src/test/unit/snapshotHelper.test.ts` | Existing coverage to preserve and extend |
| `apps/node/src/domain/executions/runExecution.ts` | Shared post-processing path that attaches snapshots to step results |
| `apps/node/src/test/unit/runExecution.test.ts` | Attachment and extraction-failure tests |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/TaskScopeDefault.kt` | Android hierarchy log emission source |
| `apps/android/shared/data/task/src/main/kotlin/clawperator/task/runner/UiActionEngine.kt` | Android `snapshot_ui` metadata behavior |
| `apps/node/src/contracts/result.ts` | Result envelope contract to preserve |
| `apps/node/src/cli/commands/serve.ts` | Serve `/snapshot` caller of shared runExecution path |
| `apps/node/src/mcp/tools/core.ts` | MCP snapshot and execute callers of shared runExecution path |
| `.agents/skills/docs-author/SKILL.md` | Required workflow if authored public docs need updates |
| `docs/api/snapshot.md` | Public snapshot extraction and troubleshooting docs |

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Fix snapshot XML contamination and validate shared surfaces | 1, 2, 3 | thinking, default, default | none |

## Phase 1: Extraction and Logging Boundary Audit

### Agent Tier

thinking

### Goal

Confirm the exact fix boundary before editing code, with special attention to
project logging behavior so the implementation does not regress unified
logging, JSON cleanliness, or SSE separation.

### Files or Surfaces To Change

- `tasks/node/contamination-bug/findings.md`

### Steps

1. Read all required files in order.
2. Inspect `snapshotHelper.ts` and identify every current accepted input shape:
   - `D/E       : ...`
   - `D/TaskScopeDefault: ...`
   - raw untagged message lines from tests or callers
   - rejected historical `TaskScopeDefault:` marker payloads
3. Inspect `runExecution.ts` and confirm whether snapshot extraction still
   happens only after a successful result envelope with at least one
   `snapshot_ui` step.
4. Inspect `docs/internal/design/unified-logging.md`, `contracts/logging.ts`,
   and `adapters/logger.ts` only far enough to confirm this task should not
   change logger routing or terminal output.
5. Inspect `serve.ts` and `mcp/tools/core.ts` to confirm they consume the shared
   `runExecution()` result rather than owning separate extraction logic.
6. Append a `Phase 1 Audit Notes` section to `findings.md` with:
   - accepted logcat input shapes found in tests or code
   - protected logging boundaries
   - shared surfaces that inherit the fix through `runExecution()`
   - any implementation constraints discovered
7. Stop and update `plan.md` if the audit proves the existing plan is wrong.

### Acceptance Criteria

- `findings.md` has a `Phase 1 Audit Notes` section.
- The notes identify the logcat shapes that Phase 2 tests must preserve.
- The notes explicitly state that unified logger routing and SSE are out of
  scope unless later evidence proves otherwise.
- No runtime code changes are made in this phase.

### Validation

```bash
git diff -- tasks/node/contamination-bug/findings.md
```

Human review checklist:

- Output accuracy: audit claims are traceable to the required reading files.
- Scope completeness: Node extraction, serve, MCP, and logging boundaries are
  covered.
- Evidence grounding: no claim relies on memory instead of code or findings.
- Format compliance: the appended section is easy to scan.

### Expected Commit

```text
docs(tasks): audit snapshot contamination fix boundary
```

## Phase 2: Tag-Aware Snapshot Extraction and Regression Tests

### Agent Tier

default

### Goal

Fix the extractor so interleaved non-snapshot logcat lines cannot contaminate
`data.text`, and prove the behavior with focused tests in the same commit.

### Files or Surfaces To Change

- `apps/node/src/domain/executions/snapshotHelper.ts`
- `apps/node/src/test/unit/snapshotHelper.test.ts`
- `apps/node/src/test/unit/runExecution.test.ts` if parser-only tests do not
  prove attachment behavior strongly enough

### Steps

1. Refactor `snapshotHelper.ts` to preserve logcat source identity. Prefer a
   small internal parsed-line shape such as `{ raw, level, tag, message }`.
2. Start a snapshot only from a parsed line whose message contains
   `[TaskScope] UI Hierarchy:`.
3. Store the source identity from the marker line and append subsequent snapshot
   lines only when they come from the same compatible source.
4. Ignore different-tag logcat lines while a snapshot block is open. Do not
   append their messages to `currentSnapshotLines`.
5. Continue to terminate a snapshot when `</hierarchy>` is seen from the active
   snapshot source.
6. Preserve existing behavior for valid abbreviated fixtures unless Phase 1
   notes justify an intentional change.
7. Add required unit test cases in `snapshotHelper.test.ts`.

Required test cases:

- `D/TaskScopeDefault` hierarchy with an interleaved
  `V/Configuration: Updating configuration...` line returns XML without the
  configuration message.
- The same case with two interleaved `V/Configuration` lines at different
  depths still returns one clean XML snapshot.
- Existing `D/E       : ...` abbreviated fixture still extracts successfully.
- A line with colons inside an XML attribute still preserves the full XML
  content.
- A non-snapshot log line before the `[TaskScope] UI Hierarchy:` marker is
  ignored.
- A non-snapshot log line after `</hierarchy>` does not alter the completed
  snapshot.
- Multiple snapshots in one log stream still preserve order and
  `extractSnapshotFromLogs()` still returns the latest snapshot.
- Historical `TaskScopeDefault:` payload marker remains rejected unless Phase 1
  documented a deliberate contract change.

8. Add a `runExecution.test.ts` case only if needed to prove attachment behavior
   from noisy logcat dumps to successful `snapshot_ui` steps. Use the existing
   `FakeProcessRunner` pattern if adding this coverage.
9. Build and run the Node tests.
10. Inspect the diff to confirm no result-envelope shape, CLI output format, or
    logger routing changed.

### Acceptance Criteria

- Interleaved different-tag log lines are not present in extracted XML.
- Existing supported logcat shapes continue to pass.
- Regression tests fail on the old implementation and pass on the new one.
- Tests live in the same commit as the extractor change.
- No CLI output mode or result-envelope shape changes are included.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

Optional targeted check during iteration:

```bash
npm --prefix apps/node run build
node --test apps/node/dist/test/unit/snapshotHelper.test.js
```

Human review checklist:

- Output accuracy: test names describe the contamination scenario precisely.
- Scope completeness: compatibility cases are preserved, not only the new noisy
  case.
- Evidence grounding: implementation follows Phase 1 audit notes.
- Format compliance: code comments are minimal and explain only non-obvious
  parsing rules.

### Expected Commit

```text
fix(node): prevent snapshot logcat contamination
```

## Phase 3: Shared Surface Validation and Docs

### Agent Tier

default

### Goal

Prove the fixed extractor works through the real shared surfaces, then update
authored docs only if the implementation changes documented extraction behavior.

### Files or Surfaces To Change

- `tasks/node/contamination-bug/findings.md`
- `docs/api/snapshot.md` if extraction behavior wording changes
- generated docs outputs only via `./scripts/docs_build.sh` if authored docs
  change

### Steps

1. Build the branch-local Node CLI:
   ```bash
   npm --prefix apps/node run build
   ```
2. Check devices and choose an explicit target. Prefer a physical device if
   available:
   ```bash
   node apps/node/dist/cli/index.js devices --output pretty
   adb devices
   ```
3. Run a physical-device or emulator snapshot using the debug Operator package:
   ```bash
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --output pretty \
     --timeout 10000
   ```
4. Parse the snapshot result and assert contamination is absent. Save the output
   to a temporary file under `/tmp` if useful:
   ```bash
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --output json \
     --timeout 10000 > /tmp/clawperator-snapshot-contamination-check.json
   node -e '
   const fs = require("fs");
   const result = JSON.parse(fs.readFileSync("/tmp/clawperator-snapshot-contamination-check.json", "utf8"));
   const text = result.envelope.stepResults.find((step) => step.actionType === "snapshot_ui")?.data?.text ?? "";
   if (!text.includes("<hierarchy")) throw new Error("snapshot text missing hierarchy");
   if (text.includes("Updating configuration")) throw new Error("snapshot text still contains Configuration log noise");
   console.log("snapshot XML contamination check passed");
   '
   ```
5. Run an `exec` payload containing `snapshot_ui` through the same branch-local
   CLI and repeat the contamination check on the returned `data.text`.
6. If practical, validate one additional shared surface:
   - `serve` API `POST /snapshot`, or
   - MCP snapshot tooling if an MCP harness is already configured.
   Do not invent a large harness if unit and CLI validation already prove the
   shared `runExecution()` path.
7. Check JSON stdout cleanliness by piping JSON mode to a parser:
   ```bash
   node apps/node/dist/cli/index.js snapshot \
     --device <device_serial> \
     --operator-package com.clawperator.operator.dev \
     --output json \
     --timeout 10000 | node -e 'let s=""; process.stdin.on("data", c => s += c); process.stdin.on("end", () => JSON.parse(s));'
   ```
8. Inspect `docs/api/snapshot.md`. If it still accurately describes the
   behavior, record that no docs update was needed in `findings.md`. If the
   implementation changed documented extraction behavior, update only authored
   docs and use `.agents/skills/docs-author/SKILL.md` for that substep.
9. If docs changed, run:
   ```bash
   ./scripts/docs_build.sh
   ```
10. Append a `Phase 3 Validation Notes` section to `findings.md` with:
    - device used, with placeholders in committed text such as
      `<device_serial>`
    - exact commands run
    - contamination check result
    - surfaces validated
    - docs decision
    - any residual risk

### Acceptance Criteria

- Branch-local `snapshot` returns `data.text` with `<hierarchy` and without the
  reproduced `Updating configuration` contamination.
- Branch-local `exec` with `snapshot_ui` returns clean `data.text`.
- JSON output mode remains parseable.
- At least one shared surface beyond the direct parser unit tests is validated.
- `findings.md` records final validation with placeholders for device IDs.
- Authored docs are updated and docs build passes if the implementation changed
  documented behavior.

### Validation

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
```

If docs changed:

```bash
./scripts/docs_build.sh
```

Live validation commands are listed in the phase steps and require a connected
device or emulator with the debug Operator installed and accessible.

Human review checklist:

- Output accuracy: final notes do not include personal names, raw device IDs, or
  unredacted local-only details.
- Scope completeness: direct snapshot, exec, JSON cleanliness, and docs decision
  are covered.
- Evidence grounding: validation claims cite commands actually run.
- Format compliance: findings remain a running audit trail, not a second plan.

### Expected Commits

If no docs change is needed:

```text
test(node): validate snapshot contamination fix
```

If docs change is needed:

```text
docs(node): clarify snapshot logcat extraction hardening
```
