# Graduate Demo Findings

## Executive Summary

Move durable lessons out of `tasks/recording/demo/` into real documentation and
then delete the temporary demo task files that no longer carry unique value.

This is downstream of the earlier recording work and should happen once the
relevant guidance has a stable long-term home in `docs/`.

## Status

| Item | Value |
| --- | --- |
| State | active (wave A) / blocked (wave B) |
| Total PRs | 2 |
| Total phases | 4 |
| Completed | none |
| Remaining | P1A, P2A, P1B, P2B |
| Current / Next | P1A — recording-as-evidence facts can graduate now |
| Blockers | wave B blocked on W2 (`skill-result-contract`) wording stabilizing |

## Two-Wave Structure

The durable findings split cleanly into two groups:

- **Wave A — recording and operations facts.** These do not depend on
  `SkillResult` shape, contract declaration, or compare existing. They are
  about how recording behaves as evidence, how to operate the device during
  recording, and how the operator package and accessibility service interact.
  Wave A can graduate as soon as W1 (`skill-checkpoints`) is in flight,
  because the wording does not depend on later contract decisions.
- **Wave B — skill contract and authoring facts.** These describe the
  `SkillResult` shape, terminal verification expectations, and declared
  contract behavior. Wave B is blocked on W2 because the wording must match
  the shipped contract.

Splitting the wave lets durable recording knowledge land sooner without
trapping wave B behind a wording change later.

## Goal

Graduate the durable operational knowledge from the Solax recording demo into
the authored docs, then retire the temporary demo task files.

## In Scope

- move durable recording lessons into `docs/api/recording.md`
- move durable skill-authoring lessons into `docs/skills/authoring.md`
- run docs build validation
- delete superseded demo task files once their content is fully migrated

## Out of Scope

- new runtime behavior
- compare implementation
- skill implementation changes beyond doc references

## Decision Rules

- only graduate durable knowledge, not timeline/history
- delete demo task files only after their durable content exists elsewhere
- prefer rewriting docs clearly over preserving the exact wording from findings

## Output Contract

This task should produce:

- updated durable docs
- validated docs build
- a reduced or deleted `tasks/recording/demo/` footprint

