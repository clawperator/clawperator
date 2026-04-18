# Agent Prompt: Skill Authorship Findings Pass

Created: 2026-04-19

Audit the current Clawperator skill authorship story and document the findings in `tasks/skills/authorship/<provided_file_name>.md`.

This is a findings pass only.

- Do not implement product changes.
- Do not create task packs yet.
- Do not run `$task-author` yet.
- Do not create `plan.md` or `work-breakdown.md` in this pass.

The goal is to gather enough grounded context that a later pass can use
`$task-author` to create the right follow-up task packs.

## Goal

Evaluate two related but distinct tracks:

1. How an agent should draft a new Clawperator runtime skill from a natural-language request.
2. How Clawperator should provide durable guidance, best practices, testing expectations, and structure for safe skill authoring.

Analyze both tracks together in this findings pass, but keep them explicitly
separated in the writeup.

## Concrete scenario

Use this scenario as the anchor case:

> "Make a Clawperator skill that opens Netflix, searches for House of Cards, and adds it to My List."

Assume a host agent such as OpenClaw receives that request through a surface
like Telegram and wants to figure out:

- what Clawperator can already do
- how a new skill would be authored today
- what the agent would struggle with
- what the best future design should be

## Working rules

1. Verify behavioral claims against code and docs. Do not rely on memory.
2. Assume `gh` is available and use it for the PR-history portion.
3. Separate current-state facts from recommendations.
4. Keep repo boundaries explicit:
   - `clawperator` main repo
   - sibling `../clawperator-skills` repo
   - install-distributed authoring-skills surfaces
5. Treat discoverability as a first-class part of the problem, not a side note.
6. Call out broken or missing docs, missing links, or misleading source surfaces.
7. Do not propose implementation details as if they already exist.
8. If you recommend future task-pack splits, describe them, but do not author them yet.

## Required reading

Read these IN THIS ORDER before writing anything.

| File | Why it matters |
| --- | --- |
| `.agents/skills/skill-author-by-recording/SKILL.md` | Current front-door authoring workflow and decision rules |
| `docs/skills/overview.md` | Runtime skills vs authoring skills, replay vs orchestrated |
| `docs/skills/authoring.md` | Public authoring guidance and install model |
| `docs/skills/development.md` | Local development and validation loop |
| `docs/skills/runtime.md` | Runtime expectations, device handling, and env rules |
| `docs/host-agents.md` | Current host-agent discovery route after install |
| `docs/internal/openclaw-reference.md` | OpenClaw mental model and why Telegram-style host usage matters |
| `docs/internal/design/agent-host-integration.md` | Durable host-agent integration rules and discovery assumptions |
| `docs/internal/design/skill-design.md` | Durable skill design lessons and current doc gaps |
| `docs/internal/design/evals.md` | Eval boundary and where skill-proving work currently lives |
| `docs/api/recording.md` | Recording export and compare contracts |
| `docs/api/environment.md` | Orchestrated runtime env-var contract |
| `apps/node/src/contracts/skills.ts` | Skill registry, `agent`, and `contract` source of truth |
| `apps/node/src/contracts/skillResult.ts` | `SkillResult` contract source of truth |
| `apps/node/src/domain/skills/runSkill.ts` | Runtime parsing and trusted orchestrated behavior |
| `apps/node/src/domain/skills/validateSkill.ts` | What validation does and does not guarantee |
| `apps/node/src/domain/skills/scaffoldSkill.ts` | What `skills new` actually scaffolds |
| `apps/node/src/domain/skills/copyAuthoringSkills.ts` | How packaged authoring skills are installed and wired |
| `apps/node/src/cli/commands/authoringSkills.ts` | CLI surface for authoring-skills install/update/list |
| `apps/node/src/adapters/skills-repo/localSkillsRegistry.ts` | Runtime skill discovery and registry resolution |
| `sites/landing/public/install.sh` | Installer behavior, AGENTS.md writing, and authoring-skills setup |
| `../clawperator-skills/AGENTS.md` | Runtime-skills repo rules and validation expectations |
| `../clawperator-skills/README.md` | Skills-repo layout and its own docs surfaces |
| `../clawperator-skills/docs/skill-development-workflow.md` | Current shortest-path workflow from exploration to reusable skill |
| `../clawperator-skills/docs/skill-authoring-guidelines.md` | Quality bar and authoring conventions in the skills repo |
| `../clawperator-skills/docs/device-prep-and-runtime-tips.md` | Device and runtime-prep guidance that may affect authoring |
| `../clawperator-skills/scripts/generate_skill_indexes.sh` | Generated-index and referenced-path contract |
| `~/.clawperator/findings/skill-drafting/findings.md` | Existing lessons from real skill drafting and PR hardening |

