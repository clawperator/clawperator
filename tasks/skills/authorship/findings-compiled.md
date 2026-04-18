# Skill Authorship Findings — Compiled

Prepared: 2026-04-19  
Scope: findings pass only. No implementation, no task packs, no new runtime skills.

## Executive summary

Clawperator already has a strong evidence-first authoring workflow once the team
has decided to create a skill. The current front door,
[`skill-author-by-recording`](../../../.agents/skills/skill-author-by-recording/SKILL.md),
is concrete, honest about replay versus orchestrated tradeoffs, requires a
self-test, and keeps the result inspectable through retained evidence and
`SkillResult`.

The bigger gap is earlier in the flow. For a request like:

> "Make a Clawperator skill that opens Netflix, searches for House of Cards, and adds it to My List."

the current system can truthfully tell a host agent that no installed runtime
skill exists, but it does not give the agent a first-class next step. Today the
path from "no skill found" to "we should author one" is under-specified. That
forces the agent to improvise discovery, scope, recording readiness, and the
first truthful skill shape.

The second gap is durable guidance. The best contracts and authoring guidance
live in `clawperator`, but the place where authors actually add and harden
runtime skills is `../clawperator-skills`. That repo currently has thinner local
guidance, broken README-linked docs in this checkout, and repeated PR review
patterns around verification drift, generated index drift, helper duplication,
diagnostics truthfulness, parser ambiguity, and privacy hygiene.

**Verdict:** keep the two follow-up problems separate for execution, but not for
analysis.

- One shared findings pass is the right shape.
- The follow-up should split into:
  - Track A: agent-assisted skill drafting and discovery-to-proving workflow
  - Track B: durable skill creation guidance and repo-surface hardening
- A small shared prerequisite pass should land first to repair broken guidance
  surfaces and tighten a few low-risk guardrails.

## Scope and method

This synthesis merges:

- [findings-claude.md](./findings-claude.md)
- [findings-codex-1.md](./findings-codex-1.md)
- [findings-codex-2.md](./findings-codex-2.md)

Approach:

- Kept only the highest-signal points.
- Deduplicated overlapping observations.
- Resolved conflicts where local verification was possible.
- Preserved tradeoffs where the right answer is still a design decision.

## Verified current-state map

### Core source-of-truth surfaces

| Area | Primary sources | What they establish |
| --- | --- | --- |
| Runtime skill contract | [apps/node/src/contracts/skills.ts](../../../apps/node/src/contracts/skills.ts), [apps/node/src/contracts/skillResult.ts](../../../apps/node/src/contracts/skillResult.ts), [apps/node/src/domain/skills/runSkill.ts](../../../apps/node/src/domain/skills/runSkill.ts) | Registry shape, declared verification, `SkillResult`, terminal frame parsing, trusted source injection |
| Authoring workflow | [docs/skills/authoring.md](../../../docs/skills/authoring.md), [skill-author-by-recording](../../../.agents/skills/skill-author-by-recording/SKILL.md) | Recording-first front door, self-test requirement, replay/orchestrated choice, compare-baseline rules |
| Host-agent path | [docs/host-agents.md](../../../docs/host-agents.md), [docs/internal/design/agent-host-integration.md](../../../docs/internal/design/agent-host-integration.md), [sites/landing/public/install.sh](../../../sites/landing/public/install.sh) | Installed discovery route favors runtime-skill lookup first |
| Runtime skill author surface | [../../../../clawperator-skills/AGENTS.md](../../../../clawperator-skills/AGENTS.md), [../../../../clawperator-skills/README.md](../../../../clawperator-skills/README.md), [../../../../clawperator-skills/scripts/generate_skill_indexes.sh](../../../../clawperator-skills/scripts/generate_skill_indexes.sh) | Skills-repo rules, layout, and generated-index contract |
| Prior hardening evidence | `~/.clawperator/findings/skill-drafting/findings.md`, PR 27, PR 29 | Repeated authoring failure patterns are real and recurring |

### Ownership by surface

| Surface | Owns | Does not own |
| --- | --- | --- |
| `clawperator` | runtime contracts, CLI/API, validator, install flow, public docs, packaged authoring skills | shipped runtime skill packages |
| `../clawperator-skills` | runtime skill folders, generated registry/indexes, examples, repo-local contribution surface | runtime wrapper semantics, install behavior |
| install-distributed authoring skills | prompt-side workflows an agent can invoke directly | durable runtime-skill guidance as the only source of truth |

