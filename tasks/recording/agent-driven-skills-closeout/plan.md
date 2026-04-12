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

- W2b v1 may be codex-only at runtime. `skill.json.agent.cli` for the Solax
  proving skill is `codex` and the current orchestrated harness is written for
  the codex `exec` command shape. The runtime path is not expected to be
  portable to other agent CLIs in W2b v1.
- If W2b is codex-only in practice, that limitation must be explicit in the
  skill, the public skill docs, and the task-pack language. "codex v1" must
  show up as a documented constraint, not as an assumed default.
- Replay remains first-class and valid. Nothing in this pack should imply all
  skills must be orchestrated. The replay sibling
  (`com.solaxcloud.starter.set-discharge-to-limit-replay`) must not be edited
  or re-shaped by this pack.
- Hidden runtime toggles are out of bounds. If an execution-mode or sandbox
  behavior is required, it must be declared in `skill.json.agent` (or an
  equivalent public contract surface) and documented, not smuggled in through
  a private env knob.
- Reliability remains a hard ship gate for the skills-side PR. One successful
  live run is evidence, not closure. The 10-run protocol from
  `agent-driven-skills/work-breakdown.md` P4 applies unchanged and must be
  executed against a physical Samsung device.
- `runSkill` is the single authority on the `SkillResult` contract. Orchestrated
  harnesses must not re-implement the parser.

## In Scope

- Clawperator runtime and docs fixes still needed for truthful W2b closeout
- Clawperator public documentation of the new orchestrated runtime env-var
  surface so agents and integrators can see the injected fields
- Solax orchestrated harness cleanup (thinning, removing local-machine
  coupling, removing hidden toggles, removing duplicated contract parsing)
- Solax skill/docs updates required by the codex-only W2b v1 decision
- repeated-run reliability validation and evidence capture
- task/doc status updates needed once the closeout work is genuinely complete

## Out Of Scope

- future non-codex runtime support (reviewers must not gate this pack on
  generic CLI portability)
- shared orchestrated harness helpers / a generic thin-harness utility
- richer parse sub-codes for `SKILL_RESULT_PARSE_FAILED`
- W3 `skill.json.contract`
- W4 compare work
- any replay sibling rework

## Must-Fix Outcomes

### Clawperator repo

1. When `skill.json.agent` is present but malformed, `runSkill` must return a
   typed failure in all paths (including the legacy non-framed path), instead
   of silently downgrading to scripted execution. The existing
   "legacy permissive for non-framed output" test must be tightened so
   permissiveness only applies when `agent` is absent, not when it is
   present-but-broken.
2. Public docs must list `SKILL_AGENT_CLI_UNAVAILABLE` in the error-code
   reference surface at `docs/skills/overview.md`.
3. Public docs must document the orchestrated runtime env-var contract injected
   by `runSkill` into agent-driven harnesses: `CLAWPERATOR_SKILL_AGENT_CLI`,
   `CLAWPERATOR_SKILL_AGENT_CLI_PATH`, `CLAWPERATOR_SKILL_AGENT_TIMEOUT_MS`,
   `CLAWPERATOR_SKILL_PROGRAM`, `CLAWPERATOR_SKILL_INPUTS`,
   `CLAWPERATOR_SKILL_ID`, and the skill-scoped use of `CLAWPERATOR_DEVICE_ID`.
   These are part of the public orchestrated contract and must appear in
   `docs/api/environment.md` or the skills authoring page (or both).

### Skills repo

1. The Solax orchestrated harness must become a truthful thin wrapper for the
   codex runtime path. Codex-specific invocation shape is allowed (W2b v1
   decision) but Solax-specific runtime logic is not.
2. Skill logic, navigation guidance, checkpoint semantics, Samsung-specific
   coordinate hints, prompt construction, and result-shape authority must live
   in `SKILL.md`, not in `scripts/run.js`. `SKILL.md` already contains the
   runtime program; the harness cleanup is mostly a deletion job.
3. The harness must not re-implement the `SkillResult` contract parser. The
   duplicated `parseFinalSkillResultFrame` and hardcoded `CHECKPOINT_IDS` in
   `scripts/run.js` must be removed. `runSkill` is the authoritative parser.
4. The harness must not assume a sibling-repo layout or branch-local build
   paths. Anything derived from `../clawperator` or
   `apps/node/dist/cli/index.js` must be removed. `CLAWPERATOR_BIN` supplied by
   the parent process is the single source of truth for the Clawperator CLI
   path; the harness must not synthesise its own fallback.