Also inspect at least:

- one replay example under `../clawperator-skills/skills/`
- one orchestrated example under `../clawperator-skills/skills/`

Prefer the Google Home examples because they currently capture both skill
shapes and recent authorship lessons.

## Required PR-history review

Use `gh` to inspect the discussion history of these PRs in
`clawperator/clawperator-skills`:

- PR 27
- PR 29

Read enough review discussion to extract recurring failure patterns around:

- contract drift
- generated index drift
- helper reuse versus copy-paste logic
- diagnostics truthfulness
- parser ambiguity
- verification-state semantics
- privacy hygiene

Do not just summarize the PRs. Extract the reusable authoring lessons.

## Core questions to answer

1. What is the current end-to-end skill authorship flow today?
2. What parts of that flow already work well for agents?
3. What parts are too hard to discover, too underspecified, or too brittle?
4. What is the current role of `skill-author-by-recording`, and where does it stop being enough?
5. What would an agent struggle with if asked to create a new skill directly from a user request?
6. Is recording-first still the right front door, or should discovery-first or hybrid flows exist?
7. If an agent explores first and records later, what are the truthfulness, testing, and UX risks?
8. What guidance should become more explicit for skill authors, especially around:
   - testing
   - structure
   - helper reuse
   - truthful verification
   - personalized-local versus shared-general skills
   - generated index regeneration
9. Which improvements belong in:
   - `clawperator`
   - `../clawperator-skills`
   - install-distributed authoring skills
10. Should the eventual follow-up work stay grouped, or should it split into separate task packs for:
   - agent-assisted skill drafting
   - skill authoring guidance

## Specific areas to analyze

### Track A: Agent-drafted skill workflow

Evaluate:

- how an agent would go from user request to first working draft today
- whether the current system expects recording before it has enough route knowledge
- whether there should be a distinct agent-discovery phase before recording
- whether a new authoring skill is warranted
- whether the right shape is:
  - extending `skill-author-by-recording`
  - adding a sibling skill such as `skill-author-by-agent-discovery`
  - adding helper tooling without a new top-level skill
  - or a hybrid workflow

### Track B: Skill creation guidance

Evaluate:

- whether the current docs and repo guidance are sufficient
- what guidance is missing or not discoverable enough
- what best practices should be mandatory for authors
- what mistakes keep appearing in authored skills and PR review
- where the durable guidance should live:
  - public docs
  - `clawperator-skills/AGENTS.md`
  - repo-local authoring skills
  - other canonical docs

### Shared concerns across both tracks

Evaluate:

- install and bundling implications of new authoring skills
- host-agent discovery after install
- runtime skill discovery versus prompt-skill discovery
- validation expectations and self-test expectations
- repo-boundary ownership

## Deliverable structure

Write `tasks/skills/authorship/<provided_file_name>.md` with these sections:

1. Executive summary
2. Scope and method
3. Verified source map
4. Current-state map
5. Track A findings: agent-drafted skill workflow
6. Track B findings: skill creation guidance
7. Shared issues and dependencies
8. Recurrent lessons from PR history and existing findings
9. Design options and tradeoffs
10. Recommended direction
11. Recommended split for future task packs
12. Open questions

## Output expectations

The findings document should be useful to an EM or tech lead deciding what work
to schedule next.

That means:

- concise executive summary first
- current-state facts clearly separated from proposals
- recommendations labeled by owner surface
- concrete references to code and docs where terms are defined
- explicit note of broken or missing docs if found
- explicit recommendation on whether follow-up work should split into separate task packs

## Important constraints

- Do not create implementation diffs in this pass.
- Do not author new skills in this pass.
- Do not create task packs in this pass.
- Do not drift into generic documentation advice. Keep it specific to the real Clawperator authoring workflow.
- Do not treat PR review history as anecdotal noise. Use it as evidence for where authorship guidance and workflow design are currently failing.
- Do not confuse runtime skills with authoring skills or host-agent prompt-skills.
