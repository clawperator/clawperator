# Agent-Driven Skills Closeout (W2b Follow-Up)

## Purpose

This pack exists to close the remaining `skills/agent-driven` branch gaps after
the main W2b runtime work landed.

Use this pack as the implementation checklist for the remaining branch work.
Do not use `tasks/recording/agent-driven-skills/` as the active to-do list for
this phase. That pack now serves mainly as the runtime-shape source of truth
and status history for W2b itself.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Depends on | `agent-driven-skills/` P1-P3 |
| Primary repos | `../clawperator`, `../clawperator-skills` |
| Current / Next | close macro-review gaps, then finish P4 reliability |
| Ship gate | PRs are not ready until this pack is complete |

## Context

The macro review found that the Clawperator runtime side is close to ready, but
the skills-side Solax orchestrated proving path still has meaningful branch-
closure work left.

This pack keeps the remaining work narrow:

- close the remaining contract and docs gaps in the Clawperator repo
- turn the Solax orchestrated skill into a truthful W2b v1 proving reference
- complete the required reliability evidence

## Durable Decisions

- W2b v1 may be codex-only at runtime.
- If W2b is codex-only in practice, that limitation must be explicit in the
  skill, docs, and task-pack language.
- Replay remains first-class and valid. Nothing in this pack should imply all
  skills must be orchestrated.
- Hidden runtime toggles are out of bounds. If an execution-mode or sandbox
  behavior is required, it must be declared and documented, not smuggled in
  through a private env knob.
- Reliability remains a hard ship gate for the skills-side PR. One successful
  live run is evidence, not closure.

## In Scope

- Clawperator fixes still needed for truthful W2b closeout
- Solax orchestrated harness cleanup
- Solax skill/docs updates required by the codex-only W2b v1 decision
- repeated-run reliability validation and evidence capture
- task/doc status updates needed once the closeout work is genuinely complete

## Out Of Scope

- future non-codex runtime support
- shared orchestrated harness helpers
- richer parse sub-codes for `SKILL_RESULT_PARSE_FAILED`
- W3 `skill.json.contract`
- W4 compare work

## Must-Fix Outcomes

### Clawperator repo

1. Malformed `skill.json.agent` must fail clearly instead of silently falling
   back to scripted execution.
2. Public docs must list `SKILL_AGENT_CLI_UNAVAILABLE` in the error-code
   reference surface.

### Skills repo

1. The Solax orchestrated harness must become a truthful thin wrapper for the
   codex runtime path.
2. Skill logic, navigation guidance, checkpoint semantics, and result-shape
   authority must live in `SKILL.md`, not in `scripts/run.js`.
3. The harness must not assume sibling-repo layout or branch-local build paths.
4. Any hidden sandbox or approval bypass behavior must be removed or promoted
   into declared, documented contract.
5. The proving skill must document that W2b v1 is codex-based if that remains
   the actual shipped limitation.
6. P4 reliability evidence must be captured and committed before the skills-side
   PR can be called ready.

## Expected Outputs

- Clawperator code/doc fixes for the remaining runtime and public-doc gaps
- a materially thinner Solax orchestrated `scripts/run.js`
- corresponding `SKILL.md` updates so the runtime program is the real authority
- committed reliability artifacts under `docs/internal/design/reliability/`
- honest task-pack status updates once the reliability threshold is actually met

## Validation Requirements

### Clawperator repo

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

### Skills repo and live proving

```bash
CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
node apps/node/dist/cli/index.js skills validate \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated --json

CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
node apps/node/dist/cli/index.js skills run \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --output json -- 40
```

When multiple devices are connected, explicitly target the physical Samsung.

## Definition Of Done

This closeout pack is done only when all of the following are true:

- the Clawperator repo no longer has the remaining malformed-agent/docs gaps
- the Solax orchestrated harness is thin enough to serve as a truthful W2b v1
  codex reference
- no hidden runtime toggle is required to understand how the proving skill runs
- the codex-only limitation is documented honestly where relevant
- the 10-run P4 reliability protocol has been executed and recorded
- the reliability threshold is either met and documented, or clearly not met and
  W2b remains open
- the task-pack status files reflect reality without mixing completed W2b work
  with this closeout checklist
