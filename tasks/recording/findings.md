# Recording Findings

## Purpose

Capture cross-cutting findings from the recording workstreams while the task
packs are still active.

This file is temporary, but it is the correct aggregation point for findings
that affect multiple recording sub-tasks. Durable guidance discovered here
should later graduate into `docs/` or repo-local skills instead of staying
only in `tasks/`.

## Orchestrated Skill Creation Findings

- The current orchestrated Solax runtime can enter a no-evidence stall where
  the device leaves the launcher or sits inside SolaX, but the runtime emits no
  command transcript and no final `SkillResult` frame.
- Per-run harness logs immediately exposed one concrete harness contract bug:
  the bootstrap `exec` payload omitted required `source`, so the first live
  bootstrap command was being rejected before any real app navigation happened.
- The codex runtime path can drift into unrelated system surfaces such as the
  Google app or voice-search flow before returning to SolaX. That is a real
  runtime failure mode, not harmless exploration.
- Tightening `SKILL.md` with strict-agentic wording helps define truthful
  success and failure behavior, but it does not by itself guarantee timely
  device actuation.
- Reliability capture for orchestrated skills needs its own watchdogs. Waiting
  only on the full runtime timeout is too slow and hides the failure shape.
- The orchestrated harness also needs explicit per-run artifact capture.
  Without a saved prompt, stdout log, stderr log, and small metadata file, a
  failed live run leaves too little evidence to distinguish prompt stall,
  runtime drift, or child-process failure.
- The minimum useful watchdog set is:
  - off-target surface detection
  - no-evidence stall detection
  - a hard elapsed-time cap
- When the task is to prove a setting change, a fixed repeated target can turn
  into a false-confidence no-op check. If the persisted value is already `40%`,
  then re-running the skill to set `40%` does not prove a real state change.
- A better reliability runner should carry the last known verified persisted
  value forward and choose the next target so it differs from that known value.
- Process-group handling for orchestrated reliability capture is easy to get
  wrong on macOS. If the runner does not manage child groups carefully,
  `codex exec` can outlive the parent skill run and muddy later observations.
- The proving-device SolaX flow is stateful. A live run may already be inside
  the `Peak Export` editor or `Discharge to` dialog, so an orchestrated skill
  that assumes `tab_intelligent` is always present can fail immediately even
  though it is still inside the correct app flow.
- On the current proving-device UI, clicking `Confirm` in the `Discharge to`
  dialog returns to the `Peak Export` editor. Waiting for `Discharge to` to
  reappear before handling the save actions is therefore the wrong assumption
  for this branch state.

## Gaps Exposed

- Orchestrated authoring guidance should explicitly warn that the runtime agent
  may wander into launcher search or Google voice-search surfaces if the
  allowed-app boundary is not stated clearly.
- Orchestrated reliability guidance should explicitly require proving that the
  target value changed from the last known persisted value, not merely that the
  final UI text matches the requested target.
- Orchestrated reliability guidance should include how to classify launcher
  stalls, unrelated-app drift, transcript-free hangs, and orphaned child
  processes during local validation.
- Orchestrated runtime debugging guidance should explicitly describe how to
  retain per-run logs and where to look for the prompt and Codex transcript
  when a live skill fails before emitting a `SkillResult`.
- Orchestrated authoring guidance should explicitly tell authors to document
  stateful entry surfaces and post-confirm screen transitions, not just the
  happy-path route from a cold app open.

## Follow-Up To Graduate

- Add general orchestrated-authoring guidance about allowed-app boundaries and
  anti-drift phrasing to durable skill-authoring docs.
- Add durable reliability guidance for orchestrated-skill validation loops,
  including watchdog expectations and target-change validation.
- Add durable debugging guidance for orchestrated skills so live failures do
  not require ad hoc harness edits before they become diagnosable.
- Keep the C3 evidence truthful even if the threshold is not met. These
  findings are here to improve the next iteration, not to soften the current
  outcome.
