# Findings: Skill Authorship Prompt Review

Date: 2026-04-19
Scope: review the drafted prompt, verify the referenced paths, point future agents at the real source surfaces, and tighten the prompt so it is easier to execute truthfully.

## Executive Summary

The draft is directionally strong, but it currently underspecifies the actual source-of-truth surfaces an agent would need to inspect.

The biggest gaps are:

- it focuses mostly on this repo and misses the sibling runtime-skills repo `../clawperator-skills/`, where authored skills, generated indexes, and repo-local authoring rules actually live
- it mentions discoverability, but it does not explicitly include the host-agent discovery docs and install surfaces that currently carry that responsibility
- it talks about possible new authorship workflows, but it does not clearly separate current-state audit from future design recommendation
- it asks for PR-history learning, but it does not tell the future agent which recurring failure classes to look for
- it does not ask for a concrete output shape beyond “document your findings”, which risks an unfocused report

There is also one real doc gap in the current repo:

- [`docs/internal/design/skill-design.md`](../../../docs/internal/design/skill-design.md) points to `../skills/skill-from-recording.md` at lines 15-17, but that file does not exist

## Verified Paths From The Draft

These references were checked locally.

- [`../../../.agents/skills/skill-author-by-recording/SKILL.md`](../../../.agents/skills/skill-author-by-recording/SKILL.md) exists
- [`../../../docs/skills/overview.md`](../../../docs/skills/overview.md) exists
- [`../../../docs/skills/authoring.md`](../../../docs/skills/authoring.md) exists
- [`../../../docs/skills/development.md`](../../../docs/skills/development.md) exists
- [`../../../docs/skills/runtime.md`](../../../docs/skills/runtime.md) exists
- [`../../../.agents/skills/evals-run/SKILL.md`](../../../.agents/skills/evals-run/SKILL.md) exists
- [`../../../.agents/skills/evals-live-run/SKILL.md`](../../../.agents/skills/evals-live-run/SKILL.md) exists
- [`../../../evals/`](../../../evals/) exists
- [`../../../docs/internal/openclaw-reference.md`](../../../docs/internal/openclaw-reference.md) exists
- [`../../../docs/internal/design/agent-host-integration.md`](../../../docs/internal/design/agent-host-integration.md) exists
- [`../../../docs/internal/design/skill-design.md`](../../../docs/internal/design/skill-design.md) exists

Additional related surfaces that are not in the draft but should be:

- [`../../../docs/host-agents.md`](../../../docs/host-agents.md)
- [`../../../docs/api/recording.md`](../../../docs/api/recording.md)
- [`../../../docs/api/environment.md`](../../../docs/api/environment.md)
- [`../../../sites/landing/public/install.sh`](../../../sites/landing/public/install.sh)
- [`../../../apps/node/src/cli/commands/authoringSkills.ts`](../../../apps/node/src/cli/commands/authoringSkills.ts)
- [`../../../apps/node/src/domain/skills/copyAuthoringSkills.ts`](../../../apps/node/src/domain/skills/copyAuthoringSkills.ts)
- [`../../../apps/node/src/contracts/skills.ts`](../../../apps/node/src/contracts/skills.ts)
- [`../../../apps/node/src/contracts/skillResult.ts`](../../../apps/node/src/contracts/skillResult.ts)
- [`../../../apps/node/src/domain/skills/runSkill.ts`](../../../apps/node/src/domain/skills/runSkill.ts)
- [`../../../apps/node/src/domain/skills/validateSkill.ts`](../../../apps/node/src/domain/skills/validateSkill.ts)
- [`../../../apps/node/src/domain/skills/scaffoldSkill.ts`](../../../apps/node/src/domain/skills/scaffoldSkill.ts)
- [`../../../apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`](../../../apps/node/src/adapters/skills-repo/localSkillsRegistry.ts)
- [`../../../../clawperator-skills/AGENTS.md`](../../../../clawperator-skills/AGENTS.md)
- [`../../../../clawperator-skills/README.md`](../../../../clawperator-skills/README.md)
- [`../../../../clawperator-skills/scripts/generate_skill_indexes.sh`](../../../../clawperator-skills/scripts/generate_skill_indexes.sh)
- [`../../../../clawperator-skills/docs/`](../../../../clawperator-skills/docs/)
- `~/.clawperator/findings/skill-drafting/findings.md`

## Term And Contract Source Map

Use these files when the prompt talks about a concept and the future agent needs the actual definition.