### Resolved source conflicts

- The missing `../clawperator-skills/docs/*` files are a real gap in this
  checkout. `README.md` advertises local docs such as
  `docs/skill-development-workflow.md`, `docs/skill-authoring-guidelines.md`,
  and `docs/device-prep-and-runtime-tips.md`, but those files are absent.
- The packaged authoring-skills source path is **not** a root-level mismatch.
  [`copyAuthoringSkills.ts`](../../../apps/node/src/domain/skills/copyAuthoringSkills.ts)
  resolves to `apps/node/authoring-skills/`, and in this checkout that directory
  exists and contains a symlinked `skill-author-by-recording` entry.

## Current-state synthesis

### What already works well

- The recording-first authoring workflow is unusually concrete.
- The runtime contract is strict and well documented.
- Replay and orchestrated are treated as equally legitimate maintained shapes.
- `recording export` is clearly treated as evidence, not as the runtime program.
- The retained compare baseline has a defined home:
  `skills/<id>/references/compare-baseline.export.json`.
- The current workflow requires a self-test and keeps the repair loop inside the
  authored skill instead of calling the job done after scaffolding.

### What fails closed today

- The host-agent discovery route is good at answering "what can I run now?" and
  weak at answering "what should I do when nothing exists yet?"
- In the anchor scenario, the runtime discovery path returns zero installed
  skills and offers no authored next step.
- There is no first-class discovery phase for unfamiliar app routes before
  recording.
- The raw scaffold path is materially weaker than the real authoring workflow.
  It creates starter files, but it does not encode the truthfulness rules,
  proving discipline, or helper patterns shown in current exemplars.

## Track A: agent-drafted skill workflow

### Synthesis

The current front door,
[`skill-author-by-recording`](../../../.agents/skills/skill-author-by-recording/SKILL.md),
is the right **proving** workflow, not the full **discovery-to-authoring**
workflow.

That distinction matters:

- It is strong once a team knows a new skill should be authored now.
- It is weaker at helping an agent become ready to record in the first place.

For unfamiliar flows, the missing step is not "better scaffolding." It is a
discovery and routing phase that helps the agent answer:

- does an existing runtime skill already solve this request?
- is the result likely personalized-local or shared-general?
- is the route understood well enough to record now?
- is replay or orchestrated the truthful first proving shape?

### High-signal gaps

- No first-class discovery phase before recording.
- No documented "zero results, now author" path in host-facing guidance.
- No packaged sibling authoring skill for discovery-first work.
- Raw scaffold output is not strong enough to serve as the agent’s front door.
- The only declared verification kind today is `node_text_matches`, which may
  be too narrow for some richer app-state proofs.

### Compiled recommendation

Use a **hybrid model**.

- Keep recording-first as the default proving workflow.
- Add an explicit discovery-first phase for unfamiliar or cold-start requests.
- Keep the boundary clear: discovery decides whether and how to author; the
  proving workflow turns evidence into a real skill plus self-test.

The exact surface should stay open for Track A:

- likely candidates are a sibling authoring skill,
- a discovery-oriented CLI probe,
- or a combination of both.

The key recommendation is the boundary, not the exact naming.

## Track B: skill creation guidance

### Synthesis

Guidance exists, but it is split across the wrong surfaces for daily authoring.

- `clawperator` contains the strongest contract and design guidance.
- `../clawperator-skills` is where contributors actually author and harden
  runtime skills.
- The skills repo currently lacks a strong local author checklist and, in this
  checkout, even advertises missing docs.

That means authors learn the quality bar from a mix of:

- main-repo docs,
- exemplar skills,
- PR review,
- and private/local findings.

That is workable for maintainers. It is not a clean authoring system.

### High-signal gaps

- Skills-repo README advertises missing local docs.
- `AGENTS.md` in `../clawperator-skills` is thinner than the current review
  burden demands.
- The validator does not replace author guidance. It proves structure, not
  truthfulness.
- Some conventions remain unenforced, such as the `clawperator-skill-type`
  convention.

### Compiled recommendation

Treat guidance as a **co-location problem**, not just a content problem.

- Keep runtime contracts and public docs canonical in `clawperator`.
- Move runtime-skill drafting guardrails closer to authors in
  `../clawperator-skills`.
