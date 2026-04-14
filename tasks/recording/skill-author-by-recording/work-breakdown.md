# Skill Author By Recording Work Breakdown

Parent plan: `tasks/recording/skill-author-by-recording/plan.md`

## Executive Summary

Total PRs: 3. Total phases: 3.

- P1: create the replay-first front-door workflow from scratch
- P2: extend the created workflow to handle the orchestrated authoring path
- P3: validate the full story against the Solax demo path and graduate durable
  guidance

Current state: the skill directory does not exist yet. P1 creates it.

## Status

| Item | Value |
| --- | --- |
| State | active |
| Total PRs | 3 |
| Total phases | 3 |
| Completed | problem-definition pass, plan-tightening pass, and P1 |
| Remaining | P2 (orchestrated path), P3 (demo validation) |
| Current / Next | P2 |
| Blockers | none |

## Starting Point

`.agents/skills/skill-author-by-recording/` does not exist. P1 creates it.
Do not look for existing files to edit. Read the plan and required reading
list first, then create the skill directory and `SKILL.md` from scratch.

## Hard Rules

- Do not claim that the recording alone generates a reliable skill.
- Do not hide the intermediate artifacts. The workflow must surface them.
- Do not imply the recording export becomes the runtime program. The export is
  authoring evidence.
- Do not hardcode the Solax proving case into the front-door workflow. The
  workflow must be able to help author a developer's own skill id and goal.
- Do not make first-time users learn replay versus orchestrated before they can
  create a skill.
- Do not skip showing the orchestrated code and verification logic when the
  orchestrated path is chosen.
- Do not declare authoring done until the newly written skill has been invoked
  once and its emitted `SkillResult` is inspectable.
- Keep one human-facing entrypoint: `skill-author-by-recording`.
- If helper skills are introduced, they sit behind that entrypoint.
- Reuse the named orchestrated runtime contract from
  `docs/skills/overview.md#orchestrated-runtime-contract`.
- Do not introduce a top-level skill named `skill-author-orchestrator`.
- Do not require both replay and orchestrated output variants in the first pass
  unless the task explicitly calls for both.
- Do not expand this task into bundled runtime-family work such as a single
  registry skill with internal replay and orchestrated subfolders.

## Required Reading

| File | Why it matters |
| --- | --- |
| `tasks/recording/skill-author-by-recording/problem-definition.md` | Refined product framing and north star |
| `tasks/recording/skill-author-by-recording/plan.md` | Stable scope and ordered delivery shape |
| `tasks/recording/video-draft.md` | Demo north star |
| `docs/api/recording.md` | Recording lifecycle commands and artifacts |
| `docs/skills/authoring.md` | Scaffold and authoring contract |
| `docs/skills/overview.md` | Named orchestrated runtime contract |
| `docs/internal/design/skill-design.md` | Durable orchestrated skill design lessons and failure modes |
| `apps/node/src/contracts/skillResult.ts` | Universal `SkillResult` return shape |
| `apps/node/src/domain/skills/runSkill.ts` | Runtime parsing and injected source behavior |

Read these files in the listed order before writing anything.

## PR / Phase Plan

| PR | Purpose | Included phases | Agent tier | Merge gate |
| --- | --- | --- | --- | --- |
| PR-1 | Replay-first workflow creation | P1 | `thinking` | Do not start PR-2 until PR-1 intent and wording are accepted |
| PR-2 | Orchestrated-path closeout | P2 | `default` | Do not start PR-3 until PR-2 wording and workflow shape are accepted |
| PR-3 | Demo validation and graduation | P3 | `default` | Final closeout after earlier phases are landed |

## Phase P1: Replay-First Workflow Creation

Status: complete

### Agent Tier

`thinking`

### Goal

Tighten the front-door workflow so it truthfully supports "record once, author
the right skill shape" while defaulting to replay-first authoring when replay
is sufficient.

### Files or Surfaces To Change

