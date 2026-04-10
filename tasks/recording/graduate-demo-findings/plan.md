# Graduate Demo Findings

## Executive Summary

Move durable lessons out of `tasks/recording/demo/` into real documentation and
then delete the temporary demo task files that no longer carry unique value.

This is downstream of the earlier recording work and should happen once the
relevant guidance has a stable long-term home in `docs/`.

## Status

| Item | Value |
| --- | --- |
| State | blocked |
| Total PRs | 1 |
| Total phases | 2 |
| Completed | none |
| Remaining | P1, P2 |
| Current / Next | blocked on W2 sequencing clarity |
| Blockers | durable guidance should land after W1/W2 shape is stable |

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

