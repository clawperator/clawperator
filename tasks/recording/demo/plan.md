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

Status note:

- This plan is historical context only. The active workstreams now live under
  sibling folders in `tasks/recording/`.
- It predates the W2b correction that makes orchestrated skills agent-driven
  at runtime. Do not use this file as guidance for the orchestrated runtime
  shape.
- The repo-local authoring skill is deferred and must not be revived from this
  checklist until the top-level recording plan explicitly unblocks it.

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

- [x] Confirm the current recording and scaffold docs still match the merged
      code paths we will rely on.
- [x] Confirm the target device and operator package we will use for the live
      recording run.
- [x] Define the Solax skill intent and target skill id before scaffolding.
- [x] Confirm the Samsung device can use the debug operator variant for a live
      recording run.
- [x] Run a real manual recording session for the Solax dialog flow on the
      Galaxy device.
- [x] Pull the raw NDJSON recording into `../clawperator-skills`.
- [x] Export the recording context artifact for authoring.
- [x] Scaffold the new Solax skill into `../clawperator-skills` using
      `--recording-context`.
- [ ] Inspect the recording artifacts and turn the captured flow into reusable
      authoring evidence rather than treating it as a one-off replay.
- [x] Validate the Solax skill on-device and note any reliability gaps.
- [ ] Update `tasks/recording/demo/findings.md` throughout the work with:
      commands used, artifact paths, observed gaps, and decisions.
- [ ] Distill the stable parts of the workflow into
      `.agents/skills/skill-author-by-recording/`.
      Deferred. Superseded by `tasks/recording/plan.md`.
- [x] Decide whether durable docs in `docs/skills/` also need an update based
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

Historical note: the actual end-state for the orchestrated runtime skill now
lives in W2b and W6, not in this file.