- `.agents/skills/skill-author-by-recording/SKILL.md`
- `.agents/skills/skill-author-by-recording/agents/openai.yaml`
- `tasks/recording/skill-author-by-recording/plan.md` if wording drift is
  discovered during implementation
- `tasks/recording/skill-author-by-recording/work-breakdown.md` only if the
  execution steps need to be tightened further

### Acceptance Criteria

- The task pack and repo-local skill explicitly say that the workflow authors
  one requested or recommended skill shape per pass.
- The default recommendation is replay when the captured flow is replay-safe.
- The workflow still honors an explicit user request for `-orchestrated` or
  `-replay`.
- The workflow explicitly includes:
  - capture or confirm the target skill id, plain-language goal, and device
    context
  - run recording start, tell the human when to perform the flow, then stop
    and pull
  - export the recording artifact
  - sanitize and retain the baseline under
    `skills/<skill_id>/references/compare-baseline.export.json`
  - analyze the export and recommend or apply the right skill shape
  - author the chosen skill shape
  - run one self-test invocation of the authored skill
  - show the key generated files and surface the `SkillResult`
- The workflow makes the "how" visible to a developer by surfacing the concrete
  recording/export commands and resulting files.
- The workflow distinguishes clearly between:
  - authoring evidence
  - replay script logic
  - orchestrated runtime program plus thin harness
- The workflow keeps the Solax proving case separate from the generic path.

### Steps

1. Read the required reading list in full before writing anything.
2. Create `.agents/skills/skill-author-by-recording/` and write `SKILL.md`
   from scratch. The skill does not exist yet.
3. Write `SKILL.md` as an agent-program that embodies the replay-first default:
   - gather skill id, goal, and device context up front
   - start recording, prompt human to perform the flow, stop and pull
   - export and sanitize the recording artifact
   - analyze the export and recommend replay or orchestrated with explicit
     reasoning
   - author the chosen shape
   - run one self-test invocation and surface the `SkillResult`
4. Make the replay-first default explicit without claiming replay is mandatory
   for every flow.
5. Keep explicit support for a direct orchestrated or replay request.
6. Create `agents/openai.yaml` aligned with the skill program.
   Use `.agents/skills/task-author/agents/openai.yaml` as the exemplar for
   structure and field shape.
7. Confirm the written skill points to durable docs and does not invent a
   parallel contract.

### Validation

```bash
# Confirm the skill was created
ls .agents/skills/skill-author-by-recording/

# Spot-check content
sed -n '1,260p' .agents/skills/skill-author-by-recording/SKILL.md
sed -n '1,120p' .agents/skills/skill-author-by-recording/agents/openai.yaml

# Check for stale anti-patterns
rg -n "orchestrated path first|only continue with orchestrated|less real" .agents/skills/skill-author-by-recording tasks/recording/skill-author-by-recording
```

### Expected Commit

```text
docs(recording): align skill-author-by-recording workflow
```

## Phase P2: Orchestrated Path Closeout

Status: pending

### Agent Tier

`default`

### Goal

Close out the orchestrated authoring path so the same front-door workflow can
truthfully produce an orchestrated skill when replay would not be sufficient or
when the user explicitly asks for orchestrated.

This phase is the second authoring pass after P1. P1 creates the skill from
scratch and establishes the replay-first front-door workflow. P2 extends that
newly created workflow so it also handles the orchestrated branch cleanly and
truthfully.

### Files or Surfaces To Change

- `.agents/skills/skill-author-by-recording/SKILL.md`
- `docs/skills/authoring.md` if durable public authoring guidance needs to be
  tightened
- `tasks/recording/skill-author-by-recording/plan.md`
- `tasks/recording/skill-author-by-recording/work-breakdown.md`

### Acceptance Criteria

- The repo-local skill reuses the durable orchestrated runtime contract wording
  from `docs/skills/overview.md#orchestrated-runtime-contract`.