- Repair or remove the broken README-promised docs.
- Promote repeated PR-hardening lessons into durable, repo-local guidance.

## Recurring failure patterns

The three findings docs were highly consistent here. The repeated PR issues are
not noise; they form the real authoring backlog.

### 1. Verification drift

- Skills declare verification stronger than what they actually prove.
- This is especially visible when `contract.verification` claims
  `node_text_matches` but the real proof path is screenshot-based, heuristic, or
  otherwise indirect.

### 2. Generated index drift

- Registry changes are often made without regenerating `skills/generated/*`.
- The generator script already makes this contract concrete, but authors still
  miss it often enough that review keeps catching it.

### 3. Shared helper bypass

- Authors still duplicate logic that should come from shared helpers, especially
  package resolution and parsing/decoding helpers.

### 4. Diagnostics that overstate reality

- Review repeatedly catches success/failure messages that reference deleted
  files, hide the real failure layer, or dump raw noise instead of a bounded
  summary.

### 5. Parser ambiguity and robustness

- Argument parsing and lightweight parsers are a recurring source of fragile
  behavior and false confidence.

### 6. Privacy hygiene outside code

- Real device ids, labels, or local paths leak not only into code, but also
  into examples, validation notes, and PR metadata.

## Design options and verdict

| Option | Summary | Verdict |
| --- | --- | --- |
| Recording-first only | Keep `skill-author-by-recording` as the only front door | Too narrow for the anchor scenario |
| Extend `skill-author-by-recording` | Add discovery behavior inside the existing skill | Possible, but risks making a good proving workflow too broad |
| Helper tooling only | Add docs/scripts but no new front-door surface | Too weak on orchestration and host-agent routing |
| Hybrid | Separate discovery and proving while keeping recording-first intact | Best fit |

### Why hybrid wins

- It preserves the strongest part of the current system instead of replacing it.
- It matches the actual problem shape: unfamiliar flows need discovery before
  recording, but still need an evidence-first proving pass afterward.
- It allows cleaner ownership:
  - Track A focuses on workflow routing and host-agent UX.
  - Track B focuses on durable guidance and quality bar.

## Recommended direction

### Shared prerequisite pass

Before Track A and Track B, land a small prerequisite pass that:

- repairs or removes the broken `../clawperator-skills/README.md` doc links
- migrates the high-value local findings into a durable repo surface
- considers low-risk mechanical guardrails such as:
  - validating `clawperator-skill-type` more explicitly
  - adding a generated-index freshness check
  - tightening scaffold output where it clearly lags exemplar practice

### Track A owner focus

Primary owners:

- `clawperator`
- install-distributed authoring skills

Work should define:

- the discovery-first phase for unfamiliar skill requests
- the handoff into recording/proving
- the host-agent route when runtime discovery returns zero matches

### Track B owner focus

Primary owners:

- `../clawperator-skills`
- selective cross-links back to `clawperator`

Work should define:

- the repo-local author checklist
- repaired or consolidated local guidance docs
- mandatory drafting rules near the skill packages themselves

## Recommended split for future task packs

### Task pack A: agent-assisted skill drafting

Scope:

- host-agent entry from natural-language request
- existing-skill reuse versus new-skill routing
- discovery-before-recording behavior for unfamiliar routes
- handoff into proving workflow
- install-distributed authoring-skill implications

### Task pack B: skill creation guidance

Scope:

- skills-repo author checklist and local docs
- restored or consolidated missing README-promised docs
- durable codification of PR-hardening lessons
- clear ownership boundaries between main-repo docs and skills-repo guidance

### Why split

- Track A is workflow and host-agent UX.
- Track B is quality bar and author guidance.
- They touch different surfaces, different repos, and likely different review
  cadences.

Bundling them would make the work slower and blur success criteria.

## Open questions

1. What is the best discovery surface for Track A: sibling prompt-skill, CLI
   probe, or both?
2. What is the minimum discovery output that is trustworthy enough to justify
   recording?
3. Should personalized-local versus shared-general be an explicit early
   decision in the workflow?
4. Is `node_text_matches` enough as the only declared verification kind for the
   next wave of skills, or should richer declared verification be expected?
5. What is the right durable home in `../clawperator-skills` for local
   guidance: `AGENTS.md`, restored `docs/`, a contributor checklist, or a
   combination?
6. Which low-risk prerequisite guardrails should land before the bigger Track A
   and Track B task packs?