| Topic | Source | Why it matters |
| --- | --- | --- |
| runtime skills vs authoring skills | [`docs/skills/overview.md`](../../../docs/skills/overview.md) lines 32-45 | clarifies that runtime skills and authoring skills are separate models |
| `replay` vs `orchestrated` | [`docs/skills/overview.md`](../../../docs/skills/overview.md) lines 46-67 | current public definition and caveats |
| preferred recording-first authoring path | [`docs/skills/authoring.md`](../../../docs/skills/authoring.md) lines 7-24 | says `skill-author-by-recording` is the current front door |
| authoring-skills install model | [`docs/skills/authoring.md`](../../../docs/skills/authoring.md) lines 26-104 | explains copied install store and discovery symlinks |
| host-agent discovery route | [`docs/host-agents.md`](../../../docs/host-agents.md) lines 26-119 | covers discovery after install and durable host-facing files |
| OpenClaw / Telegram host framing | [`docs/internal/openclaw-reference.md`](../../../docs/internal/openclaw-reference.md) lines 27-55 | validates the “OpenClaw receives a Telegram and delegates” framing |
| host-agent integration implications | [`docs/internal/design/agent-host-integration.md`](../../../docs/internal/design/agent-host-integration.md) lines 69-195 | covers discovery conventions, install outputs, and preferred bridge order |
| recording export and compare | [`docs/api/recording.md`](../../../docs/api/recording.md) lines 314-577 | defines `recording export`, `recording compare`, wrapper requirements, and compare semantics |
| orchestrated harness env vars | [`docs/api/environment.md`](../../../docs/api/environment.md) lines 209-267 | defines env vars injected into `scripts/run.js` for orchestrated skills |
| `SkillResult` contract | [`apps/node/src/contracts/skillResult.ts`](../../../apps/node/src/contracts/skillResult.ts) lines 4-205 | authoritative frame prefix, statuses, source kinds, checkpoints, diagnostics, schema |
| `skill.json` contract and input schemas | [`apps/node/src/contracts/skills.ts`](../../../apps/node/src/contracts/skills.ts) lines 6-162 | authoritative `SkillEntry`, `agent`, `contract`, and supported input schemas |
| how orchestrated results are parsed and trusted | [`apps/node/src/domain/skills/runSkill.ts`](../../../apps/node/src/domain/skills/runSkill.ts) lines 42-289 | shows terminal frame parsing and trusted source injection |
| scaffolding behavior and `recording-context.json` | [`docs/skills/authoring.md`](../../../docs/skills/authoring.md) lines 137-243 and [`apps/node/src/domain/skills/scaffoldSkill.ts`](../../../apps/node/src/domain/skills/scaffoldSkill.ts) | explains what scaffold creates and what recording context is not |
| current authoring workflow rules | [`../../../.agents/skills/skill-author-by-recording/SKILL.md`](../../../.agents/skills/skill-author-by-recording/SKILL.md) lines 31-177 and 351-620 | front-door rules, decision table, self-test loop, compare-baseline policy |
| eval boundary | [`docs/internal/design/evals.md`](../../../docs/internal/design/evals.md) lines 1-280 and the two eval skills | useful context, but secondary to the main authoring surfaces |
| skills repo validation and generated indexes | [`../../../../clawperator-skills/AGENTS.md`](../../../../clawperator-skills/AGENTS.md) lines 52-80 and [`../../../../clawperator-skills/scripts/generate_skill_indexes.sh`](../../../../clawperator-skills/scripts/generate_skill_indexes.sh) lines 50-173 | explains why authoring work must include index regeneration and referenced-path checks |

## What The Draft Prompt Gets Right

- It centers the actual user problem: “make me a new skill that does this”.
- It correctly identifies two goals: lower the cost of creating new skills, and improve guidance and quality standards around skill authoring.
- It correctly suspects that discoverability matters as much as raw capability.
- It correctly calls out the main design fork: recording-first authoring versus a more agent-driven discovery flow.
- It correctly notices that PR hardening churn in `clawperator-skills` contains reusable lessons.

## Gaps In The Draft Prompt

### 1. It misses the runtime-skills repo

The draft mostly names files in `clawperator`, but authored runtime skills live in `../clawperator-skills/skills/`, and that repo also owns:

- repo-local authoring rules in `AGENTS.md`
- authoring guidance in `docs/`
- generated registry and search indexes
- shared helpers under `skills/utils/`

If the audit ignores that repo, it will miss where most authorship quality problems actually show up.

### 2. It does not point the future agent at the actual code contracts

If the goal is “agent-friendly and truthful”, the audit has to verify current behavior against code, not just docs.

The draft should explicitly require reading:

- `apps/node/src/contracts/skills.ts`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/skills/scaffoldSkill.ts`

Without those files, an agent can easily overgeneralize what skill types exist, what `contract.verification` can express, or what the runtime really trusts.

### 3. It says “discoverable” but does not name the discovery surfaces

The discoverability question is not just “does the Node API point to docs”.

The current host-facing surfaces are:

- `docs/host-agents.md`
- `~/.clawperator/AGENTS.md` as generated by `install.sh`
- authoring-skill discovery links created by `clawperator authoring-skills install`
- optional MCP material

The draft should ask the future agent to evaluate those surfaces explicitly.

### 4. It should verify the install and bundling story in code

The draft correctly worries that a new authoring skill would need to be bundled, but it should point to the real mechanism:

- `sites/landing/public/install.sh` lines 544-600 call `clawperator authoring-skills install`
- `apps/node/src/cli/commands/authoringSkills.ts` lines 37-64 invoke the copy flow
- `apps/node/src/domain/skills/copyAuthoringSkills.ts` lines 42-100 and 336 onward define the packaged source, install dir, and discovery-link wiring

That should be part of the future audit, otherwise the prompt invites speculative answers.

### 5. It mixes current-state audit with future design too early

Right now the prompt slides between:

- “what is the current skill creation process”
- “what should improve”
- “should we add a new authoring skill”
- “should an agent first yolo a UI flow and then record it”

Those are related, but they are not the same task. The future agent should be told to separate:

- current system inventory
- friction points and evidence
- option set
- recommendation

### 6. It does not explicitly ask for repo-boundary recommendations

Some likely improvements belong in `clawperator`, some in `clawperator-skills`, and some in install-distributed authoring skills.

The prompt should require the future agent to label each recommendation as one of:

- main repo docs or runtime
- skills repo docs or runtime skill conventions
- install / host-discovery behavior
- authoring-skill workflow changes

### 7. It under-specifies how to use the PR-history evidence

The two referenced PRs are useful, but the prompt should tell the future agent what to extract from them:

- contract drift
- generated index drift
- shared helper bypass
- diagnostics truthfulness
- parser edge cases
- verification-state semantics
- privacy hygiene

Those are the repeated classes that appeared in the PR feedback and in the local findings note at `~/.clawperator/findings/skill-drafting/findings.md`.

### 8. It should acknowledge tool availability for PR review

The draft says “if you use `gh`”, but a future agent may not have GitHub auth or may have a connector instead.

The prompt should say:

- inspect PRs 27 and 29 if GitHub access is available
- otherwise note the limitation and continue with repo-local evidence

### 9. It does not give the future agent a concrete output shape

The current “document your findings” ask is too open-ended.

The prompt should require:

1. current-state map
2. friction / gaps
3. design options
4. recommendation
5. open questions
6. suggested follow-up work breakdown

### 10. It misses one current doc bug

`docs/internal/design/skill-design.md` points to `docs/skills/skill-from-recording.md`, but that page does not exist. The audit should capture this because it is exactly the kind of discoverability gap that hurts future agents.

## Early Read On The Main Design Fork

The future audit should not assume that one answer is already correct.

The real design choices appear to be:

1. keep `skill-author-by-recording` as the only front door and make it broader
2. add a sibling authoring skill such as `skill-author-by-agent-discovery`
3. keep recording-first authoring, but add a pre-recording discovery workflow or helper
4. support a hybrid flow where the agent explores, proves a route, then records a cleaner baseline pass

The prompt should ask the future agent to compare those options against:

- truthfulness
- ease of use from an OpenClaw / Telegram request
- testability
- install and bundling complexity
- discoverability for host agents
- maintenance burden across `clawperator` and `clawperator-skills`

## Recurring Lessons Already Visible In The Evidence

From the local findings note and the cited PRs, the future prompt should explicitly tell the agent to look for:

- drift between declared contract and what the skill can actually prove
- failure to regenerate `skills/generated/*` after metadata changes
- duplicate helper logic instead of shared helper reuse
- diagnostics that are verbose but misleading
- positional or parser ambiguity in skill inputs
- screenshot or parsing edge cases that create false confidence
- confusion between runtime failure and verification failure
- missing privacy hygiene in code, docs, and PR metadata

## Recommended Tightened Prompt

Use the following as the next-pass agent prompt.

```markdown
High-level goal: audit the Clawperator skill authorship flow and recommend improvements that make it easier for an agent to create new skills and easier for humans and agents to author them safely and truthfully.

This is a findings pass only. Do not implement product changes yet. Gather current-state evidence, identify gaps, compare design options, and write the findings to `tasks/skills/authorship/findings-codex-1.md`.

## Questions To Answer

1. What is the current end-to-end authorship flow for creating a new skill today?
2. What documentation, code contracts, install surfaces, and discovery surfaces already support that flow?
3. Where are the biggest friction points for an agent that receives a natural-language request such as:
   "Make a Clawperator skill that opens Netflix, searches for House of Cards, and adds it to My List."
4. What guidance is currently missing or too hard to discover for safe skill authoring?
5. Should we keep a single `skill-author-by-recording` front door, add a sibling discovery-oriented authoring skill, or use some hybrid?
6. Which improvements belong in `clawperator`, which belong in `clawperator-skills`, and which belong in install-distributed authoring skills?

## Required Reading

### Current repo

- `.agents/skills/skill-author-by-recording/SKILL.md`
- `.agents/skills/evals-run/SKILL.md`
- `.agents/skills/evals-live-run/SKILL.md`
- `docs/skills/overview.md`
- `docs/skills/authoring.md`
- `docs/skills/development.md`
- `docs/skills/runtime.md`
- `docs/host-agents.md`
- `docs/api/recording.md`
- `docs/api/environment.md`
- `docs/internal/openclaw-reference.md`
- `docs/internal/design/agent-host-integration.md`
- `docs/internal/design/skill-design.md`
- `docs/internal/design/evals.md`

### Current repo code contracts

- `apps/node/src/contracts/skills.ts`
- `apps/node/src/contracts/skillResult.ts`
- `apps/node/src/domain/skills/runSkill.ts`
- `apps/node/src/domain/skills/validateSkill.ts`
- `apps/node/src/domain/skills/scaffoldSkill.ts`
- `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts`
- `apps/node/src/domain/skills/copyAuthoringSkills.ts`
- `apps/node/src/cli/commands/authoringSkills.ts`
- `sites/landing/public/install.sh`

### Sibling skills repo

- `../clawperator-skills/AGENTS.md`
- `../clawperator-skills/README.md`
- `../clawperator-skills/docs/skill-development-workflow.md`
- `../clawperator-skills/docs/skill-authoring-guidelines.md`
- `../clawperator-skills/docs/device-prep-and-runtime-tips.md`
- `../clawperator-skills/scripts/generate_skill_indexes.sh`
- inspect at least one replay example and one orchestrated example under `../clawperator-skills/skills/`, especially the Google Home examples

### Additional evidence

- `~/.clawperator/findings/skill-drafting/findings.md`
- if GitHub access is available, inspect the discussion history of `clawperator-skills` PRs 27 and 29 for recurring authoring hardening issues; if unavailable, note the limitation and continue

## Working Rules

- Verify every behavioral claim against code or docs. Do not rely on memory.
- Separate current-state facts from proposed future design.
- Be explicit about repo boundaries: `clawperator` vs `clawperator-skills` vs install-distributed authoring skills.
- Treat discoverability as a first-class part of the problem, not just documentation volume.
- Pay special attention to how an OpenClaw-style host agent would discover and use this workflow after install.
- Call out any broken or missing doc links you find.

## Specific Areas To Analyze

1. The current recording-first workflow and where it is strong or weak.
2. Whether agent-driven exploration before recording is desirable, risky, or both.
3. Whether a new authorship skill should exist, and if so whether it should be:
   - a split from `skill-author-by-recording`
   - a sibling skill such as `skill-author-by-agent-discovery`
   - a helper used by the existing front door
   - or not a new skill at all
4. What best-practice guidance should become mandatory for skill authors, especially around:
   - truthful verification
   - helper reuse
   - generated index regeneration
   - testing and self-test expectations
   - privacy hygiene
   - personalized-local versus shared-general skills
5. How new authoring skills would actually be packaged and installed today.

## Deliverable Shape

Write `tasks/skills/authorship/findings-codex-1.md` with these sections:

1. Scope and method
2. Verified current-state map
3. Source map for key terms and contracts
4. Friction points and discoverability gaps
5. Design options with tradeoffs
6. Recommended direction
7. Open questions
8. Candidate follow-up work breakdown for a later task pack

Where useful, link directly to the files that support a claim.
```

## Suggested Reading Order For The Future Agent

This order will probably produce the cleanest result:

1. `skill-author-by-recording`
2. `docs/skills/overview.md`
3. `docs/skills/authoring.md`
4. `docs/host-agents.md`
5. `docs/internal/openclaw-reference.md`
6. `docs/internal/design/agent-host-integration.md`
7. `apps/node/src/contracts/skills.ts`
8. `apps/node/src/contracts/skillResult.ts`
9. `apps/node/src/domain/skills/runSkill.ts`
10. `apps/node/src/domain/skills/scaffoldSkill.ts`
11. `apps/node/src/domain/skills/copyAuthoringSkills.ts`
12. `sites/landing/public/install.sh`
13. `../clawperator-skills/AGENTS.md`
14. `../clawperator-skills/docs/*`
15. exemplar skills in `../clawperator-skills/skills/`
16. local findings note and PR history

## Concrete Findings To Preserve For The Next Phase

- The current canonical front door is still recording-first, not exploration-first.
- The current public docs already distinguish runtime skills from authoring skills, but the draft prompt should force the next agent to inspect both models.
- Discoverability is partly a docs problem and partly an install/on-disk artifact problem.
- New authoring-skill proposals have to be evaluated against the real install flow, not just the idea of “bundling”.
- The strongest reusable authoring lessons currently appear to be in the sibling `clawperator-skills` repo and the PR hardening history, not only in this repo’s public docs.
