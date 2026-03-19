# Record Feature - Phase 3 Finalization Checklist

This file captures the remaining work required to honestly close Phase 3.
The branch currently contains useful Phase 3 findings, but the phase is not
done until we complete the human-guided recording workflow, turn that workflow
into at least two validated skills, and move every durable note out of
`tasks/record/`.

## Why this exists

The branch review showed a real constraint: Clawperator-driven taps do not
produce the same accessibility events as human finger taps. That means Phase 3
is inherently human-in-the-loop. The correct closeout is not "the agent can
record itself"; it is:

1. the agent starts recording
2. the human performs the device steps
3. the agent stops, pulls, parses, and validates the recording
4. the agent authors a skill from the validated flow
5. the process is repeated for a second distinct flow

The phase is only complete when that workflow has been demonstrated and the
docs no longer imply that the task folder is still the source of truth.

## Working rules

- Use the branch-local Node CLI build from `apps/node/dist/cli/index.js`.
- Use the connected physical Android device when one is available.
- Prefer `com.clawperator.operator.dev` and pass `--receiver-package`
  explicitly for local validation.
- Do not fall back to the globally installed `clawperator` binary when testing
  branch-local API changes.
- Keep any durable learning in `docs/` or `docs/design/`, not in `tasks/`.
- Do not delete `tasks/record/` until the durable docs migration is complete.

## Required closeout sequence

### 1. Restore the completion criteria to reality

- Verify the PRD still reflects the actual Phase 3 gates.
- If the PRD or any review note softened the requirements, restore them before
  final merge.
- The final criteria must require a real human-guided recording session, not a
  reused validation trace.

### 2. Prove the human-guided recording loop on a physical device

Run a full end-to-end recording with the human performing the Android steps.

Minimum target flow:
- start recording
- agent instructs the human to open Settings and tap Display
- stop recording
- pull the NDJSON
- parse the step log
- reproduce the flow step by step with live observation
- author a skill from that validated flow
- run the skill successfully

What to capture:
- the start and stop outputs
- the pulled `.ndjson`
- the parsed `.steps.json`
- the skill artifact that reproduces the flow
- a short validation note in `tasks/record/progress.md`

### 3. Repeat the workflow for a second distinct skill

Repeat the same human-guided workflow for a different app or flow so the phase
cannot be dismissed as a one-off.

Suggested second flow:
- Play Store search or another stable, observable app path
- the recording should again be human-performed, not adb-tapped
- the resulting skill should be stored locally and run successfully

The point is to prove that recording-to-skill is a general workflow, not a
single hard-coded demo.

### 4. Move durable knowledge out of `tasks/record/`

Before deleting the task directory, migrate any remaining durable knowledge to
long-term docs:

- the human-in-the-loop workflow and what Phase 3 actually proved
- the adb tap limitation and why recorded flows must be human-driven
- any remaining recorder / parser / skill-authoring caveats that future agents
  need after the task folder is deleted

Likely permanent homes:
- `docs/design/`
- `docs/troubleshooting.md`
- `docs/android-recording.md`
- `docs/node-api-for-agents.md`

If a note is only useful as historical project memory, delete it instead of
copying it forward.

### 5. Clean up `tasks/record/`

When the durable docs are in place:

- delete `tasks/record/`
- remove any public-doc references that would become dead links
- regenerate the docs site
- verify the site build passes

## Exit criteria

Phase 3 is only done when all of the following are true:

- a physical-device human-guided recording has been completed end to end
- the recording has been pulled, parsed, and reproduced by an agent stepwise
- at least two distinct skills have been authored from recordings and run
  successfully
- the Phase 3 findings have been migrated into permanent docs
- `tasks/record/` is removed
- docs generation and docs build validation are clean

## Notes for the implementing agent

- Do not use the phase completion claim as a substitute for evidence.
- Do not treat a validation recording that reuses agent-driven taps as a Phase 3
  success.
- If a CLI or APK mismatch blocks the run, fix the environment first rather
  than weakening the criteria.
- If a new limitation is discovered, write it down in a permanent doc before
  deleting the task directory.
