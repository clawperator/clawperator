# Recording Demo Plan

Created: 2026-04-10

## Goal

Create a new Solax skill in `../clawperator-skills` using a real manual
recording captured from the Samsung Galaxy device, then use the lessons from
that concrete flow to define a durable repo-local authoring skill for future
recording-to-skill work.

Primary deliverable:

- a working Solax skill in `../clawperator-skills`

Secondary deliverable:

- a persistent repo-local Codex skill at
  `.agents/skills/skill-author-by-recording/`

## Constraints

- Use the branch-local Node CLI build from `apps/node/`.
- Prefer the debug Operator APK:
  `com.clawperator.operator.dev`.
- Treat `tasks/recording/demo/*` as temporary working notes only.
- Put durable workflow guidance in the persistent skill or real docs, not in
  this task folder.
- Do not try to generalize the reusable authoring skill before the Solax skill
  exists and has been validated end to end.

## Working Checklist

- [ ] Confirm the current recording and scaffold docs still match the merged
      code paths we will rely on.
- [ ] Confirm the target device and operator package we will use for the live
      recording run.
- [ ] Define the Solax skill intent and target skill id before scaffolding.
- [ ] Run a real manual recording session for the Solax dialog flow on the
      Galaxy device.
- [ ] Pull the raw NDJSON recording into `../clawperator-skills`.
- [ ] Export the recording context artifact for authoring.
- [ ] Scaffold the new Solax skill into `../clawperator-skills` using
      `--recording-context`.
- [ ] Inspect the recording artifacts and turn the captured flow into reusable
      skill logic rather than a one-off replay.
- [ ] Validate the Solax skill on-device and note any reliability gaps.
- [ ] Update `tasks/recording/demo/findings.md` throughout the work with:
      commands used, artifact paths, observed gaps, and decisions.
- [ ] Distill the stable parts of the workflow into
      `.agents/skills/skill-author-by-recording/`.
- [ ] Decide whether durable docs in `docs/skills/` also need an update based
      on what we learned.
- [ ] Remove this task folder once the durable knowledge has been migrated and
      the Solax work is complete.

## Definition Of Done

- The new Solax skill exists in `../clawperator-skills` with recording context
  captured as reference evidence.
- The Solax skill has been validated against the intended device flow, not only
  scaffolded.
- `findings.md` records the concrete workflow, gaps, and improvements we
  discovered while doing the work.
- The reusable repo-local authoring skill exists with instructions that reflect
  the real Solax implementation experience.
