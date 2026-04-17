# Install Onboarding Follow-Up Items

This file is now a pointer-only index.

As of 2026-04-17, the deferred items from the install/onboarding cleanup pack
no longer live only here. PR #196 remains scoped to shipped install/onboarding
behavior on `install/onboarding-impl2`, and the follow-up work now has durable
task-pack homes under `tasks/`.

## Current Pack Status

As of 2026-04-17, the install/onboarding cleanup implementation is complete on
`install/onboarding-impl2` and PR #196 carries the remaining review/merge work.
The items below are still intentionally out of scope for that PR and should not
be folded back into that task pack.

## Durable Homes

| Deferred item | Durable home | Why it is separate from PR #196 |
| --- | --- | --- |
| F6: skill preflight and first-run requirements metadata | `tasks/node/skill-preflight-metadata/` | Node and runtime-skill contract maturity work, including sibling `clawperator-skills` schema changes and runtime preflight behavior |
| D1: agent-facing docs IA and discoverability pass | `tasks/agent-host-orientation/` | Cross-surface public docs work that should simplify around the shipped onboarding behavior rather than reopen it |
| D2: CLI self-orientation and discoverability pass | `tasks/agent-host-orientation/` | Shell-surface guidance work that depends on the canonical docs flow from D1 and the shipped onboarding behavior from PR #196 |

## Notes

- `tasks/agent-host-orientation/` contains the durable implementation contract
  for D1 and D2, including PR boundaries, required reading, and validation.
- `tasks/node/skill-preflight-metadata/` contains the durable implementation
  contract for F6, including the paired `../clawperator-skills` work and runtime
  preflight boundaries.
- Keep `tasks/install/onboarding/` in place until PR #196 is merged and the
  onboarding pack is retired through the normal task-cleanup flow.
