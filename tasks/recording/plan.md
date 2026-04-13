# Recording Workstreams

## Purpose

This file is the top-level status index for `tasks/recording/` while the final
authoring workflow workstream remains open.

Use it to answer:

- which recording workstreams are finished and retired
- which task pack is still active
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

Retired temporary task folders:

- `tasks/recording/demo/`
- `tasks/recording/brain-hand-contract/`

Still active:

- W6 `skill-author-by-recording`

Supporting completed task packs still retained:

- `tasks/recording/orchestrated-skill-evals/`

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
| Eval workflow for repeated orchestrated proving | `evals/README.md` and `tasks/recording/orchestrated-skill-evals/` |
| Runtime and contract implementation | `apps/node/src/contracts/` and `apps/node/src/domain/skills/` |

## Remaining Sequence

Only W6 remains in the recording program.

Next step:

1. Execute `tasks/recording/skill-author-by-recording/`

## Retirement Rule

Completed recording task packs should be deleted once their still-true,
still-useful guidance has been verified against code and graduated into the
durable docs or code-adjacent contract surfaces.

Do not restore deleted packs as historical references. If a future agent needs
the information after task deletion, that information belongs in docs or code.