- The workflow uses the recording export and optional user clarification to
  author orchestrated `SKILL.md`, `skill.json`, and thin `run.js`.
- The retained compare baseline rules remain explicit and truthful.
- The workflow makes clear that replay and orchestrated are peers, but the
  workflow is now intentionally taking the more advanced orchestrated branch.
- A developer can still use the workflow for a non-Solax skill without editing
  the skill first.

### Steps

1. Start from the skill created in P1. Do not re-plan the front-door workflow
   from scratch.
2. Add or tighten the orchestrated branch of the repo-local workflow so it
   clearly describes when replay is not sufficient and what the second authoring
   pass must produce.
3. Confirm the workflow still reuses the durable orchestrated runtime contract
   rather than redefining it.
4. Update durable docs only if the current public guidance is missing a rule
   this workflow genuinely depends on.
5. Recheck the task-pack wording so P2 still reads as a bounded second pass,
   not a runtime-family expansion.

### Validation

```bash
sed -n '1,260p' .agents/skills/skill-author-by-recording/SKILL.md
sed -n '1,260p' docs/skills/authoring.md
rg -n "bundled runtime-family|mandatory dual-authoring|replay-first detour" tasks/recording/skill-author-by-recording
```

### Expected Commit

```text
docs(recording): tighten orchestrated skill-authoring path
```

## Phase P3: Demo Validation And Graduation

Status: pending

### Agent Tier

`default`

### Goal

Run the workflow against the Solax proving case and make sure the resulting
experience is understandable from start to finish, while keeping the generic
workflow framing truthful.

### Files or Surfaces To Change

- `.agents/skills/skill-author-by-recording/SKILL.md`
- `docs/skills/authoring.md`
- `tasks/recording/video-draft.md` only if a real scope mismatch is discovered
- `tasks/recording/skill-author-by-recording/plan.md`
- `tasks/recording/skill-author-by-recording/work-breakdown.md`

### Acceptance Criteria

- A developer can follow the workflow and understand:
  - what was recorded
  - how the recording evidence informed the authored skill
  - how replay and orchestrated differ when each is chosen
  - how the orchestrated skill is split across `SKILL.md`, `skill.json`, and
    the thin `run.js` when the orchestrated path is demonstrated
  - how the brain/hand model is embodied in code and in the first-run
    `SkillResult`
- The chosen decomposition still feels like one workflow to the user rather
  than a menu of competing authoring skills.
- The workflow's default narrative preserves replay as a first-class category
  and does not redefine the whole product story as orchestrated-only just
  because the demo path is orchestrated.
- `docs/skills/authoring.md` includes a concrete "debugging a failed
  orchestrated run" section covering the minimum set a developer reads: agent
  stderr stream, `SkillResult.checkpoints`, and compare output when a recording
  baseline exists.
- Any other durable guidance discovered here is migrated into
  `docs/skills/authoring.md`.

### Steps

1. Run a reality check against the Solax demo path using the repo-local
   workflow as the entrypoint.
2. Record any discovered mismatches between the demo script and the actual
   workflow behavior.
3. Fix the workflow or docs when the mismatch is a real product gap.
4. Only adjust the video draft if the gap is genuinely not in scope and needs
   explicit renegotiation.
5. Update the task pack status and closeout notes to reflect the final state.

### Validation

```bash
sed -n '1,260p' tasks/recording/video-draft.md
sed -n '1,260p' .agents/skills/skill-author-by-recording/SKILL.md
sed -n '1,260p' docs/skills/authoring.md
```

### Expected Commit

```text
docs(recording): validate skill-authoring demo closeout
```

## Closeout Notes

Expected closeout shape:

- keep one parent task pack until the final PR ships
- land the work in ordered reviewable PRs
- update this pack after each phase so sequencing stays explicit
- retire the pack only after the durable guidance is fully reflected in docs,
  code, and the repo-local skill
