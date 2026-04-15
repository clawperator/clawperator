# Recording Workstreams

## Purpose

This file is the top-level status index for `tasks/recording/` after the
recording-program implementation workstreams landed on the current branch.

Use it to answer:

- which recording workstreams are finished and retired
- whether any recording task pack is still active
- where the durable source of truth now lives after task-pack graduation

## Current Status

Retired completed workstreams:

- W1 `skill-checkpoints`
- W2 `skill-result-contract`
- W2b `agent-driven-skills`
- W2c `agent-driven-skills-closeout`
- W3 `skill-contract-declaration`
- W4 `compare`
- W4c `compare-closeout`
- W5 `graduate-demo-findings`
- `skill-author-by-recording`

Retired temporary task folders:

- `tasks/recording/demo/`
- `tasks/recording/brain-hand-contract/`

Still active:

- none

## Durable Sources Of Truth

The completed recording workstreams no longer own the durable contract. Future
agents should rely on these surfaces instead of the retired task packs.

| Area | Durable source |
| --- | --- |
| Recording lifecycle, export, parse, compare | `docs/api/recording.md` |
| Skill authoring workflow and `SkillResult` expectations | `docs/skills/authoring.md` |
| Orchestrated runtime contract | `docs/skills/overview.md` |
| Orchestrated skill design lessons | `docs/internal/design/skill-design.md` |
| Runtime env vars for agent-driven skills | `docs/api/environment.md` |
| Compare outcome and normalization semantics | `docs/api/recording.md` |
| Eval workflow for repeated orchestrated proving | `evals/README.md`, `docs/internal/design/evals.md`, and `evals/` |
| Runtime and contract implementation | `apps/node/src/contracts/` and `apps/node/src/domain/skills/` |

## Remaining Sequence

No recording workstreams remain open on the current branch.

Retirement step:

1. The recording program task packs can now be retired because the durable
   guidance lives in docs, code, the repo-local
   `.agents/skills/skill-author-by-recording/` workflow, and the maintained
   skills repo exemplars.

## Retirement Rule

Completed recording task packs should be deleted once their still-true,
still-useful guidance has been verified against code and graduated into the
durable docs or code-adjacent contract surfaces.

Do not restore deleted packs as historical references. If a future agent needs
the information after task deletion, that information belongs in docs or code.
