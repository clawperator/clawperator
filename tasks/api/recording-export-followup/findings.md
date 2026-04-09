# Recording Export Follow-up Findings

## Purpose

Track the follow-up items that remain after the recording-export agent-context
task shipped. Durable product behavior notes were moved into the public docs.
This file keeps only the follow-up work that still needs decisions or code.

## Sources

- Live validation notes previously captured during the completed
  `recording-export-agent-context` task
- `docs/api/recording.md`
- `docs/skills/authoring.md`

## Follow-up Candidates

### 1. Add `recording status`

Problem:

- stale-session recovery is now much better because `recording start` returns
  `sessionId`, `filePath`, and a concrete stop hint
- there is still no proactive way to ask the runtime which recording session is
  currently open on a device

Suggested scope:

- add `recording status --device <id> --operator-package <pkg>`
- return:
  - active session id
  - on-device file path
  - whether the operator considers the session open
  - optional event count if cheap to obtain

### 2. Return `resolvedInputFile` from `recording export`

Problem:

- directory-input export now works correctly, but the success payload only
  returns `outputFile`
- callers cannot see which NDJSON file was selected when `--input` points at a
  directory

Suggested scope:

- add `resolvedInputFile` to successful export responses

Benefits:

- easier provenance tracking
- easier debugging of directory autodiscovery
- fewer follow-up filesystem inspections by agents

### 3. Define same-device concurrency behavior for recording commands

Problem:

- sequential stale-session behavior is clear and tested
- concurrent `recording start` or `recording stop` calls against the same
  device are not clearly documented as supported or unsupported

Suggested scope:

- choose one policy and pin it in docs and tests:
  - unsupported: reject concurrent same-device recording control calls with a
    local conflict error
  - supported: guarantee distinct per-command correlation and envelopes under
    concurrency

### 4. Consider a higher-level CLI regression for pull-then-export

Problem:

- directory export itself is covered
- the most user-realistic flow is still:
  1. `recording stop`
  2. `recording pull --out <dir>`
  3. `recording export --input <same dir>`

Suggested scope:

- add a higher-level CLI regression around that exact flow using CLI-shaped
  artifacts

## Notes

- Public documentation now covers:
  - directory-input export path behavior
  - `parse` versus `export` intent
  - snapshot size tradeoffs for `omit` versus `include`
  - the fact that recordings reflect observed runtime events rather than a
    guaranteed one-event-per-command mapping
- This follow-up file should stay task-scoped. If any item becomes committed
  product behavior, migrate it into the durable docs and then delete it here.