5. `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` must be removed. Before that removal,
   a bypass-dependency probe (C2.0 in the work breakdown) must run against the
   physical Samsung target *with the bypass unset*, and the outcome must be
   committed under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`.
   If the probe succeeds, delete the toggle in C2. If the probe fails citing
   codex sandbox or approval policy, the bypass must be promoted into a
   declared field on `skill.json.agent` and documented; it must not be
   preserved as a hidden env var.
6. The orchestrated skill (and, if needed, `docs/skills/authoring.md` and
   `docs/skills/overview.md`) must explicitly state that W2b v1 orchestrated
   skills are currently codex-only at runtime. The limitation must be visible,
   not implicit.
7. P4 reliability evidence must be captured and committed under
   `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
   before the skills-side PR can be called ready.

## Expected Outputs

- Clawperator code/doc fixes for the remaining runtime and public-doc gaps,
  including tightened malformed-agent rejection, the error-code table update,
  and the orchestrated env-var contract documentation
- committed C2.0 probe evidence under
  `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/probe-no-bypass/`
  recording whether the current skill reaches terminal verification on the
  physical Samsung target with `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` unset
- a materially thinner Solax orchestrated `scripts/run.js` with no duplicate
  contract parser, no sibling-repo assumption, no hidden bypass toggle, and no
  Solax-specific prompt construction beyond the minimum needed to hand
  `SKILL.md` to codex
- `SKILL.md` unchanged as the source of truth, or updated only to absorb any
  runtime policy that was previously hidden in the harness
- explicit codex-only W2b v1 language wherever the skill's runtime shape is
  described
- committed reliability artifacts under
  `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
- honest task-pack status updates in both this pack and the original
  `agent-driven-skills/` pack once the reliability threshold is actually met

## Validation Requirements

### Clawperator repo

```bash
npm --prefix apps/node run build
npm --prefix apps/node run test
./scripts/docs_build.sh
```

In addition:

- a focused unit test must assert that `runSkill` returns a typed failure when
  `skill.json.agent` is present but malformed, for both framed and non-framed
  script output
- `clawperator doctor --json` should still complete without halting on a host
  where the configured agent CLI is absent (advisory warn, not fail)

### Skills repo and live proving

Use the branch-local build of the Clawperator CLI, not the globally installed
binary. When multiple devices are connected, explicitly target the physical
Samsung.

```bash
# validate the orchestrated skill
CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
node apps/node/dist/cli/index.js skills validate \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated --json

# run a single proving invocation end-to-end
CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
node apps/node/dist/cli/index.js skills run \
  com.solaxcloud.starter.set-discharge-to-limit-orchestrated \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --output json -- 40
```

The replay sibling must keep running unchanged as a control:

```bash
CLAWPERATOR_SKILLS_REGISTRY=../clawperator-skills/skills/skills-registry.json \
node apps/node/dist/cli/index.js skills run \
  com.solaxcloud.starter.set-discharge-to-limit-replay \
  --device <device_serial> \
  --operator-package com.clawperator.operator.dev \
  --output json -- 40
```

If the replay sibling regresses as a side-effect of this pack, the closeout is
not complete.

## Definition Of Done

This closeout pack is done only when all of the following are true:

- `runSkill` hard-rejects malformed `skill.json.agent` in every path, covered
  by regression tests
- `SKILL_AGENT_CLI_UNAVAILABLE` appears in the public error-code reference
- the orchestrated runtime env-var contract is documented on a public docs
  surface
- the C2.0 bypass-dependency probe has been executed on the physical Samsung
  target with `CLAWPERATOR_SKILL_AGENT_ALLOW_BYPASS` unset, and the outcome is
  committed as evidence for the delete-vs-promote decision
- the Solax orchestrated harness is thin enough to serve as a truthful W2b v1
  codex reference, with no sibling-repo coupling, no duplicated SkillResult
  parser, and no hidden bypass toggle (or, if the probe forced a contract
  promotion, the new `skill.json.agent` field is declared and documented
  instead of the env var)
- the codex-only W2b v1 limitation is documented honestly in the skill and in
  the public skill docs
- the 10-run P4 reliability protocol has been executed on a physical Samsung
  device and recorded under
  `docs/internal/design/reliability/solax-discharge-to-limit-orchestrated/`
- the reliability threshold is either met (≥8/10 runs reached terminal
  verification with `status: success`, zero `runtime_poisoned` states, and at
  least one forced-failure run produced a truthful failed/indeterminate result
  without poisoning the runtime) and recorded, or clearly not met and W2b
  remains open
- the replay sibling still runs end-to-end without regression
- this closeout pack and the original `agent-driven-skills/` pack both reflect
  reality without mixing completed W2b work with in-flight closeout work
