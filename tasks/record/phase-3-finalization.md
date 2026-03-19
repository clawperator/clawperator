# Record Feature - Phase 3 Finalization Checklist

This file captures the remaining work required to honestly close Phase 3.
The branch currently contains useful Phase 3 findings, but the phase is not
done until we complete the human-guided recording workflow, turn that workflow
into at least two validated skills, and move every durable note out of
`tasks/record/`.

## Current status

As of 2026-03-20, the Phase 3 skill-authorship loop is functionally complete.
The remaining work is the task-folder cleanup and any final link removal that
becomes necessary when `tasks/record/` is deleted.

- [x] Restore the completion criteria to reality
- [x] Prove the human-guided recording loop on a physical device
- [x] Repeat the workflow for a second distinct skill
- [x] Move durable knowledge out of `tasks/record/`
- [x] Update source-of-truth docs and regenerate the public docs site
- [ ] Clean up `tasks/record/` and remove any now-dead references

Practical readout:

- the recordings were human-performed, not adb-tapped
- at least two distinct recording-derived skills were authored and validated
- the durable lessons were migrated into long-lived docs
- the docs site was regenerated and validated
- the only remaining closeout step is deleting this task tree once nothing
  durable still depends on it

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

- Phase 3 aims to ship no new code. Everything it needs should already be on `main`.
  The only exception is if bugs are found during this phase.
- Use the branch-local Node CLI build and the `.dev` Operator APK when
  reproducing the validated skill-authorship workflow. The earlier assumption
  that Phase 3 would use the global binary and release APK was disproven by the
  actual validation runs.
- Use the connected physical Android device when one is available. The human
  recording steps must be performed with a real finger on the physical device
  - not via adb, not via emulator tap injection.
- The skills runtime does not yet support `CLAWPERATOR_BIN` or
  `CLAWPERATOR_RECEIVER_PACKAGE` as first-class env vars. That work is tracked
  in `tasks/skills/env/plan.md` and ships as a follow-on PR. Do not block
  Phase 3 on it and do not use undocumented workarounds as a substitute for
  the criteria.
- Keep any durable learning in `docs/` or `docs/design/`, not in `tasks/`.
- Do not delete `tasks/record/` until the durable docs migration is complete.
  Do not delete `tasks/skills/` - it is a separate active task.

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
- agent instructs the human to open Settings and tap through to check if there is a software update.
- stop recording
- pull the NDJSON
- parse the step log
- reproduce the flow step by step with live observation (discrete `execute`
  calls, `observe snapshot` between each step)
- reproduce the flow a **second consecutive time** from the same step log
  without re-recording - this is the repeatability bar, not a nice-to-have
- author a skill from that validated flow
- run the skill via `clawperator skills run` and confirm exit code 0

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
- Open the YouTube app, search for "first youtube video zoo", play the video, pause the video
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

Required permanent deliverables:

- **`docs/design/skill-from-recording.md`** - a new design note covering what
  Phase 3 proved: the recording pipeline works when recordings are
  human-performed; the correct usage model is agent-orchestrated, human-executed
  capture; and the open questions around a future `skills create --from-recording`
  surface or equivalent agent-guided capture workflow. This is the conceptual
  output of the PoC and belongs in `docs/design/` permanently.

- **`docs/troubleshooting.md`** - the adb tap limitation entry added in acf34ba
  is a keeper; verify nothing further is needed from the Phase 3 runs.

- **`docs/android-recording.md`** - confirm the page correctly reflects that
  recordings must be human-performed. The current page does not state this
  explicitly.

- **`docs/node-api-for-agents.md`** - two specific stale lines remain: the
  `start_recording` and `stop_recording` entries in the action type table still
  say "PoC-phase action, no host-side retrieval API yet." Phase 2 shipped the
  retrieval API. Update those entries to remove the stale hedge. Also remove the
  early-access note on the recording command section if Phase 3 validates cleanly.

If a note is only useful as historical project memory, delete it instead of
copying it forward.

### 5. Clean up `tasks/record/`

When the durable docs are in place and this checklist is no longer needed:

- delete `tasks/record/`
- remove any public-doc references that would become dead links
- regenerate the docs site
- verify the site build passes

## Exit criteria

Phase 3 is only done when all of the following are true:

- a physical-device human-guided recording has been completed end to end
- the recording has been pulled, parsed, and reproduced by an agent stepwise
- at least two distinct skills have been authored from recordings and both run
  successfully via `clawperator skills run` with exit code 0 (scaffolded-only
  artifacts do not count)
- the Phase 3 findings have been migrated into permanent docs including a new
  `docs/design/skill-from-recording.md`
- stale PoC-phase notes in `node-api-for-agents.md` have been corrected
- `tasks/record/` is removed
- docs-generate has been run and docs-validate passes clean
- `./scripts/docs_build.sh` completes without error

## Notes for the implementing agent

- Do not use the phase completion claim as a substitute for evidence.
- Do not treat a validation recording that reuses agent-driven taps as a Phase 3
  success.
- If a CLI or APK mismatch blocks the run, fix the environment first rather
  than weakening the criteria.
- If a new limitation is discovered, write it down in a permanent doc before
  deleting the task directory.
