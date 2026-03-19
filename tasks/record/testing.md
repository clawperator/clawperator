# Record Feature - API Validation Skill

## Purpose

Create a repeatable skill at `.agents/skills/test-recording-validate` that
smokes the recording APIs end to end:

1. start a recording
2. run the Play Store search skill
3. stop the recording
4. pull the recording to host
5. parse and validate the recording output

The skill exists so future agents can verify the recording surface without
hand-building the same workflow each time.

## Why this skill exists

The recording API is only valuable if it can be exercised reliably in a
real-world flow. A repeatable skill gives us:

- a stable smoke test for `recording start` / `recording stop`
- a deterministic way to prove `recording pull` works on a real device
- a parser validation path that checks the pulled NDJSON is structurally sane
- a reusable harness for future changes to the recording schema or CLI surface

## Required workflow

The skill should perform the following sequence:

1. Check connected devices and choose a target serial explicitly.
2. Start a recording session on that device.
3. Run the existing Play Store search skill from the skills repo
   (`skills/com.android.vending.search-app`) with the search term
   `Action Launcher`.
4. Wait for the skill to finish completely.
5. Stop the recording session.
6. Pull the recording output to a host directory.
7. Parse the pulled NDJSON into a step log.
8. Validate the resulting artifacts and report the findings.

## Validation expectations

The skill should confirm, at minimum:

- the start response contains a `sessionId`
- the stop response contains a non-zero `eventCount` when the flow produces
  interaction events
- the pull command writes a `.ndjson` file to the host
- the parse command writes a `.steps.json` file
- the parsed step log contains at least one `open_app` step and one `click`
  step for the Play Store flow
- the parsed step log includes `uiStateBefore` on each emitted step
- the step log has no structural parse errors

If the device or app behavior makes a `click` step unavailable, the skill
should report that clearly instead of treating the run as a false pass.

## Implementation considerations

- Prefer the canonical `recording` CLI family if available, but tolerate the
  `record` alias only if the implementation still needs it for compatibility.
- Always pass `--device-id` when more than one device is connected.
- Treat the Play Store search skill as an external dependency, not something to
  reimplement inside the new skill.
- Keep the skill deterministic: do not add branching heuristics beyond
  validating the outputs produced by the recording pipeline.
- Use a dedicated output directory under the skill workspace so repeated runs
  do not overwrite prior recordings.
- Preserve the raw `.ndjson` file as a debug artifact.
- Capture the parse stderr summary in the skill output or logs if possible, as
  it is useful for debugging whether the parser inferred the right steps.

## Device and app assumptions

- The connected Android device already has the Operator app installed and
  permissioned.
- The Play Store app is available on the device.
- The Play Store search skill can open Play Store reliably and search for
  `Action Launcher`.
- The recording should be taken on a physical device when one is available,
  because the goal is to validate the real runtime path, not only emulator
  behavior.

## Skill deliverables

The implementing agent should create:

- `.agents/skills/test-recording-validate/SKILL.md`
- a small runnable wrapper for the skill
- any supporting artifact files needed to keep the workflow repeatable
- a short note in `tasks/record/progress.md` describing the smoke result and
  any deviations from the expected flow

## Acceptance criteria

The skill is complete when:

- it runs the full start / record / stop / pull / parse workflow end to end
- it verifies the parsed output rather than just command exit codes
- it works repeatably on the same connected device
- it leaves behind a useful recording artifact that can be inspected later
- it records any anomalies in `tasks/record/progress.md`

## Notes for the implementing agent

- Do not modify Android runtime code for this task unless a bug in the smoke
  path makes the validation impossible.
- Do not hardcode a device serial in the skill.
- Do not assume the recording stream will always produce the same number of
  steps; validate the structure, not a brittle exact count.
- If the Play Store flow yields more than one click, that is acceptable as long
  as the parsed step log still validates and contains the expected core steps.
- Keep the skill focused on verification, not on introducing new recording
  behavior.
